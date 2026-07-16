import test from 'node:test';
import assert from 'node:assert/strict';

import { CAT_COAT, WORKER_ROLE, createGame, createCat } from '../src/game-engine.js';
import {
  fighterSlot, workerSlot, tutorialShop, tutorialShopAfterRefresh, tutorialWave,
  refreshTutorialShop,
  catOnBoard, boardCatCount, producerInHouse, producerInShop, catAtLevel,
  squadFull, anyWoundedCat, ownsAbilityCat, inventoryHasItem, ownsWorkerRole,
  tutorialShopFighterSelector, tutorialOpenLaneSelector, tutorialWoundedCatSelector, confirmTutorialSkip,
  tutorialMergeHints, tutorialMergeTaskForDrop, tutorialMergeText,
  TUTORIAL_MERGE_TASK, TUTORIAL_SKIP_CONFIRMATION, CORE_STEPS, TIPS,
} from '../src/tutorial.js';

test('skipping the tutorial requires explicit confirmation', () => {
  const prompts = [];
  assert.equal(confirmTutorialSkip((message) => { prompts.push(message); return false; }), false);
  assert.equal(confirmTutorialSkip((message) => { prompts.push(message); return true; }), true);
  assert.deepEqual(prompts, [TUTORIAL_SKIP_CONFIRMATION, TUTORIAL_SKIP_CONFIRMATION]);
});

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

