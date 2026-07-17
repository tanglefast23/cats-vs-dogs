import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CAT_STATS,
  CAT_COAT,
  CAT_COAT_INFO,
  DOG_ROLE,
  catStatsFor,
  dogStatsFor,
  ROWS,
  COLS,
  CAT_ZONE_START,
  MAX_ROUNDS,
  ACTIONS_PER_ROUND,
  MAX_FIELD_CATS,
  BENCH_SIZE,
  DOG_CELL_CAPACITY,
  MAX_SHOP_SIZE,
  createGame,
  restoreGame,
  makeShop,
  availableCatCoatsForRound,
  shopTierForRound,
  shopSizeForRound,
  addCatToBench,
  combineCats,
  placeCat,
  moveCat,
  resolveSection,
  startRound,
  finishRound,
  createCat,
  createDog,
  generateWave,
  availableDogRolesForRound,
  waveCountForRound,
  minimumDogTierForRound,
  featuredDogRolesForRound,
  buyShopCat,
  purchaseShopFighterToBoard,
  refreshShop,
  toggleSaveShopSlot,
  mergeUnitOnto,
  catTooltipInfo,
  dogTooltipInfo,
  closestDogByRowPriority,
  splitDamage,
  catSaleQuote,
  sellCat,
} from '../src/game-engine.js';

test('saved runs restore only stable phases and reseed generated IDs', () => {
  const original = createGame(() => 0.5);
  const snapshot = JSON.parse(JSON.stringify({ ...original, random: undefined }));
  snapshot.cats.push({ ...createCat(), id: 'cat-999999', row: 10, col: 0 });
  snapshot.events = [{ type: 'stale-animation' }];

  const random = () => 0.25;
  const restored = restoreGame(snapshot, random);

  assert.equal(restored.phase, 'prep');
  assert.equal(restored.random, random);
  assert.deepEqual(restored.events, []);
  assert.ok(Number(createCat().id.split('-').at(-1)) > 999999);
  assert.equal(restoreGame({ ...snapshot, phase: 'combat' }, random), null);
  assert.equal(restoreGame({ ...snapshot, inventory: [] }, random), null);
});

test('desktop board uses six columns, fourteen rows, a five-cat squad, and two actions', () => {
  assert.equal(COLS, 6);
  assert.equal(ROWS, 14);
  assert.equal(CAT_ZONE_START, 10);
  assert.equal(ROWS - CAT_ZONE_START, 4);
  assert.equal(ACTIONS_PER_ROUND, 2);
  assert.equal(MAX_FIELD_CATS, 5);
  assert.equal(MAX_ROUNDS, 10);
});

test('the next-wave preview is the exact wave released when combat starts', () => {
  const game = createGame(() => 0.25);
  const preview = game.nextWave.map(({ id, tier, row, col }) => ({ id, tier, row, col }));

  assert.equal(preview.length, 2);
  const started = startRound(game);
  assert.deepEqual(
    started.dogs.map(({ id, tier, row, col }) => ({ id, tier, row, col })),
    preview,
  );
  assert.deepEqual(started.nextWave, []);
});

test('SAP economy expands shop choices while resetting to ten gold', () => {
  let game = createGame(() => 0.5);
  assert.equal(MAX_SHOP_SIZE, 5);
  assert.equal(game.shop.length, 3);
  assert.equal(game.gold, 10);

  while (game.round < MAX_ROUNDS) {
    game.gold = 1;
    game.phase = 'combat';
    game.dogs = [];
    game = finishRound(game);
    assert.equal(game.gold, 10, `round ${game.round} should start with fresh gold`);
    const expectedSize = game.round >= 9 ? 5 : game.round >= 5 ? 4 : 3;
    assert.equal(game.shop.length, expectedSize, `round ${game.round} should have ${expectedSize} shop choices`);
  }
});

test('rolling replaces the current shop choices while preserving saved slots', () => {
  let game = createGame(() => 0.2);
  game = toggleSaveShopSlot(game, 2);
  const savedId = game.shop[2].id;
  game = refreshShop(game);

  assert.equal(game.shop.length, 3);
  assert.equal(game.shop[2].id, savedId);
  assert.equal(game.shop[2].saved, true);
});

