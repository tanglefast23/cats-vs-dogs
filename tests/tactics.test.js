import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTIONS_PER_ROUND,
  CAT_COAT,
  CAT_COAT_INFO,
  CAT_ZONE_START,
  COLS,
  ROWS,
  addCatToBench,
  addInventoryStack,
  availableCatCoatsForRound,
  continueCombat,
  createCat,
  createDog,
  createGame,
  finishRound,
  moveCat,
  openTacticsWindow,
  placeCat,
  resolveSection,
  startRound,
  useActiveAbility,
  useFood,
} from '../src/game-engine.js';
import { getDropAction } from '../src/drag-drop.js';

function placeCoat(game, coat, row, col) {
  game = addCatToBench(game, { level: 1, coat });
  return placeCat(game, game.bench.length - 1, row, col);
}

test('five active Tier 3 cats unlock on round five', () => {
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

test('combat opens a tactics window between its two normal exchanges', () => {
  let game = createGame(() => 0.5);
  game = placeCoat(game, CAT_COAT.ORANGE, 13, 0);
  game = startRound(game);
  game.dogs = [createDog(4, 0, 5)];
  game = resolveSection(game);
  assert.equal(game.section, 1);
  game = openTacticsWindow(game);
  assert.equal(game.phase, 'tactics');
  game = continueCombat(game);
  assert.equal(game.phase, 'combat');
  game = resolveSection(game);
  assert.equal(game.section, ACTIONS_PER_ROUND);
});

test('food is consumed only during a tactics window', () => {
  let game = createGame(() => 0.5);
  game = placeCoat(game, CAT_COAT.ORANGE, 12, 0);
  game.cats[0].hp = 2;
  game = addInventoryStack(game, { kind: 'food', quantity: 1 });
  game.phase = 'combat';
  assert.equal(useFood(game, 0, game.cats[0].id), game);
  game = openTacticsWindow(game);
  game = useFood(game, 0, game.cats[0].id);
  assert.equal(game.cats[0].hp, 4);
  assert.equal(game.inventory[0], null);
});

test('between-round movement is one square for melee and two for other cats, once per prep', () => {
  let game = createGame(() => 0.5);
  game = placeCoat(game, CAT_COAT.GREY, 12, 1);
  game = placeCoat(game, CAT_COAT.ORANGE, 12, 4);
  game.phase = 'combat';
  game = finishRound(game);
  const meleeId = game.cats.find((cat) => cat.coat === CAT_COAT.GREY).id;
  const rangedId = game.cats.find((cat) => cat.coat === CAT_COAT.ORANGE).id;

  assert.equal(moveCat(game, meleeId, 10, 1), game);
  game = moveCat(game, meleeId, 11, 1);
  assert.equal(game.cats.find((cat) => cat.id === meleeId).row, 11);
  assert.equal(moveCat(game, meleeId, 11, 2), game, 'a cat only relocates once per prep');

  game = moveCat(game, rangedId, 10, 4);
  assert.equal(game.cats.find((cat) => cat.id === rangedId).row, 10);
});

test('drag validation reads prepOrigin from real engine cats, so highlights match engine limits', () => {
  let game = createGame(() => 0.5);
  game = placeCoat(game, CAT_COAT.GREY, 12, 1);
  game = placeCoat(game, CAT_COAT.ORANGE, 12, 4);
  game.phase = 'combat';
  game = finishRound(game);
  const melee = game.cats.find((cat) => cat.coat === CAT_COAT.GREY);
  const ranged = game.cats.find((cat) => cat.coat === CAT_COAT.ORANGE);
  assert.deepEqual(melee.prepOrigin, { row: 12, col: 1 }, 'engine stores prepOrigin as an object');

  // Sources spread the engine cat exactly as app.js builds drag and click-select sources.
  const drop = (cat, row, col) => getDropAction({
    source: { ...cat, type: 'cat' },
    target: { kind: 'cell', row, col, occupied: null },
    catZoneStart: CAT_ZONE_START,
    rows: ROWS,
    cols: COLS,
    phase: game.phase,
  });

  assert.equal(drop(melee, 10, 1).type, 'invalid', 'melee highlight must not promise a two-square move');
  assert.equal(drop(melee, 11, 1).type, 'move');
  assert.equal(drop(ranged, 10, 2).type, 'invalid', 'ranged highlight must not promise a four-square move');
  assert.equal(drop(ranged, 10, 4).type, 'move');
  assert.equal(moveCat(game, melee.id, 10, 1), game, 'engine rejects the same drop the highlight rejects');
});

test('Frostpoint Witch freezes one dog for its next full action', () => {
  let game = createGame(() => 0.5);
  game = placeCoat(game, CAT_COAT.FROST, 13, 0);
  game.dogs = [createDog(3, 5, 5)];
  game.phase = 'tactics';
  const dogId = game.dogs[0].id;
  game = useActiveAbility(game, game.cats[0].id, { dogId });
  assert.equal(game.dogs[0].frozenActions, 1);
  game = continueCombat(game);
  game = resolveSection(game);
  assert.equal(game.dogs[0].row, 5);
  assert.equal(game.dogs[0].frozenActions, 0);
  assert.equal(game.events.some((event) => event.type === 'freeze-skip'), true);
});

test('Rift Walker teleports an ally anywhere and grants its level bonus', () => {
  let game = createGame(() => 0.5);
  game.cats = [createCat(2, CAT_COAT.RIFT), createCat(1, CAT_COAT.GREY)];
  game.cats[0].row = 13; game.cats[0].col = 0;
  game.cats[1].row = 13; game.cats[1].col = 1;
  game.phase = 'tactics';
  game = useActiveAbility(game, game.cats[0].id, {
    targetCatId: game.cats[1].id,
    row: 10,
    col: 5,
  });
  const target = game.cats[1];
  assert.deepEqual([target.row, target.col], [10, 5]);
  assert.equal(target.guard, 2);
});

test('Mirage Maker creates a temporary blocker that absorbs dog bites', () => {
  let game = createGame(() => 0.5);
  game = placeCoat(game, CAT_COAT.MIRAGE, 13, 0);
  game.phase = 'tactics';
  game = useActiveAbility(game, game.cats[0].id, { row: 11, col: 3 });
  assert.equal(game.decoys.length, 1);
  game.dogs = [createDog(2, 10, 3)];
  game = continueCombat(game);
  game = resolveSection(game);
  assert.equal(game.decoys.length, 0);
  assert.equal(game.dogs[0].row, 10);
});

test('Stormcaller damages every living dog in one selected column', () => {
  let game = createGame(() => 0.5);
  game.cats = [createCat(2, CAT_COAT.STORM)];
  game.cats[0].row = 13; game.cats[0].col = 0;
  game.dogs = [createDog(3, 2, 4), createDog(3, 5, 4), createDog(3, 4, 2)];
  game.phase = 'tactics';
  game = useActiveAbility(game, game.cats[0].id, { col: 4 });
  assert.deepEqual(game.dogs.map((dog) => dog.hp), [12, 12, 16]);
});

test('Encore Maestro grants one reduced-strength immediate allied attack', () => {
  let game = createGame(() => 0.5);
  game.cats = [createCat(1, CAT_COAT.ENCORE), createCat(1, CAT_COAT.WHITE)];
  game.cats[0].row = 13; game.cats[0].col = 0;
  game.cats[1].row = 13; game.cats[1].col = 1;
  game.dogs = [createDog(2, 3, 1)];
  game.phase = 'tactics';
  game = useActiveAbility(game, game.cats[0].id, { targetCatId: game.cats[1].id });
  assert.equal(game.dogs[0].hp, 10);
  assert.equal(game.events.some((event) => event.type === 'encore'), true);
});

test('starting a battle resets active casts and finishing fully heals survivors', () => {
  let game = createGame(() => 0.5);
  game = placeCoat(game, CAT_COAT.FROST, 13, 0);
  game.cats[0].activeUsed = true;
  game.cats[0].hp = 1;
  game = startRound(game);
  assert.equal(game.cats[0].activeUsed, false);
  game = finishRound(game);
  assert.equal(game.cats[0].hp, game.cats[0].maxHp);
});
