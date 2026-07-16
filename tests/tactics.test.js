import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ACTIONS_PER_ROUND,
  CAT_COAT,
  CAT_COAT_INFO,
  CAT_ZONE_START,
  COLS,
  DOG_ROLE,
  MAX_ROUNDS,
  ROWS,
  addCatToBench,
  addInventoryStack,
  availableCatCoatsForRound,
  canTeleportDogTo,
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
  plusCells,
  portalEffectAmount,
  portalEffectForLevel,
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

test('six active Tier 2 cats unlock on round four', () => {
  const activeCoats = [
    CAT_COAT.BLACK,
    CAT_COAT.FROST,
    CAT_COAT.RIFT,
    CAT_COAT.MIRAGE,
    CAT_COAT.STORM,
    CAT_COAT.ENCORE,
  ];
  assert.deepEqual(activeCoats, [4, 6, 7, 8, 9, 10]);
  assert.equal(activeCoats.every((coat) => CAT_COAT_INFO[coat].shopTier === 2), true);
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

test('food is consumed during setup or a tactics window, but not active combat', () => {
  let game = createGame(() => 0.5);
  game = placeCoat(game, CAT_COAT.GREY, 12, 0);
  game.cats[0].hp = 2;
  game = addInventoryStack(game, { kind: 'food', quantity: 2 });

  game = useFood(game, 0, game.cats[0].id);
  assert.equal(game.cats[0].hp, 4);
  assert.equal(game.inventory[0].quantity, 1);

  game.phase = 'combat';
  assert.equal(useFood(game, 0, game.cats[0].id), game);

  game = openTacticsWindow(game);
  game = useFood(game, 0, game.cats[0].id);
  assert.equal(game.cats[0].hp, 6);
  assert.equal(game.inventory[0], null);
});

test('melee cats move one square and smaller cats move two during setup, once per prep', () => {
  let game = createGame(() => 0.5);
  game = placeCoat(game, CAT_COAT.GREY, 12, 1);
  game = placeCoat(game, CAT_COAT.ORANGE, 12, 4);
  game = startRound(game);
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

test('veteran melee cats can cross beyond cat territory during setup and tactics', () => {
  let setupGame = createGame(() => 0.5);
  setupGame = placeCoat(setupGame, CAT_COAT.GREY, CAT_ZONE_START, 1);
  const setupMeleeId = setupGame.cats[0].id;
  setupGame = startRound(setupGame);
  setupGame = finishRound(setupGame);
  setupGame = moveCat(setupGame, setupMeleeId, CAT_ZONE_START - 1, 1);
  assert.equal(setupGame.cats[0].row, CAT_ZONE_START - 1);

  let tacticsGame = createGame(() => 0.5);
  tacticsGame = placeCoat(tacticsGame, CAT_COAT.GREY, CAT_ZONE_START, 2);
  const tacticsMeleeId = tacticsGame.cats[0].id;
  tacticsGame = startRound(tacticsGame);
  tacticsGame = openTacticsWindow(tacticsGame);
  tacticsGame = moveCatInTactics(tacticsGame, tacticsMeleeId, CAT_ZONE_START - 1, 2);
  assert.equal(tacticsGame.cats[0].row, CAT_ZONE_START - 1);
});

test('rookie melee cats and veteran ranged cats stay inside cat territory', () => {
  let rookieGame = createGame(() => 0.5);
  rookieGame = placeCoat(rookieGame, CAT_COAT.GREY, CAT_ZONE_START, 1);
  assert.equal(moveCat(rookieGame, rookieGame.cats[0].id, CAT_ZONE_START - 1, 1), rookieGame);

  let rangedGame = createGame(() => 0.5);
  rangedGame = placeCoat(rangedGame, CAT_COAT.ORANGE, CAT_ZONE_START, 2);
  const rangedId = rangedGame.cats[0].id;
  rangedGame = startRound(rangedGame);
  rangedGame = finishRound(rangedGame);
  assert.equal(moveCat(rangedGame, rangedId, CAT_ZONE_START - 1, 2), rangedGame);
});

test('a newly deployed cat can reposition anywhere until its first battle starts', () => {
  let game = createGame(() => 0.5);
  game = placeCoat(game, CAT_COAT.ORANGE, 12, 2);
  const catId = game.cats[0].id;

  game = moveCat(game, catId, 10, 5);
  game = moveCat(game, catId, 13, 0);
  assert.deepEqual([game.cats[0].row, game.cats[0].col], [13, 0]);
  assert.equal(game.cats[0].hasEnteredBattle, false);

  game = startRound(game);
  assert.equal(game.cats[0].hasEnteredBattle, true);
  game = finishRound(game);
  assert.equal(moveCat(game, catId, 10, 0), game, 'the normal range applies after battle starts');
  game = moveCat(game, catId, 11, 0);
  assert.deepEqual([game.cats[0].row, game.cats[0].col], [11, 0]);
  assert.equal(moveCat(game, catId, 11, 1), game, 'the veteran cat has spent its setup move');
});

test('a battlefield merge bypasses movement distance and the spent-move flag', () => {
  let game = createGame(() => 0.5);
  game = placeCoat(game, CAT_COAT.ORANGE, 12, 0);
  game = placeCoat(game, CAT_COAT.ORANGE, 12, 3);
  game = startRound(game);
  game = finishRound(game);
  const [source, target] = game.cats;
  game = moveCat(game, source.id, 11, 0);

  const merged = mergeUnitOnto(game, 'cat', source.id, 'cat', target.id);
  assert.notEqual(merged, game);
  assert.equal(merged.cats.length, 1);
  assert.equal(merged.cats[0].copies, 2);
});

test('merging a veteran cat into a rookie preserves the first-battle movement lock', () => {
  let game = createGame(() => 0.5);
  game = placeCoat(game, CAT_COAT.ORANGE, 12, 0);
  game = startRound(game);
  game = finishRound(game);
  game = placeCoat(game, CAT_COAT.ORANGE, 12, 3);
  const veteran = game.cats.find((cat) => cat.hasEnteredBattle);
  const rookie = game.cats.find((cat) => !cat.hasEnteredBattle);

  game = mergeUnitOnto(game, 'cat', veteran.id, 'cat', rookie.id);

  assert.equal(game.cats.length, 1);
  assert.equal(game.cats[0].hasEnteredBattle, true);
});

test('drag validation reads prepOrigin from real engine cats, so highlights match engine limits', () => {
  let game = createGame(() => 0.5);
  game = placeCoat(game, CAT_COAT.GREY, 12, 1);
  game = placeCoat(game, CAT_COAT.ORANGE, 12, 4);
  game = startRound(game);
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

test('level-two Frosty freezes a dog through the current round and the following round', () => {
  let game = createGame(() => 0.5);
  game.cats = [createCat(2, CAT_COAT.FROST)];
  game.cats[0].row = 13; game.cats[0].col = 0;
  game.dogs = [createDog(3, 5, 5)];
  game.phase = 'tactics';
  game.section = 1;
  const dogId = game.dogs[0].id;
  game = useActiveAbility(game, game.cats[0].id, { dogId });
  assert.equal(game.dogs[0].frozenActions, 3);
  assert.equal(game.dogs[0].shatterDamage, 2);

  game = continueCombat(game);
  game = resolveSection(game);
  assert.equal(game.dogs[0].row, 5);
  assert.equal(game.dogs[0].frozenActions, 2);
  assert.equal(game.events.at(-1).remainingActions, 2);

  game = finishRound(game);
  game = startRound(game);
  game = resolveSection(game);
  assert.equal(game.dogs.find((dog) => dog.id === dogId).row, 5);
  assert.equal(game.dogs.find((dog) => dog.id === dogId).frozenActions, 1);
  game = resolveSection(game);
  assert.equal(game.dogs.find((dog) => dog.id === dogId).row, 5);
  assert.equal(game.dogs[0].frozenActions, 0);

  game = resolveSection(game);
  assert.notEqual(game.dogs.find((dog) => dog.id === dogId).row, 5, 'the dog acts again after two rounds of freeze');
});

test('Frosty freeze duration and shatter damage scale 1x, 2x, and 3x by level', () => {
  for (const level of [1, 2, 3]) {
    let game = createGame(() => 0.5);
    game.cats = [createCat(level, CAT_COAT.FROST)];
    game.cats[0].row = 13; game.cats[0].col = 0;
    game.dogs = [createDog(4, 5, 5)];
    game.phase = 'tactics';
    game.section = 1;

    game = useActiveAbility(game, game.cats[0].id, { dogId: game.dogs[0].id });

    assert.equal(game.dogs[0].frozenActions, 1 + ((level - 1) * ACTIONS_PER_ROUND));
    assert.equal(game.dogs[0].frozenRoundsRemaining, level);
    assert.equal(game.dogs[0].shatterDamage, level);
  }
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
  assert.equal(target.portalGuardLevel, 2);
  assert.equal(target.portalAttackBonusLevel, 2);
});

test('Purrtal percentage effects scale from one configuration with level minimums', () => {
  assert.deepEqual([1, 2, 3].map((level) => portalEffectForLevel(level)), [
    { percent: 10, minimum: 1, enemyRange: 2 },
    { percent: 20, minimum: 2, enemyRange: 3 },
    { percent: 30, minimum: 3, enemyRange: 4 },
  ]);
  assert.equal(portalEffectAmount(9, 3), 3, '30% of 9 rounds down to 2, then uses the level-three minimum');
  assert.equal(portalEffectAmount(30, 3), 9, 'future high stats use the full percentage');
  assert.equal(portalEffectAmount(11, 3), 3, '30% of 11 rounds down to 3');
});

test('level-two Purrtal can stack an enemy onto one dog and applies its one-shot penalty', () => {
  let game = createGame(() => 0.5);
  game.cats = [createCat(2, CAT_COAT.RIFT)];
  game.cats[0].row = 13; game.cats[0].col = 0;
  const target = createDog(2, 5, 3);
  const waitingDog = createDog(1, 4, 2);
  game.dogs = [target, waitingDog];
  game.phase = 'tactics';

  assert.equal(canTeleportDogTo(game, target.id, 4, 2), true, 'one vertical and one horizontal step is legal');
  game = useActiveAbility(game, game.cats[0].id, { targetDogId: target.id, row: 4, col: 2 });

  assert.deepEqual([game.dogs.find((dog) => dog.id === target.id).row, game.dogs.find((dog) => dog.id === target.id).col], [4, 2]);
  assert.equal(game.dogs.filter((dog) => dog.row === 4 && dog.col === 2).length, 2);
  assert.equal(game.dogs.find((dog) => dog.id === target.id).portalAttackPenaltyLevel, 2);
  assert.equal(game.cats[0].activeUsed, true);
  assert.deepEqual(game.events.find((event) => event.type === 'teleport' && event.to === target.id), {
    type: 'teleport', unitType: 'dog', from: game.cats[0].id, to: target.id,
    fromRow: 5, fromCol: 3, row: 4, col: 2,
    attackPenalty: 2, attackPenaltyPercent: 20, attackPenaltyMinimum: 2,
  });
});

test('Purrtal enemy range scales 2, 3, and 4 while ally effects scale 10%, 20%, and 30%', () => {
  for (const level of [1, 2, 3]) {
    let game = createGame(() => 0.5);
    const caster = createCat(level, CAT_COAT.RIFT);
    const ally = createCat(1, CAT_COAT.GREY);
    caster.row = 13; caster.col = 0;
    ally.row = 13; ally.col = 1;
    game.cats = [caster, ally];
    game.phase = 'tactics';

    game = useActiveAbility(game, caster.id, { targetCatId: ally.id, row: 10, col: 5 });

    const movedAlly = game.cats.find((cat) => cat.id === ally.id);
    assert.equal(movedAlly.portalGuardLevel, level);
    assert.equal(movedAlly.portalAttackBonusLevel, level);

    const rangeGame = createGame(() => 0.5);
    const dog = createDog(2, 5, 1);
    rangeGame.dogs = [dog];
    const range = level + 1;
    assert.equal(canTeleportDogTo(rangeGame, dog.id, 5, 1 + range, range), true);
    assert.equal(canTeleportDogTo(rangeGame, dog.id, 5, 2 + range, range), false);
  }
});

test('Purrtal enemy penalties do not stack and expire after one damaging attack', () => {
  let game = createGame(() => 0.5);
  const strongPurrtal = createCat(3, CAT_COAT.RIFT);
  const weakPurrtal = createCat(1, CAT_COAT.RIFT);
  const defender = createCat(3, CAT_COAT.GREY);
  strongPurrtal.row = 13; strongPurrtal.col = 0;
  weakPurrtal.row = 13; weakPurrtal.col = 1;
  defender.row = 11; defender.col = 2;
  const dog = createDog(2, 8, 2);
  dog.hp = 100; dog.maxHp = 100;
  game.cats = [strongPurrtal, weakPurrtal, defender];
  game.dogs = [dog];
  game.phase = 'tactics';

  game = useActiveAbility(game, strongPurrtal.id, { targetDogId: dog.id, row: 9, col: 2 });
  game = useActiveAbility(game, weakPurrtal.id, { targetDogId: dog.id, row: 10, col: 2 });
  assert.equal(game.dogs[0].portalAttackPenaltyLevel, 3, 'the weaker portal does not add to or replace the 30% effect');

  game = resolveSection(continueCombat(game));

  const bite = game.events.find((event) => event.type === 'melee' && event.from === dog.id);
  assert.equal(bite.damage, 3, 'T2 Chomps deals 6 attack minus the level-three minimum penalty of 3');
  assert.equal(game.dogs[0].portalAttackPenaltyLevel, 0);
});

test('Purrtal percentage guard and attack bonus apply once with their level minimums', () => {
  let guarded = createGame(() => 0.5);
  const guardCaster = createCat(3, CAT_COAT.RIFT);
  const defender = createCat(3, CAT_COAT.GREY);
  const attacker = createDog(4, 10, 2);
  guardCaster.row = 13; guardCaster.col = 0;
  defender.row = 13; defender.col = 1;
  guarded.cats = [guardCaster, defender];
  guarded.dogs = [attacker];
  guarded.phase = 'tactics';
  guarded = useActiveAbility(guarded, guardCaster.id, { targetCatId: defender.id, row: 11, col: 2 });
  guarded = resolveSection(continueCombat(guarded));

  const guardedBite = guarded.events.find((event) => event.type === 'melee' && event.from === attacker.id);
  assert.equal(guardedBite.damage, 8, '30% guard blocks 3 from an 11-damage bite');
  assert.equal(guardedBite.blocked, 3);
  assert.equal(guarded.cats.find((cat) => cat.id === defender.id).portalGuardLevel, 0);

  let boosted = createGame(() => 0.5);
  const boostCaster = createCat(3, CAT_COAT.RIFT);
  const purrcy = createCat(3, CAT_COAT.ORANGE);
  const target = createDog(4, 5, 0);
  target.hp = 100; target.maxHp = 100;
  boostCaster.row = 13; boostCaster.col = 1;
  purrcy.row = 13; purrcy.col = 0;
  boosted.cats = [boostCaster, purrcy];
  boosted.dogs = [target];
  boosted.phase = 'tactics';
  boosted = useActiveAbility(boosted, boostCaster.id, { targetCatId: purrcy.id, row: 12, col: 0 });
  boosted = resolveSection(continueCombat(boosted));

  const boostedShots = boosted.events.filter((event) => event.type === 'shot' && event.from === purrcy.id && !event.miss);
  assert.deepEqual(boostedShots.map((event) => event.damage), [4, 4, 4]);
  assert.equal(boosted.cats.find((cat) => cat.id === purrcy.id).portalAttackBonusLevel, 0);
});

test('Purrtal rejects enemy destinations beyond two steps or already holding two dogs', () => {
  const game = createGame(() => 0.5);
  game.cats = [createCat(1, CAT_COAT.RIFT), createCat(1, CAT_COAT.GREY)];
  game.cats[0].row = 13; game.cats[0].col = 0;
  game.cats[1].row = 4; game.cats[1].col = 2;
  const target = createDog(2, 5, 3);
  game.dogs = [target, createDog(1, 3, 3), createDog(1, 3, 3)];
  game.phase = 'tactics';

  assert.equal(canTeleportDogTo(game, target.id, 2, 3), false, 'three steps is too far');
  assert.equal(canTeleportDogTo(game, target.id, 3, 3), false, 'a full two-dog stack is blocked');
  assert.equal(canTeleportDogTo(game, target.id, 4, 2), false, 'cats still block dog destinations');
  assert.equal(useActiveAbility(game, game.cats[0].id, { targetDogId: target.id, row: 3, col: 3 }), game);
});

function summonPhantom(level, row = 11, col = 3) {
  let game = createGame(() => 0.5);
  game.cats = [createCat(level, CAT_COAT.MIRAGE)];
  game.cats[0].row = 13;
  game.cats[0].col = 0;
  game.phase = 'tactics';
  return useActiveAbility(game, game.cats[0].id, { row, col });
}

test('Faux Paw phantom blocks scale 2x its level and have no HP', () => {
  for (const level of [1, 2, 3]) {
    const game = summonPhantom(level);
    const expectedBlocks = level * 2;
    assert.equal(game.decoys.length, 1);
    assert.equal(game.decoys[0].blocks, expectedBlocks);
    assert.equal(game.decoys[0].maxBlocks, expectedBlocks);
    assert.equal('hp' in game.decoys[0], false);
    assert.equal('maxHp' in game.decoys[0], false);
  }
});

test('two same-round Faux Paw casts stack their full values on one square', () => {
  let game = createGame(() => 0.5);
  game.cats = [createCat(1, CAT_COAT.MIRAGE), createCat(1, CAT_COAT.MIRAGE)];
  game.cats[0].row = 13; game.cats[0].col = 0;
  game.cats[1].row = 13; game.cats[1].col = 1;
  game.phase = 'tactics';

  game = useActiveAbility(game, game.cats[0].id, { row: 11, col: 3 });
  game = useActiveAbility(game, game.cats[1].id, { row: 11, col: 3 });

  assert.equal(game.decoys.length, 1);
  assert.equal(game.decoys[0].blocks, 4);
  assert.equal(game.decoys[0].maxBlocks, 4);

  game = continueCombat(game);
  assert.equal(game.decoys[0].blocks, 4, 'the combined total stays full during its summoning round');
  game.dogs = [];
  game = finishRound(game);
  assert.equal(game.decoys[0].blocks, 3, 'the combined square decays only once next round');
});

test('adding to an older decoy still decays the combined square only once', () => {
  let game = summonPhantom(1);
  const casterId = game.cats[0].id;
  const decoyId = game.decoys[0].id;

  game = continueCombat(game);
  game.dogs = [];
  game = finishRound(game);
  assert.equal(game.decoys[0].blocks, 1);

  game = startRound(game);
  game.dogs = [];
  game = openTacticsWindow(game);
  game = useActiveAbility(game, casterId, { row: 11, col: 3 });
  assert.equal(game.decoys.length, 1);
  assert.equal(game.decoys[0].id, decoyId);
  assert.equal(game.decoys[0].blocks, 3, 'the new +2 adds to the older remaining block');
  assert.equal(game.decoys[0].maxBlocks, 4);

  game = continueCombat(game);
  game = finishRound(game);
  assert.equal(game.decoys[0].blocks, 2, 'old and new blocks share one round decay');
});

test('Faux Paw phantom spends exactly one block on every damaging dog attack kind', () => {
  const attacks = [
    { role: DOG_ROLE.SCRUFFY, row: 10, style: undefined },
    { role: DOG_ROLE.FRISBEE, row: 8, style: 'frisbee' },
    { role: DOG_ROLE.TENNIS, row: 8, style: 'tennis' },
    { role: DOG_ROLE.LOBBER, row: 8, style: 'bone-bomb' },
  ];

  for (const attack of attacks) {
    let game = summonPhantom(1);
    const decoyId = game.decoys[0].id;
    game.cats = [];
    const dog = createDog(4, attack.row, 3, attack.role);
    dog.hp = 100;
    dog.maxHp = 100;
    game.dogs = [dog];
    game = resolveSection(continueCombat(game));

    const block = game.events.find((event) => event.to === decoyId);
    assert.ok(block, `${attack.role} should hit the phantom`);
    assert.equal(block.style, attack.style);
    assert.equal(block.decoyBlock, true);
    assert.equal(block.damage, 0);
    assert.equal(block.blocksBefore, 2);
    assert.equal(block.blocksAfter, 1);
    assert.ok(block.blocked > 0);
    assert.equal(game.decoys.length, 1);
  }
});

test('Faux Paw phantom also blocks bone bomb splash damage', () => {
  let game = summonPhantom(1, 11, 4);
  const decoyId = game.decoys[0].id;
  const tank = createCat(3, CAT_COAT.GREY);
  tank.row = 11;
  tank.col = 3;
  game.cats = [tank];
  const dog = createDog(4, 8, 3, DOG_ROLE.LOBBER);
  dog.hp = 100;
  dog.maxHp = 100;
  game.dogs = [dog];
  game = resolveSection(continueCombat(game));

  const block = game.events.find((event) => event.to === decoyId);
  assert.equal(block?.style, 'bone-bomb-secondary');
  assert.equal(block?.decoyBlock, true);
  assert.equal(block?.blocksAfter, 1);
  assert.equal(game.decoys.length, 1);
});

test('Faux Paw phantom keeps its full count this round, then decays once per later round', () => {
  let game = summonPhantom(1);
  const decoyId = game.decoys[0].id;
  game.cats = [];
  game = continueCombat(game);
  assert.equal(game.decoys.find((decoy) => decoy.id === decoyId)?.blocks, 2);

  game.dogs = [];
  game = finishRound(game);
  assert.equal(game.phase, 'prep');
  assert.equal(game.decoys.find((decoy) => decoy.id === decoyId)?.blocks, 1);

  game = startRound(game);
  assert.equal(game.phase, 'combat');
  assert.equal(game.decoys.find((decoy) => decoy.id === decoyId)?.blocks, 1);

  game.dogs = [];
  game = finishRound(game);
  assert.equal(game.decoys.some((decoy) => decoy.id === decoyId), false);
});

test('Faux Paw phantom decays from its remaining count after taking a hit', () => {
  let game = summonPhantom(3);
  const decoyId = game.decoys[0].id;
  game.cats = [];
  const dog = createDog(4, 10, 3, DOG_ROLE.SCRUFFY);
  dog.hp = 100;
  dog.maxHp = 100;
  game.dogs = [dog];
  game = resolveSection(continueCombat(game));
  assert.equal(game.decoys.find((decoy) => decoy.id === decoyId)?.blocks, 5);

  game.dogs = [];
  game = finishRound(game);
  assert.equal(game.decoys.find((decoy) => decoy.id === decoyId)?.blocks, 4);
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

test('Thunderpaws storm damage scales 2, 4, and 6 by level', () => {
  for (const level of [1, 2, 3]) {
    let game = createGame(() => 0.5);
    game.cats = [createCat(level, CAT_COAT.STORM)];
    game.cats[0].row = 13; game.cats[0].col = 0;
    const dog = createDog(4, 5, 4);
    dog.hp = 100; dog.maxHp = 100;
    game.dogs = [dog];
    game.phase = 'tactics';

    game = useActiveAbility(game, game.cats[0].id, { col: 4 });

    assert.equal(game.events.find((event) => event.style === 'lightning').damage, level * 2);
  }
});

test('Thunderpaws immediately wins when storm clears the final wave', () => {
  let game = createGame(() => 0.5);
  game.cats = [createCat(1, CAT_COAT.STORM)];
  game.cats[0].row = 13; game.cats[0].col = 0;
  const finalDog = createDog(1, 5, 4);
  finalDog.hp = 2;
  game.dogs = [finalDog];
  game.round = MAX_ROUNDS;
  game.phase = 'tactics';

  game = useActiveAbility(game, game.cats[0].id, { col: 4 });

  assert.equal(game.dogs.length, 0);
  assert.equal(game.phase, 'victory');
  assert.equal(game.events.some((event) => event.type === 'level-clear'), true);
});

test('Bombay Boom special hits a five-square plus — full damage at the centre, half to the sides', () => {
  let game = createGame(() => 0.5);
  game.cats = [createCat(2, CAT_COAT.BLACK)];
  game.cats[0].row = 12; game.cats[0].col = 2;
  const occupiedPlus = plusCells(5, 2);
  game.dogs = occupiedPlus.map(({ row, col }) => createDog(1, row, col));
  game.dogs.push(createDog(1, 5, 2)); // A sixth dog stacked on the centre square.
  const outside = createDog(1, 4, 1);
  game.dogs.push(outside);
  game.phase = 'tactics';

  game = useActiveAbility(game, game.cats[0].id, { row: 5, col: 2 });

  const attack = game.cats[0].attack;
  const hits = game.events.filter((event) => event.type === 'spell' && event.style.startsWith('bomb-cross'));
  assert.equal(hits.length, 6);
  // Visual stays one primary explosion + splash; damage varies by position.
  assert.equal(hits.filter((event) => event.style === 'bomb-cross').length, 1);
  assert.equal(hits.filter((event) => event.style === 'bomb-cross-secondary').length, 5);
  // Two dogs sit on the centre square → full damage; the four sides → half.
  assert.equal(hits.filter((event) => event.damage === attack).length, 2);
  assert.equal(hits.filter((event) => event.damage === attack / 2).length, 4);
  assert.equal(hits.reduce((total, event) => total + event.damage, 0), attack * 4);
  assert.equal(hits.every((event) => event.aimRow === 5 && event.aimCol === 2), true);
  assert.equal(game.dogs.find((dog) => dog.id === outside.id).hp, 8);
  assert.equal(game.cats[0].activeUsed, true);
});

test('Bombay Boom special scales centre and collateral damage by level', () => {
  for (const level of [1, 2, 3]) {
    let game = createGame(() => 0.5);
    game.cats = [createCat(level, CAT_COAT.BLACK)];
    game.cats[0].row = 12; game.cats[0].col = 2;
    const center = createDog(4, 5, 2);
    const side = createDog(4, 5, 3);
    game.dogs = [center, side];
    game.phase = 'tactics';

    game = useActiveAbility(game, game.cats[0].id, { row: 5, col: 2 });

    const hits = game.events.filter((event) => event.type === 'spell');
    assert.equal(hits.find((event) => event.to === center.id).damage, level * 2);
    assert.equal(hits.find((event) => event.to === side.id).damage, level);
  }
});

test('Bombay Boom plus footprint clips cleanly at battlefield edges', () => {
  assert.deepEqual(plusCells(0, 0), [
    { row: 0, col: 0 },
    { row: 1, col: 0 },
    { row: 0, col: 1 },
  ]);
  assert.equal(plusCells(5, 2).length, 5);
});

test('Meowstro makes two dogs on the selected square attack each other simultaneously', () => {
  let game = createGame(() => 0.5);
  game.cats = [createCat(1, CAT_COAT.ENCORE)];
  game.cats[0].row = 13; game.cats[0].col = 0;
  game.dogs = [createDog(1, 5, 2), createDog(2, 5, 2)];
  const [firstId, secondId] = game.dogs.map((dog) => dog.id);
  game.phase = 'tactics';

  game = useActiveAbility(game, game.cats[0].id, { row: 5, col: 2 });

  assert.equal(game.dogs.find((dog) => dog.id === firstId).hp, 2, 'takes the T2 dog\'s 6 attack');
  assert.equal(game.dogs.find((dog) => dog.id === secondId).hp, 9, 'takes the T1 dog\'s 4 attack');
  assert.deepEqual(
    game.events.filter((event) => event.type === 'dog-duel').map((event) => [event.from, event.to, event.damage]),
    [[firstId, secondId, 4], [secondId, firstId, 6]],
  );
  assert.equal(game.cats[0].activeUsed, true);
});

test('Meowstro pairs a lone selected dog with one randomly chosen orthogonal neighbor', () => {
  let game = createGame(() => 0.75);
  game.cats = [createCat(1, CAT_COAT.ENCORE)];
  game.cats[0].row = 13; game.cats[0].col = 0;
  const selected = createDog(1, 5, 2);
  const above = createDog(1, 4, 2);
  const right = createDog(2, 5, 3);
  const diagonal = createDog(4, 4, 3);
  game.dogs = [selected, above, right, diagonal];
  game.phase = 'tactics';

  game = useActiveAbility(game, game.cats[0].id, { row: 5, col: 2 });

  assert.equal(game.dogs.find((dog) => dog.id === selected.id).hp, 2, 'random 0.75 chooses the second adjacent option');
  assert.equal(game.dogs.find((dog) => dog.id === above.id).hp, above.maxHp, 'the other adjacent option is untouched');
  assert.equal(game.dogs.find((dog) => dog.id === right.id).hp, 9);
  assert.equal(game.dogs.find((dog) => dog.id === diagonal.id).hp, diagonal.maxHp, 'diagonal dogs are not adjacent');
});

test('Meowstro always uses the only adjacent occupied square when there is one option', () => {
  let game = createGame(() => 0);
  game.cats = [createCat(1, CAT_COAT.ENCORE)];
  game.cats[0].row = 13; game.cats[0].col = 0;
  const selected = createDog(1, 5, 2);
  const onlyNeighbor = createDog(2, 6, 2);
  game.dogs = [selected, onlyNeighbor, createDog(4, 5, 4)];
  game.phase = 'tactics';

  game = useActiveAbility(game, game.cats[0].id, { row: 5, col: 2 });

  assert.equal(game.dogs.find((dog) => dog.id === selected.id).hp, 2);
  assert.equal(game.dogs.find((dog) => dog.id === onlyNeighbor.id).hp, 9);
});

test('Meowstro does not spend the ability on an isolated dog', () => {
  const game = createGame(() => 0.5);
  game.cats = [createCat(1, CAT_COAT.ENCORE)];
  game.cats[0].row = 13; game.cats[0].col = 0;
  game.dogs = [createDog(1, 5, 2), createDog(1, 4, 3)];
  game.phase = 'tactics';

  assert.equal(useActiveAbility(game, game.cats[0].id, { row: 5, col: 2 }), game);
  assert.equal(game.cats[0].activeUsed, false);
});

test('Meowstro scales forced duel damage 1x, 1.5x, and 3x by level and rounds up', () => {
  const expectedDamageByLevel = [[5, 7], [8, 11], [15, 21]];
  for (const level of [1, 2, 3]) {
    let game = createGame(() => 0.5);
    game.cats = [createCat(level, CAT_COAT.ENCORE)];
    game.cats[0].row = 13; game.cats[0].col = 0;
    const first = createDog(1, 5, 2);
    const second = createDog(2, 5, 2);
    first.attack = 5;
    second.attack = 7;
    first.hp = 100; first.maxHp = 100;
    second.hp = 100; second.maxHp = 100;
    game.dogs = [first, second];
    game.phase = 'tactics';

    game = useActiveAbility(game, game.cats[0].id, { row: 5, col: 2 });

    assert.deepEqual(
      game.events.filter((event) => event.type === 'dog-duel').map((event) => event.damage),
      expectedDamageByLevel[level - 1],
    );
  }
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

test('round 10 refreshes active abilities at every tactics pause', () => {
  let game = createGame(() => 0.5);
  game = placeCoat(game, CAT_COAT.FROST, 13, 0);
  game.round = MAX_ROUNDS;
  game.phase = 'combat';
  game.cats[0].activeUsed = true;

  game = openTacticsWindow(game);
  assert.equal(game.cats[0].activeUsed, false);
  assert.match(game.message, /abilities refreshed/i);

  game.dogs = [createDog(3, 5, 5)];
  game = useActiveAbility(game, game.cats[0].id, { dogId: game.dogs[0].id });
  assert.equal(game.cats[0].activeUsed, true);

  game = continueCombat(game);
  game = openTacticsWindow(game);
  assert.equal(game.cats[0].activeUsed, false, 'the next final-round pause refreshes the cast again');
});

test('tactics pauses before round 10 do not refresh spent abilities', () => {
  let game = createGame(() => 0.5);
  game = placeCoat(game, CAT_COAT.FROST, 13, 0);
  game.round = MAX_ROUNDS - 1;
  game.phase = 'combat';
  game.cats[0].activeUsed = true;

  game = openTacticsWindow(game);
  assert.equal(game.cats[0].activeUsed, true);
});

test('every cat gets one normal range-limited move during each tactics window', () => {
  let game = createGame(() => 0.5);
  game = placeCoat(game, CAT_COAT.GREY, 12, 1);
  game = placeCoat(game, CAT_COAT.ORANGE, 12, 4);
  game = startRound(game);
  game = openTacticsWindow(game);
  const meleeId = game.cats.find((cat) => cat.coat === CAT_COAT.GREY).id;
  const rangedId = game.cats.find((cat) => cat.coat === CAT_COAT.ORANGE).id;

  assert.deepEqual(game.cats.find((cat) => cat.id === meleeId).tacticsOrigin, { row: 12, col: 1 });
  assert.equal(moveCatInTactics(game, meleeId, 10, 1), game, 'melee movement stays limited to one square');
  game = moveCatInTactics(game, meleeId, 11, 1);
  assert.deepEqual(
    [game.cats.find((cat) => cat.id === meleeId).row, game.cats.find((cat) => cat.id === meleeId).col],
    [11, 1],
  );
  assert.equal(moveCatInTactics(game, meleeId, 11, 2), game, 'the melee cat spent its break movement');

  game = moveCatInTactics(game, rangedId, 10, 4);
  assert.deepEqual(
    [game.cats.find((cat) => cat.id === rangedId).row, game.cats.find((cat) => cat.id === rangedId).col],
    [10, 4],
  );

  game = continueCombat(game);
  game = openTacticsWindow(game);
  game = moveCatInTactics(game, meleeId, 11, 2);
  assert.deepEqual(
    [game.cats.find((cat) => cat.id === meleeId).row, game.cats.find((cat) => cat.id === meleeId).col],
    [11, 2],
    'a new battle break grants a fresh move',
  );
});

test('tactics movement cannot enter a cat, dog, or decoy tile', () => {
  let game = createGame(() => 0.5);
  game = placeCoat(game, CAT_COAT.ORANGE, 12, 2);
  game = startRound(game);
  game = openTacticsWindow(game);
  const catId = game.cats[0].id;
  game.cats.push({ ...createCat(1, CAT_COAT.GREY), row: 12, col: 3 });
  game.dogs = [createDog(1, 11, 2)];
  game.decoys = [{ id: 'decoy-1', kind: 'phantom-cat', row: 13, col: 2, blocks: 1, maxBlocks: 1 }];

  assert.equal(moveCatInTactics(game, catId, 12, 3), game);
  assert.equal(moveCatInTactics(game, catId, 11, 2), game);
  assert.equal(moveCatInTactics(game, catId, 13, 2), game);
  assert.deepEqual([game.cats[0].row, game.cats[0].col], [12, 2]);
});

test('drag rules allow each cat normal tactics movement but reject merges and deployment', () => {
  const drop = (source, target, extra = {}) => getDropAction({
    source,
    target,
    catZoneStart: CAT_ZONE_START,
    rows: ROWS,
    cols: COLS,
    phase: 'tactics',
    ...extra,
  });
  const cat = {
    type: 'cat', id: 'cat-9', level: 1, coat: CAT_COAT.ORANGE, ability: 'homing',
    row: 12, col: 2, tacticsOrigin: { row: 12, col: 2 }, tacticsMoved: false,
  };

  assert.deepEqual(
    drop(cat, { kind: 'cell', row: 10, col: 2, occupied: null }),
    { type: 'tactics-move', row: 10, col: 2 },
  );
  assert.deepEqual(
    drop(cat, { kind: 'cell', row: 10, col: 1, occupied: null }),
    { type: 'invalid', reason: 'move-distance' },
  );
  assert.deepEqual(
    drop({ ...cat, tacticsMoved: true }, { kind: 'cell', row: 12, col: 3, occupied: null }),
    { type: 'invalid', reason: 'prep-moved' },
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

test('drag rules expose dog-yard movement only to veteran melee cats', () => {
  const target = { kind: 'cell', row: CAT_ZONE_START - 1, col: 2, occupied: null };
  const common = {
    target,
    catZoneStart: CAT_ZONE_START,
    rows: ROWS,
    cols: COLS,
    phase: 'prep',
  };
  const veteranMelee = {
    type: 'cat', id: 'melee-1', ability: 'melee', hasEnteredBattle: true,
    row: CAT_ZONE_START, col: 2, prepOrigin: { row: CAT_ZONE_START, col: 2 }, prepMoved: false,
  };

  assert.deepEqual(
    getDropAction({ ...common, source: veteranMelee }),
    { type: 'move', row: CAT_ZONE_START - 1, col: 2 },
  );
  assert.equal(
    getDropAction({ ...common, source: { ...veteranMelee, ability: 'homing' } }).type,
    'invalid',
  );
  assert.equal(
    getDropAction({ ...common, source: { ...veteranMelee, hasEnteredBattle: false } }).type,
    'invalid',
  );
  assert.deepEqual(
    getDropAction({
      ...common,
      source: { type: 'shop-fighter', id: 'shop-melee', level: 1, coat: CAT_COAT.GREY },
      target: {
        ...target,
        occupied: { id: 'advanced-melee', level: 1, coat: CAT_COAT.GREY },
      },
    }),
    { type: 'purchase-merge', targetType: 'cat', targetId: 'advanced-melee' },
  );
});
