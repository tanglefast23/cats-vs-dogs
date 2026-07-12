import test from 'node:test';
import assert from 'node:assert/strict';

import {
  REALTIME, MAX_WAVES, CAT_COAT, CAT_ZONE_START, ROWS,
  createGame, createDog, createWorker, advance,
  useActiveAbility, useFood, equipInventoryItem, addInventoryStack,
  purchaseShopWorker, collectWorkerOutput,
} from '../src/game-engine.js';

import { placeCoat } from './helpers.js';

/** random() of 0.5 makes spawn jitter exactly zero, keeping timings exact. */
const noJitter = () => 0.5;

/** Park the next wave far in the future for tests that isolate one mechanic. */
function withoutWaves(game) {
  game.waveDueAt = 1e9;
  return game;
}

test('a new game starts the battle clock immediately', () => {
  const game = createGame(noJitter);
  assert.equal(game.phase, 'battle');
  assert.equal(game.clockMs, 0);
  assert.equal(game.waveNumber, 0);
  assert.equal(game.waveDueAt, REALTIME.waveFirstMs);
  assert.equal(game.gold, 10);
  assert.equal(game.goldFraction, 0);
  assert.equal(game.nextWave.length, 1);
});

test('placing a fighter stamps its attack timer from the current clock', () => {
  let game = createGame(noJitter);
  game = advance(game, 1000);
  game = placeCoat(game, CAT_COAT.ORANGE, 13, 0);
  assert.equal(game.cats[0].nextAttackAt, 1000 + REALTIME.catAttackMs);
  assert.equal(game.cats[0].abilityReadyAt, undefined);
});

test('ability cats start with their ability on cooldown', () => {
  let game = createGame(noJitter);
  game = placeCoat(game, CAT_COAT.FROST, 13, 0);
  assert.equal(game.cats[0].abilityReadyAt, REALTIME.abilityCooldownMs);
});

test('gold drips at ten per four dog steps of time', () => {
  let game = createGame(noJitter);
  game = advance(game, REALTIME.dogActMs * 4);
  assert.equal(game.gold, 20);
  assert.equal(game.clockMs, REALTIME.dogActMs * 4);
});

test('a dog steps once per act interval and bites when blocked', () => {
  let game = withoutWaves(createGame(noJitter));
  game = placeCoat(game, CAT_COAT.GREY, CAT_ZONE_START, 3);
  game.dogs = [{ ...createDog(1, 8, 3), nextActAt: REALTIME.dogActMs }];
  game = advance(game, REALTIME.dogActMs);
  assert.equal(game.dogs[0].row, 9);
  game = advance(game, REALTIME.dogActMs);
  assert.equal(game.dogs[0].row, 9);
  assert.ok(game.events.some((event) => event.type === 'melee'));
});

test('in the time a dog walks four squares Purrcy fires four times', () => {
  let game = withoutWaves(createGame(noJitter));
  game = placeCoat(game, CAT_COAT.ORANGE, 13, 0);
  const catId = game.cats[0].id;
  game.dogs = [{ ...createDog(4, 0, 5), nextActAt: REALTIME.dogActMs }];
  const advanced = advance(game, REALTIME.dogActMs * 4);
  assert.equal(advanced.dogs[0].row, 4);
  const volleys = advanced.events
    .filter((event) => event.type === 'shot' && event.from === catId && event.pelletIndex === 0);
  assert.equal(volleys.length, 4);
});

test('a frozen dog skips exactly one act', () => {
  let game = withoutWaves(createGame(noJitter));
  game.dogs = [{ ...createDog(1, 3, 0), nextActAt: REALTIME.dogActMs, frozenActions: 1 }];
  game = advance(game, REALTIME.dogActMs);
  assert.equal(game.dogs[0].row, 3);
  assert.ok(game.events.some((event) => event.type === 'freeze-skip'));
  game = advance(game, REALTIME.dogActMs);
  assert.equal(game.dogs[0].row, 4);
});

