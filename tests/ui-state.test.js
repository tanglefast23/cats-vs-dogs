import test from 'node:test';
import assert from 'node:assert/strict';

import { selectionAfterPurchase, catSelectionAdvice, shopOfferHasOwnedMatch, shopOfferMatchingFieldCatIds, shopPetAvailability, hpTone, equippedItemMarkers, catStatusMarkers, dogStatusMarkers, productionLegendRows, glossaryTabs, glossaryEntriesByUnlockRound, dogPreviewQueue, stormTargetDogIds, productionCollectionDestination, productionProgressStatus, productionWorkVisual, shopCardSummary, workerTooltipInfo } from '../src/ui-state.js';
import { WORKER_INFO } from '../src/production-rules.js';
import {
  CAT_EQUIPMENT, CAT_ARCHETYPE_MARKERS, DOG_TIER_MARKERS, DOG_ROLE_MARKERS,
  WORKER_ART_MARKERS, ITEM_ART_MARKERS, CAT_BODY_BUILDS, DOG_BODY_BUILDS, drawDog,
} from '../src/pixel-art.js';
import { COMBAT_TIMING, combatTiming, homingShotKeyframes, lobShotKeyframes, stormColumnPosition } from '../src/combat-animation.js';
import { FIELD_CAP_MESSAGE, DRAG_FEEDBACK, DROP_IMPACT, getDropAction, isBattlefieldDropAction } from '../src/drag-drop.js';
import { CAT_PLANNING_MOVE_SPENT_MESSAGE, catMovementPath, catMoveLimitMessage } from '../src/movement-rules.js';
import { UPGRADE_TIMING, describeUpgrade } from '../src/upgrade-animation.js';
import { BLUE_SCRATCH_FLURRY } from '../src/melee-animation.js';

test('cat pickup advice explains free placement before its first battle', () => {
  assert.equal(
    catSelectionAdvice(
      { level: 1, hasEnteredBattle: false },
      { name: 'Purrcy Pew-Pew', blurb: 'Hits hard' },
      'prep',
    ),
    'Level 1 Purrcy Pew-Pew selected. Before its first battle, you can freely place or reposition this cat anywhere in cat territory.',
  );
});

test('shop offers flag mergeable cats owned across the field, Production House, and workbench', () => {
  const ownedCats = [
    { kind: 'alley-cat', coat: 2, level: 1 },
    { kind: 'production-cat', role: 'cook', level: 1 },
    { kind: 'alley-cat', coat: 5, level: 2 },
  ];

  assert.equal(shopOfferHasOwnedMatch({ category: 'fighter', coat: 2, level: 1 }, ownedCats), true);
  assert.equal(shopOfferHasOwnedMatch({ category: 'worker', role: 'cook', level: 1 }, ownedCats), true);
  assert.equal(shopOfferHasOwnedMatch({ category: 'fighter', coat: 5, level: 2 }, ownedCats), true);
  assert.equal(shopOfferHasOwnedMatch({ category: 'fighter', coat: 2, level: 2 }, ownedCats), false);
  assert.equal(shopOfferHasOwnedMatch({ category: 'worker', role: 'trader', level: 1 }, ownedCats), false);
});

test('sold and max-level shop cats never advertise an unusable match', () => {
  const ownedCats = [{ kind: 'alley-cat', coat: 2, level: 3 }];
  assert.equal(shopOfferHasOwnedMatch({ category: 'fighter', coat: 2, level: 3 }, ownedCats), false);
  assert.equal(shopOfferHasOwnedMatch({ category: 'fighter', coat: 2, level: 3, sold: true }, ownedCats), false);
});

test('shop hover identifies every matching battlefield cat and no invalid targets', () => {
  const fieldCats = [
    { id: 'white-one', kind: 'alley-cat', coat: 2, level: 1 },
    { id: 'white-two', kind: 'alley-cat', coat: 2, level: 1 },
    { id: 'white-level-two', kind: 'alley-cat', coat: 2, level: 2 },
    { id: 'orange-one', kind: 'alley-cat', coat: 0, level: 1 },
  ];
  const offer = { category: 'fighter', coat: 2, level: 1 };

  assert.deepEqual(shopOfferMatchingFieldCatIds(offer, fieldCats), ['white-one', 'white-two']);
  assert.deepEqual(shopOfferMatchingFieldCatIds({ ...offer, sold: true }, fieldCats), []);
  assert.deepEqual(shopOfferMatchingFieldCatIds({ ...offer, level: 3 }, fieldCats), []);
  assert.deepEqual(shopOfferMatchingFieldCatIds({ category: 'worker', role: 'cook', level: 1 }, fieldCats), []);
});

test('next-wave dogs fill from top-left in chronological and left-to-right order', () => {
  const laterLeft = { id: 'later-left', appearanceIndex: 1, col: 0 };
  const nowRight = { id: 'now-right', appearanceIndex: 0, col: 5 };
  const nowLeft = { id: 'now-left', appearanceIndex: 0, col: 1 };

  assert.deepEqual(
    dogPreviewQueue([laterLeft, nowRight, nowLeft]).map((dog) => dog.id),
    ['now-left', 'now-right', 'later-left'],
  );
});

test('Storm preview identifies every living dog in the hovered column', () => {
  const dogs = [
    { id: 'top-dog', row: 2, col: 4, hp: 8 },
    { id: 'stacked-dog', row: 2, col: 4, hp: 3 },
    { id: 'other-column', row: 5, col: 3, hp: 8 },
    { id: 'defeated-dog', row: 7, col: 4, hp: 0 },
  ];

  assert.deepEqual(stormTargetDogIds(dogs, 4), ['top-dog', 'stacked-dog']);
  assert.deepEqual(stormTargetDogIds(dogs, 1), []);
});

test('production collection feedback targets matching storage, empty storage, or gold', () => {
  const inventory = [{ kind: 'food', quantity: 2 }, null, { kind: 'weapon', tier: 1, quantity: 1 }];
  assert.deepEqual(productionCollectionDestination(inventory, { kind: 'food', quantity: 1 }), { type: 'storage', index: 0 });
  assert.deepEqual(productionCollectionDestination(inventory, { kind: 'armour', tier: 1, quantity: 1 }), { type: 'storage', index: 1 });
  assert.deepEqual(productionCollectionDestination(inventory, { kind: 'coins', quantity: 2 }), { type: 'gold', index: null });
  assert.equal(productionCollectionDestination(inventory.map(() => ({ kind: 'blocked' })), { kind: 'food' }), null);
});

