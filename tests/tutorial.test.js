import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CAT_COAT, DOG_CELL_CAPACITY, WORKER_ROLE, createGame, createCat, waveCountForRound,
} from '../src/game-engine.js';
import {
  fighterSlot, workerSlot, tutorialShop, tutorialShopAfterRefresh, tutorialWave,
  refreshTutorialShop,
  catOnBoard, boardCatCount, producerInHouse, producerInShop, catAtLevel,
  squadFull, anyWoundedCat, ownsAbilityCat, inventoryHasItem, ownsWorkerRole,
  tutorialShopFighterSelector, tutorialOpenLaneSelector, tutorialWoundedCatSelector, tutorialPurrcyIsWounded, confirmTutorialSkip,
  tutorialShopWorkerSelector, tutorialBlockedCatDragMessage, tutorialBlockedDropMessage,
  tutorialMergeHints, tutorialMergeTaskForDrop, tutorialMergeText, tutorialMovableCatSelectors,
  tutorialCatInfoSelectors, allTutorialCatsMoved, woundTutorialPurrcy,
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

  // Healing is now taught immediately after the Round 2 move, so Round 3 needs no scripted dog.
  assert.equal(tutorialWave(3, [3]), null);
  assert.equal(tutorialWave(2, [1]), null);
});