test('cat unlock rounds are independent from the odd-round stat tier curve', () => {
  assert.equal(shopTierForRound(1), 1);
  assert.equal(shopTierForRound(2), 1);
  assert.equal(shopTierForRound(3), 2);
  assert.equal(shopTierForRound(5), 3);
  assert.equal(shopTierForRound(7), 4);
  assert.deepEqual(availableCatCoatsForRound(1), [0, 1, 2, 3]);
  assert.deepEqual(availableCatCoatsForRound(3), [0, 1, 2, 3]);
  assert.deepEqual(availableCatCoatsForRound(4), [0, 1, 2, 3, 4, 6, 7, 8, 9, 10]);
  assert.deepEqual(availableCatCoatsForRound(5), [0, 1, 2, 3, 4, 6, 7, 8, 9, 10]);
  assert.deepEqual(availableCatCoatsForRound(7), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('battle cats use the player-facing T1, T2, and T3 categories', () => {
  assert.deepEqual(
    [CAT_COAT.ORANGE, CAT_COAT.GREY, CAT_COAT.WHITE, CAT_COAT.CALICO]
      .map((coat) => CAT_COAT_INFO[coat].shopTier),
    [1, 1, 1, 1],
  );
  assert.deepEqual(
    [CAT_COAT.BLACK, CAT_COAT.FROST, CAT_COAT.RIFT, CAT_COAT.MIRAGE, CAT_COAT.STORM, CAT_COAT.ENCORE]
      .map((coat) => CAT_COAT_INFO[coat].shopTier),
    [2, 2, 2, 2, 2, 2],
  );
  assert.equal(CAT_COAT_INFO[CAT_COAT.PRISM].shopTier, 3);
  assert.equal(CAT_COAT_INFO[CAT_COAT.CALICO].unlockRound, 1);
  assert.equal(CAT_COAT_INFO[CAT_COAT.PRISM].unlockRound, 7);
});

test('every cat has one explicit strength and a real weakness at every level', () => {
  for (const info of Object.values(CAT_COAT_INFO)) {
    assert.ok(info.role);
    assert.ok(info.strength);
    assert.ok(info.weakness);
  }

  for (const level of [1, 2, 3]) {
    const purrcy = catStatsFor(level, CAT_COAT.ORANGE);
    const clawdius = catStatsFor(level, CAT_COAT.GREY);
    const hissiletoe = catStatsFor(level, CAT_COAT.WHITE);
    const bombay = catStatsFor(level, CAT_COAT.BLACK);
    const nonTankStats = Object.keys(CAT_COAT_INFO)
      .filter((coat) => Number(coat) !== CAT_COAT.GREY)
      .map((coat) => catStatsFor(level, Number(coat)));

    assert.ok(purrcy.attack > hissiletoe.attack, `L${level} straight damage pays for lane lock`);
    assert.equal(bombay.attack, hissiletoe.attack, `L${level} Bombay's lane bomb has medium damage`);
    assert.ok(clawdius.hp > Math.max(...nonTankStats.map((stats) => stats.hp)));
    assert.ok(clawdius.attack < hissiletoe.attack, `L${level} tank damage stays below the generalist`);
  }
});

test('every cat uses linear 1x, 2x, and 3x attack scaling by level', () => {
  for (const coat of Object.keys(CAT_COAT_INFO).map(Number)) {
    const levelOne = catStatsFor(1, coat);
    const levelTwo = catStatsFor(2, coat);
    const levelThree = catStatsFor(3, coat);

    assert.ok(levelTwo.hp > levelOne.hp * 3, `coat ${coat} L2 health should beat three L1 cats`);
    assert.equal(levelTwo.attack, levelOne.attack * 2, `coat ${coat} L2 attack should double L1`);
    assert.ok(levelThree.hp > levelTwo.hp * 3, `coat ${coat} L3 health should beat three L2 cats`);
    assert.equal(levelThree.attack, levelOne.attack * 3, `coat ${coat} L3 attack should triple L1`);
  }
});

test('Purrcy pellets scale from 1-1-1 to 2-2-2 and 3-3-3', () => {
  assert.deepEqual(
    [1, 2, 3].map((level) => splitDamage(catStatsFor(level, CAT_COAT.ORANGE).attack, 3)),
    [[1, 1, 1], [2, 2, 2], [3, 3, 3]],
  );
});

test('SAP shop slots grow on rounds five and nine while fighter unlocks remain separate', () => {
  const roundThree = makeShop(() => 0.999, null, 3);
  const roundFive = makeShop(() => 0.999, null, 5);
  const roundSeven = makeShop(() => 0.999, null, 7);
  const roundNine = makeShop(() => 0.999, null, 9);

  assert.equal(shopSizeForRound(1), 3);
  assert.equal(shopSizeForRound(4), 3);
  assert.equal(shopSizeForRound(5), 4);
  assert.equal(shopSizeForRound(8), 4);
  assert.equal(shopSizeForRound(9), 5);
  assert.equal(roundThree.length, 3);
  assert.equal(roundFive.length, 4);
  assert.equal(roundSeven.length, 4);
  assert.equal(roundNine.length, 5);
  assert.deepEqual(availableCatCoatsForRound(3), [0, 1, 2, CAT_COAT.CALICO]);
  assert.deepEqual(availableCatCoatsForRound(4), [
    0, 1, 2, CAT_COAT.CALICO, CAT_COAT.BLACK,
    CAT_COAT.FROST, CAT_COAT.RIFT, CAT_COAT.MIRAGE, CAT_COAT.STORM, CAT_COAT.ENCORE,
  ]);
  assert.deepEqual(availableCatCoatsForRound(7), [
    0, 1, 2, CAT_COAT.CALICO, CAT_COAT.BLACK, CAT_COAT.PRISM,
    CAT_COAT.FROST, CAT_COAT.RIFT, CAT_COAT.MIRAGE, CAT_COAT.STORM, CAT_COAT.ENCORE,
  ]);
});

test('the round-five shop adds a fourth slot without dropping saved pets', () => {
  const early = makeShop(() => 0.2, null, 4);
  early[2].saved = true;
  const expanded = makeShop(() => 0.8, early, 5);

  assert.equal(expanded.length, 4);
  assert.equal(expanded[2].id, early[2].id);
  assert.equal(expanded[2].saved, true);
});

test('an unobstructed dog breaches on its seventh two-square action', () => {
  let game = createGame(() => 0.5);
  game.dogs = [createDog(1, 0, 2)];

  for (let action = 0; action < 6; action += 1) game = resolveSection(game);
  assert.equal(game.lives, 3);
  assert.equal(game.dogs[0].row, 12);

  game = resolveSection(game);
  assert.equal(game.lives, 2);
  assert.equal(game.dogs.length, 0);
});

test('three level-one cats combine into one level-two cat', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 1 });
  game = addCatToBench(game, { level: 1 });
  game = addCatToBench(game, { level: 1 });

  game = combineCats(game);

  assert.equal(game.bench.length, 1);
  assert.equal(game.bench[0].level, 2);
  assert.equal(game.bench[0].hp, CAT_STATS[2].hp);
});

test('nine level-one cats can still combine through the three-slot workbench', () => {
  let game = createGame(() => 0.5);
  let levelTwoStackId = null;

  for (let group = 0; group < 3; group += 1) {
    game = addCatToBench(game, { level: 1 });
    const groupTargetId = game.bench.at(-1).id;

    for (let copy = 1; copy < 3; copy += 1) {
      game = addCatToBench(game, { level: 1 });
      const sourceId = game.bench.at(-1).id;
      game = mergeUnitOnto(game, 'bench', sourceId, 'bench', groupTargetId);
    }

    if (levelTwoStackId) {
      game = mergeUnitOnto(game, 'bench', groupTargetId, 'bench', levelTwoStackId);
    } else levelTwoStackId = groupTargetId;
  }

  assert.deepEqual(game.bench.map((cat) => cat.level), [3]);
});

test('level-one Purrcy deals three damage per action', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 1 });
  game = placeCat(game, 0, 12, 2);
  game.dogs = [createDog(1, 0, 2)];

  game = resolveSection(game);
  assert.equal(game.dogs[0].hp, 5);

  game = resolveSection(game);
  assert.equal(game.dogs[0].hp, 2);
});

test('orange cat splits one attack into rapid burst pellets', () => {
  assert.deepEqual(splitDamage(2, 3), [1, 1, 0]);
  assert.deepEqual(splitDamage(3, 3), [1, 1, 1]);
  assert.deepEqual(splitDamage(5, 3), [2, 2, 1]);

  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 1, coat: CAT_COAT.ORANGE });
  game = placeCat(game, 0, 12, 2);
  game.dogs = [createDog(1, 0, 2)];

  game = resolveSection(game);
  const shots = game.events.filter((event) => event.type === 'shot');

  assert.equal(shots.length, 3);
  assert.equal(shots.every((shot) => shot.burst), true);
  assert.equal(shots.reduce((sum, shot) => sum + shot.damage, 0), 3);
  assert.deepEqual(shots.map((shot) => shot.damage), [1, 1, 1]);
  assert.equal(shots[0].hpBefore, 8);
  assert.equal(shots[0].hpAfter, 7);
  assert.equal(shots[1].hpAfter, 6);
  assert.equal(shots[2].hpAfter, 5);
  assert.equal(game.dogs[0].hp, 5);
});

test('Purrcy hits a dying dog before leftover pellets sail through', () => {
  let game = createGame(() => 0.5);
  const purrcy = createCat(1, CAT_COAT.ORANGE);
  purrcy.row = 12;
  purrcy.col = 2;
  const dog = createDog(1, 3, 2);
  dog.hp = 2;
  game.cats = [purrcy];
  game.dogs = [dog];

  game = resolveSection(game);

  const shots = game.events.filter((event) => event.type === 'shot');
  assert.deepEqual(shots.map((shot) => shot.miss), [false, false, true]);
  assert.deepEqual(shots.map((shot) => shot.pelletIndex), [0, 1, 2]);
  assert.deepEqual(
    shots.slice(0, 2).map((shot) => [shot.hpBefore, shot.hpAfter]),
    [[2, 1], [1, 0]],
  );
  assert.equal(game.dogs.length, 0);
});