test('Clawhammer progress reports battles remaining without implying a real-time countdown', () => {
  const info = WORKER_INFO.weaponsmith;
  assert.deepEqual(productionProgressStatus({ productionProgress: 0 }, info), {
    completed: 0, total: 2, remaining: 2, percent: 0, label: '2 BATTLES',
  });
  assert.deepEqual(productionProgressStatus({ productionProgress: 1 }, info), {
    completed: 1, total: 2, remaining: 1, percent: 50, label: '1 BATTLE',
  });
  assert.deepEqual(productionProgressStatus({
    productionProgress: 0,
    pendingOutput: { kind: 'weapon', tier: 1, quantity: 1 },
  }, info), {
    completed: 2, total: 2, remaining: 0, percent: 100, label: 'READY',
  });
});

test('every production cat has a distinct planning-stage work visual', () => {
  assert.deepEqual(Object.keys(WORKER_INFO).map((role) => productionWorkVisual(role)), [
    'stir',
    'coin',
    'hammer',
    'polish',
  ]);
  assert.equal(productionWorkVisual('unknown'), null);
});

test('every multi-battle production cat exposes the same completion countdown', () => {
  const slowWorkers = Object.entries(WORKER_INFO).filter(([, info]) => info.productionRounds > 1);
  assert.deepEqual(slowWorkers.map(([role, info]) => ({
    role,
    status: productionProgressStatus({ role, productionProgress: 1 }, info),
  })), [
    {
      role: 'weaponsmith',
      status: { completed: 1, total: 2, remaining: 1, percent: 50, label: '1 BATTLE' },
    },
    {
      role: 'armourer',
      status: { completed: 1, total: 2, remaining: 1, percent: 50, label: '1 BATTLE' },
    },
  ]);
});

test('cat equipment plates expose actual attack, block, and remaining-hit values', () => {
  assert.deepEqual(equippedItemMarkers({
    equipment: {
      weapon: { tier: 1, attack: 1 },
      armour: { tier: 3, block: 4, uses: 2, maxUses: 3 },
    },
  }), [
    { kind: 'weapon', tier: 1, value: 1, uses: null, maxUses: null },
    { kind: 'armour', tier: 3, value: 4, uses: 2, maxUses: 3 },
  ]);
  assert.deepEqual(equippedItemMarkers({ equipment: { weapon: null, armour: null } }), []);
});

test('temporary cat and dog statuses provide large-marker values and plain-language labels', () => {
  assert.deepEqual(catStatusMarkers({ guard: 2, nextAttackBonus: 3, nextAttackPenalty: 1 }), [
    { kind: 'guard', value: '2', label: 'Guard blocks 2 damage from the next hit' },
    { kind: 'attack-up', value: '+3', label: 'Next attack gains 3 damage' },
    { kind: 'attack-down', value: '-1', label: 'Next attack loses 1 damage' },
  ]);
  assert.deepEqual(dogStatusMarkers({ frozenActions: 1, tangled: true, attackBoost: 4 }), [
    { kind: 'frozen', value: '1', label: 'Frozen for 1 round' },
    { kind: 'tangled', value: '1', label: 'Next movement is skipped' },
    { kind: 'attack-up', value: '+4', label: 'Next damaging attack gains 4 damage' },
  ]);
  assert.deepEqual(dogStatusMarkers({ frozenActions: 3 }), [
    { kind: 'frozen', value: '2', label: 'Frozen for 2 rounds' },
  ]);
});

test('Cat Cart summaries contain only badge, name, and cost', () => {
  assert.deepEqual(shopCardSummary({ category: 'fighter', sold: false }, { shopTier: 3, name: 'Laserpaw' }), {
    badge: 'T3', name: 'Laserpaw', cost: 3,
  });
  assert.deepEqual(shopCardSummary({ category: 'worker', sold: false }, { name: 'Cashmere Cat' }), {
    badge: 'WORK', name: 'Cashmere Cat', cost: 3,
  });
});

test('worker cats expose production hover details', () => {
  assert.deepEqual(workerTooltipInfo({ level: 1, role: 'armourer' }, WORKER_INFO.armourer), {
    kind: 'cat',
    category: 'WORK',
    title: 'L1 Pawladin',
    stats: 'Produces 1 T1 armour every 2 battles',
    detailLabel: 'Production',
    attack: 'Place in the Production House. Three matching workers evolve to the next level.',
    note: 'Builds blocking armour',
  });
});

test('zero-gold shop cats stay interactive and readable while purchase is rejected', () => {
  const availability = shopPetAvailability({
    sold: false,
    gold: 0,
    benchLength: 0,
    benchSize: 6,
    phase: 'prep',
    playing: false,
  });

  assert.deepEqual(availability, {
    interactive: true,
    canBuy: false,
    reason: 'gold',
  });
});

test('sold shop cats are disabled because they are genuinely unavailable', () => {
  const availability = shopPetAvailability({
    sold: true,
    gold: 10,
    benchLength: 0,
    benchSize: 6,
    phase: 'prep',
    playing: false,
  });

  assert.deepEqual(availability, {
    interactive: false,
    canBuy: false,
    reason: 'sold',
  });
});

test('hp bars read green above half, amber to a quarter, red below', () => {
  assert.equal(hpTone(6, 6), 'full');
  assert.equal(hpTone(4, 7), 'full');
  assert.equal(hpTone(3, 6), 'mid');
  assert.equal(hpTone(3, 7), 'mid');
  assert.equal(hpTone(2, 8), 'low');
  assert.equal(hpTone(0, 6), 'low');
  assert.equal(hpTone(5, 0), 'low');
});

test('a successful shop purchase clears selection instead of silently selecting the new cat', () => {
  const priorSelection = { type: 'cat', id: 'cat-on-board' };

  const selection = selectionAfterPurchase(priorSelection, true);

  assert.equal(selection, null);
});

test('failed shop purchases preserve the current explicit selection', () => {
  const priorSelection = { type: 'cat', id: 'cat-on-board' };

  const selection = selectionAfterPurchase(priorSelection, false);

  assert.deepEqual(selection, priorSelection);
});

