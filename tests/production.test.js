import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WORKER_ROLE,
  WORKER_INFO,
  PRODUCTION_CAPACITY,
  BENCH_SIZE,
  STORAGE_CAPACITY,
  availableShopEntriesForRound,
  createGame,
  makeShop,
  purchaseShopWorker,
  purchaseShopWorkerToBench,
  moveWorker,
  mergeWorkerOnto,
  moveBenchWorkerToHouse,
  returnWorkerToBench,
  mergeBenchWorkerOnto,
  createWorker,
  finishRound,
  collectWorkerOutput,
  addInventoryStack,
  equipInventoryItem,
  useFood,
  addCatToBench,
  placeCat,
  createDog,
  resolveSection,
  CAT_COAT,
  purchaseShopFighterToBench,
  purchaseShopFighterToBoard,
  sellWorker,
  mergeInventoryItems,
  purchaseShopFighterOnto,
} from '../src/game-engine.js';

test('all four production worker roles are available immediately', () => {
  assert.deepEqual(Object.keys(WORKER_INFO).sort(), [
    WORKER_ROLE.ARMOURER,
    WORKER_ROLE.COOK,
    WORKER_ROLE.TRADER,
    WORKER_ROLE.WEAPONSMITH,
  ].sort());

  const workers = availableShopEntriesForRound(1)
    .filter((entry) => entry.category === 'worker')
    .map((entry) => entry.role)
    .sort();

  assert.deepEqual(workers, Object.values(WORKER_ROLE).sort());
});

test('round-one shared shop pool contains unlocked fighters and every worker definition', () => {
  const entries = availableShopEntriesForRound(1);
  const fighters = entries
    .filter((entry) => entry.category === 'fighter')
    .map((entry) => entry.coat);
  assert.equal(entries.length, 8);
  assert.deepEqual(fighters, [CAT_COAT.ORANGE, CAT_COAT.GREY, CAT_COAT.WHITE, CAT_COAT.CALICO]);
  assert.equal(entries.filter((entry) => entry.category === 'worker').length, 4);
  assert.equal(new Set(entries.map((entry) => `${entry.category}:${entry.coat ?? entry.role}`)).size, 8);
});

test('shop refreshes cap house cats as the shop expands', () => {
  for (const [round, size, maxHouseCats] of [[2, 3, 1], [5, 4, 2], [9, 5, 3]]) {
    const shop = makeShop(() => 0.999, null, round);
    assert.equal(shop.length, size);
    assert.equal(
      shop.filter((slot) => slot.category === 'worker').length,
      maxHouseCats,
      `round ${round} should show at most ${maxHouseCats} house cat${maxHouseCats === 1 ? '' : 's'}`,
    );
  }

  const opening = makeShop(() => 0.999, null, 1);
  assert.equal(opening.filter((slot) => slot.category === 'fighter').length, 2);
  assert.equal(opening.filter((slot) => slot.category === 'worker').length, 1);
});

test('saved house cats count toward the refresh cap', () => {
  const previous = makeShop(() => 0.999, null, 5);
  previous[0].saved = true;
  previous[1].saved = true;

  const refreshed = makeShop(() => 0.999, previous, 5);

  assert.equal(refreshed.filter((slot) => slot.category === 'worker').length, 2);
  assert.equal(refreshed[0].id, previous[0].id);
  assert.equal(refreshed[1].id, previous[1].id);
});

test('new games start with two active house slots, a three-cat workbench, and two full-size storage squares', () => {
  const game = createGame(() => 0.5);
  assert.equal(PRODUCTION_CAPACITY, 2);
  assert.equal(BENCH_SIZE, 3);
  assert.equal(STORAGE_CAPACITY, 2);
  assert.deepEqual(game.workers, Array(PRODUCTION_CAPACITY).fill(null));
  assert.deepEqual(game.bench, []);
  assert.deepEqual(game.inventory, Array(STORAGE_CAPACITY).fill(null));
});

test('fighter purchase charges only after a valid bench or battlefield drop', () => {
  let game = createGame(() => 0);
  game = purchaseShopFighterToBoard(game, 0, 12, 2);
  assert.equal(game.gold, 7);
  assert.equal(game.cats.length, 1);
  assert.equal(game.cats[0].row, 12);
  assert.equal(game.shop[0].sold, true);

  game = createGame(() => 0);
  game = purchaseShopFighterToBench(game, 0, 2);
  assert.equal(game.gold, 7);
  assert.equal(game.bench.length, 1);
  assert.equal(game.shop[0].sold, true);
});

