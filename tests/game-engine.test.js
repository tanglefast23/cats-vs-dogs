import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CAT_STATS,
  CAT_COAT,
  catStatsFor,
  ROWS,
  COLS,
  CAT_ZONE_START,
  MAX_ROUNDS,
  ACTIONS_PER_ROUND,
  createGame,
  addCatToBench,
  combineCats,
  placeCat,
  resolveSection,
  startRound,
  finishRound,
  createDog,
  buyShopCat,
  refreshShop,
  toggleSaveShopSlot,
  mergeUnitOnto,
  catTooltipInfo,
  dogTooltipInfo,
} from '../src/game-engine.js';

test('desktop board uses six columns, fourteen rows, five cat rows, and two actions', () => {
  assert.equal(COLS, 6);
  assert.equal(ROWS, 14);
  assert.equal(CAT_ZONE_START, 9);
  assert.equal(ACTIONS_PER_ROUND, 2);
  assert.equal(MAX_ROUNDS, 7);
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

test('shot events describe travel and exact HP loss for animation', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 1 });
  game = placeCat(game, 0, 12, 2);
  game.dogs = [createDog(1, 0, 2)];

  game = resolveSection(game);
  const shot = game.events.find((event) => event.type === 'shot');

  assert.deepEqual(
    { damage: shot.damage, hpBefore: shot.hpBefore, hpAfter: shot.hpAfter, fromRow: shot.fromRow, toRow: shot.toRow },
    { damage: 2, hpBefore: 7, hpAfter: 5, fromRow: 12, toRow: 0 },
  );
});

test('a cat shot damages only the nearest dog in its column', () => {
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

test('white cat fires a weaker homing shot at the closest dog in any lane', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 1, coat: CAT_COAT.WHITE });
  game = placeCat(game, 0, 12, 1);
  // Far dog in the same column, much closer dog two lanes over.
  game.dogs = [createDog(1, 0, 1), createDog(1, 10, 3)];

  game = resolveSection(game);

  const farDog = game.dogs.find((dog) => dog.col === 1);
  const closeDog = game.dogs.find((dog) => dog.col === 3);
  const shot = game.events.find((event) => event.type === 'shot');

  assert.equal(catStatsFor(1, CAT_COAT.WHITE).attack, 1);
  assert.equal(farDog.hp, 7);
  assert.equal(closeDog.hp, 6);
  assert.equal(shot.style, 'homing');
  assert.equal(shot.damage, 1);
  assert.equal(shot.fromCol, 1);
  assert.equal(shot.col, 3);
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

test('grey cat does not melee when no dog is directly in front', () => {
  let game = createGame(() => 0.5);
  game = addCatToBench(game, { level: 1, coat: CAT_COAT.GREY });
  game = placeCat(game, 0, 12, 2);
  game.dogs = [createDog(1, 8, 2)];

  game = resolveSection(game);

  assert.equal(game.dogs[0].hp, 7);
  assert.equal(game.events.some((event) => event.type === 'cat-melee' || event.type === 'shot'), false);
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

test('seven completed rounds win Level 1', () => {
  let game = createGame(() => 0.5);
  for (let round = 1; round <= MAX_ROUNDS; round += 1) {
    game = startRound(game);
    game = finishRound(game);
  }

  assert.equal(game.phase, 'victory');
  assert.equal(game.round, MAX_ROUNDS);
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

  assert.match(tabby.attack, /column/i);
  assert.match(brawler.attack, /melee|front/i);
  assert.match(ghost.attack, /homing|closest dog|sine/i);
  assert.match(brawler.stats, /12/);
});

test('dog tooltips explain march and bite behavior', () => {
  const dog = dogTooltipInfo({ tier: 1, hp: 7, maxHp: 7, attack: 3 });
  assert.match(dog.attack, /porch|ahead|bites|steps/i);
  assert.match(dog.stats, /7/);
});
