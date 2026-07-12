import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WORKER_ROLE,
  WORKER_INFO,
  availableShopEntriesForRound,
  createGame,
  makeShop,
  purchaseShopWorker,
  moveWorker,
  mergeWorkerOnto,
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
  assert.equal(entries.length, 7);
  assert.equal(entries.filter((entry) => entry.category === 'fighter').length, 3);
  assert.equal(entries.filter((entry) => entry.category === 'worker').length, 4);
  assert.equal(new Set(entries.map((entry) => `${entry.category}:${entry.coat ?? entry.role}`)).size, 7);
});

test('ordinary shops can roll all workers while the opening shop guarantees two fighters', () => {
  const workerShop = makeShop(() => 0.999, null, 2);
  assert.equal(workerShop.length, 3);
  assert.equal(workerShop.every((slot) => slot.category === 'worker'), true);
  assert.equal(workerShop.every((slot) => slot.role === WORKER_ROLE.ARMOURER), true);

  const opening = makeShop(() => 0.999, null, 1);
  assert.equal(opening.filter((slot) => slot.category === 'fighter').length, 2);
});

test('new games start with six empty production slots and nine empty inventory slots', () => {
  const game = createGame(() => 0.5);
  assert.deepEqual(game.workers, Array(6).fill(null));
  assert.deepEqual(game.inventory, Array(9).fill(null));
});

test('fighter purchase charges only after a valid bench or battlefield drop', () => {
  let game = createGame(() => 0);
  game = purchaseShopFighterToBoard(game, 0, 12, 2);
  assert.equal(game.gold, 7);
  assert.equal(game.cats.length, 1);
  assert.equal(game.cats[0].row, 12);
  assert.equal(game.shop[0].sold, true);

  game = createGame(() => 0);
  game = purchaseShopFighterToBench(game, 0, 3);
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
  assert.equal(game.bench[0].attack, 5);
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

  game = purchaseShopWorker(game, 0, 4);
  assert.equal(game.gold, 7);
  assert.equal(game.shop[0].sold, true);
  assert.equal(game.workers[4].role, WORKER_ROLE.COOK);
  assert.equal(game.workers[4].level, 1);
});

test('workers move only during prep and merge three matching copies into the target', () => {
  let game = createGame(() => 0.5);
  game.workers[0] = createWorker(WORKER_ROLE.COOK);
  game.workers[1] = createWorker(WORKER_ROLE.COOK);
  game.workers[2] = createWorker(WORKER_ROLE.COOK);

  game = mergeWorkerOnto(game, 1, 0);
  assert.equal(game.workers[0].copies, 2);
  assert.equal(game.workers[1], null);

  game = mergeWorkerOnto(game, 2, 0);
  assert.equal(game.workers[0].level, 2);
  assert.equal(game.workers[0].copies, 1);
  assert.equal(game.workers[2], null);

  game = moveWorker(game, 0, 5);
  assert.equal(game.workers[0], null);
  assert.equal(game.workers[5].level, 2);
});

test('completed battles replace pending output using each worker level', () => {
  let game = createGame(() => 0.5);
  game.workers[0] = createWorker(WORKER_ROLE.COOK, 1);
  game.workers[1] = createWorker(WORKER_ROLE.TRADER, 2);
  game.workers[2] = createWorker(WORKER_ROLE.WEAPONSMITH, 3);
  game.workers[0].pendingOutput = { kind: 'food', quantity: 99 };
  game.phase = 'combat';
  game.dogs = [];

  game = finishRound(game);

  assert.deepEqual(game.workers[0].pendingOutput, { kind: 'food', quantity: 1 });
  assert.deepEqual(game.workers[1].pendingOutput, { kind: 'coins', quantity: 3 });
  assert.deepEqual(game.workers[2].pendingOutput, { kind: 'weapon', tier: 3, quantity: 1 });
});

test('collection stacks identical items with no quantity limit and uses nine distinct slots', () => {
  let game = createGame(() => 0.5);
  game = addInventoryStack(game, { kind: 'food', quantity: 999 });
  game = addInventoryStack(game, { kind: 'food', quantity: 2 });
  assert.equal(game.inventory[0].quantity, 1001);
  assert.equal(game.inventory.filter(Boolean).length, 1);

  for (let tier = 1; tier <= 3; tier += 1) {
    game = addInventoryStack(game, { kind: 'weapon', tier, quantity: 1 });
    game = addInventoryStack(game, { kind: 'armour', tier, quantity: 1 });
  }
  assert.equal(game.inventory.filter(Boolean).length, 7);
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
  assert.equal(game.bench[0].attack, 3);
  assert.equal(game.bench[0].equipment.weapon.tier, 1);

  game = addInventoryStack(game, { kind: 'weapon', tier: 3, quantity: 1 });
  const weaponIndex = game.inventory.findIndex((stack) => stack?.kind === 'weapon');
  game = equipInventoryItem(game, weaponIndex, 'bench', game.bench[0].id);
  assert.equal(game.bench[0].attack, 5);
  assert.equal(game.bench[0].equipment.weapon.tier, 3);
});

test('armour blocks damage for finite hits, always allows one damage, then breaks', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 1, coat: CAT_COAT.ORANGE });
  game = placeCat(game, 0, 10, 2);
  game = addInventoryStack(game, { kind: 'armour', tier: 1, quantity: 1 });
  game = equipInventoryItem(game, 0, 'cat', game.cats[0].id);
  game.dogs = [createDog(1, 9, 2)];

  game = resolveSection(game);
  assert.equal(game.cats[0].hp, 5);
  assert.equal(game.cats[0].equipment.armour.uses, 2);

  game = resolveSection(game);
  assert.equal(game.cats[0].hp, 4);
  assert.equal(game.cats[0].equipment.armour.uses, 1);

  game = resolveSection(game);
  assert.equal(game.cats[0].hp, 3);
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
  game.workers[2] = createWorker(WORKER_ROLE.COOK);
  game.workers[2].pendingOutput = { kind: 'food', quantity: 4 };
  game = sellWorker(game, 2);
  assert.equal(game.gold, 11);
  assert.equal(game.workers[2], null);
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

  game.cats[0].hp = 3;
  game = useFood(game, 0, game.cats[0].id);
  assert.equal(game.cats[0].hp, 5);
  assert.equal(game.inventory[0].quantity, 1);
});