test('shop fighter can merge directly while the target equipment survives', () => {
  let game = createGame(() => 0);
  game = addCatToBench(game, { level: 1, coat: CAT_COAT.ORANGE });
  game.bench[0].equipment.weapon = { tier: 3, attack: 3 };
  game.bench[0].attack += 3;
  const targetId = game.bench[0].id;

  game = purchaseShopFighterOnto(game, 0, 'bench', targetId);
  assert.equal(game.gold, 7);
  assert.equal(game.bench[0].copies, 2);
  assert.equal(game.bench[0].equipment.weapon.tier, 3);
  assert.equal(game.bench[0].attack, 7);
});

test('worker purchase charges only after a valid production-slot drop', () => {
  let game = createGame(() => 0);
  const rolls = [0.9, 0];
  let rollIndex = 0;
  game.shop = makeShop(() => rolls[rollIndex++ % rolls.length], null, 2);
  assert.equal(game.shop[0].role, WORKER_ROLE.COOK);

  const invalid = purchaseShopWorker(game, 0, 6);
  assert.equal(invalid, game);
  assert.equal(game.gold, 10);
  assert.equal(game.shop[0].sold, false);

  game = purchaseShopWorker(game, 0, 1);
  assert.equal(game.gold, 7);
  assert.equal(game.shop[0].sold, true);
  assert.equal(game.workers[1].role, WORKER_ROLE.COOK);
  assert.equal(game.workers[1].level, 1);
});

test('production cats can reserve, merge, and move between the workbench and either house slot', () => {
  let game = createGame(() => 0.5);
  game.shop = [{
    id: 'shop-worker', kind: 'production-cat', category: 'worker',
    role: WORKER_ROLE.COOK, level: 1, sold: false, saved: false,
  }];

  game = purchaseShopWorkerToBench(game, 0, 0);
  assert.equal(game.gold, 7);
  assert.equal(game.bench.length, 1);
  assert.equal(game.bench[0].role, WORKER_ROLE.COOK);

  game = moveBenchWorkerToHouse(game, 0, 1);
  assert.equal(game.bench.length, 0);
  assert.equal(game.workers[1].role, WORKER_ROLE.COOK);

  game = returnWorkerToBench(game, 1, 0);
  assert.equal(game.workers[1], null);
  assert.equal(game.bench[0].role, WORKER_ROLE.COOK);

  game.bench.push(createWorker(WORKER_ROLE.COOK));
  game = mergeBenchWorkerOnto(game, 1, 0);
  assert.equal(game.bench.length, 1);
  assert.equal(game.bench[0].copies, 2);
});

test('workers move only during prep and can finish a house merge from the workbench', () => {
  let game = createGame(() => 0.5);
  game.workers[0] = createWorker(WORKER_ROLE.COOK);
  game.workers[1] = createWorker(WORKER_ROLE.COOK);
  game.bench.push(createWorker(WORKER_ROLE.COOK));

  game = mergeWorkerOnto(game, 1, 0);
  assert.equal(game.workers[0].copies, 2);
  assert.equal(game.workers[1], null);

  game = moveBenchWorkerToHouse(game, 0, 0);
  assert.equal(game.workers[0].level, 2);
  assert.equal(game.workers[0].copies, 1);
  assert.equal(game.bench.length, 0);

  game = moveWorker(game, 0, 1);
  assert.equal(game.workers[0], null);
  assert.equal(game.workers[1].level, 2);
});

test('food and coins produce each battle while weapons and armour take two battles', () => {
  let game = createGame(() => 0.5);
  game.workers[0] = createWorker(WORKER_ROLE.COOK, 1);
  game.workers[1] = createWorker(WORKER_ROLE.TRADER, 2);
  game.workers[0].pendingOutput = { kind: 'food', quantity: 99 };
  game.phase = 'combat';
  game.dogs = [];

  game = finishRound(game);

  assert.deepEqual(game.workers[0].pendingOutput, { kind: 'food', quantity: 1 });
  assert.deepEqual(game.workers[1].pendingOutput, { kind: 'coins', quantity: 3 });

  game.workers[1] = createWorker(WORKER_ROLE.WEAPONSMITH, 3);

  game.phase = 'combat';
  game.dogs = [];
  game = finishRound(game);

  assert.equal(game.workers[1].pendingOutput, null);

  game.phase = 'combat';
  game.dogs = [];
  game = finishRound(game);

  assert.deepEqual(game.workers[1].pendingOutput, { kind: 'weapon', tier: 3, quantity: 1 });

  let armourGame = createGame(() => 0.5);
  armourGame.workers[0] = createWorker(WORKER_ROLE.ARMOURER, 2);
  armourGame.phase = 'combat';
  armourGame.dogs = [];
  armourGame = finishRound(armourGame);
  assert.equal(armourGame.workers[0].pendingOutput, null);

  armourGame.phase = 'combat';
  armourGame.dogs = [];
  armourGame = finishRound(armourGame);
  assert.deepEqual(armourGame.workers[0].pendingOutput, { kind: 'armour', tier: 2, quantity: 1 });
});