test('tutorial refresh costs one gold while preserving its scripted teaching shop', () => {
  const game = createGame(() => 0.5);
  game.shop = tutorialShop(1);

  const refreshed = refreshTutorialShop(game);

  assert.equal(refreshed.gold, 9);
  assert.ok(refreshed.shop.some((slot) => slot.category === 'worker' && slot.role === WORKER_ROLE.COOK));
  assert.equal(game.gold, 10);
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

test('tutorial purchase hints follow the unused Purrcy shop card', () => {
  const game = createGame();
  game.shop = tutorialShop(1);

  assert.equal(tutorialShopFighterSelector(game, CAT_COAT.ORANGE),
    '#shop .shop-card[data-shop-index="0"]');

  game.shop[0].sold = true;
  assert.equal(tutorialShopFighterSelector(game, CAT_COAT.ORANGE),
    '#shop .shop-card[data-shop-index="1"]');

  game.shop[0].sold = false;
  game.shop[1].sold = true;
  assert.equal(tutorialShopFighterSelector(game, CAT_COAT.ORANGE),
    '#shop .shop-card[data-shop-index="0"]');
});

test('tutorial purchase hints choose a lane the player has not used', () => {
  const game = createGame();
  assert.equal(tutorialOpenLaneSelector(game),
    '#board .cell[data-row="13"][data-col="2"]');

  game.cats.push({ ...createCat(1, CAT_COAT.ORANGE), row: 13, col: 2 });
  assert.equal(tutorialOpenLaneSelector(game),
    '#board .cell[data-row="13"][data-col="3"]');

  game.cats[0] = { ...game.cats[0], row: 11, col: 3 };
  assert.equal(tutorialOpenLaneSelector(game),
    '#board .cell[data-row="13"][data-col="2"]');
});

test('tutorial heal hint targets the wounded cat instead of the first board unit', () => {
  const game = createGame();
  const healthy = { ...createCat(1, CAT_COAT.GREY), row: 13, col: 2 };
  const wounded = { ...createCat(1, CAT_COAT.ORANGE), row: 12, col: 4 };
  wounded.hp -= 2;
  game.cats.push(healthy, wounded);

  assert.equal(tutorialWoundedCatSelector(game),
    '#board .cell[data-row="12"][data-col="4"] .unit:not(.dog-unit):not(.decoy-unit)');
  wounded.hp = wounded.maxHp;
  assert.equal(tutorialWoundedCatSelector(game), null);
});

test('the merge lesson classifies the battlefield and Cat Cart drops separately', () => {
  assert.equal(tutorialMergeTaskForDrop(
    { type: 'merge', targetType: 'cat' },
    { type: 'cat', coat: CAT_COAT.ORANGE },
  ), TUTORIAL_MERGE_TASK.BATTLEFIELD);
  assert.equal(tutorialMergeTaskForDrop(
    { type: 'purchase-merge', targetType: 'cat' },
    { type: 'shop-fighter', coat: CAT_COAT.ORANGE },
  ), TUTORIAL_MERGE_TASK.CART);
  assert.equal(tutorialMergeTaskForDrop(
    { type: 'merge', targetType: 'cat' },
    { type: 'bench', coat: CAT_COAT.ORANGE },
  ), null);
  assert.equal(tutorialMergeTaskForDrop(
    { type: 'purchase-merge', targetType: 'cat' },
    { type: 'shop-fighter', coat: CAT_COAT.GREY },
  ), null);
});

test('the merge lesson keeps only unfinished drag demonstrations visible', () => {
  const game = createGame();
  game.shop = tutorialShop(2);
  game.cats = [
    { ...createCat(1, CAT_COAT.ORANGE), row: 13, col: 2 },
    { ...createCat(1, CAT_COAT.ORANGE), row: 13, col: 3 },
  ];
  const step = CORE_STEPS.find((entry) => entry.id === 'r2-merge');
  const neitherDone = new Set();
  assert.deepEqual(tutorialMergeHints(game, neitherDone).map((hint) => hint.id),
    [TUTORIAL_MERGE_TASK.BATTLEFIELD, TUTORIAL_MERGE_TASK.CART]);
  assert.match(tutorialMergeText(neitherDone), /both merges/i);
  assert.equal(step.isDone(game, neitherDone), false);

  const battlefieldDone = new Set([TUTORIAL_MERGE_TASK.BATTLEFIELD]);
  assert.deepEqual(tutorialMergeHints(game, battlefieldDone).map((hint) => hint.id),
    [TUTORIAL_MERGE_TASK.CART]);
  assert.match(tutorialMergeText(battlefieldDone), /Cat Cart/);
  assert.equal(step.isDone(game, battlefieldDone), false);

  const cartDone = new Set([TUTORIAL_MERGE_TASK.CART]);
  assert.deepEqual(tutorialMergeHints(game, cartDone).map((hint) => hint.id),
    [TUTORIAL_MERGE_TASK.BATTLEFIELD]);
  assert.match(tutorialMergeText(cartDone), /battlefield Purrcy/);
  assert.equal(step.isDone(game, cartDone), false);

  const bothDone = new Set(Object.values(TUTORIAL_MERGE_TASK));
  assert.deepEqual(tutorialMergeHints(game, bothDone), []);
  assert.equal(step.isDone(game, bothDone), true);
});

test('every core step is well-formed', () => {
  assert.ok(CORE_STEPS.length > 0);
  for (const step of CORE_STEPS) {
    assert.ok(step.id && typeof step.id === 'string');
    assert.ok(typeof step.text === 'function' || (typeof step.text === 'string' && step.text.length > 0));
    assert.ok(['tap', 'gate'].includes(step.mode));
    if (step.mode === 'gate') assert.equal(typeof step.isDone, 'function');
    if (step.spotlight !== null) assert.equal(typeof step.spotlight, 'string');
    if (step.dragFrom) assert.ok(['string', 'function'].includes(typeof step.dragFrom));
    if (step.dragTo) assert.ok(['string', 'function'].includes(typeof step.dragTo));
    if (step.dragHints) assert.equal(typeof step.dragHints, 'function');
    if (step.mutedRegion) assert.equal(typeof step.mutedRegion, 'string');
  }
  assert.equal(new Set(CORE_STEPS.map((s) => s.id)).size, CORE_STEPS.length);
});

test('the first placement lesson mutes the unrelated dog preview lane', () => {
  assert.equal(CORE_STEPS.find((step) => step.id === 'r1-buy1').mutedRegion,
    '.dog-preview-wing');
});

test('every tip is well-formed with a trigger', () => {
  assert.ok(TIPS.length > 0);
  for (const tip of TIPS) {
    assert.ok(tip.id && tip.text);
    assert.equal(typeof tip.when, 'function');
  }
  assert.equal(new Set(TIPS.map((t) => t.id)).size, TIPS.length);
});

test('the ability tip waits until the Tactics Window opens', () => {
  const game = createGame();
  game.cats.push({ ...createCat(1, CAT_COAT.BLACK), row: 13, col: 3 });
  const tip = TIPS.find((entry) => entry.id === 'tip-ability');

  assert.equal(game.phase, 'prep');
  assert.equal(tip.when(game), false);

  game.phase = 'tactics';
  assert.equal(tip.when(game), true);
  assert.equal(tip.spotlight, '#tactics-panel');
  assert.doesNotMatch(tip.text, /open the tactics window/i);
});