test('combat timing leaves enough time to read travel, impact, and HP loss', () => {
  assert.ok(COMBAT_TIMING.projectileMs >= 700);
  assert.ok(COMBAT_TIMING.impactMs >= 300);
  assert.ok(COMBAT_TIMING.hpPauseMs >= 250);
});

test('Thunderpaws charges, flashes, and spans exactly one selected board column', () => {
  assert.ok(COMBAT_TIMING.stormChargeMs >= 300);
  assert.ok(COMBAT_TIMING.stormAftermathMs >= 500);
  assert.deepEqual(stormColumnPosition(4), {
    leftPercent: 400 / 6,
    centerPercent: 450 / 6,
    widthPercent: 100 / 6,
  });
});

test('2x combat speed halves every timing without touching the tuned constants', () => {
  assert.deepEqual(combatTiming(1), { ...COMBAT_TIMING });
  const fast = combatTiming(2);
  assert.equal(fast.projectileMs, Math.round(COMBAT_TIMING.projectileMs / 2));
  assert.equal(fast.homingMs, Math.round(COMBAT_TIMING.homingMs / 2));
  assert.equal(fast.impactMs, Math.round(COMBAT_TIMING.impactMs / 2));
  assert.equal(COMBAT_TIMING.projectileMs, 820, 'source table stays untouched');
  assert.equal(combatTiming(0).projectileMs, COMBAT_TIMING.projectileMs, 'invalid speed falls back to 1x');
});

test('Blue Brawler uses a readable alternating-paw scratch flurry', () => {
  assert.equal(BLUE_SCRATCH_FLURRY.swipes, 5);
  assert.equal(BLUE_SCRATCH_FLURRY.alternatingPaws, true);
  assert.ok(BLUE_SCRATCH_FLURRY.durationMs >= 700);
  assert.ok(BLUE_SCRATCH_FLURRY.hitAtMs > BLUE_SCRATCH_FLURRY.durationMs / 2);
  assert.ok(BLUE_SCRATCH_FLURRY.hitAtMs < BLUE_SCRATCH_FLURRY.durationMs);
});

test('dragging a bench cat to an empty cat-territory cell produces a place action', () => {
  const action = getDropAction({
    source: { type: 'bench', id: 'cat-1', level: 1 },
    target: { kind: 'cell', row: 10, col: 2, occupied: null },
    catZoneStart: 9,
    rows: 14,
    cols: 6,
  });

  assert.deepEqual(action, { type: 'place', row: 10, col: 2 });
});

test('dragging a board cat to another empty cat cell produces a move action', () => {
  const action = getDropAction({
    source: { type: 'cat', id: 'cat-1', level: 1 },
    target: { kind: 'cell', row: 12, col: 5, occupied: null },
    catZoneStart: 9,
    rows: 14,
    cols: 6,
  });

  assert.deepEqual(action, { type: 'move', row: 12, col: 5 });
});

test('a full squad blocks new deployments while still allowing moves and merges', () => {
  const common = {
    target: { kind: 'cell', row: 10, col: 2, occupied: null },
    catZoneStart: 9,
    rows: 14,
    cols: 6,
    fieldCount: 5,
    fieldCap: 5,
  };

  assert.equal(FIELD_CAP_MESSAGE, 'Elite Squad full (5/5). Merge, workbench, or sell a cat before deploying another.');
  assert.deepEqual(getDropAction({
    ...common,
    source: { type: 'bench', id: 'cat-1', level: 1 },
  }), { type: 'invalid', reason: 'field-cap' });
  assert.deepEqual(getDropAction({
    ...common,
    source: { type: 'shop-fighter', id: 'shop-1', level: 1 },
  }), { type: 'invalid', reason: 'field-cap' });
  assert.deepEqual(getDropAction({
    ...common,
    source: { type: 'cat', id: 'cat-1', level: 1 },
  }), { type: 'move', row: 10, col: 2 });
  assert.deepEqual(getDropAction({
    ...common,
    target: { kind: 'cell', row: 10, col: 2, occupied: { id: 'cat-2', level: 1 } },
    source: { type: 'bench', id: 'cat-1', level: 1 },
  }), { type: 'merge', targetType: 'cat', targetId: 'cat-2' });
});

test('drag highlights match the setup move limit for each cat build', () => {
  assert.equal(catMoveLimitMessage({ ability: 'melee' }), 'This cat can only move 1 square.');
  assert.equal(catMoveLimitMessage({ ability: 'homing' }), 'This cat can only move 2 squares.');
  const target = { kind: 'cell', row: 10, col: 3, occupied: false };
  const common = { target, catZoneStart: 10, rows: 14, cols: 6, phase: 'prep' };
  assert.deepEqual(getDropAction({
    ...common,
    source: { type: 'cat', id: 1, ability: 'melee', hasEnteredBattle: true, prepOrigin: { row: 10, col: 1 }, prepMoved: false },
  }), { type: 'invalid', reason: 'move-distance' });
  assert.deepEqual(getDropAction({
    ...common,
    source: { type: 'cat', id: 2, ability: 'homing', hasEnteredBattle: true, prepOrigin: { row: 10, col: 1 }, prepMoved: false },
  }), { type: 'move', row: 10, col: 3 });
  assert.deepEqual(getDropAction({
    ...common,
    target: { kind: 'cell', row: 10, col: 4, occupied: false },
    source: { type: 'cat', id: 2, ability: 'homing', hasEnteredBattle: true, prepOrigin: { row: 10, col: 1 }, prepMoved: false },
  }), { type: 'invalid', reason: 'move-distance' });
  assert.deepEqual(getDropAction({
    ...common,
    target: { kind: 'cell', row: 10, col: 4, occupied: { id: 9, level: 1 } },
    source: { type: 'cat', id: 2, level: 1, ability: 'homing', hasEnteredBattle: true, prepOrigin: { row: 10, col: 1 }, prepMoved: false },
  }), { type: 'merge', targetType: 'cat', targetId: 9 });
  assert.equal(getDropAction({
    ...common,
    source: { type: 'cat', id: 3, ability: 'homing', hasEnteredBattle: true, prepOrigin: { row: 10, col: 2 }, prepMoved: true },
  }).type, 'invalid');
});

