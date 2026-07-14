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
  mergeUnitOnto,
  moveCat,
  moveCatInTactics,
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

test('five active Tier 3 cats unlock on round four', () => {
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
  assert.equal(activeCoats.every((coat) => !availableCatCoatsForRound(3).includes(coat)), true);
  assert.equal(activeCoats.every((coat) => availableCatCoatsForRound(4).includes(coat)), true);
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

test('melee cats move one square and smaller cats move two during setup, once per prep', () => {
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
  assert.equal(moveCat(game, rangedId, 11, 4), game, 'a ranged cat still relocates only once per prep');
});

test('a newly deployed cat gets one range-limited setup move after its free placement', () => {
  let game = createGame(() => 0.5);
  game = placeCoat(game, CAT_COAT.ORANGE, 12, 2);
  const catId = game.cats[0].id;

  game = moveCat(game, catId, 10, 2);
  assert.deepEqual([game.cats[0].row, game.cats[0].col], [10, 2]);
  assert.equal(moveCat(game, catId, 10, 3), game, 'the one setup move is now spent');
});

test('a battlefield merge bypasses movement distance and the spent-move flag', () => {
  let game = createGame(() => 0.5);
  game = placeCoat(game, CAT_COAT.ORANGE, 12, 0);
  game = placeCoat(game, CAT_COAT.ORANGE, 12, 3);
  const [source, target] = game.cats;
  game = moveCat(game, source.id, 11, 0);

  const merged = mergeUnitOnto(game, 'cat', source.id, 'cat', target.id);
  assert.notEqual(merged, game);
  assert.equal(merged.cats.length, 1);
  assert.equal(merged.cats[0].copies, 2);
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
  assert.equal(drop(ranged, 10, 4).type, 'move', 'smaller ranged cats may move two squares');
  assert.equal(drop(ranged, 11, 4).type, 'move');
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
  const struckDogIds = game.dogs.filter((dog) => dog.col === 4).map((dog) => dog.id);
  game.phase = 'tactics';
  game = useActiveAbility(game, game.cats[0].id, { col: 4 });
  assert.deepEqual(game.dogs.map((dog) => dog.hp), [15, 15, 19]);
  const strikes = game.events.filter((event) => event.type === 'spell' && event.style === 'lightning');
  assert.deepEqual(strikes.map((event) => event.to), struckDogIds);
  assert.deepEqual(strikes.map((event) => [event.toRow, event.col]), [[2, 4], [5, 4]]);
});

test('Encore Maestro grants one reduced-strength immediate allied attack', () => {
  let game = createGame(() => 0.5);
  game.cats = [createCat(1, CAT_COAT.ENCORE), createCat(1, CAT_COAT.WHITE)];
  game.cats[0].row = 13; game.cats[0].col = 0;
  game.cats[1].row = 13; game.cats[1].col = 1;
  game.dogs = [createDog(2, 3, 1)];
  game.phase = 'tactics';
  game = useActiveAbility(game, game.cats[0].id, { targetCatId: game.cats[1].id });
  assert.equal(game.dogs[0].hp, 12);
  assert.equal(game.events.some((event) => event.type === 'encore'), true);
});

test('starting a battle resets active casts without healing survivors between rounds', () => {
  let game = createGame(() => 0.5);
  game = placeCoat(game, CAT_COAT.FROST, 13, 0);
  game.cats[0].activeUsed = true;
  game.cats[0].hp = 1;
  game = startRound(game);
  assert.equal(game.cats[0].activeUsed, false);
  game = finishRound(game);
  assert.equal(game.cats[0].hp, 1);
});

test('manual cat movement stays disabled during a tactics window', () => {
  let game = createGame(() => 0.5);
  game = placeCoat(game, CAT_COAT.ORANGE, 12, 2);
  game = startRound(game);
  game = openTacticsWindow(game);
  const catId = game.cats[0].id;

  assert.equal(moveCatInTactics(game, catId, 12, 3), game);
  assert.deepEqual([game.cats[0].row, game.cats[0].col], [12, 2]);
});

test('drag rules reject all manual movement during a tactics window', () => {
  const drop = (source, target, extra = {}) => getDropAction({
    source,
    target,
    catZoneStart: CAT_ZONE_START,
    rows: ROWS,
    cols: COLS,
    phase: 'tactics',
    ...extra,
  });
  const cat = { type: 'cat', id: 'cat-9', level: 1, coat: CAT_COAT.ORANGE, row: 12, col: 2 };

  assert.deepEqual(
    drop(cat, { kind: 'cell', row: 12, col: 3, occupied: null }),
    { type: 'invalid', reason: 'phase' },
  );
  assert.equal(
    drop(cat, { kind: 'cell', row: 12, col: 3, occupied: { id: 'cat-2', level: 1, coat: CAT_COAT.ORANGE } }).type,
    'invalid',
    'no mid-combat merges',
  );
  assert.equal(
    drop({ type: 'bench', id: 'bench-1', level: 1, coat: CAT_COAT.ORANGE }, { kind: 'cell', row: 12, col: 3, occupied: null }).type,
    'invalid',
    'no mid-combat deployment',
  );
});