test('orange cat burst keeps hitting the nearest dog in its column', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 1, coat: CAT_COAT.ORANGE });
  game = placeCat(game, 0, 12, 2);
  game.dogs = [createDog(1, 1, 2), createDog(1, 4, 2)];

  game = resolveSection(game);

  const upperDog = game.dogs.find((dog) => dog.row === 3);
  const lowerDog = game.dogs.find((dog) => dog.row === 6);
  assert.equal(upperDog.hp, 8);
  assert.equal(lowerDog.hp, 5);
});

test('level-two Purrcy fires three equal two-damage pellets', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 2, coat: CAT_COAT.ORANGE });
  game = placeCat(game, 0, 12, 2);
  game.dogs = [createDog(2, 0, 2)];

  game = resolveSection(game);
  const shots = game.events.filter((event) => event.type === 'shot');
  assert.equal(shots.length, 3);
  assert.deepEqual(shots.map((shot) => shot.damage), [2, 2, 2]);
  assert.equal(game.dogs[0].hp, 7);
});

test('white cat targets the lowest dog row before the nearest column', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 1, coat: CAT_COAT.WHITE });
  game = placeCat(game, 0, 12, 1);
  // A lower dog two lanes over takes priority over a higher dog in Hissiletoe's column.
  game.dogs = [createDog(1, 0, 1), createDog(1, 10, 3)];

  game = resolveSection(game);

  const ownColumnDog = game.dogs.find((dog) => dog.col === 1);
  const otherDog = game.dogs.find((dog) => dog.col === 3);
  const shot = game.events.find((event) => event.type === 'shot');

  assert.equal(catStatsFor(1, CAT_COAT.WHITE).attack, 2);
  assert.equal(ownColumnDog.hp, 8);
  assert.equal(otherDog.hp, 6);
  assert.equal(shot.style, 'homing');
  assert.equal(shot.damage, 2);
  assert.equal(shot.fromCol, 1);
  assert.equal(shot.col, 3);
});

test('white cat uses lowest row, then nearest column, then random on equal distances', () => {
  const cat = { row: 12, col: 2 };

  // The lowest dog wins even when a higher dog is in Hissiletoe's own column.
  const lowest = closestDogByRowPriority(
    cat,
    [createDog(1, 4, 2), createDog(1, 8, 5), createDog(1, 2, 1)],
    () => 0,
  );
  assert.equal(lowest.col, 5);
  assert.equal(lowest.row, 8);

  // Multiple dogs on the lowest row: nearest column wins.
  const nearestColumn = closestDogByRowPriority(
    cat,
    [createDog(1, 8, 0), createDog(1, 8, 3), createDog(1, 7, 2)],
    () => 0,
  );
  assert.equal(nearestColumn.col, 3);
  assert.equal(nearestColumn.row, 8);

  // Equal row and column distance → random among ties.
  const left = createDog(1, 6, 1);
  const right = createDog(1, 6, 3);
  const pickLeft = closestDogByRowPriority(cat, [left, right], () => 0);
  const pickRight = closestDogByRowPriority(cat, [left, right], () => 0.99);
  assert.equal(pickLeft.id, left.id);
  assert.equal(pickRight.id, right.id);
});

test('Clawdius has extreme HP and tiny melee damage only in the front tile', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 1, coat: CAT_COAT.GREY });
  game = placeCat(game, 0, 11, 2);
  game.dogs = [createDog(1, 10, 2), createDog(1, 4, 2)];

  assert.equal(game.cats[0].maxHp, 18);
  assert.equal(game.cats[0].attack, 1);

  game = resolveSection(game);

  const frontDog = game.dogs.find((dog) => dog.row === 10);
  const rearDog = game.dogs.find((dog) => dog.col === 2 && dog.row !== 10);
  const catMelee = game.events.find((event) => event.type === 'cat-melee');

  assert.equal(frontDog.hp, 7);
  assert.equal(rearDog.hp, 8);
  assert.equal(rearDog.row, 6);
  assert.equal(catMelee.damage, 1);
  assert.equal(game.events.some((event) => event.type === 'shot'), false);
});

test('grey cat still swings when no dog is directly in front', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 1, coat: CAT_COAT.GREY });
  game = placeCat(game, 0, 12, 2);
  game.dogs = [createDog(1, 8, 2)];

  game = resolveSection(game);

  const swing = game.events.find((event) => event.type === 'cat-melee');
  assert.equal(game.dogs[0].hp, 8);
  assert.equal(swing.miss, true);
  assert.equal(swing.to, null);
  assert.equal(game.events.some((event) => event.type === 'shot'), false);
});

test('Calico Tangler marks a dog to skip its next unblocked move without healing', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 1, coat: CAT_COAT.CALICO });
  game = placeCat(game, 0, 12, 2);
  game.cats[0].hp = 4;
  game.dogs = [createDog(1, 5, 2)];

  game = resolveSection(game);

  assert.equal(game.cats[0].hp, 4);
  assert.equal(game.events.some((event) => event.type === 'heal'), false);
  assert.equal(game.dogs[0].hp, 7);
  assert.equal(game.dogs[0].row, 5);
  assert.equal(game.dogs[0].tangled, false);
  assert.equal(game.dogs[0].tangledOnce, true);
  assert.equal(game.events.some((event) => event.type === 'tangle-skip'), true);

  game = resolveSection(game);
  assert.equal(game.dogs[0].hp, 6);
  assert.equal(game.dogs[0].row, 7, 'the same dog cannot be locked by yarn forever');
});

test('Knotty Kitty tangles for one, two, or three moves by level', () => {
  for (const level of [1, 2, 3]) {
    let game = createGame(() => 0.5);
    game.cats = [createCat(level, CAT_COAT.CALICO)];
    game.cats[0].row = 12; game.cats[0].col = 2;
    const dog = createDog(4, 5, 2);
    dog.frozenActions = 1;
    game.dogs = [dog];

    game = resolveSection(game);

    assert.equal(game.dogs[0].tangledMovesRemaining, level);
    assert.equal(game.dogs[0].tangled, true);
  }
});

test('Bombay Boom lobs one medium bomb at the nearest dog in his own lane', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 1, coat: CAT_COAT.BLACK });
  game = placeCat(game, 0, 12, 2);
  const far = createDog(1, 4, 2);
  const nearest = createDog(1, 7, 2);
  const otherLane = createDog(1, 8, 3);
  game.dogs = [far, nearest, otherLane];

  game = resolveSection(game);

  assert.equal(game.dogs.find((dog) => dog.id === nearest.id).hp, 6);
  assert.equal(game.dogs.find((dog) => dog.id === far.id).hp, 8);
  assert.equal(game.dogs.find((dog) => dog.id === otherLane.id).hp, 8);
  const bombs = game.events.filter((event) => event.type === 'shot' && event.style === 'bomb');
  assert.equal(bombs.length, 1);
  assert.equal(bombs[0].to, nearest.id);
});