test('a rookie cat can drag anywhere repeatedly before its first battle', () => {
  const source = {
    type: 'cat', id: 4, ability: 'melee', hasEnteredBattle: false,
    row: 10, col: 0, prepOrigin: { row: 10, col: 0 }, prepMoved: true,
  };
  const target = { kind: 'cell', row: 13, col: 5, occupied: false };
  const common = { source, target, catZoneStart: 10, rows: 14, cols: 6, phase: 'prep' };

  assert.deepEqual(getDropAction(common), { type: 'move', row: 13, col: 5 });
  assert.equal(catMovementPath(source, target).every((step) => step.withinLimit), true);
});

test('movement path marks allowed steps green and excess steps red', () => {
  assert.deepEqual(
    catMovementPath(
      { type: 'cat', ability: 'homing', hasEnteredBattle: true, row: 10, col: 1 },
      { kind: 'cell', row: 10, col: 4 },
    ),
    [
      { row: 10, col: 1, withinLimit: true },
      { row: 10, col: 2, withinLimit: true },
      { row: 10, col: 3, withinLimit: true },
      { row: 10, col: 4, withinLimit: false },
    ],
  );
});

test('a cat that already moved marks every hovered path square invalid', () => {
  assert.equal(CAT_PLANNING_MOVE_SPENT_MESSAGE, '1 move per setup or battle break.');
  const source = {
    type: 'cat', id: 3, level: 1, ability: 'homing', row: 10, col: 2,
    hasEnteredBattle: true, prepOrigin: { row: 10, col: 1 }, prepMoved: true,
  };
  const target = { kind: 'cell', row: 10, col: 4, occupied: false };
  const common = { source, target, catZoneStart: 10, rows: 14, cols: 6, phase: 'prep' };

  assert.deepEqual(getDropAction(common), { type: 'invalid', reason: 'prep-moved' });
  assert.deepEqual(
    catMovementPath(source, target),
    [
      { row: 10, col: 2, withinLimit: false },
      { row: 10, col: 3, withinLimit: false },
      { row: 10, col: 4, withinLimit: false },
    ],
  );
  const mergeTarget = { ...target, occupied: { id: 9, level: 1 } };
  assert.deepEqual(
    getDropAction({ ...common, target: mergeTarget }),
    { type: 'merge', targetType: 'cat', targetId: 9 },
  );
  assert.deepEqual(catMovementPath(source, mergeTarget), []);
});

test('dropping onto a matching cat produces a merge action', () => {
  const action = getDropAction({
    source: { type: 'bench', id: 'cat-1', level: 2 },
    target: { kind: 'cell', row: 11, col: 3, occupied: { id: 'cat-2', level: 2 } },
    catZoneStart: 9,
    rows: 14,
    cols: 6,
  });

  assert.deepEqual(action, { type: 'merge', targetType: 'cat', targetId: 'cat-2' });
});

test('dropping outside cat territory is rejected and uses a visible return animation', () => {
  const action = getDropAction({
    source: { type: 'bench', id: 'cat-1', level: 1 },
    target: { kind: 'cell', row: 4, col: 2, occupied: null },
    catZoneStart: 9,
    rows: 14,
    cols: 6,
  });

  assert.deepEqual(action, { type: 'invalid' });
  assert.ok(DRAG_FEEDBACK.returnMs >= 200);
  assert.ok(DRAG_FEEDBACK.liftScale > 1);
  assert.ok(DRAG_FEEDBACK.dropMs >= 220);
});

test('shop fighters buy only when dragged to a legal battlefield or bench destination', () => {
  const source = { type: 'shop-fighter', shopIndex: 0, id: 'shop-1', level: 1, coat: 0 };
  assert.deepEqual(getDropAction({
    source,
    target: { kind: 'cell', row: 12, col: 2, occupied: null },
    catZoneStart: 10,
    rows: 14,
    cols: 6,
  }), { type: 'purchase-place', row: 12, col: 2 });
  assert.deepEqual(getDropAction({
    source,
    target: { kind: 'bench', index: 3, occupied: null },
    catZoneStart: 10,
    rows: 14,
    cols: 6,
  }), { type: 'purchase-bench', index: 3 });
  assert.deepEqual(getDropAction({
    source,
    target: { kind: 'cell', row: 12, col: 2, occupied: { id: 'cat-2', level: 1, coat: 0 } },
    catZoneStart: 10,
    rows: 14,
    cols: 6,
  }), { type: 'purchase-merge', targetType: 'cat', targetId: 'cat-2' });
});

test('production cats route between the two-slot House and the universal workbench, never the field', () => {
  const shopWorker = { type: 'shop-worker', shopIndex: 1, id: 'shop-2', level: 1, role: 'cook' };
  assert.deepEqual(getDropAction({
    source: shopWorker,
    target: { kind: 'worker-slot', index: 1, occupied: null },
    catZoneStart: 10,
    rows: 14,
    cols: 6,
  }), { type: 'purchase-worker', index: 1 });
  assert.deepEqual(getDropAction({
    source: shopWorker,
    target: { kind: 'bench', index: 0, occupied: null },
    catZoneStart: 10,
    rows: 14,
    cols: 6,
  }), { type: 'purchase-worker-bench', index: 0 });
  assert.deepEqual(getDropAction({
    source: shopWorker,
    target: { kind: 'cell', row: 12, col: 2, occupied: null },
    catZoneStart: 10,
    rows: 14,
    cols: 6,
  }), { type: 'invalid' });

  const owned = { type: 'worker', workerIndex: 0, id: 'worker-1', level: 1, role: 'cook' };
  assert.deepEqual(getDropAction({
    source: owned,
    target: { kind: 'worker-slot', index: 1, occupied: null },
    catZoneStart: 10,
    rows: 14,
    cols: 6,
  }), { type: 'move-worker', index: 1 });
  assert.deepEqual(getDropAction({
    source: owned,
    target: { kind: 'bench', index: 0, occupied: null },
    catZoneStart: 10,
    rows: 14,
    cols: 6,
  }), { type: 'return-worker', index: 0 });
  assert.deepEqual(getDropAction({
    source: owned,
    target: { kind: 'cell', row: 12, col: 2, occupied: null },
    catZoneStart: 10,
    rows: 14,
    cols: 6,
  }), { type: 'invalid' });

  const reserved = { type: 'bench-worker', benchIndex: 0, id: 'worker-2', level: 1, role: 'cook' };
  assert.deepEqual(getDropAction({
    source: reserved,
    target: { kind: 'worker-slot', index: 0, occupied: null },
    catZoneStart: 10,
    rows: 14,
    cols: 6,
  }), { type: 'place-worker', index: 0 });
  assert.deepEqual(getDropAction({
    source: reserved,
    target: {
      kind: 'bench', index: 1,
      occupied: { id: 'worker-3', unitType: 'worker', level: 1, role: 'cook' },
    },
    catZoneStart: 10,
    rows: 14,
    cols: 6,
  }), { type: 'merge-bench-worker', index: 1, targetId: 'worker-3' });
});