test('advancing in many small steps equals one large step', () => {
  let game = createGame(noJitter);
  game = placeCoat(game, CAT_COAT.ORANGE, 13, 2);
  game.dogs = [{ ...createDog(2, 0, 2), nextActAt: REALTIME.dogActMs }];
  const cloneBase = () => ({
    ...JSON.parse(JSON.stringify({ ...game, random: null, events: [] })),
    random: noJitter,
  });

  let small = cloneBase();
  for (let i = 0; i < 50; i += 1) small = advance(small, 250);
  const large = advance(cloneBase(), 250 * 50);

  const snapshot = (state) => JSON.parse(JSON.stringify({
    clockMs: state.clockMs,
    gold: state.gold,
    goldFraction: state.goldFraction,
    waveNumber: state.waveNumber,
    cats: state.cats,
    dogs: state.dogs,
  }));
  assert.deepEqual(snapshot(small), snapshot(large));
});

test('waves spawn on schedule and reroll the shop', () => {
  let game = createGame(noJitter);
  game.shop[0].saved = true;
  const savedId = game.shop[0].id;
  game = advance(game, REALTIME.waveFirstMs);
  assert.equal(game.waveNumber, 1);
  assert.equal(game.dogs.length, 1);
  assert.equal(game.dogs[0].row, 0);
  assert.equal(game.waveDueAt, REALTIME.waveFirstMs + REALTIME.waveIntervalMs);
  assert.equal(game.nextWave.length, 2);
  assert.equal(game.shop[0].id, savedId);
  assert.ok(game.events.some((event) => event.type === 'wave' && event.wave === 1));
});

test('a square held by a dog blocks new cat placement', () => {
  let game = withoutWaves(createGame(noJitter));
  game.dogs = [{ ...createDog(1, 11, 2), nextActAt: 1e9 }];
  const blocked = placeCoat(game, CAT_COAT.ORANGE, 11, 2);
  assert.equal(blocked.cats.length, 0);
  assert.equal(blocked.bench.length, 1);
});

test('a jammed gate delays wave dogs instead of deleting them', () => {
  let game = createGame(noJitter);
  game.waveNumber = MAX_WAVES - 1;
  game.waveDueAt = 1000;
  game.nextWave = [createDog(1, 0, 3)];
  game.dogs = Array.from({ length: 6 }, (_, col) => ({ ...createDog(1, 0, col), nextActAt: 1e9 }));

  game = advance(game, 1000);
  assert.equal(game.dogs.length, 6, 'no room at the gate yet');
  assert.equal(game.nextWave.length, 1, 'the dog waits instead of vanishing');
  assert.notEqual(game.waveDueAt, null, 'a retry spawn is scheduled');
  assert.equal(game.phase, 'battle');

  game.dogs = [];
  game = advance(game, REALTIME.dogActMs);
  assert.equal(game.dogs.length, 1, 'the delayed dog finally arrives');
  assert.equal(game.waveDueAt, null);
  assert.equal(game.phase, 'battle', 'victory still requires clearing it');
});

test('wave events carry the spawned roles for the banner', () => {
  let game = createGame(noJitter);
  game = advance(game, REALTIME.waveFirstMs);
  const waveEvent = game.events.find((event) => event.type === 'wave');
  assert.deepEqual(waveEvent.roles, game.dogs.map((dog) => dog.role));
});

test('a wave spawn never stacks two dogs on one square', () => {
  let game = createGame(noJitter);
  const col = game.nextWave[0].col;
  game.dogs = [{ ...createDog(1, 0, col), nextActAt: 1e9 }];
  game = advance(game, REALTIME.waveFirstMs);
  assert.equal(game.dogs.length, 2);
  const squares = new Set(game.dogs.map((dog) => `${dog.row},${dog.col}`));
  assert.equal(squares.size, 2);
});

test('clearing the final wave wins the level', () => {
  let game = createGame(noJitter);
  game.waveNumber = MAX_WAVES;
  game.waveDueAt = null;
  game.nextWave = [];
  game = placeCoat(game, CAT_COAT.ORANGE, 13, 0);
  game.dogs = [{ ...createDog(1, 0, 0), hp: 1, nextActAt: 1e9 }];
  game = advance(game, REALTIME.catAttackMs);
  assert.equal(game.dogs.length, 0);
  assert.equal(game.phase, 'victory');
});

