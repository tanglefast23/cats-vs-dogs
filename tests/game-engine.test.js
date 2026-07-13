import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CAT_STATS,
  CAT_COAT,
  DOG_ROLE,
  catStatsFor,
  ROWS,
  COLS,
  CAT_ZONE_START,
  MAX_ROUNDS,
  ACTIONS_PER_ROUND,
  MAX_SHOP_SIZE,
  createGame,
  makeShop,
  availableCatCoatsForRound,
  shopTierForRound,
  shopSizeForRound,
  addCatToBench,
  combineCats,
  placeCat,
  resolveSection,
  startRound,
  finishRound,
  createDog,
  generateWave,
  availableDogRolesForRound,
  buyShopCat,
  refreshShop,
  toggleSaveShopSlot,
  mergeUnitOnto,
  catTooltipInfo,
  dogTooltipInfo,
  closestDogByColumnPriority,
  splitDamage,
  catSaleQuote,
  sellCat,
} from '../src/game-engine.js';

test('desktop board uses six columns, fourteen rows, four cat rows, and two actions', () => {
  assert.equal(COLS, 6);
  assert.equal(ROWS, 14);
  assert.equal(CAT_ZONE_START, 10);
  assert.equal(ROWS - CAT_ZONE_START, 4);
  assert.equal(ACTIONS_PER_ROUND, 2);
  assert.equal(MAX_ROUNDS, 7);
});

test('the next-wave preview is the exact wave released when combat starts', () => {
  const game = createGame(() => 0.25);
  const preview = game.nextWave.map(({ id, tier, row, col }) => ({ id, tier, row, col }));

  assert.equal(preview.length, 1);
  const started = startRound(game);
  assert.deepEqual(
    started.dogs.map(({ id, tier, row, col }) => ({ id, tier, row, col })),
    preview,
  );
  assert.deepEqual(started.nextWave, []);
});

test('SAP economy expands from three to four shop choices while resetting to ten gold', () => {
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
    const expectedSize = game.round >= 5 ? 4 : 3;
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

test('SAP-style cat tiers unlock on rounds one, three, five, and seven', () => {
  assert.equal(shopTierForRound(1), 1);
  assert.equal(shopTierForRound(2), 1);
  assert.equal(shopTierForRound(3), 2);
  assert.equal(shopTierForRound(5), 3);
  assert.equal(shopTierForRound(7), 4);
  assert.deepEqual(availableCatCoatsForRound(1), [0, 1, 2]);
  assert.deepEqual(availableCatCoatsForRound(3), [0, 1, 2, 3]);
  assert.deepEqual(availableCatCoatsForRound(5), [0, 1, 2, 3, 4, 6, 7, 8, 9, 10]);
  assert.deepEqual(availableCatCoatsForRound(7), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
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
  assert.deepEqual(availableCatCoatsForRound(5), [
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

test('an unobstructed dog first breaches during round seven pacing', () => {
  let game = createGame(() => 0.5);
  game.dogs = [createDog(1, 0, 2)];

  for (let action = 0; action < 6 * ACTIONS_PER_ROUND; action += 1) game = resolveSection(game);
  assert.equal(game.lives, 3);
  assert.equal(game.dogs[0].row, 12);

  for (let action = 0; action < ACTIONS_PER_ROUND; action += 1) game = resolveSection(game);
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

test('nine level-one cats acquired in groups ultimately combine into one level-three cat', () => {
  let game = createGame(() => 0.5);
  for (let group = 0; group < 3; group += 1) {
    for (let i = 0; i < 3; i += 1) game = addCatToBench(game, { level: 1 });
    game = combineCats(game);
  }

  game = combineCats(game);

  assert.deepEqual(game.bench.map((cat) => cat.level), [3]);
});

test('a base cat needs four readable hits to defeat a tier-one dog', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 1 });
  game = placeCat(game, 0, 12, 2);
  game.dogs = [createDog(1, 0, 2)];

  for (let hit = 0; hit < 3; hit += 1) game = resolveSection(game);
  assert.equal(game.dogs[0].hp, 1);

  game = resolveSection(game);
  assert.equal(game.dogs.length, 0);
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

  assert.equal(shots.length, 2);
  assert.equal(shots.every((shot) => shot.burst), true);
  assert.equal(shots.reduce((sum, shot) => sum + shot.damage, 0), 2);
  assert.equal(shots[0].damage, 1);
  assert.equal(shots[0].hpBefore, 7);
  assert.equal(shots[0].hpAfter, 6);
  assert.equal(shots[1].hpAfter, 5);
  assert.equal(game.dogs[0].hp, 5);
});

test('orange cat burst keeps hitting the nearest dog in its column', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 1, coat: CAT_COAT.ORANGE });
  game = placeCat(game, 0, 12, 2);
  game.dogs = [createDog(1, 1, 2), createDog(1, 4, 2)];

  game = resolveSection(game);

  const upperDog = game.dogs.find((dog) => dog.row === 2);
  const lowerDog = game.dogs.find((dog) => dog.row === 5);
  assert.equal(upperDog.hp, 7);
  assert.equal(lowerDog.hp, 5);
});

test('level-two orange cat fires three equal burst pellets', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 2, coat: CAT_COAT.ORANGE });
  game = placeCat(game, 0, 12, 2);
  game.dogs = [createDog(1, 0, 2)];

  game = resolveSection(game);
  const shots = game.events.filter((event) => event.type === 'shot');
  assert.equal(shots.length, 3);
  assert.deepEqual(shots.map((shot) => shot.damage), [1, 1, 1]);
  assert.equal(game.dogs[0].hp, 4);
});