test('food targets cats during setup or tactics, while active combat stays blocked', () => {
  const target = { kind: 'fighter', id: 'cat-1', hp: 3, maxHp: 6 };
  assert.deepEqual(getDropAction({
    source: { type: 'item', inventoryIndex: 0, itemKind: 'food' },
    target, catZoneStart: 10, rows: 14, cols: 6, phase: 'prep', paused: false,
  }), { type: 'use-food', targetId: 'cat-1' });
  assert.deepEqual(getDropAction({
    source: { type: 'item', inventoryIndex: 0, itemKind: 'food' },
    target, catZoneStart: 10, rows: 14, cols: 6, phase: 'combat', paused: false,
  }), { type: 'invalid' });
  assert.deepEqual(getDropAction({
    source: { type: 'item', inventoryIndex: 0, itemKind: 'food' },
    target, catZoneStart: 10, rows: 14, cols: 6, phase: 'tactics', paused: false,
  }), { type: 'use-food', targetId: 'cat-1' });
  assert.deepEqual(getDropAction({
    source: { type: 'item', inventoryIndex: 1, itemKind: 'weapon' },
    target, catZoneStart: 10, rows: 14, cols: 6, phase: 'combat', paused: false,
  }), { type: 'invalid' });
  assert.deepEqual(getDropAction({
    source: { type: 'item', inventoryIndex: 1, itemKind: 'weapon' },
    target, catZoneStart: 10, rows: 14, cols: 6, phase: 'tactics', paused: false,
  }), { type: 'equip', targetId: 'cat-1' });
});

test('only sellable owned cats route into the adoption box during prep', () => {
  const target = { kind: 'sell' };
  const common = { target, catZoneStart: 10, rows: 14, cols: 6, phase: 'prep' };
  assert.deepEqual(getDropAction({
    ...common,
    source: { type: 'cat', id: 'cat-1', level: 2, sellable: true, sellValue: 2 },
  }), { type: 'sell', value: 2 });
  assert.deepEqual(getDropAction({
    ...common,
    source: { type: 'bench', id: 'cat-2', level: 1, sellable: true, sellValue: 1 },
  }), { type: 'sell', value: 1 });
  assert.deepEqual(getDropAction({
    ...common,
    source: { type: 'shop-fighter', id: 'shop-1', sellable: true, sellValue: 1 },
  }), { type: 'invalid' });
  assert.deepEqual(getDropAction({
    ...common,
    source: { type: 'cat', id: 'cat-3', level: 1, sellable: false, sellValue: 1 },
  }), { type: 'invalid' });
  assert.deepEqual(getDropAction({
    ...common,
    phase: 'combat',
    source: { type: 'cat', id: 'cat-4', level: 1, sellable: true, sellValue: 1 },
  }), { type: 'invalid' });
});

test('successful placement feedback stays visually gentle while its sound remains audible', () => {
  assert.equal(DROP_IMPACT.intensity, 0.4);
  assert.equal(DROP_IMPACT.boardShakePx, 1.2);
  assert.equal(DROP_IMPACT.landingLiftPercent, 11.2);
  assert.equal(DROP_IMPACT.ghostSettleScale, 0.928);
  assert.equal(DROP_IMPACT.ringEndScale, 1.68);
  assert.equal(DROP_IMPACT.soundGain, 0.9);
});

test('landing sound plays only for successful battlefield drops and moves', () => {
  for (const type of ['purchase-place', 'place', 'move', 'tactics-move']) {
    assert.equal(isBattlefieldDropAction({ type }), true, `${type} should play the landing sound`);
  }
  for (const type of ['purchase-bench', 'purchase-worker', 'equip', 'merge', 'return', 'sell', 'invalid']) {
    assert.equal(isBattlefieldDropAction({ type }), false, `${type} should stay silent`);
  }
});

test('a two-copy merge gets a polished stack reveal without claiming a level-up', () => {
  const reveal = describeUpgrade(
    { level: 1, copies: 1 },
    { level: 1, copies: 2 },
  );

  assert.deepEqual(reveal, {
    kind: 'stack',
    level: 1,
    label: '2 / 3',
    intensity: 'standard',
  });
});

test('level two and level three promotions receive stronger reveal classifications', () => {
  assert.deepEqual(
    describeUpgrade({ level: 1, copies: 2 }, { level: 2, copies: 1 }),
    { kind: 'level-up', level: 2, label: 'LEVEL 2!', intensity: 'level-up' },
  );
  assert.deepEqual(
    describeUpgrade({ level: 2, copies: 2 }, { level: 3, copies: 1 }),
    { kind: 'level-up', level: 3, label: 'LEVEL 3!', intensity: 'ultimate' },
  );
  assert.ok(UPGRADE_TIMING.smokeMs >= 600);
  assert.ok(UPGRADE_TIMING.totalMs >= UPGRADE_TIMING.smokeMs);
});

test('level two and three cats have progressively stronger visible equipment sets', () => {
  assert.ok(CAT_EQUIPMENT[2].length >= 3, 'Level 2 needs several obvious armor pieces');
  assert.ok(CAT_EQUIPMENT[3].length > CAT_EQUIPMENT[2].length, 'Level 3 needs more equipment than Level 2');
  assert.ok(CAT_EQUIPMENT[3].includes('power-cannon'));
  assert.ok(CAT_EQUIPMENT[3].includes('energy-wings'));
});