test('Prism Sphinx beam pierces up to three dogs in its column', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 1, coat: CAT_COAT.PRISM });
  game = placeCat(game, 0, 12, 2);
  game.dogs = [createDog(1, 3, 2), createDog(1, 5, 2), createDog(1, 7, 2), createDog(1, 7, 4)];

  game = resolveSection(game);

  const sameColumn = game.dogs.filter((dog) => dog.col === 2);
  assert.deepEqual(sameColumn.map((dog) => dog.hp), [5, 5, 5]);
  assert.equal(game.dogs.find((dog) => dog.col === 4).hp, 8);
});

test('dog tiers scale through tier four while retaining their strategic role', () => {
  assert.ok(generateWave(3, () => 0.999).some((dog) => dog.tier === 2));
  assert.ok(generateWave(5, () => 0.999).some((dog) => dog.tier === 3));
  const finalWave = generateWave(7, () => 0.999);
  const alpha = finalWave.find((dog) => dog.tier === 4);
  assert.ok(alpha);
  assert.match(dogTooltipInfo(alpha).title, /^T4 /);
});

test('dog waves scale in count and stop rolling low tiers late', () => {
  assert.deepEqual(
    Array.from({ length: MAX_ROUNDS }, (_, index) => waveCountForRound(index + 1)),
    [2, 3, 3, 4, 4, 5, 5, 6, 6, 7],
  );
  assert.deepEqual(
    Array.from({ length: MAX_ROUNDS }, (_, index) => minimumDogTierForRound(index + 1)),
    [1, 1, 1, 1, 2, 2, 2, 2, 3, 3],
  );

  const roundNine = generateWave(9, () => 0);
  const roundTen = generateWave(10, () => 0);
  assert.equal(roundNine.length, 6);
  assert.equal(roundTen.length, 7);
  for (const wave of [roundNine, roundTen]) {
    assert.ok(wave.every((dog) => dog.col >= 0 && dog.col < COLS));
    assert.ok(Array.from({ length: COLS }, (_, col) => wave.filter((dog) => dog.col === col).length)
      .every((count) => count <= DOG_CELL_CAPACITY));
  }
  assert.ok(roundNine.every((dog) => dog.tier >= 3));
  assert.ok(roundTen.every((dog) => dog.tier >= 3));
  assert.deepEqual(featuredDogRolesForRound(9), [DOG_ROLE.FRISBEE, DOG_ROLE.LOBBER, DOG_ROLE.MEDIC]);
  assert.deepEqual(featuredDogRolesForRound(10), [DOG_ROLE.LOBBER, DOG_ROLE.MEDIC, DOG_ROLE.GROWLER]);
  assert.ok(featuredDogRolesForRound(9).every((role) => roundNine.some((dog) => dog.role === role)));
  assert.ok(featuredDogRolesForRound(10).every((role) => roundTen.some((dog) => dog.role === role)));
});

test('dog roles pay for their special ability with distinct health and bite curves', () => {
  for (const tier of [1, 2, 3, 4]) {
    const biter = dogStatsFor(tier, DOG_ROLE.SCRUFFY);
    const tennis = dogStatsFor(tier, DOG_ROLE.TENNIS);
    const howler = dogStatsFor(tier, DOG_ROLE.HOWLER);
    const jumper = dogStatsFor(tier, DOG_ROLE.JUMPER);
    const frisbee = dogStatsFor(tier, DOG_ROLE.FRISBEE);
    const lobber = dogStatsFor(tier, DOG_ROLE.LOBBER);
    const skittish = dogStatsFor(tier, DOG_ROLE.SKITTISH);
    const medic = dogStatsFor(tier, DOG_ROLE.MEDIC);
    const growler = dogStatsFor(tier, DOG_ROLE.GROWLER);

    assert.ok([tennis, howler, jumper, frisbee, lobber, skittish, medic, growler]
      .every((specialist) => biter.hp > specialist.hp));
    assert.ok(biter.attack > tennis.attack && tennis.attack > howler.attack);
    assert.ok(jumper.attack < biter.attack);
    assert.ok(skittish.hp < lobber.hp && skittish.attack <= howler.attack,
      `T${tier} Sir Flinches pays for Panic Shuffle with the frailest stat line`);
    assert.ok(howler.howlBonus > howler.attack, `T${tier} Howler contributes through support, not biting`);
    assert.ok(medic.healPower > medic.attack, `T${tier} Medic contributes through healing, not biting`);
    assert.ok(growler.fearPower > growler.attack, `T${tier} Growler contributes through disruption, not biting`);
  }
});

test('an unobstructed dog advances two rows in one action', () => {
  let game = createGame(() => 0.5);
  game.dogs = [createDog(1, 0, 2)];

  game = resolveSection(game);

  assert.equal(game.dogs[0].row, 2);
  assert.deepEqual(
    game.events.filter((event) => event.type === 'move')
      .map(({ fromRow, toRow }) => ({ fromRow, toRow })),
    [{ fromRow: 0, toRow: 2 }],
  );
});

test('Barkour Bandit advances three squares while other dogs move two', () => {
  let game = createGame(() => 0.5);
  game.dogs = [
    createDog(1, 0, 1, DOG_ROLE.SCRUFFY),
    createDog(1, 0, 4, DOG_ROLE.JUMPER),
  ];

  game = resolveSection(game);

  assert.equal(game.dogs.find((dog) => dog.role === DOG_ROLE.SCRUFFY).row, 2);
  assert.equal(game.dogs.find((dog) => dog.role === DOG_ROLE.JUMPER).row, 3);
  assert.match(dogTooltipInfo(game.dogs.find((dog) => dog.role === DOG_ROLE.JUMPER)).attack, /3 squares/);
});

test('Barkour Bandit Light Gear adds one damage to every damaging hit', () => {
  let game = createGame(() => 0.5);
  const cat = createCat(1, CAT_COAT.GREY);
  cat.row = 10;
  cat.col = 2;
  cat.attack = 1;
  const barkour = createDog(2, 9, 2, DOG_ROLE.JUMPER);
  game.cats = [cat];
  game.dogs = [barkour];

  game = resolveSection(game);

  const hit = game.events.find((event) => event.type === 'cat-melee' && event.to === barkour.id);
  assert.equal(hit.damage, 2);
  assert.equal(hit.lightGearDamage, 1);
  assert.match(dogTooltipInfo(barkour).note, /Light Gear/);
});

test('Sir Flinches-a-Lot panic-steps after surviving a hit so later column pellets miss', () => {
  let game = createGame(() => 0);
  const cat = createCat(1, CAT_COAT.ORANGE);
  cat.row = 12;
  cat.col = 2;
  const skittish = createDog(2, 5, 2, DOG_ROLE.SKITTISH);
  skittish.frozenActions = 1;
  game.cats = [cat];
  game.dogs = [skittish];

  game = resolveSection(game);

  const survivor = game.dogs.find((dog) => dog.id === skittish.id);
  assert.equal(survivor.hp, 5, 'only the first one-damage pellet connects');
  assert.equal(survivor.col, 1);
  assert.equal(game.events.filter((event) => event.type === 'shot' && !event.miss).length, 1);
  assert.equal(game.events.filter((event) => event.type === 'shot' && event.miss).length, 2);
  assert.deepEqual(
    game.events.find((event) => event.type === 'panic-sidestep').path,
    [{ row: 5, col: 2 }, { row: 5, col: 1 }],
  );
});

