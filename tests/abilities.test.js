import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CAT_COAT,
  CAT_COAT_INFO,
  REALTIME,
  addCatToBench,
  availableCatCoatsForRound,
  createCat,
  createDog,
  createGame,
  placeCat,
  advance,
  useActiveAbility,
} from '../src/game-engine.js';

import { placeCoat } from './helpers.js';

/** Casting tests care about the effect, not the warm-up, so make the caster ready now. */
function readyCaster(game, index = 0) {
  game.cats[index].abilityReadyAt = game.clockMs;
  return game;
}

test('five active Tier 3 cats unlock on wave five', () => {
  const activeCoats = [
    CAT_COAT.FROST,
    CAT_COAT.RIFT,
    CAT_COAT.MIRAGE,
    CAT_COAT.STORM,
    CAT_COAT.ENCORE,
  ];
  assert.deepEqual(activeCoats, [6, 7, 8, 9, 10]);
  assert.equal(activeCoats.every((coat) => CAT_COAT_INFO[coat].shopTier === 3), true);
  assert.equal(activeCoats.every((coat) => CAT_COAT_INFO[coat].activeAbility), true);
  assert.equal(activeCoats.every((coat) => !availableCatCoatsForRound(4).includes(coat)), true);
  assert.equal(activeCoats.every((coat) => availableCatCoatsForRound(5).includes(coat)), true);
});

test('Frosty Paws freezes one dog for its next full action', () => {
  let game = createGame(() => 0.5);
  game.waveDueAt = 1e9;
  game = placeCoat(game, CAT_COAT.FROST, 13, 0);
  game = readyCaster(game);
  game.dogs = [{ ...createDog(3, 5, 5), nextActAt: game.clockMs + REALTIME.dogActMs }];
  const dogId = game.dogs[0].id;

  game = useActiveAbility(game, game.cats[0].id, { dogId });
  assert.equal(game.dogs[0].frozenActions, 1);

  game.cats = [];
  game = advance(game, REALTIME.dogActMs);
  assert.equal(game.dogs[0].row, 5);
  assert.equal(game.dogs[0].frozenActions, 0);
  assert.equal(game.events.some((event) => event.type === 'freeze-skip'), true);
});

test('Purrtal teleports an ally anywhere and grants its level bonus', () => {
  let game = createGame(() => 0.5);
  game.cats = [createCat(2, CAT_COAT.RIFT), createCat(1, CAT_COAT.GREY)];
  game.cats[0].row = 13; game.cats[0].col = 0;
  game.cats[1].row = 13; game.cats[1].col = 1;
  game = readyCaster(game);
  game = useActiveAbility(game, game.cats[0].id, {
    targetCatId: game.cats[1].id,
    row: 10,
    col: 5,
  });
  const target = game.cats[1];
  assert.deepEqual([target.row, target.col], [10, 5]);
  assert.equal(target.guard, 2);
});

test('Faux Paw creates a persistent blocker that absorbs dog bites', () => {
  let game = createGame(() => 0.5);
  game.waveDueAt = 1e9;
  game = placeCoat(game, CAT_COAT.MIRAGE, 13, 0);
  game = readyCaster(game);
  game = useActiveAbility(game, game.cats[0].id, { row: 11, col: 3 });
  assert.equal(game.decoys.length, 1);

  game.cats = [];
  game.dogs = [{ ...createDog(2, 10, 3), nextActAt: game.clockMs + REALTIME.dogActMs }];
  game = advance(game, REALTIME.dogActMs);
  assert.equal(game.decoys.length, 0);
  assert.equal(game.dogs[0].row, 10);
});

test('decoys block new cat placement while they stand', () => {
  let game = createGame(() => 0.5);
  game = placeCoat(game, CAT_COAT.MIRAGE, 13, 0);
  game = readyCaster(game);
  game = useActiveAbility(game, game.cats[0].id, { row: 11, col: 3 });

  game = addCatToBench(game, { level: 1, coat: CAT_COAT.ORANGE });
  const blocked = placeCat(game, game.bench.length - 1, 11, 3);
  assert.equal(blocked, game);
});

test('Thunderpaws damages every living dog in one selected column', () => {
  let game = createGame(() => 0.5);
  game.cats = [createCat(2, CAT_COAT.STORM)];
  game.cats[0].row = 13; game.cats[0].col = 0;
  game.dogs = [createDog(3, 2, 4), createDog(3, 5, 4), createDog(3, 4, 2)];
  game = readyCaster(game);
  game = useActiveAbility(game, game.cats[0].id, { col: 4 });
  assert.deepEqual(game.dogs.map((dog) => dog.hp), [12, 12, 16]);
});

test('Meowstro grants one reduced-strength immediate allied attack', () => {
  let game = createGame(() => 0.5);
  game.cats = [createCat(1, CAT_COAT.ENCORE), createCat(1, CAT_COAT.WHITE)];
  game.cats[0].row = 13; game.cats[0].col = 0;
  game.cats[1].row = 13; game.cats[1].col = 1;
  game.dogs = [createDog(2, 3, 1)];
  game = readyCaster(game);
  game = useActiveAbility(game, game.cats[0].id, { targetCatId: game.cats[1].id });
  assert.equal(game.dogs[0].hp, 10);
  assert.equal(game.events.some((event) => event.type === 'encore'), true);
});

test('a storm that clears the final dogs wins the level immediately', () => {
  let game = createGame(() => 0.5);
  game.waveNumber = 7;
  game.waveDueAt = null;
  game.nextWave = [];
  game.cats = [createCat(3, CAT_COAT.STORM)];
  game.cats[0].row = 13; game.cats[0].col = 0;
  game.dogs = [{ ...createDog(1, 2, 4), hp: 2 }];
  game = readyCaster(game);
  game = useActiveAbility(game, game.cats[0].id, { col: 4 });
  assert.equal(game.dogs.length, 0);
  assert.equal(game.phase, 'victory');
});