test('white cat prefers a same-column dog over a nearer dog in another column', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 1, coat: CAT_COAT.WHITE });
  game = placeCat(game, 0, 12, 1);
  // Far dog in own column, nearer dog two lanes over — own column wins.
  game.dogs = [createDog(1, 0, 1), createDog(1, 10, 3)];

  game = resolveSection(game);

  const ownColumnDog = game.dogs.find((dog) => dog.col === 1);
  const otherDog = game.dogs.find((dog) => dog.col === 3);
  const shot = game.events.find((event) => event.type === 'shot');

  assert.equal(catStatsFor(1, CAT_COAT.WHITE).attack, 1);
  assert.equal(ownColumnDog.hp, 6);
  assert.equal(otherDog.hp, 7);
  assert.equal(shot.style, 'homing');
  assert.equal(shot.damage, 1);
  assert.equal(shot.fromCol, 1);
  assert.equal(shot.col, 1);
});

test('white cat uses next-nearest columns, then lowest row, then random on full ties', () => {
  const cat = { row: 12, col: 2 };

  // No own-column dog: adjacent columns, pick the lower one (higher row).
  const adjacent = closestDogByColumnPriority(
    cat,
    [createDog(1, 4, 1), createDog(1, 8, 3), createDog(1, 2, 5)],
    () => 0,
  );
  assert.equal(adjacent.col, 3);
  assert.equal(adjacent.row, 8);

  // Equal column distance and equal row → random among ties.
  const left = createDog(1, 6, 1);
  const right = createDog(1, 6, 3);
  const pickLeft = closestDogByColumnPriority(cat, [left, right], () => 0);
  const pickRight = closestDogByColumnPriority(cat, [left, right], () => 0.99);
  assert.equal(pickLeft.id, left.id);
  assert.equal(pickRight.id, right.id);

  // Multiple dogs in own column → lowest (closest) dog wins.
  const ownColumn = closestDogByColumnPriority(
    cat,
    [createDog(1, 1, 2), createDog(1, 9, 2), createDog(1, 10, 4)],
    () => 0,
  );
  assert.equal(ownColumn.col, 2);
  assert.equal(ownColumn.row, 9);
});