test('Panic Shuffle may join one dog but treats a square with two dogs as blocked', () => {
  let game = createGame(() => 0);
  const cat = createCat(1, CAT_COAT.ORANGE);
  cat.row = 12;
  cat.col = 2;
  const skittish = createDog(2, 5, 2, DOG_ROLE.SKITTISH);
  const leftBlockers = [
    createDog(1, 5, 1, DOG_ROLE.SCRUFFY),
    createDog(1, 5, 1, DOG_ROLE.SCRUFFY),
  ];
  const rightDog = createDog(1, 5, 3, DOG_ROLE.SCRUFFY);
  [skittish, ...leftBlockers, rightDog].forEach((dog) => { dog.frozenActions = 1; });
  game.cats = [cat];
  game.dogs = [skittish, ...leftBlockers, rightDog];

  game = resolveSection(game);

  assert.equal(game.dogs.find((dog) => dog.id === skittish.id).col, 3);
  assert.equal(game.dogs.filter((dog) => dog.row === 5 && dog.col === 3).length, 2);
});

test('Panic Shuffle stays put when both neighboring squares already hold two dogs', () => {
  let game = createGame(() => 0);
  const cat = createCat(1, CAT_COAT.ORANGE);
  cat.row = 12;
  cat.col = 2;
  const skittish = createDog(2, 5, 2, DOG_ROLE.SKITTISH);
  const blockers = [1, 1, 3, 3].map((col) => createDog(1, 5, col, DOG_ROLE.SCRUFFY));
  [skittish, ...blockers].forEach((dog) => { dog.frozenActions = 1; });
  game.cats = [cat];
  game.dogs = [skittish, ...blockers];

  game = resolveSection(game);

  assert.equal(game.dogs.find((dog) => dog.id === skittish.id).col, 2);
  assert.equal(game.events.some((event) => event.type === 'panic-sidestep'), false);
});

test('a dog uses its advance to reach and attack a cat in the same action', () => {
  let game = createGame(() => 0.5);
  game.cats = [createCat(1, CAT_COAT.ORANGE)];
  game.cats[0].row = 3;
  game.cats[0].col = 2;
  game.cats[0].attack = 0;
  game.dogs = [createDog(1, 0, 2)];

  game = resolveSection(game);

  assert.equal(game.dogs[0].row, 2);
  assert.equal(game.cats.length, 0);
  assert.ok(game.events.some((event) => event.type === 'move' && event.fromRow === 0 && event.toRow === 2));
  assert.ok(game.events.some((event) => event.type === 'melee' && event.fromRow === 2 && event.toRow === 3));
});

test('a blocked dog moves right then down instead of moving sideways twice', () => {
  let game = createGame(() => 0.5);
  const movingDog = createDog(1, 0, 2);
  const blockers = [createDog(1, 1, 2), createDog(1, 1, 2)];
  blockers.forEach((dog) => { dog.frozenActions = 1; });
  game.dogs = [movingDog, ...blockers];

  game = resolveSection(game);

  const moved = game.dogs.find((dog) => dog.id === movingDog.id);
  const event = game.events.find((entry) => entry.type === 'move' && entry.id === movingDog.id);
  assert.deepEqual({ row: moved.row, col: moved.col }, { row: 1, col: 3 });
  assert.deepEqual(event.path, [
    { row: 0, col: 2 },
    { row: 0, col: 3 },
    { row: 1, col: 3 },
  ]);
});

test('a dog repeats its horizontal direction only when down is blocked', () => {
  let game = createGame(() => 0.5);
  const movingDog = createDog(1, 0, 2);
  const blockers = [
    createDog(1, 1, 2), createDog(1, 1, 2),
    createDog(1, 1, 3), createDog(1, 1, 3),
  ];
  blockers.forEach((dog) => { dog.frozenActions = 1; });
  game.dogs = [movingDog, ...blockers];

  game = resolveSection(game);

  const event = game.events.find((entry) => entry.type === 'move' && entry.id === movingDog.id);
  assert.deepEqual(event.path, [
    { row: 0, col: 2 },
    { row: 0, col: 3 },
    { row: 0, col: 4 },
  ]);
});

test('the first step chooses the direction with a fully open route', () => {
  let game = createGame(() => 0.5);
  const movingDog = createDog(1, 0, 2);
  const blockerCells = [[1, 2], [1, 3], [0, 4], [1, 1]];
  const blockers = blockerCells.flatMap(([row, col]) => [
    createDog(1, row, col), createDog(1, row, col),
  ]);
  blockers.forEach((dog) => { dog.frozenActions = 1; });
  game.dogs = [movingDog, ...blockers];

  game = resolveSection(game);

  const event = game.events.find((entry) => entry.type === 'move' && entry.id === movingDog.id);
  assert.deepEqual(event.path, [
    { row: 0, col: 2 },
    { row: 0, col: 1 },
    { row: 0, col: 0 },
  ]);
});

test('two dogs can share a cell but a third stops behind the full stack', () => {
  let game = createGame(() => 0.5);
  game.cats = [createCat(1, CAT_COAT.GREY)];
  game.cats[0].row = 5;
  game.cats[0].col = 2;
  game.cats[0].attack = 0;
  game.dogs = [
    createDog(1, 4, 2),
    createDog(1, 2, 2),
    createDog(1, 1, 2),
  ];

  game = resolveSection(game);

  assert.equal(game.dogs.filter((dog) => dog.row === 4 && dog.col === 2).length, 2);
  assert.equal(game.dogs.filter((dog) => dog.row === 3 && dog.col === 2).length, 1);
  assert.ok(game.events.some((event) => event.type === 'move' && event.fromRow === 2 && event.toRow === 4));
  assert.ok(game.events.some((event) => event.type === 'move' && event.fromRow === 1 && event.toRow === 3));
});

test('a dog attacks a blocking cat instead of moving through it', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 1 });
  game = placeCat(game, 0, 10, 1);
  game.dogs = [createDog(1, 9, 1)];

  game = resolveSection(game);

  assert.equal(game.dogs[0].row, 9);
  assert.equal(game.cats.length, 0);
});

test('Bark McEnroe stops at range and throws a weaker tennis ball down its lane', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 1 });
  game = placeCat(game, 0, 10, 1);
  game.cats[0].attack = 0;
  game.dogs = [createDog(1, 7, 1, DOG_ROLE.TENNIS)];

  game = resolveSection(game);

  assert.equal(game.dogs[0].row, 7);
  assert.equal(game.cats[0].hp, 2);
  assert.ok(game.events.some((event) => event.type === 'dog-shot' && event.style === 'tennis'));
});

