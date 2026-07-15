import test from 'node:test';
import assert from 'node:assert/strict';

import { CAT_COAT, WORKER_ROLE, createGame, createCat } from '../src/game-engine.js';
import {
  fighterSlot, workerSlot, tutorialShop, tutorialShopAfterRefresh, tutorialWave,
  catOnBoard, boardCatCount, producerInHouse, producerInShop, catAtLevel,
  squadFull, anyWoundedCat, ownsAbilityCat, inventoryHasItem, ownsWorkerRole,
  CORE_STEPS, TIPS,
} from '../src/tutorial.js';

test('fighterSlot builds a shop-shaped fighter for the coat', () => {
  const slot = fighterSlot(CAT_COAT.ORANGE);
  assert.equal(slot.category, 'fighter');
  assert.equal(slot.kind, 'alley-cat');
  assert.equal(slot.coat, CAT_COAT.ORANGE);
  assert.equal(slot.level, 1);
  assert.equal(slot.sold, false);
  assert.equal(slot.saved, false);
  assert.ok(typeof slot.id === 'string');
  assert.ok('shopTier' in slot);
  assert.ok('ability' in slot);
});

test('workerSlot builds a shop-shaped worker for the role', () => {
  const slot = workerSlot(WORKER_ROLE.COOK);
  assert.equal(slot.category, 'worker');
  assert.equal(slot.kind, 'production-cat');
  assert.equal(slot.role, WORKER_ROLE.COOK);
  assert.equal(slot.ability, 'produce-food');
});

test('tutorial shops have exactly three slots and the right guarantees', () => {
  assert.equal(tutorialShop(1).length, 3);
  assert.ok(tutorialShop(1).some((s) => s.category === 'fighter' && s.coat === CAT_COAT.ORANGE));
  assert.ok(tutorialShopAfterRefresh(1).some((s) => s.category === 'worker' && s.role === WORKER_ROLE.COOK));
  assert.ok(tutorialShop(2).some((s) => s.coat === CAT_COAT.ORANGE), 'R2 offers a third Purrcy');
  assert.ok(tutorialShop(4).some((s) => s.coat === CAT_COAT.BLACK), 'R4 offers an ability cat (Bombay Boom)');
  assert.equal(tutorialShop(3), null, 'unscripted rounds return null');
});

test('tutorialWave scripts R1 in the covered lanes; other rounds use the normal wave', () => {
  const r1 = tutorialWave(1, [2, 4]);
  assert.equal(r1.length, 2);
  assert.deepEqual(r1.map((d) => d.col).sort(), [2, 4]);
  assert.ok(r1.every((d) => d.row === 0));

  // R3's heal is staged via a scripted persisted wound (app.js), not a wave dog.
  assert.equal(tutorialWave(3, [3]), null);
  assert.equal(tutorialWave(2, [1]), null);
});

test('predicates read the game state they claim to', () => {
  const game = createGame();
  assert.equal(catOnBoard(game, CAT_COAT.ORANGE), false);
  assert.equal(boardCatCount(game), 0);
  assert.equal(producerInHouse(game), false);
  assert.equal(squadFull(game), false);
  assert.equal(anyWoundedCat(game), false);
  assert.equal(ownsAbilityCat(game), false);
  assert.equal(inventoryHasItem(game), false);

  game.cats.push({ ...createCat(1, CAT_COAT.ORANGE), row: 13, col: 2 });
  assert.equal(catOnBoard(game, CAT_COAT.ORANGE), true);
  assert.equal(boardCatCount(game), 1);

  game.cats[0].hp = 1; // maxHp 4 → wounded
  assert.equal(anyWoundedCat(game), true);

  game.cats.push({ ...createCat(1, CAT_COAT.BLACK), row: 13, col: 3 }); // Bombay has activeAbility
  assert.equal(ownsAbilityCat(game), true);
});

test('every core step is well-formed', () => {
  assert.ok(CORE_STEPS.length > 0);
  for (const step of CORE_STEPS) {
    assert.ok(step.id && typeof step.id === 'string');
    assert.ok(step.text && step.text.length > 0);
    assert.ok(['tap', 'gate'].includes(step.mode));
    if (step.mode === 'gate') assert.equal(typeof step.isDone, 'function');
    if (step.spotlight !== null) assert.equal(typeof step.spotlight, 'string');
  }
  assert.equal(new Set(CORE_STEPS.map((s) => s.id)).size, CORE_STEPS.length);
});

test('every tip is well-formed with a trigger', () => {
  assert.ok(TIPS.length > 0);
  for (const tip of TIPS) {
    assert.ok(tip.id && tip.text);
    assert.equal(typeof tip.when, 'function');
  }
  assert.equal(new Set(TIPS.map((t) => t.id)).size, TIPS.length);
});