test('grey cat has double HP and a powerful melee attack on the dog in front', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 1, coat: CAT_COAT.GREY });
  game = placeCat(game, 0, 11, 2);
  game.dogs = [createDog(1, 10, 2), createDog(1, 4, 2)];

  assert.equal(game.cats[0].maxHp, CAT_STATS[1].hp * 2);
  assert.equal(game.cats[0].attack, 5);

  game = resolveSection(game);

  const frontDog = game.dogs.find((dog) => dog.row === 10);
  const rearDog = game.dogs.find((dog) => dog.col === 2 && dog.row !== 10);
  const catMelee = game.events.find((event) => event.type === 'cat-melee');

  assert.equal(frontDog.hp, 2);
  assert.equal(rearDog.hp, 7);
  assert.equal(rearDog.row, 5);
  assert.equal(catMelee.damage, 5);
  assert.equal(game.events.some((event) => event.type === 'shot'), false);
});

test('grey cat still swings when no dog is directly in front', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 1, coat: CAT_COAT.GREY });
  game = placeCat(game, 0, 12, 2);
  game.dogs = [createDog(1, 8, 2)];

  game = resolveSection(game);

  const swing = game.events.find((event) => event.type === 'cat-melee');
  assert.equal(game.dogs[0].hp, 7);
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
  assert.equal(game.dogs[0].hp, 5);
  assert.equal(game.dogs[0].row, 5);
  assert.equal(game.dogs[0].tangled, false);
  assert.equal(game.events.some((event) => event.type === 'tangle-skip'), true);
});

test('Black Bombardier shot splashes dogs in adjacent columns', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 1, coat: CAT_COAT.BLACK });
  game = placeCat(game, 0, 12, 2);
  const left = createDog(1, 7, 1);
  const center = createDog(1, 7, 2);
  const right = createDog(1, 7, 3);
  game.dogs = [left, center, right];

  game = resolveSection(game);

  assert.equal(game.dogs.find((dog) => dog.id === center.id).hp, 4);
  assert.equal(game.dogs.find((dog) => dog.id === left.id).hp, 6);
  assert.equal(game.dogs.find((dog) => dog.id === right.id).hp, 6);
});

test('Prism Sphinx beam pierces up to three dogs in its column', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 1, coat: CAT_COAT.PRISM });
  game = placeCat(game, 0, 12, 2);
  game.dogs = [createDog(1, 3, 2), createDog(1, 5, 2), createDog(1, 7, 2), createDog(1, 7, 4)];

  game = resolveSection(game);

  const sameColumn = game.dogs.filter((dog) => dog.col === 2);
  assert.deepEqual(sameColumn.map((dog) => dog.hp), [4, 4, 4]);
  assert.equal(game.dogs.find((dog) => dog.col === 4).hp, 7);
});

test('dog tiers scale through tier four while retaining their strategic role', () => {
  assert.ok(generateWave(3, () => 0.999).some((dog) => dog.tier === 2));
  assert.ok(generateWave(5, () => 0.999).some((dog) => dog.tier === 3));
  const finalWave = generateWave(7, () => 0.999);
  const alpha = finalWave.find((dog) => dog.tier === 4);
  assert.ok(alpha);
  assert.match(dogTooltipInfo(alpha).title, /^T4 /);
});

test('a dog attacks a blocking cat instead of moving through it', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 1 });
  game = placeCat(game, 0, 10, 1);
  game.dogs = [createDog(1, 9, 1)];

  game = resolveSection(game);

  assert.equal(game.dogs[0].row, 9);
  assert.equal(game.cats[0].hp, 3);
});

test('Bark McEnroe stops at range and throws a weaker tennis ball down its lane', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 1 });
  game = placeCat(game, 0, 10, 1);
  game.cats[0].attack = 0;
  game.dogs = [createDog(1, 7, 1, DOG_ROLE.TENNIS)];

  game = resolveSection(game);

  assert.equal(game.dogs[0].row, 7);
  assert.equal(game.cats[0].hp, 4);
  assert.ok(game.events.some((event) => event.type === 'dog-shot' && event.style === 'tennis'));
});

test('Howl Pacino spends its first action buffing nearby dogs for their next bite', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 1 });
  game = placeCat(game, 0, 10, 2);
  game.cats[0].attack = 0;
  game.dogs = [
    createDog(1, 10, 1, DOG_ROLE.HOWLER),
    createDog(1, 9, 2, DOG_ROLE.SCRUFFY),
  ];

  game = resolveSection(game);

  assert.equal(game.cats[0].hp, 1);
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
  assert.equal(openLanding.cats[0].hp, 6);
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
  assert.equal(layered.cats.find((cat) => cat.row === 10).hp, 3);
});