test('a breach costs a life and sweeps the column', () => {
  let game = withoutWaves(createGame(noJitter));
  game.dogs = [
    { ...createDog(1, ROWS - 1, 2), nextActAt: REALTIME.dogActMs },
    { ...createDog(1, 5, 2), nextActAt: 1e9 },
    { ...createDog(1, 5, 4), nextActAt: 1e9 },
  ];
  game = advance(game, REALTIME.dogActMs);
  assert.equal(game.lives, 2);
  assert.deepEqual(game.dogs.map((dog) => dog.col), [4]);
  assert.ok(game.events.some((event) => event.type === 'super-cat' && event.col === 2));
});

test('losing the last life ends the game mid-advance', () => {
  let game = createGame(noJitter);
  game.lives = 1;
  game.dogs = [{ ...createDog(1, ROWS - 1, 0), nextActAt: REALTIME.dogActMs }];
  game = advance(game, 60000);
  assert.equal(game.phase, 'gameover');
  assert.ok(game.clockMs < 60000);
});

test('active abilities recharge on a cooldown instead of once per battle', () => {
  let game = withoutWaves(createGame(noJitter));
  game = placeCoat(game, CAT_COAT.FROST, 13, 0);
  game.dogs = [
    { ...createDog(1, 0, 0), nextActAt: 1e9 },
    { ...createDog(1, 1, 1), nextActAt: 1e9 },
  ];
  const catId = game.cats[0].id;
  const early = useActiveAbility(game, catId, { dogId: game.dogs[0].id });
  assert.equal(early, game);

  game.cats[0].abilityReadyAt = 0;
  const cast = useActiveAbility(game, catId, { dogId: game.dogs[0].id });
  assert.notEqual(cast, game);
  assert.equal(cast.dogs[0].frozenActions, 1);
  assert.equal(cast.cats[0].abilityReadyAt, cast.clockMs + REALTIME.abilityCooldownMs);

  const again = useActiveAbility(cast, catId, { dogId: cast.dogs[1].id });
  assert.equal(again, cast);
});

test('food and equipment work while the battle runs', () => {
  let game = withoutWaves(createGame(noJitter));
  game = placeCoat(game, CAT_COAT.ORANGE, 13, 0);
  game.cats[0].hp = 2;
  game = addInventoryStack(game, { kind: 'food', quantity: 1 });
  game = useFood(game, 0, game.cats[0].id);
  assert.equal(game.cats[0].hp, 4);

  game = addInventoryStack(game, { kind: 'weapon', tier: 1, quantity: 1 });
  const weaponIndex = game.inventory.findIndex((stack) => stack?.kind === 'weapon');
  game = equipInventoryItem(game, weaponIndex, 'cat', game.cats[0].id);
  assert.equal(game.cats[0].equipment.weapon.tier, 1);
  assert.equal(game.cats[0].attack, game.cats[0].baseAttack + 1);
});

test('hiring a worker starts its production timer', () => {
  let game = createGame(noJitter);
  game.shop[0] = {
    id: 'slot-under-test', kind: 'production-cat', category: 'worker',
    role: 'trader', level: 1, sold: false, saved: false,
  };
  game = advance(game, 4000);
  game = purchaseShopWorker(game, 0, 2);
  assert.equal(game.workers[2].outputReadyAt, 4000 + REALTIME.workerProduceMs);
});

test('production cats produce on a timer, nap until collected, then resume', () => {
  let game = withoutWaves(createGame(noJitter));
  game.workers[0] = { ...createWorker('cook', 1), outputReadyAt: REALTIME.workerProduceMs };
  game = advance(game, REALTIME.workerProduceMs);
  assert.deepEqual(game.workers[0].pendingOutput, { kind: 'food', quantity: 1 });
  assert.equal(game.workers[0].outputReadyAt, null);
  assert.ok(game.events.some((event) => event.type === 'worker-output-ready'));

  const napping = advance(game, REALTIME.workerProduceMs * 3);
  assert.deepEqual(napping.workers[0].pendingOutput, { kind: 'food', quantity: 1 });

  game = collectWorkerOutput(napping, 0);
  assert.equal(game.workers[0].pendingOutput, null);
  assert.equal(game.workers[0].outputReadyAt, game.clockMs + REALTIME.workerProduceMs);
  assert.equal(game.inventory[0].kind, 'food');
});