test('Fetch Armstrong throws a frisbee into a neighboring lane from four squares away', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 1 });
  game = placeCat(game, 0, 10, 2);
  game.cats[0].attack = 0;
  game.dogs = [createDog(1, 6, 1, DOG_ROLE.FRISBEE)];

  game = resolveSection(game);

  assert.equal(game.dogs[0].row, 6);
  assert.equal(game.cats[0].hp, 2);
  assert.ok(game.events.some((event) => event.type === 'dog-shot' && event.style === 'frisbee'));
});

test('Bone Jovi lobs a ranged bone bomb that splashes adjacent cats', () => {
  let game = createGame(() => 0.5);
  for (const col of [1, 2, 3]) {
    game = addCatToBench(game, { level: 1 });
    game = placeCat(game, 0, 10, col);
  }
  game.cats.forEach((cat) => { cat.attack = 0; });
  game.dogs = [createDog(1, 6, 2, DOG_ROLE.LOBBER)];

  game = resolveSection(game);

  assert.deepEqual(game.cats.map((cat) => cat.hp), [3, 3, 3]);
  const bombs = game.events.filter((event) => event.type === 'dog-shot' && event.style.startsWith('bone-bomb'));
  assert.equal(bombs.length, 3);
  assert.equal(bombs.filter((event) => event.style === 'bone-bomb-secondary').length, 2);
});

test('Howl Pacino spends its first action buffing nearby dogs for their next bite', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 1, coat: CAT_COAT.GREY });
  game = placeCat(game, 0, 10, 2);
  game.cats[0].attack = 0;
  game.dogs = [
    createDog(1, 10, 1, DOG_ROLE.HOWLER),
    createDog(1, 9, 2, DOG_ROLE.SCRUFFY),
  ];

  game = resolveSection(game);

  assert.equal(game.cats[0].hp, 12);
  assert.equal(game.dogs[0].row, 10);
  assert.ok(game.events.some((event) => event.type === 'howl'));
});

test('Barkour Bandit clears one blocker but cannot jump a layered defence', () => {
  let openLanding = createGame(() => 0.5);
  openLanding = addCatToBench(openLanding, { level: 1 });
  openLanding = placeCat(openLanding, 0, 10, 1);
  openLanding.cats[0].attack = 0;
  openLanding.dogs = [createDog(1, 9, 1, DOG_ROLE.JUMPER)];
  openLanding = resolveSection(openLanding);
  assert.equal(openLanding.dogs[0].row, 11);
  assert.equal(openLanding.cats[0].hp, 4);
  assert.ok(openLanding.events.some((event) => event.type === 'dog-jump'));

  let layered = createGame(() => 0.5);
  layered = addCatToBench(layered, { level: 1 });
  layered = addCatToBench(layered, { level: 1 });
  layered = placeCat(layered, 0, 10, 1);
  layered = placeCat(layered, 0, 11, 1);
  layered.cats.forEach((cat) => { cat.attack = 0; });
  layered.dogs = [createDog(1, 9, 1, DOG_ROLE.JUMPER)];
  layered = resolveSection(layered);
  assert.equal(layered.dogs[0].row, 9);
  assert.equal(layered.cats.find((cat) => cat.row === 10).hp, 2);
});

test('Dr. Droolittle spends one action healing the most injured nearby dog', () => {
  let game = createGame(() => 0.5);
  const medic = createDog(1, 5, 1, DOG_ROLE.MEDIC);
  const patient = createDog(1, 6, 2, DOG_ROLE.SCRUFFY);
  patient.hp = 1;
  game.dogs = [medic, patient];

  game = resolveSection(game);

  assert.equal(game.dogs.find((dog) => dog.id === patient.id).hp, 4);
  assert.equal(game.dogs.find((dog) => dog.id === medic.id).row, 5, 'healing spends the medic action');
  assert.ok(game.events.some((event) => event.type === 'dog-heal' && event.amount === 3));

  game = resolveSection(game);
  assert.equal(game.events.some((event) => event.type === 'dog-heal'), false, 'the medic heals once per battle');
});

test('Growl Gadot frightens a nearby cat and weakens its next attack', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 1 });
  game = placeCat(game, 0, 10, 2);
  game.dogs = [createDog(1, 7, 2, DOG_ROLE.GROWLER)];

  game = resolveSection(game);
  assert.equal(game.dogs[0].hp, 3);
  assert.equal(game.cats[0].nextAttackPenalty, 2);
  assert.ok(game.events.some((event) => event.type === 'dog-fear' && event.amount === 2));

  game = resolveSection(game);
  const weakenedShot = game.events.find((event) => event.type === 'shot' && !event.miss);
  assert.equal(weakenedShot.damage, 1, 'Purrcy fires its one remaining attack as one pellet');
  assert.equal(game.events.filter((event) => event.type === 'shot' && !event.miss).length, 1);
  assert.equal(game.dogs[0].hp, 2);
});

test('special dog roles unlock gradually and debut in their first eligible wave', () => {
  assert.deepEqual(availableDogRolesForRound(1), [DOG_ROLE.SCRUFFY]);
  assert.deepEqual(availableDogRolesForRound(2), [DOG_ROLE.SCRUFFY, DOG_ROLE.FRISBEE]);
  assert.deepEqual(availableDogRolesForRound(3), [DOG_ROLE.SCRUFFY, DOG_ROLE.FRISBEE, DOG_ROLE.TENNIS]);
  assert.deepEqual(availableDogRolesForRound(4), [
    DOG_ROLE.SCRUFFY, DOG_ROLE.FRISBEE, DOG_ROLE.TENNIS, DOG_ROLE.HOWLER,
  ]);
  assert.deepEqual(availableDogRolesForRound(10), [
    DOG_ROLE.SCRUFFY, DOG_ROLE.FRISBEE, DOG_ROLE.TENNIS, DOG_ROLE.HOWLER,
    DOG_ROLE.LOBBER, DOG_ROLE.JUMPER, DOG_ROLE.SKITTISH, DOG_ROLE.MEDIC, DOG_ROLE.GROWLER,
  ]);
  assert.ok(generateWave(2, () => 0).some((dog) => dog.role === DOG_ROLE.FRISBEE));
  assert.ok(generateWave(3, () => 0).some((dog) => dog.role === DOG_ROLE.TENNIS));
  assert.ok(generateWave(4, () => 0).some((dog) => dog.role === DOG_ROLE.HOWLER));
  assert.ok(generateWave(5, () => 0).some((dog) => dog.role === DOG_ROLE.JUMPER));
  assert.ok(generateWave(6, () => 0).some((dog) => dog.role === DOG_ROLE.LOBBER));
  assert.ok(generateWave(7, () => 0).some((dog) => dog.role === DOG_ROLE.SKITTISH));
  assert.ok(generateWave(8, () => 0).some((dog) => dog.role === DOG_ROLE.MEDIC));
  assert.ok(generateWave(10, () => 0).some((dog) => dog.role === DOG_ROLE.GROWLER));
});

test('a breach spends one life and Super Cat clears that column', () => {
  let game = createGame(() => 0.5);
  game.dogs = [createDog(1, ROWS - 1, 3), createDog(1, 4, 3), createDog(1, 4, 1)];

  game = resolveSection(game);

  assert.equal(game.lives, 2);
  assert.deepEqual(game.dogs.map((dog) => dog.col), [1]);
  assert.equal(game.events.some((event) => event.type === 'breach' && event.col === 3), true);
});