test('tutorial rounds 8 through 10 add one dog to the normal wave', () => {
  for (const round of [8, 9, 10]) {
    const wave = tutorialWave(round, [], () => 0);
    assert.equal(wave.length, waveCountForRound(round) + 1, `round ${round}`);

    const countsBySquare = Object.groupBy(wave, (dog) => `${dog.row}:${dog.col}`);
    assert.ok(Object.values(countsBySquare)
      .every((dogs) => dogs.length <= DOG_CELL_CAPACITY), `round ${round} respects dog stack capacity`);
  }
  assert.equal(tutorialWave(7, [], () => 0), null);
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

test('the Whisker Biscuit lesson blocks other cat drags without blocking Biscuit', () => {
  const game = createGame();
  game.shop = tutorialShopAfterRefresh(1);
  const step = CORE_STEPS.find((entry) => entry.id === 'r1-produce');

  assert.equal(tutorialShopWorkerSelector(game, WORKER_ROLE.COOK),
    '#shop .shop-card[data-shop-index="0"]');
  assert.match(tutorialBlockedCatDragMessage(step, { type: 'shop-fighter', coat: CAT_COAT.ORANGE }),
    /Drag Whisker Biscuit/i);
  assert.match(tutorialBlockedCatDragMessage(step, { type: 'shop-worker', role: WORKER_ROLE.TRADER }),
    /Drag Whisker Biscuit/i);
  assert.equal(tutorialBlockedCatDragMessage(step, { type: 'shop-worker', role: WORKER_ROLE.COOK }), null);
  assert.equal(tutorialBlockedCatDragMessage(step, { type: 'item', itemKind: 'food' }), null,
    'the guard is narrowly limited to cat drags');
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

test('round 1 places both cats before teaching tap-for-info', () => {
  const buyIndex = CORE_STEPS.findIndex((entry) => entry.id === 'r1-buy1');
  const infoIndex = CORE_STEPS.findIndex((entry) => entry.id === 'r1-cat-info');
  const secondBuyIndex = CORE_STEPS.findIndex((entry) => entry.id === 'r1-buy2');
  assert.equal(secondBuyIndex, buyIndex + 1);
  assert.equal(infoIndex, secondBuyIndex + 1);

  const step = CORE_STEPS[infoIndex];
  assert.deepEqual(step.completeOnActions, ['view-cat-info', 'open-glossary']);
  assert.equal(step.bubblePlacement, 'between-targets');
  assert.equal(step.mode, 'gate');
  assert.equal(step.actionStartSelectors, tutorialCatInfoSelectors);
  assert.match(step.text, /Tap the cat you just placed/i);
  assert.match(step.text, /yellow “i” in the Cat Cart/i);

  const game = createGame();
  game.cats.push({ ...createCat(1, CAT_COAT.ORANGE), row: 13, col: 2 });
  assert.deepEqual(tutorialCatInfoSelectors(game), [
    '#board .cell[data-row="13"][data-col="2"]',
    '#cart-info',
  ]);
});

test('tutorial heal hint targets wounded Purrcy instead of another hurt cat', () => {
  const game = createGame();
  const healthy = { ...createCat(1, CAT_COAT.GREY), row: 13, col: 2 };
  const wounded = { ...createCat(1, CAT_COAT.ORANGE), row: 12, col: 4 };
  healthy.hp -= 1;
  wounded.hp -= 2;
  game.cats.push(healthy, wounded);

  assert.equal(tutorialWoundedCatSelector(game),
    '#board .cell[data-row="12"][data-col="4"] .unit:not(.dog-unit):not(.decoy-unit)');
  assert.equal(tutorialPurrcyIsWounded(game), true);
  wounded.hp = wounded.maxHp;
  assert.equal(tutorialWoundedCatSelector(game), null);
  assert.equal(tutorialPurrcyIsWounded(game), false, 'another wounded cat does not redirect Purrcy\'s lesson');
});

test('the movement payoff wounds Purrcy without hurting another cat', () => {
  const game = createGame();
  const healthy = { ...createCat(1, CAT_COAT.GREY), row: 13, col: 2 };
  const purrcy = { ...createCat(2, CAT_COAT.ORANGE), row: 12, col: 4 };
  game.cats.push(healthy, purrcy);

  assert.equal(woundTutorialPurrcy(game), purrcy);
  assert.equal(purrcy.hp, purrcy.maxHp - 2);
  assert.equal(healthy.hp, healthy.maxHp);

  const woundedHp = purrcy.hp;
  woundTutorialPurrcy(game);
  assert.equal(purrcy.hp, woundedHp, 'an existing wound is not deepened');
});

test('the movement lesson targets only cats that can still move', () => {
  const game = createGame();
  const moved = { ...createCat(1, CAT_COAT.ORANGE), row: 12, col: 2, hasEnteredBattle: true, prepMoved: true };
  const ready = { ...createCat(1, CAT_COAT.GREY), row: 13, col: 4, hasEnteredBattle: true, prepMoved: false };
  game.cats.push(moved, ready);

  assert.deepEqual(tutorialMovableCatSelectors(game), [
    '#board .cell[data-row="13"][data-col="4"] .unit:not(.dog-unit):not(.decoy-unit) > canvas',
  ]);

  moved.hasEnteredBattle = false;
  assert.equal(tutorialMovableCatSelectors(game).length, 2, 'a rookie stays freely repositionable');
  game.phase = 'battle';
  assert.deepEqual(tutorialMovableCatSelectors(game), []);
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

test('the merge lesson blocks unrelated cats and non-merge Purrcy drops', () => {
  const step = CORE_STEPS.find((entry) => entry.id === 'r2-merge');

  assert.match(tutorialBlockedCatDragMessage(step, { type: 'shop-fighter', coat: CAT_COAT.GREY }),
    /Only Purrcy/i);
  assert.match(tutorialBlockedCatDragMessage(step, { type: 'shop-worker', role: WORKER_ROLE.COOK }),
    /Only Purrcy/i);
  assert.equal(tutorialBlockedCatDragMessage(step, { type: 'cat', coat: CAT_COAT.ORANGE }), null);
  assert.equal(tutorialBlockedCatDragMessage(step, { type: 'shop-fighter', coat: CAT_COAT.ORANGE }), null);

  assert.match(tutorialBlockedDropMessage(step, { type: 'move' }), /Drop Purrcy onto/i);
  assert.match(tutorialBlockedDropMessage(step, { type: 'purchase-place' }), /Drop Purrcy onto/i);
  assert.equal(tutorialBlockedDropMessage(step, { type: 'merge' }), null);
  assert.equal(tutorialBlockedDropMessage(step, { type: 'purchase-merge' }), null);
  assert.equal(tutorialBlockedDropMessage(step, { type: 'invalid' }), null,
    'normal invalid drops keep their existing feedback');
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
  assert.match(tutorialMergeText(battlefieldDone), /Now merge the shop cat/);
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

test('the merge payoff explains stronger cats and freed squad space', () => {
  const step = CORE_STEPS.find((entry) => entry.id === 'r2-admire');

  assert.match(step.text, /Level 2 cats hit harder and survive longer than Level 1 cats/);
  assert.match(step.text, /clears two spaces for your squad/);
  assert.doesNotMatch(step.text, /beats three/i);
});

test('round 2 skips selling and moves directly from the Purrcy merge to spending and Ready', () => {
  const admireIndex = CORE_STEPS.findIndex((entry) => entry.id === 'r2-admire');
  const spendReadyIndex = CORE_STEPS.findIndex((entry) => entry.id === 'r2-spend-ready');
  const spendReadyStep = CORE_STEPS[spendReadyIndex];
  const game = createGame();
  game.round = 2;
  game.gold = 7;

  assert.equal(spendReadyIndex, admireIndex + 1);
  assert.equal(CORE_STEPS.some((entry) => entry.id === 'r2-adopt-buy'), false);
  assert.equal(CORE_STEPS.some((entry) => entry.id === 'r2-adopt'), false);
  assert.equal(CORE_STEPS.some((entry) => entry.id === 'r2-spend'), false);
  assert.equal(spendReadyStep.text, 'Spend the rest of the gold, then tap READY.');
  assert.equal(spendReadyStep.spotlight(game), '#shop');
  assert.equal(spendReadyStep.isDone(game), false);

  game.gold = 0;
  assert.equal(spendReadyStep.spotlight(game), '#done');
  assert.equal(spendReadyStep.isDone(game), false, 'spending alone does not skip the Ready instruction');

  game.phase = 'combat';
  assert.equal(spendReadyStep.isDone(game), true);
});

test('core lessons only complete from actions that prove the taught behavior', () => {
  const game = createGame();
  const buySecond = CORE_STEPS.find((entry) => entry.id === 'r1-buy2');
  const placeProducer = CORE_STEPS.find((entry) => entry.id === 'r1-produce');
  const collectFood = CORE_STEPS.find((entry) => entry.id === 'r2-collect');

  game.cats = [
    { ...createCat(1, CAT_COAT.ORANGE), row: 13, col: 2 },
    { ...createCat(1, CAT_COAT.GREY), row: 13, col: 3 },
  ];
  assert.equal(buySecond.isDone(game), false, 'a non-Purrcy defender does not prove that a second Purrcy was placed');
  game.cats[1] = { ...createCat(1, CAT_COAT.ORANGE), row: 12, col: 2 };
  assert.equal(buySecond.isDone(game), true, 'a second Purrcy in the same column must not trap the tutorial');
  game.cats[1].col = 3;
  assert.equal(buySecond.isDone(game), true);

  game.cats = [{ ...createCat(1, CAT_COAT.ORANGE), copies: 2, row: 13, col: 2 }];
  assert.equal(buySecond.isDone(game), true, 'stacking the second Purrcy onto the first must also continue');

  game.workers[0] = { role: WORKER_ROLE.TRADER };
  assert.equal(placeProducer.isDone(game), false, 'the heal lesson requires Whisker Biscuit');
  game.workers[0] = { role: WORKER_ROLE.COOK };
  assert.equal(placeProducer.isDone(game), true);

  game.inventory[0] = { kind: 'weapon', tier: 1, quantity: 1 };
  assert.equal(collectFood.isDone(game), false, 'an unrelated stored item does not prove treat collection');
  game.inventory[0] = { kind: 'food', tier: 1, quantity: 1 };
  assert.equal(collectFood.isDone(game), true);
});

test('actionable lessons can declare the successful action that completes them', () => {
  const scout = CORE_STEPS.find((entry) => entry.id === 'r1-scout');
  assert.deepEqual(scout.completeOnActions, ['view-next-wave']);
  assert.equal(scout.advanceDelayMs, 2600);
  assert.deepEqual(CORE_STEPS.find((entry) => entry.id === 'r2-heal').completeOnActions, ['use-food']);
});

test('moving a cat immediately leads into healing the wounded Purrcy', () => {
  const moveIndex = CORE_STEPS.findIndex((entry) => entry.id === 'r2-move');
  const step = CORE_STEPS[moveIndex + 1];
  const game = createGame();
  const woundedCat = { ...createCat(1, CAT_COAT.ORANGE), row: 13, col: 2 };
  woundedCat.hp -= 2;
  game.round = 2;
  game.phase = 'tactics';
  game.cats.push(woundedCat);
  game.inventory[0] = { kind: 'food', tier: 1, quantity: 1 };

  assert.equal(step.id, 'r2-heal');
  assert.equal(step.mode, 'gate', 'the tactics screen stays undimmed for the drag');
  assert.equal(step.showWhen(game), true);
  assert.equal(step.spotlight, '#board');
  assert.equal(step.bubblePlacement, 'target-top');
  assert.equal(step.dragFrom, '#inventory .pet-draggable');
  assert.equal(step.dragTo(game), tutorialWoundedCatSelector(game));
  assert.equal(step.text, "Great move, now heal Purrcy, who's been hurt, with the food from below. That's the payoff of worker cats!");
  assert.equal(step.isDone(game), false);

  game.cats[0].hp = game.cats[0].maxHp;
  assert.equal(step.isDone(game), true);
});

test('every core step is well-formed', () => {
  assert.ok(CORE_STEPS.length > 0);
  for (const step of CORE_STEPS) {
    assert.ok(step.id && typeof step.id === 'string');
    assert.ok(typeof step.text === 'function' || (typeof step.text === 'string' && step.text.length > 0));
    assert.ok(['tap', 'gate'].includes(step.mode));
    if (step.mode === 'gate') {
      const hasCompletionGate = typeof step.isDone === 'function'
        || step.completeOnActions?.length > 0
        || step.completeOnAllActions?.length > 0;
      const hasActionStart = step.dragSources?.length > 0 || step.actionStartSelectors;
      assert.equal(hasCompletionGate, true, `${step.id} needs proof that its action completed`);
      assert.ok(hasActionStart, `${step.id} needs a real action-start trigger`);
    }
    if (step.spotlight !== null) assert.ok(['string', 'function'].includes(typeof step.spotlight));
    if (step.dragFrom) assert.ok(['string', 'function'].includes(typeof step.dragFrom));
    if (step.dragTo) assert.ok(['string', 'function'].includes(typeof step.dragTo));
    if (step.dragHints) assert.equal(typeof step.dragHints, 'function');
    if (step.mutedRegion) assert.equal(typeof step.mutedRegion, 'string');
    if (step.bubblePlacement) assert.ok(['target-top', 'between-targets'].includes(step.bubblePlacement));
  }
  assert.equal(new Set(CORE_STEPS.map((s) => s.id)).size, CORE_STEPS.length);
});

test('the first placement lesson mutes the unrelated dog preview lane', () => {
  assert.equal(CORE_STEPS.find((step) => step.id === 'r1-buy1').mutedRegion,
    '.dog-lawn-preview');
});

test('tutorial targets follow the relocated planning, scout, spending, and tactics UI', () => {
  const scoutStep = CORE_STEPS.find((step) => step.id === 'r1-scout');
  assert.equal(scoutStep.spotlight, '#next-wave-toggle');
  assert.deepEqual(scoutStep.completeOnActions, ['view-next-wave']);
  assert.equal(scoutStep.advanceDelayMs, 2600);
  assert.equal(CORE_STEPS.find((step) => step.id === 'r1-buy1').spotlight, '#shop');
  assert.equal(CORE_STEPS.find((step) => step.id === 'r1-start').spotlight, '#done');
  assert.equal(CORE_STEPS.find((step) => step.id === 'r2-spend-ready').spotlight({ gold: 1 }), '#shop');
  assert.equal(CORE_STEPS.find((step) => step.id === 'r2-spend-ready').spotlight({ gold: 0 }), '#done');
  assert.equal(TIPS.find((tip) => tip.id === 'tip-ability').spotlight, '#tactics-panel');
});

test('every tip is well-formed with a trigger', () => {
  assert.ok(TIPS.length > 0);
  for (const tip of TIPS) {
    assert.ok(tip.id && tip.text);
    assert.ok(['tap', 'gate'].includes(tip.mode));
    assert.equal(typeof tip.when, 'function');
  }
  assert.equal(new Set(TIPS.map((t) => t.id)).size, TIPS.length);
});

test('only information lessons use Continue; action lessons wait for the game action', () => {
  assert.deepEqual(
    CORE_STEPS.filter((step) => step.mode === 'tap').map((step) => step.id),
    ['r1-stakes', 'r2-admire'],
  );
  assert.deepEqual(
    TIPS.filter((tip) => tip.mode === 'gate').map((tip) => tip.id),
    ['tip-ability'],
  );
  assert.deepEqual(
    TIPS.filter((tip) => tip.mode === 'tap').map((tip) => tip.id),
    ['tip-new-cats', 'tip-coins', 'tip-fill-house'],
  );
});

test('round 2 teaches movement at the first Tactics Window', () => {
  const startStepIndex = CORE_STEPS.findIndex((entry) => entry.id === 'r2-spend-ready');
  const moveStepIndex = CORE_STEPS.findIndex((entry) => entry.id === 'r2-move');
  const step = CORE_STEPS[moveStepIndex];
  const game = createGame();
  game.round = 2;
  game.cats.push(
    { ...createCat(1, CAT_COAT.ORANGE), row: 13, col: 2 },
    { ...createCat(1, CAT_COAT.GREY), row: 13, col: 4 },
  );

  assert.equal(moveStepIndex, startStepIndex + 1);
  assert.equal(step.mode, 'gate');
  assert.equal(step.spotlight, null);
  assert.equal(step.showWhen(game), false, 'the lesson waits through setup');

  game.phase = 'tactics';
  assert.equal(step.showWhen(game), true);
  assert.equal(step.isDone(game), false);
  assert.deepEqual(step.focusSelectors(game), tutorialMovableCatSelectors(game));
  assert.equal(step.focusSelectors(game).length, 2);
  assert.match(step.text, /each cat can move once/i);
  assert.match(step.text, /up to 2 squares/i);
  assert.match(step.text, /Clawdius moves 1/i);
  assert.equal(step.text, "there's a pause during every battle to perform tactics like move. Each cat can move once: move up to 2 squares, while Clawdius moves 1. Drag a cat now");

  game.cats[0].tacticsMoved = true;
  assert.equal(step.isDone(game), true, 'moving a cat completes the lesson');
  game.cats[0].tacticsMoved = false;
  game.phase = 'combat';
  assert.equal(step.isDone(game), true, 'continuing without moving keeps the lesson optional');
  assert.equal(TIPS.some((entry) => entry.id === 'tip-move'), false, 'the lesson is not repeated later');
});

test('the post-movement Ready cue waits until every tutorial cat has moved', () => {
  const game = createGame();
  game.phase = 'tactics';
  game.cats.push(
    { ...createCat(1, CAT_COAT.ORANGE), tacticsMoved: true },
    { ...createCat(1, CAT_COAT.GREY), tacticsMoved: false },
  );

  assert.equal(allTutorialCatsMoved(game), false);
  game.cats[1].tacticsMoved = true;
  assert.equal(allTutorialCatsMoved(game), true);
  game.cats.length = 0;
  assert.equal(allTutorialCatsMoved(game), false, 'an empty field never prompts Ready');
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

test('each actionable just-in-time tip recognizes proof of completion', () => {
  const game = createGame();
  const newCats = TIPS.find((entry) => entry.id === 'tip-new-cats');
  const coins = TIPS.find((entry) => entry.id === 'tip-coins');
  const ability = TIPS.find((entry) => entry.id === 'tip-ability');
  const fillHouse = TIPS.find((entry) => entry.id === 'tip-fill-house');

  assert.deepEqual(newCats.completeOnActions, ['purchase-advanced-cat']);
  assert.equal(newCats.isDone(game), false);
  game.cats.push({ ...createCat(1, CAT_COAT.BLACK), row: 13, col: 3 });
  assert.equal(newCats.isDone(game), true, 'owning Bombay proves a tier-3 cat was grabbed');

  assert.deepEqual(coins.completeOnActions, ['collect-coins']);
  assert.deepEqual(ability.completeOnActions, ['use-ability']);

  assert.deepEqual(fillHouse.completeOnActions, ['fill-house']);
  assert.equal(fillHouse.isDone(game), false);
  game.workers = [{ role: WORKER_ROLE.COOK }, { role: WORKER_ROLE.TRADER }];
  assert.equal(fillHouse.isDone(game), true);
});