test('production legend lists every worker with a concise economy role', () => {
  assert.deepEqual(productionLegendRows(WORKER_INFO), [
    { role: 'cook', name: 'BISCUIT', description: 'cooks healing food' },
    { role: 'trader', name: 'CASHMERE', description: 'earns bonus coins' },
    { role: 'weaponsmith', name: 'HAMMER', description: 'forges attack weapons' },
    { role: 'armourer', name: 'PAWLADIN', description: 'makes bite-blocking armour' },
  ]);
});

test('Cat & Dog Glossary exposes the three requested roster tabs', () => {
  assert.deepEqual(glossaryTabs('production'), [
    { id: 'battle', label: 'Battle Cats', active: false },
    { id: 'production', label: 'Production Cats', active: true },
    { id: 'dogs', label: 'Dogs', active: false },
  ]);
});

test('battle cat glossary entries are ordered by unlock round', () => {
  const entries = glossaryEntriesByUnlockRound({
    5: { name: 'Laserpaw', unlockRound: 7 },
    6: { name: 'Frosty Paws', unlockRound: 4 },
    0: { name: 'Purrcy Pew-Pew', unlockRound: 1 },
    4: { name: 'Bombay Boom', unlockRound: 4 },
  });

  assert.deepEqual(entries.map(([key]) => key), ['0', '4', '6', '5']);
});

test('production workers and items expose distinct readable art markers', () => {
  assert.deepEqual(Object.keys(WORKER_ART_MARKERS).sort(), ['armourer', 'cook', 'trader', 'weaponsmith']);
  assert.ok(WORKER_ART_MARKERS.cook.includes('straw-hat'));
  assert.ok(WORKER_ART_MARKERS.trader.includes('coin-purse'));
  assert.ok(WORKER_ART_MARKERS.weaponsmith.includes('hammer'));
  assert.ok(WORKER_ART_MARKERS.weaponsmith.includes('anvil'));
  assert.ok(WORKER_ART_MARKERS.armourer.includes('goggles'));
  assert.deepEqual(Object.keys(ITEM_ART_MARKERS).sort(), ['armour', 'coins', 'food', 'weapon']);
});

test('unlockable fighters have distinct accessories and dog tier gear', () => {
  assert.deepEqual(CAT_ARCHETYPE_MARKERS[3], ['calico-patches', 'yarn-ball']);
  assert.deepEqual(CAT_ARCHETYPE_MARKERS[4], ['black-coat', 'bomb-pack']);
  assert.deepEqual(CAT_ARCHETYPE_MARKERS[5], ['prism-coat', 'crystal-crown']);
  assert.deepEqual(CAT_ARCHETYPE_MARKERS[6], ['ice-coat', 'frost-staff']);
  assert.deepEqual(CAT_ARCHETYPE_MARKERS[7], ['rift-cloak', 'portal-rings']);
  assert.deepEqual(CAT_ARCHETYPE_MARKERS[8], ['mirage-mask', 'phantom-double']);
  assert.deepEqual(CAT_ARCHETYPE_MARKERS[9], ['storm-coat', 'lightning-rod']);
  assert.deepEqual(CAT_ARCHETYPE_MARKERS[10], ['maestro-coat', 'conductor-baton']);
  assert.deepEqual(DOG_TIER_MARKERS[4], ['alpha-armor', 'crown']);
  assert.deepEqual(DOG_ROLE_MARKERS.frisbee, ['blue-frisbee', 'flight-goggles']);
  assert.deepEqual(DOG_ROLE_MARKERS.tennis, ['visor', 'tennis-ball']);
  assert.deepEqual(DOG_ROLE_MARKERS.howler, ['sound-cone', 'purple-bandana']);
  assert.deepEqual(DOG_ROLE_MARKERS.lobber, ['bone-cannon', 'ammo-pack']);
  assert.deepEqual(DOG_ROLE_MARKERS.jumper, ['spring-boots', 'red-cape']);
  assert.deepEqual(DOG_ROLE_MARKERS.skittish, ['shaking-knees', 'security-blanket']);
  assert.deepEqual(DOG_ROLE_MARKERS.medic, ['medic-cap', 'heart-pack']);
  assert.deepEqual(DOG_ROLE_MARKERS.growler, ['megaphone', 'spiked-collar']);
});

test('every fighter has a unique body build matched to its combat role', () => {
  const catBuilds = Object.values(CAT_BODY_BUILDS);
  assert.equal(catBuilds.length, 11, 'all 11 battle coats need a body build');
  assert.equal(new Set(catBuilds).size, catBuilds.length, 'cat builds must all differ');
  assert.equal(CAT_BODY_BUILDS[1], 'bruiser', 'the melee cat reads big and tough');
  assert.equal(CAT_BODY_BUILDS[3], 'kitten');
  assert.equal(CAT_BODY_BUILDS[6], 'robed-mystic', 'casters read frail');
  assert.equal(CAT_BODY_BUILDS[7], 'hooded-phantom');

  const dogBuilds = Object.values(DOG_BODY_BUILDS);
  assert.equal(dogBuilds.length, 9, 'all 9 dog roles need a body build');
  assert.equal(new Set(dogBuilds).size, dogBuilds.length, 'dog builds must all differ');
  assert.equal(DOG_BODY_BUILDS.frisbee, 'disc-retriever');
  assert.equal(DOG_BODY_BUILDS.howler, 'crooner', 'the howler poses mid-howl');
  assert.equal(DOG_BODY_BUILDS.lobber, 'artillery-dachshund');
  assert.equal(DOG_BODY_BUILDS.jumper, 'springer', 'the jumper reads coiled to leap');
  assert.equal(DOG_BODY_BUILDS.skittish, 'trembling-chihuahua');
  assert.equal(DOG_BODY_BUILDS.medic, 'saint-bernard-medic');
  assert.equal(DOG_BODY_BUILDS.growler, 'corgi-intimidator');
});

test('every dog role renders at every tier without missing sprite geometry', () => {
  const ctx = { clearRect() {}, fillRect() {}, set fillStyle(value) { this.color = value; } };
  const canvas = { width: 0, height: 0, getContext: () => ctx };
  for (const role of Object.keys(DOG_BODY_BUILDS)) {
    for (const tier of [1, 2, 3, 4]) {
      assert.doesNotThrow(() => drawDog(canvas, tier, role), `${role} tier ${tier} should render`);
    }
  }
});