test('special dog roles unlock gradually and debut in their first eligible wave', () => {
  assert.deepEqual(availableDogRolesForRound(1), [DOG_ROLE.SCRUFFY]);
  assert.deepEqual(availableDogRolesForRound(3), [DOG_ROLE.SCRUFFY, DOG_ROLE.TENNIS]);
  assert.deepEqual(availableDogRolesForRound(4), [DOG_ROLE.SCRUFFY, DOG_ROLE.TENNIS, DOG_ROLE.HOWLER]);
  assert.deepEqual(availableDogRolesForRound(5), [DOG_ROLE.SCRUFFY, DOG_ROLE.TENNIS, DOG_ROLE.HOWLER, DOG_ROLE.JUMPER]);
  assert.ok(generateWave(3, () => 0).some((dog) => dog.role === DOG_ROLE.TENNIS));
  assert.ok(generateWave(4, () => 0).some((dog) => dog.role === DOG_ROLE.HOWLER));
  assert.ok(generateWave(5, () => 0).some((dog) => dog.role === DOG_ROLE.JUMPER));
});

test('a breach spends one life and Super Cat clears that column', () => {
  let game = createGame(() => 0.5);
  game.dogs = [createDog(1, ROWS - 1, 3), createDog(1, 4, 3), createDog(1, 4, 1)];

  game = resolveSection(game);

  assert.equal(game.lives, 2);
  assert.deepEqual(game.dogs.map((dog) => dog.col), [1]);
  assert.equal(game.events.some((event) => event.type === 'super-cat' && event.col === 3), true);
});

test('surviving dogs persist and the next wave joins them', () => {
  let game = createGame(() => 0.5);
  game = startRound(game);
  const survivorId = game.dogs[0].id;
  game = finishRound(game);
  game = startRound(game);

  assert.equal(game.dogs.some((dog) => dog.id === survivorId), true);
  assert.equal(game.dogs.length, 3);
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
  // L3 orange attack 5 as burst 2+2+1 kills 7-hp dog over enough sections if needed.
  // One section of 5 damage leaves dog at 2; second section finishes.
  game = resolveSection(game);
  assert.notEqual(game.phase, 'victory');
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

test('buying a cat costs three gold and a full bench rejects the purchase', () => {
  let game = createGame(() => 0.5);
  for (let i = 0; i < 6; i += 1) game = addCatToBench(game, { level: 1 });
  const goldBefore = game.gold;

  const unchanged = addCatToBench(game, { level: 1 }, true);

  assert.equal(unchanged.bench.length, 6);
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
  assert.equal(evolved.maxHp, CAT_STATS[2].hp * 2);
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
  assert.equal(brawler.stats, 'Health 12/12 · 10 damage/round if attacks hit');
  assert.equal(armedBrawler.stats, 'Health 9/12 · 14 damage/round if attacks hit');
});

test('dog tooltips explain march and bite behavior', () => {
  const dog = dogTooltipInfo({ tier: 1, hp: 7, maxHp: 7, attack: 3 });
  assert.match(dog.attack, /porch|ahead|bites|steps/i);
  assert.match(dog.stats, /7/);
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

test('selling a battlefield cat returns equipped items to Storage', () => {
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

test('a cat with equipment cannot be sold when Storage has no room', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 1 });
  game.bench[0].equipment.weapon = { tier: 2, attack: 2 };
  game.inventory = Array.from({ length: 6 }, (_, index) => ({ id: `full-${index}`, kind: `other-${index}`, tier: 1, quantity: 1 }));
  const catId = game.bench[0].id;

  assert.deepEqual(catSaleQuote(game, 'bench', catId), {
    canSell: false,
    value: 1,
    reason: 'Storage needs room for equipped items.',
  });
  assert.equal(sellCat(game, 'bench', catId), game);
});