test('collection stacks identical items with no quantity limit and uses two distinct storage squares', () => {
  let game = createGame(() => 0.5);
  game = addInventoryStack(game, { kind: 'food', quantity: 999 });
  game = addInventoryStack(game, { kind: 'food', quantity: 2 });
  assert.equal(game.inventory[0].quantity, 1001);
  assert.equal(game.inventory.filter(Boolean).length, 1);

  game = addInventoryStack(game, { kind: 'weapon', tier: 1, quantity: 1 });
  assert.equal(game.inventory.filter(Boolean).length, 2);
  const full = game;
  assert.equal(addInventoryStack(game, { kind: 'armour', tier: 1, quantity: 1 }), full);
});

test('station item collection persists in inventory while merchant coins go directly to gold', () => {
  let game = createGame(() => 0.5);
  game.workers[0] = createWorker(WORKER_ROLE.COOK);
  game.workers[0].pendingOutput = { kind: 'food', quantity: 4 };
  game.workers[1] = createWorker(WORKER_ROLE.TRADER);
  game.workers[1].pendingOutput = { kind: 'coins', quantity: 3 };

  game = collectWorkerOutput(game, 0);
  assert.equal(game.inventory[0].kind, 'food');
  assert.equal(game.inventory[0].quantity, 4);
  assert.equal(game.workers[0].pendingOutput, null);

  game = collectWorkerOutput(game, 1);
  assert.equal(game.gold, 13);
  assert.equal(game.workers[1].pendingOutput, null);
});

test('weapons replace permanently', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 1, coat: CAT_COAT.ORANGE });
  game = addInventoryStack(game, { kind: 'weapon', tier: 1, quantity: 1 });
  game = equipInventoryItem(game, 0, 'bench', game.bench[0].id);
  assert.equal(game.bench[0].attack, 5);
  assert.equal(game.bench[0].equipment.weapon.tier, 1);

  game = addInventoryStack(game, { kind: 'weapon', tier: 3, quantity: 1 });
  const weaponIndex = game.inventory.findIndex((stack) => stack?.kind === 'weapon');
  game = equipInventoryItem(game, weaponIndex, 'bench', game.bench[0].id);
  assert.equal(game.bench[0].attack, 7);
  assert.equal(game.bench[0].equipment.weapon.tier, 3);
});

test('armour blocks damage for finite hits, always allows one damage, then breaks', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 1, coat: CAT_COAT.GREY });
  game = placeCat(game, 0, 10, 2);
  game.cats[0].attack = 0;
  game = addInventoryStack(game, { kind: 'armour', tier: 1, quantity: 1 });
  game = equipInventoryItem(game, 0, 'cat', game.cats[0].id);
  game.dogs = [createDog(1, 9, 2)];

  game = resolveSection(game);
  assert.equal(game.cats[0].hp, 16);
  assert.equal(game.cats[0].equipment.armour.uses, 2);

  game = resolveSection(game);
  assert.equal(game.cats[0].hp, 14);
  assert.equal(game.cats[0].equipment.armour.uses, 1);

  game = resolveSection(game);
  assert.equal(game.cats[0].hp, 12);
  assert.equal(game.cats[0].equipment.armour, null);
});

test('three same-tier equipment items merge upward and tier three is capped', () => {
  let game = createGame(() => 0.5);
  game = addInventoryStack(game, { kind: 'weapon', tier: 1, quantity: 3 });
  game = mergeInventoryItems(game, 0);
  assert.deepEqual(game.inventory[0], {
    id: game.inventory[0].id,
    kind: 'weapon',
    tier: 2,
    quantity: 1,
  });

  game = addInventoryStack(game, { kind: 'armour', tier: 3, quantity: 3 });
  const armourIndex = game.inventory.findIndex((stack) => stack?.kind === 'armour');
  assert.equal(mergeInventoryItems(game, armourIndex), game);
});

test('workers sell for one gold during prep and destroy pending output', () => {
  let game = createGame(() => 0.5);
  game.workers[1] = createWorker(WORKER_ROLE.COOK);
  game.workers[1].pendingOutput = { kind: 'food', quantity: 4 };
  game = sellWorker(game, 1);
  assert.equal(game.gold, 11);
  assert.equal(game.workers[1], null);
});

test('food heals two in a tactics window and is not consumed on full health', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 1, coat: CAT_COAT.ORANGE });
  game = placeCat(game, 0, 12, 2);
  game = addInventoryStack(game, { kind: 'food', quantity: 2 });
  game.phase = 'tactics';

  const full = useFood(game, 0, game.cats[0].id);
  assert.equal(full, game);
  assert.equal(game.inventory[0].quantity, 2);

  game.cats[0].hp = 2;
  game = useFood(game, 0, game.cats[0].id);
  assert.equal(game.cats[0].hp, 4);
  assert.equal(game.inventory[0].quantity, 1);
});
