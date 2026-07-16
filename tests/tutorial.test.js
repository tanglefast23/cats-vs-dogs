import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CAT_COAT, DOG_CELL_CAPACITY, WORKER_ROLE, createGame, createCat, waveCountForRound,
} from '../src/game-engine.js';
import {
  fighterSlot, workerSlot, tutorialShop, tutorialShopAfterRefresh, tutorialWave,
  refreshTutorialShop,
  catOnBoard, boardCatCount, producerInHouse, producerInShop, catAtLevel,
  squadFull, anyWoundedCat, ownsAbilityCat, inventoryHasItem, ownsWorkerRole, ownsFighterCoat,
  tutorialShopFighterSelector, tutorialOpenLaneSelector, tutorialWoundedCatSelector, confirmTutorialSkip,
  tutorialMergeHints, tutorialMergeTaskForDrop, tutorialMergeText, tutorialMovableCatSelectors, tutorialOwnedCatSelector,
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

test('the merge payoff explains stronger cats and freed squad space', () => {
  const step = CORE_STEPS.find((entry) => entry.id === 'r2-admire');

  assert.match(step.text, /Level 2 cats hit harder and survive longer than Level 1 cats/);
  assert.match(step.text, /clears two spaces for your squad/);
  assert.doesNotMatch(step.text, /beats three/i);
});

test('round 2 teaches the Next Wave adoption gesture in text and action', () => {
  const admireIndex = CORE_STEPS.findIndex((entry) => entry.id === 'r2-admire');
  const buyIndex = CORE_STEPS.findIndex((entry) => entry.id === 'r2-adopt-buy');
  const adoptIndex = CORE_STEPS.findIndex((entry) => entry.id === 'r2-adopt');
  const spendIndex = CORE_STEPS.findIndex((entry) => entry.id === 'r2-spend');
  const buyStep = CORE_STEPS[buyIndex];
  const adoptStep = CORE_STEPS[adoptIndex];
  const game = createGame();
  game.round = 2;
  game.shop = tutorialShop(2);

  assert.equal(buyIndex, admireIndex + 1);
  assert.equal(adoptIndex, buyIndex + 1);
  assert.equal(spendIndex, adoptIndex + 1);
  assert.match(buyStep.text, /Hissiletoe/);
  assert.equal(buyStep.isDone(game), false);

  const practiceCat = { ...createCat(1, CAT_COAT.WHITE), row: 13, col: 4 };
  game.cats.push(practiceCat);
  assert.equal(ownsFighterCoat(game, CAT_COAT.WHITE), true);
  assert.equal(buyStep.isDone(game), true);
  assert.equal(adoptStep.dragFrom(game),
    '#board .cell[data-row="13"][data-col="4"]');
  assert.equal(adoptStep.dragTo, '#next-wave-zone');
  assert.deepEqual(adoptStep.completeOnActions, ['sell']);
  assert.match(adoptStep.text, /hover over NEXT WAVE/i);
  assert.match(adoptStep.text, /turns into the Adoption Box/i);
  assert.match(adoptStep.text, /drop Hissiletoe there to sell/i);

  game.cats = [];
  game.bench.push(practiceCat);
  assert.equal(tutorialOwnedCatSelector(game, CAT_COAT.WHITE),
    `#workbench .bench-slot[data-unit-id="${practiceCat.id}"]`);
});

test('round 2 teaches spending every coin before showing the start-round lesson', () => {
  const spendStepIndex = CORE_STEPS.findIndex((entry) => entry.id === 'r2-spend');
  const startStepIndex = CORE_STEPS.findIndex((entry) => entry.id === 'r2-start');
  const spendStep = CORE_STEPS[spendStepIndex];
  const startStep = CORE_STEPS[startStepIndex];
  const game = createGame();
  game.round = 2;
  game.gold = 7;

  assert.ok(spendStepIndex > 0);
  assert.equal(startStepIndex, spendStepIndex + 1);
  assert.equal(spendStep.isDone(game), false);
  assert.match(spendStep.text(game), /7 gold/i);
  assert.doesNotMatch(spendStep.text(game), /start (the )?round/i);
  assert.equal(startStep.showWhen(game), false);

  game.gold = 0;
  assert.equal(spendStep.isDone(game), true);
  assert.equal(startStep.showWhen(game), true);
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
  assert.equal(buySecond.isDone(game), false, 'a non-Purrcy defender does not prove the second-lane lesson');
  game.cats[1] = { ...createCat(1, CAT_COAT.ORANGE), row: 12, col: 2 };
  assert.equal(buySecond.isDone(game), false, 'two Purrcys in one column do not cover another lane');
  game.cats[1].col = 3;
  assert.equal(buySecond.isDone(game), true);

  game.workers[0] = { role: WORKER_ROLE.TRADER };
  assert.equal(placeProducer.isDone(game), false, 'the heal lesson requires Whisker Biscuit');
  game.workers[0] = { role: WORKER_ROLE.COOK };
  assert.equal(placeProducer.isDone(game), true);

  game.inventory[0] = { kind: 'weapon', tier: 1, quantity: 1 };
  assert.equal(collectFood.isDone(game), false, 'an unrelated stored item does not prove treat collection');
  game.inventory[0] = { kind: 'food', tier: 1, quantity: 1 };
  assert.equal(collectFood.isDone(game), true);
});

test('tap lessons can declare the successful action that replaces Continue', () => {
  assert.deepEqual(CORE_STEPS.find((entry) => entry.id === 'r1-scout').completeOnActions,
    ['purchase-place', 'purchase-bench', 'purchase-merge']);
  assert.deepEqual(CORE_STEPS.find((entry) => entry.id === 'r3-hurt').completeOnActions, ['use-food']);
  assert.deepEqual(CORE_STEPS.find((entry) => entry.id === 'r3-heal').completeOnActions, ['use-food']);
});

test('every core step is well-formed', () => {
  assert.ok(CORE_STEPS.length > 0);
  for (const step of CORE_STEPS) {
    assert.ok(step.id && typeof step.id === 'string');
    assert.ok(typeof step.text === 'function' || (typeof step.text === 'string' && step.text.length > 0));
    assert.ok(['tap', 'gate'].includes(step.mode));
    if (step.mode === 'gate') assert.equal(typeof step.isDone, 'function');
    if (step.spotlight !== null) assert.ok(['string', 'function'].includes(typeof step.spotlight));
    if (step.dragFrom) assert.ok(['string', 'function'].includes(typeof step.dragFrom));
    if (step.dragTo) assert.ok(['string', 'function'].includes(typeof step.dragTo));
    if (step.dragHints) assert.equal(typeof step.dragHints, 'function');
    if (step.mutedRegion) assert.equal(typeof step.mutedRegion, 'string');
  }
  assert.equal(new Set(CORE_STEPS.map((s) => s.id)).size, CORE_STEPS.length);
});

test('the first placement lesson mutes the unrelated dog preview lane', () => {
  assert.equal(CORE_STEPS.find((step) => step.id === 'r1-buy1').mutedRegion,
    '.dog-lawn-preview');
});

test('tutorial targets follow the relocated planning, scout, adoption, and tactics UI', () => {
  assert.equal(CORE_STEPS.find((step) => step.id === 'r1-scout').spotlight, '#next-wave-toggle');
  assert.equal(CORE_STEPS.find((step) => step.id === 'r1-buy1').spotlight, '#shop');
  assert.equal(CORE_STEPS.find((step) => step.id === 'r1-start').spotlight, '#done');
  assert.equal(CORE_STEPS.find((step) => step.id === 'r2-adopt').spotlight, '#next-wave-zone');
  assert.equal(CORE_STEPS.find((step) => step.id === 'r2-adopt').dragTo, '#next-wave-zone');
  assert.equal(TIPS.find((tip) => tip.id === 'tip-ability').spotlight, '#tactics-panel');
});

test('every tip is well-formed with a trigger', () => {
  assert.ok(TIPS.length > 0);
  for (const tip of TIPS) {
    assert.ok(tip.id && tip.text);
    assert.equal(typeof tip.when, 'function');
  }
  assert.equal(new Set(TIPS.map((t) => t.id)).size, TIPS.length);
});

test('round 2 teaches movement at the first Tactics Window', () => {
  const startStepIndex = CORE_STEPS.findIndex((entry) => entry.id === 'r2-start');
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

  game.cats[0].tacticsMoved = true;
  assert.equal(step.isDone(game), true, 'moving a cat completes the lesson');
  game.cats[0].tacticsMoved = false;
  game.phase = 'combat';
  assert.equal(step.isDone(game), true, 'continuing without moving keeps the lesson optional');
  assert.equal(TIPS.some((entry) => entry.id === 'tip-move'), false, 'the lesson is not repeated later');
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