test('homing shot path uses a sine wave while ending on the target', () => {
  const start = { xPercent: 10, yPercent: 80 };
  const end = { xPercent: 70, yPercent: 20 };
  const frames = homingShotKeyframes(start, end, { steps: 20, waves: 2, amplitude: 5 });

  assert.ok(frames.length >= 12);
  const first = frames[0];
  const mid = frames[Math.floor(frames.length / 2)];
  const last = frames[frames.length - 1];

  assert.match(first.left, /^10(\.0+)?%$/);
  assert.match(first.top, /^80(\.0+)?%$/);
  assert.match(last.left, /^70(\.0+)?%$/);
  assert.match(last.top, /^20(\.0+)?%$/);

  // Some mid-flight frame should leave the straight line (sine offset).
  let maxOff = 0;
  for (const frame of frames.slice(1, -1)) {
    const x = Number(frame.left.replace('%', ''));
    const y = Number(frame.top.replace('%', ''));
    const u = frames.indexOf(frame) / (frames.length - 1);
    const t = u * u * (3 - 2 * u);
    const straightX = start.xPercent + (end.xPercent - start.xPercent) * t;
    const straightY = start.yPercent + (end.yPercent - start.yPercent) * t;
    maxOff = Math.max(maxOff, Math.hypot(x - straightX, y - straightY));
  }
  assert.ok(maxOff > 1.2, `expected a sine offset off the line, maxOff=${maxOff}`);
});

test('a bomb thrown within one lane follows a visibly curved path', () => {
  const frames = lobShotKeyframes(
    { xPercent: 40, yPercent: 90 },
    { xPercent: 40, yPercent: 35 },
    { steps: 20, arcPercent: 12 },
  );
  const firstX = Number(frames[0].left.replace('%', ''));
  const middleX = Number(frames[Math.floor(frames.length / 2)].left.replace('%', ''));
  const lastX = Number(frames.at(-1).left.replace('%', ''));

  assert.equal(firstX, 40);
  assert.ok(middleX >= 45, `same-lane bomb should bow sideways, middle x=${middleX}`);
  assert.ok(Math.abs(lastX - 40) < 1e-9);
});

test('orange burst bullets use exactly double their prior travel time', () => {
  assert.equal(COMBAT_TIMING.burstProjectileMs, 1040);
});

test('white homing shots are modestly slower without doubling their travel time', () => {
  assert.equal(COMBAT_TIMING.homingMs, 1650);
  assert.ok(COMBAT_TIMING.homingMs < COMBAT_TIMING.burstProjectileMs * 2);
});

test('homing shots are slower than normal projectiles so the seek reads', () => {
  assert.ok(COMBAT_TIMING.homingMs > COMBAT_TIMING.projectileMs);
  assert.ok(COMBAT_TIMING.homingMs >= 1200);
});

test('UI click sound stays quieter than gameplay feedback', async () => {
  const sound = await import('../src/sound.js');
  assert.equal(typeof sound.playUiClick, 'function');
  assert.ok(sound.UI_CLICK_VOLUME > 0);
  assert.ok(sound.UI_CLICK_VOLUME <= 0.03);
  assert.doesNotThrow(() => sound.playUiClick());
});

test('refresh has its own safe mechanical click sound', async () => {
  const sound = await import('../src/sound.js');
  assert.equal(typeof sound.playRefreshClick, 'function');
  assert.doesNotThrow(() => sound.playRefreshClick());
});

test('refresh click synthesizes a two-stage click with a noise transient', async () => {
  const oscillators = [];
  const bufferSources = [];
  class FakeAudioContext {
    constructor() {
      this.currentTime = 0;
      this.destination = {};
      this.sampleRate = 8000;
      this.state = 'running';
    }

    createOscillator() {
      const oscillator = {
        type: '',
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        start() {},
        stop() {},
      };
      oscillators.push(oscillator);
      return oscillator;
    }

    createGain() {
      return {
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
      };
    }

    createBuffer(_channels, length) {
      return { getChannelData: () => new Float32Array(length) };
    }

    createBufferSource() {
      const source = { connect() {}, start() {}, stop() {} };
      bufferSources.push(source);
      return source;
    }

    createBiquadFilter() {
      return { type: '', frequency: { value: 0 }, connect() {} };
    }
  }

  globalThis.window = {
    AudioContext: FakeAudioContext,
    setTimeout(callback) { callback(); return 1; },
  };
  const sound = await import(`../src/sound.js?refresh-click=${Date.now()}-${Math.random()}`);
  sound.playRefreshClick();

  assert.deepEqual(oscillators.map((oscillator) => oscillator.type), ['square', 'triangle']);
  assert.equal(bufferSources.length, 1);
  delete globalThis.window;
});

test('sound helpers no-op safely without a browser audio context', async () => {
  const sound = await import('../src/sound.js');
  assert.equal(typeof sound.playCatDrop, 'function');
  assert.equal(typeof sound.playHit, 'function');
  assert.equal(typeof sound.playCollection, 'function');
  assert.equal(typeof sound.startLevelMusic, 'function');
  assert.equal(typeof sound.stopLevelMusic, 'function');
  assert.doesNotThrow(() => sound.playCatDrop());
  assert.doesNotThrow(() => sound.playHit());
  assert.doesNotThrow(() => sound.playHit({ heavy: true }));
  assert.doesNotThrow(() => sound.playCollection('coins'));
  assert.doesNotThrow(() => sound.unlockAudio());
  assert.doesNotThrow(() => sound.startLevelMusic());
  assert.doesNotThrow(() => sound.stopLevelMusic());
});

test('sound setting can be toggled and remembered', async () => {
  const memory = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => (memory.has(key) ? memory.get(key) : null),
      setItem: (key, value) => { memory.set(key, String(value)); },
    },
    AudioContext: undefined,
    webkitAudioContext: undefined,
    setTimeout: () => 0,
  };

  const sound = await import(`../src/sound.js?settings=${Date.now()}`);
  sound.setSoundEnabled(false);
  assert.equal(sound.isSoundEnabled(), false);
  assert.equal(memory.get(sound.SOUND_SETTING_KEY), '0');
  assert.doesNotThrow(() => sound.playCatDrop());
  assert.doesNotThrow(() => sound.playHit());

  sound.setSoundEnabled(true);
  assert.equal(sound.isSoundEnabled(), true);
  assert.equal(memory.get(sound.SOUND_SETTING_KEY), '1');
  assert.equal(sound.loadSoundEnabled(), true);

  delete globalThis.window;
});