test('surviving dogs persist and the next wave joins them', () => {
  let game = createGame(() => 0.5);
  game = startRound(game);
  const survivorId = game.dogs[0].id;
  game = finishRound(game);
  game = startRound(game);

  assert.equal(game.dogs.some((dog) => dog.id === survivorId), true);
  assert.equal(game.dogs.length, waveCountForRound(1) + waveCountForRound(2));
});

test('clearing every dog after the final wave wins Level 1', () => {
  let game = createGame(() => 0.5);
  for (let round = 1; round < MAX_ROUNDS; round += 1) {
    game = startRound(game);
    game.dogs = [];
    game = finishRound(game);
    assert.equal(game.phase, 'prep');
  }

  game = startRound(game);
  assert.equal(game.round, MAX_ROUNDS);
  assert.ok(game.dogs.length > 0);
  game.dogs = [];
  game = finishRound(game);

  assert.equal(game.phase, 'victory');
  assert.equal(game.round, MAX_ROUNDS);
});

test('killing all dogs mid-level does not win before the final wave', () => {
  let game = createGame(() => 0.5);
  game = startRound(game);
  game.dogs = [];
  game = finishRound(game);
  assert.equal(game.phase, 'prep');
  assert.equal(game.round, 2);
});

test('final wave with dogs remaining keeps combat instead of auto-winning', () => {
  let game = createGame(() => 0.5);
  game.round = MAX_ROUNDS;
  game.phase = 'combat';
  game.dogs = [createDog(1, 3, 1)];
  game = finishRound(game);
  assert.equal(game.phase, 'combat');
  assert.equal(game.dogs.length, 1);
});

test('resolveSection grants victory when the final wave is fully cleared', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 3, coat: CAT_COAT.ORANGE });
  game = placeCat(game, 0, 12, 2);
  game.round = MAX_ROUNDS;
  game.phase = 'combat';
  game.dogs = [createDog(1, 11, 2)];
  // L3 Purrcy is intentionally strong enough to erase a tier-one dog in one action.
  game = resolveSection(game);
  assert.equal(game.dogs.length, 0);
  assert.equal(game.phase, 'victory');
});

test('illegal placement above cat territory leaves the bench unchanged', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 1 });

  const unchanged = placeCat(game, 0, CAT_ZONE_START - 1, 2);

  assert.equal(unchanged.bench.length, 1);
  assert.equal(unchanged.cats.length, 0);
});

test('the field cap blocks a sixth deployment but still allows board movement', () => {
  let game = createGame(() => 0.2);
  for (let index = 0; index < MAX_FIELD_CATS; index += 1) {
    game = addCatToBench(game, { level: 1, coat: index % 3 });
    game = placeCat(game, 0, CAT_ZONE_START, index);
  }
  game = addCatToBench(game, { level: 1 });

  const blockedBenchPlacement = placeCat(game, 0, CAT_ZONE_START + 1, 0);
  const blockedShopPlacement = purchaseShopFighterToBoard(game, 0, CAT_ZONE_START + 1, 1);
  const moved = moveCat(game, game.cats[0].id, CAT_ZONE_START + 1, 0);

  assert.equal(blockedBenchPlacement, game);
  assert.equal(blockedShopPlacement, game);
  assert.equal(moved.cats.length, MAX_FIELD_CATS);
  assert.equal(moved.cats.find((cat) => cat.id === game.cats[0].id).row, CAT_ZONE_START + 1);
});

test('buying a cat costs three gold and a full bench rejects the purchase', () => {
  let game = createGame(() => 0.5);
  for (let i = 0; i < BENCH_SIZE; i += 1) game = addCatToBench(game, { level: 1 });
  const goldBefore = game.gold;

  const unchanged = addCatToBench(game, { level: 1 }, true);

  assert.equal(unchanged.bench.length, BENCH_SIZE);
  assert.equal(unchanged.gold, goldBefore);
});

test('saving a shop pet keeps it through refresh and clears only unsaved slots', () => {
  let game = createGame(() => 0.1);
  const savedCoat = game.shop[1].coat;
  const savedId = game.shop[1].id;
  game = toggleSaveShopSlot(game, 1);
  assert.equal(game.shop[1].saved, true);

  const goldBefore = game.gold;
  game = refreshShop(game);

  assert.equal(game.gold, goldBefore - 1);
  assert.equal(game.shop[1].id, savedId);
  assert.equal(game.shop[1].coat, savedCoat);
  assert.equal(game.shop[1].saved, true);
  assert.notEqual(game.shop[0].id, savedId);
});

test('saved shop pets carry into the next round shop', () => {
  let game = createGame(() => 0.2);
  game = toggleSaveShopSlot(game, 0);
  const keptId = game.shop[0].id;
  game = startRound(game);
  game = finishRound(game);

  assert.equal(game.phase, 'prep');
  assert.equal(game.shop[0].id, keptId);
  assert.equal(game.shop[0].saved, true);
  assert.equal(game.shop[0].sold, false);
});

test('buying a saved shop pet clears the save and frees the slot on later refresh', () => {
  let game = createGame(() => 0.3);
  game = toggleSaveShopSlot(game, 2);
  const boughtId = game.shop[2].id;
  game = buyShopCat(game, 2);
  assert.equal(game.shop[2].sold, true);
  assert.equal(game.shop[2].saved, false);

  game = refreshShop(game);
  assert.notEqual(game.shop[2].id, boughtId);
  assert.equal(game.shop[2].sold, false);
});

test('cats can only stack with the same coat color', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 1, coat: CAT_COAT.ORANGE });
  game = addCatToBench(game, { level: 1, coat: CAT_COAT.WHITE });
  const orangeId = game.bench[0].id;
  const whiteId = game.bench[1].id;

  const unchanged = mergeUnitOnto(game, 'bench', orangeId, 'bench', whiteId);
  assert.equal(unchanged, game);
  assert.equal(game.bench.length, 2);
});

test('same-color same-level cats can stack and evolve', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 1, coat: CAT_COAT.GREY });
  game = addCatToBench(game, { level: 1, coat: CAT_COAT.GREY });
  game = addCatToBench(game, { level: 1, coat: CAT_COAT.GREY });
  const a = game.bench[0].id;
  const b = game.bench[1].id;
  const c = game.bench[2].id;

  game = mergeUnitOnto(game, 'bench', b, 'bench', a);
  assert.equal(game.bench.length, 2);
  assert.equal(game.bench.find((cat) => cat.id === a).copies, 2);

  game = mergeUnitOnto(game, 'bench', c, 'bench', a);
  const evolved = game.bench.find((cat) => cat.id === a);
  assert.equal(game.bench.length, 1);
  assert.equal(evolved.level, 2);
  assert.equal(evolved.coat, CAT_COAT.GREY);
  assert.equal(evolved.ability, 'melee');
  assert.equal(evolved.maxHp, catStatsFor(2, CAT_COAT.GREY).hp);
});