test('level music loops quietly and follows the shared sound setting', async () => {
  const players = [];
  class FakeAudio {
    constructor(src) {
      this.src = src;
      this.currentTime = 9;
      this.playCount = 0;
      this.pauseCount = 0;
      players.push(this);
    }

    play() {
      this.playCount += 1;
      return Promise.resolve();
    }

    pause() {
      this.pauseCount += 1;
    }
  }

  globalThis.window = {
    Audio: FakeAudio,
    AudioContext: undefined,
    webkitAudioContext: undefined,
    setTimeout: () => 0,
  };

  const sound = await import(`../src/sound.js?music=${Date.now()}`);
  assert.equal(sound.startLevelMusic(), true);
  assert.equal(players.length, 1);
  assert.equal(players[0].loop, true);
  assert.equal(players[0].preload, 'auto');
  assert.equal(players[0].volume, sound.LEVEL_MUSIC_VOLUME);
  assert.ok(sound.LEVEL_MUSIC_VOLUME >= 0.35, 'music should remain clearly audible');
  assert.equal(players[0].playCount, 1);

  sound.setSoundEnabled(false);
  assert.equal(players[0].pauseCount, 1);
  sound.setSoundEnabled(true);
  assert.equal(players[0].playCount, 2);

  sound.stopLevelMusic();
  assert.equal(players[0].pauseCount, 2);
  assert.equal(players[0].currentTime, 0);

  delete globalThis.window;
});

test('automated browser checks never start audible game music', async () => {
  const players = [];
  globalThis.window = {
    navigator: { webdriver: true },
    document: {
      hidden: false,
      visibilityState: 'visible',
      addEventListener: () => {},
    },
    Audio: class FakeAudio {
      constructor() { players.push(this); }
      play() { return Promise.resolve(); }
      pause() {}
    },
  };

  const sound = await import(`../src/sound.js?automated=${Date.now()}-${Math.random()}`);
  assert.equal(sound.startLevelMusic(), false);
  assert.equal(players.length, 0);

  delete globalThis.window;
});

test('hidden tabs pause music and resume when visible again', async () => {
  const players = [];
  let visibilityHandler = null;
  const document = {
    hidden: false,
    visibilityState: 'visible',
    addEventListener(type, handler) {
      if (type === 'visibilitychange') visibilityHandler = handler;
    },
  };
  class FakeAudio {
    constructor() {
      this.playCount = 0;
      this.pauseCount = 0;
      players.push(this);
    }

    play() {
      this.playCount += 1;
      return Promise.resolve();
    }

    pause() {
      this.pauseCount += 1;
    }
  }
  globalThis.window = {
    document,
    Audio: FakeAudio,
    addEventListener: () => {},
  };

  const sound = await import(`../src/sound.js?visibility=${Date.now()}-${Math.random()}`);
  assert.equal(sound.startLevelMusic(), true);
  assert.equal(players.length, 1);
  assert.equal(players[0].playCount, 1);

  document.hidden = true;
  document.visibilityState = 'hidden';
  visibilityHandler();
  assert.equal(players[0].pauseCount, 1);

  document.hidden = false;
  document.visibilityState = 'visible';
  visibilityHandler();
  assert.equal(players[0].playCount, 2);

  delete globalThis.window;
});

test('embedded webviews that report unfocused or hidden still play music', async () => {
  // Regression: app preview panes render the game on screen while the page
  // reports visibilityState "hidden" and hasFocus() false — audio must not
  // be gated on those signals or real play sessions go silent.
  const players = [];
  globalThis.window = {
    document: {
      hidden: true,
      visibilityState: 'hidden',
      hasFocus: () => false,
      addEventListener: () => {},
    },
    Audio: class FakeAudio {
      constructor() {
        this.playCount = 0;
        players.push(this);
      }

      play() {
        this.playCount += 1;
        return Promise.resolve();
      }

      pause() {}
    },
    addEventListener: () => {},
  };

  const sound = await import(`../src/sound.js?embedded=${Date.now()}-${Math.random()}`);
  assert.equal(sound.startLevelMusic(), true);
  assert.equal(players.length, 1);
  assert.equal(players[0].playCount, 1);

  delete globalThis.window;
});

test('a game tab gives up music when another tab claims ownership', async () => {
  const memory = new Map();
  const players = [];
  let storageHandler = null;
  class FakeAudio {
    constructor() {
      this.playCount = 0;
      this.pauseCount = 0;
      players.push(this);
    }

    play() {
      this.playCount += 1;
      return Promise.resolve();
    }

    pause() {
      this.pauseCount += 1;
    }
  }
  globalThis.window = {
    document: { hidden: false, visibilityState: 'visible', addEventListener: () => {} },
    localStorage: {
      getItem: (key) => (memory.has(key) ? memory.get(key) : null),
      setItem: (key, value) => { memory.set(key, String(value)); },
      removeItem: (key) => { memory.delete(key); },
    },
    addEventListener(type, handler) {
      if (type === 'storage') storageHandler = handler;
    },
    Audio: FakeAudio,
  };

  const sound = await import(`../src/sound.js?ownership=${Date.now()}-${Math.random()}`);
  assert.equal(sound.startLevelMusic(), true);
  assert.equal(players[0].playCount, 1);
  assert.ok(memory.has(sound.MUSIC_OWNER_KEY));

  memory.set(sound.MUSIC_OWNER_KEY, 'other-tab');
  storageHandler({ key: sound.MUSIC_OWNER_KEY, newValue: 'other-tab' });
  assert.equal(players[0].pauseCount, 1);

  memory.delete(sound.MUSIC_OWNER_KEY);
  storageHandler({ key: sound.MUSIC_OWNER_KEY, newValue: null });
  assert.equal(players[0].playCount, 2);

  sound.stopLevelMusic();
  assert.equal(memory.has(sound.MUSIC_OWNER_KEY), false);

  delete globalThis.window;
});