test('auto-combine only merges matching coats, not mixed colors at the same level', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 1, coat: CAT_COAT.ORANGE });
  game = addCatToBench(game, { level: 1, coat: CAT_COAT.ORANGE });
  game = addCatToBench(game, { level: 1, coat: CAT_COAT.WHITE });
  game = combineCats(game);

  assert.equal(game.bench.length, 3);
  assert.deepEqual(game.bench.map((cat) => cat.level).sort(), [1, 1, 1]);
});

test('cat tooltips describe each coat attack style', () => {
  const tabby = catTooltipInfo({ level: 1, coat: CAT_COAT.ORANGE, hp: 6, maxHp: 6 });
  const brawler = catTooltipInfo({ level: 1, coat: CAT_COAT.GREY, hp: 12, maxHp: 12 });
  const ghost = catTooltipInfo({ level: 1, coat: CAT_COAT.WHITE, hp: 6, maxHp: 6 });
  const armedBrawler = catTooltipInfo({ level: 1, coat: CAT_COAT.GREY, hp: 9, maxHp: 12, attack: 7 });

  assert.match(tabby.attack, /3 rapid|column/i);
  assert.match(brawler.attack, /melee|front/i);
  assert.match(ghost.attack, /homing|column|sine|random/i);
  assert.equal(tabby.category, 'T1');
  assert.equal(catTooltipInfo({ level: 1, coat: CAT_COAT.PRISM }).category, 'T3');
  assert.equal(tabby.stats, 'Health 6/6 · Attack 1+1+1');
  assert.equal(catTooltipInfo({ level: 2, coat: CAT_COAT.ORANGE }).stats, 'Health 13/13 · Attack 2+2+2');
  assert.equal(brawler.stats, 'Health 12/12 · Attack 1');
  assert.equal(armedBrawler.stats, 'Health 9/12 · Attack 7');
});

test('cat tooltips get straight to the attack description', () => {
  Object.values(CAT_COAT_INFO).forEach((info) => {
    assert.doesNotMatch(info.attackDetail, /^Each action,/i);
  });
  const purrtal = catTooltipInfo({ level: 2, coat: CAT_COAT.RIFT });
  assert.match(purrtal.attack, /next damaging hit or the round ends/i);
  assert.match(purrtal.attack, /2\/3\/4 squares/i);
  assert.match(purrtal.attack, /10%\/20%\/30% attack/i);
  assert.match(purrtal.attack, /minimum 1\/2\/3/i);
  assert.match(purrtal.attack, /at least 1 damage/i);
  assert.match(purrtal.attack, /do not stack/i);
});

test('cat tooltips fully explain equipment, temporary buffs, and active ability state', () => {
  const tooltip = catTooltipInfo({
    level: 2,
    coat: CAT_COAT.RIFT,
    hp: 15,
    maxHp: 19,
    attack: 6,
    equipment: {
      weapon: { tier: 2, attack: 2 },
      armour: { tier: 1, block: 2, uses: 2, maxUses: 3 },
    },
    portalGuardLevel: 2,
    portalAttackBonusLevel: 2,
    activeUsed: false,
  });

  assert.match(tooltip.effects.find((effect) => effect.kind === 'weapon').detail, /every attack.*replaces and destroys/i);
  assert.match(tooltip.effects.find((effect) => effect.kind === 'armour').detail, /2\/3 protected hits.*at least 1 damage.*replaces and destroys/i);
  assert.match(tooltip.effects.find((effect) => effect.kind === 'guard').detail, /20%.*next hit.*minimum 2/i);
  assert.match(tooltip.effects.find((effect) => effect.kind === 'attack-up').detail, /20%.*next attack.*minimum 2/i);
  assert.deepEqual(tooltip.effects.find((effect) => effect.kind === 'ability'), {
    kind: 'ability',
    label: 'TACTICS SPECIAL',
    value: 'READY',
    detail: 'Available during a Tactics Window — once per battle normally, and once per window in round 10.',
  });
});

test('dog tooltips explain march and bite behavior', () => {
  const dog = dogTooltipInfo({
    tier: 1, hp: 7, maxHp: 7, attack: 3,
    attackBoost: 2, portalAttackPenaltyLevel: 1, frozenActions: 1, tangled: true,
  });
  assert.match(dog.attack, /porch|ahead|bites|steps/i);
  assert.match(dog.stats, /7/);
  assert.deepEqual(dog.effects.map((effect) => effect.kind), ['attack-up', 'attack-down', 'frozen', 'tangled']);
});

test('cats still act with miss events when no dogs are in range', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 2, coat: CAT_COAT.ORANGE });
  game = addCatToBench(game, { level: 1, coat: CAT_COAT.WHITE });
  game = addCatToBench(game, { level: 1, coat: CAT_COAT.GREY });
  game = placeCat(game, 0, 12, 0);
  game = placeCat(game, 0, 12, 1);
  game = placeCat(game, 0, 12, 2);
  game.dogs = [];

  game = resolveSection(game);

  const shots = game.events.filter((event) => event.type === 'shot');
  const melees = game.events.filter((event) => event.type === 'cat-melee');
  assert.equal(shots.filter((shot) => shot.style === 'column').length, 3);
  assert.equal(shots.filter((shot) => shot.style === 'homing').length, 1);
  assert.equal(melees.length, 1);
  assert.equal(shots.every((shot) => shot.miss), true);
  assert.equal(melees[0].miss, true);
  assert.equal(melees[0].to, null);
});

test('selling a cat returns gold equal to its SAP-style level value', () => {
  for (const level of [1, 2, 3]) {
    let game = createGame(() => 0.5);
    game = addCatToBench(game, { level });
    const catId = game.bench[0].id;
    assert.deepEqual(catSaleQuote(game, 'bench', catId), { canSell: true, value: level, reason: '' });
    game = sellCat(game, 'bench', catId);
    assert.equal(game.gold, 10 + level);
    assert.equal(game.bench.length, 0);
    assert.ok(game.events.some((event) => event.type === 'sell-cat' && event.gold === level));
  }
});

test('selling a battlefield cat returns equipped items to House Storage', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 2 });
  game = placeCat(game, 0, 10, 2);
  game.cats[0].equipment.weapon = { tier: 2, attack: 2 };
  game.cats[0].equipment.armour = { tier: 1, block: 2, uses: 2 };
  const catId = game.cats[0].id;

  game = sellCat(game, 'cat', catId);

  assert.equal(game.cats.length, 0);
  assert.equal(game.gold, 12);
  assert.ok(game.inventory.some((stack) => stack?.kind === 'weapon' && stack.tier === 2));
  assert.ok(game.inventory.some((stack) => stack?.kind === 'armour' && stack.tier === 1));
});

test('a cat with equipment cannot be sold when House Storage has no room', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 1 });
  game.bench[0].equipment.weapon = { tier: 2, attack: 2 };
  game.inventory = game.inventory.map((_, index) => ({ id: `full-${index}`, kind: `other-${index}`, tier: 1, quantity: 1 }));
  const catId = game.bench[0].id;

  assert.deepEqual(catSaleQuote(game, 'bench', catId), {
    canSell: false,
    value: 1,
    reason: 'House Storage needs room for equipped items.',
  });
  assert.equal(sellCat(game, 'bench', catId), game);
});
