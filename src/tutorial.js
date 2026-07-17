// Pure teaching layer for the Tutorial Level. No DOM. The engine is untouched;
// this only reads game state and builds engine-shaped shop slots / dog waves for
// a scripted opening. Consumed by the glue layer in app.js.
import {
  CAT_COAT, CAT_COAT_INFO, CAT_ZONE_START, COLS, ROWS, catStatsFor, createDog, DOG_ROLE,
  generateWave, MAX_FIELD_CATS, refreshShop, WORKER_ROLE, WORKER_INFO,
} from './game-engine.js';

let seq = 0;
const nextId = (prefix) => `${prefix}-${(seq += 1)}`;

export const TUTORIAL_SKIP_CONFIRMATION = 'Are you sure you want to skip the tutorial?';

export const TUTORIAL_FAREWELL = Object.freeze({
  id: 'tutorial-farewell',
  mode: 'tap',
  spotlight: null,
  text: 'I think you can take it from here. Go purrtect your home!',
});

export function tutorialFollowUpForAction(tipId, actionType) {
  return tipId === 'squad-full' && actionType === 'sell' ? TUTORIAL_FAREWELL : null;
}

export function confirmTutorialSkip(confirm) {
  return confirm(TUTORIAL_SKIP_CONFIRMATION);
}

// --- scripted shop slots (shapes mirror makeShopSlot) ---
export function fighterSlot(coat) {
  const stats = catStatsFor(1, coat);
  return {
    id: nextId('tut-shop'),
    kind: 'alley-cat',
    category: 'fighter',
    level: 1,
    coat,
    shopTier: CAT_COAT_INFO[coat].shopTier,
    ability: stats.ability,
    sold: false,
    saved: false,
  };
}

export function workerSlot(role) {
  const info = WORKER_INFO[role];
  return {
    id: nextId('tut-shop'),
    kind: 'production-cat',
    category: 'worker',
    role,
    level: 1,
    ability: `produce-${info.output[1].kind}`,
    sold: false,
    saved: false,
  };
}

export function tutorialShop(round) {
  if (round === 1) return [fighterSlot(CAT_COAT.ORANGE), fighterSlot(CAT_COAT.ORANGE), fighterSlot(CAT_COAT.GREY)];
  if (round === 2) return [fighterSlot(CAT_COAT.ORANGE), workerSlot(WORKER_ROLE.TRADER), fighterSlot(CAT_COAT.WHITE)];
  if (round === 4) return [fighterSlot(CAT_COAT.BLACK), fighterSlot(CAT_COAT.ORANGE), fighterSlot(CAT_COAT.FROST)];
  return null;
}

export function tutorialShopAfterRefresh(round) {
  if (round === 1) return [workerSlot(WORKER_ROLE.COOK), workerSlot(WORKER_ROLE.TRADER), fighterSlot(CAT_COAT.ORANGE)];
  return null;
}

export function refreshTutorialShop(game) {
  const next = refreshShop(game);
  if (next === game) return game;
  const scripted = tutorialShopAfterRefresh(next.round);
  if (scripted) next.shop = scripted;
  return next;
}

// --- scripted waves ---
export function tutorialWave(round, catColumns = [], random = Math.random) {
  if (round === 1) {
    const cols = catColumns.length ? catColumns.slice(0, 2) : [2, 3];
    return cols.map((col) => createDog(1, 0, col, DOG_ROLE.SCRUFFY));
  }
  if (round >= 8 && round <= 10) return generateWave(round, random, 1);
  return null;
}

// --- state predicates (all pure reads) ---
export const catOnBoard = (game, coat) => game.cats.some((cat) => cat.coat === coat);
export const boardCatCount = (game) => game.cats.length;
export const producerInHouse = (game) => game.workers.some(Boolean);
export const producerInShop = (game) => game.shop.some((s) => s && !s.sold && s.category === 'worker');
export const catAtLevel = (game, coat, level) => game.cats.some((cat) => cat.coat === coat && cat.level >= level);
export const squadFull = (game) => game.cats.length >= MAX_FIELD_CATS;
export const anyWoundedCat = (game) => game.cats.some((cat) => cat.hp < cat.maxHp);
export const ownsAbilityCat = (game) => game.cats.some((cat) => Boolean(cat.activeAbility));
export const inventoryHasItem = (game) => game.inventory.some(Boolean);
export const ownsWorkerRole = (game, role) => game.workers.some((w) => w && w.role === role);
export const ownsAdvancedCat = (game) => [...game.cats, ...game.bench]
  .some((cat) => cat.kind !== 'production-cat' && CAT_COAT_INFO[cat.coat]?.unlockRound >= 4);
export const ownsTierTwoFieldCat = (game) => game.cats
  .some((cat) => CAT_COAT_INFO[cat.coat]?.shopTier === 2);
export const tutorialSellingUnlocked = (game, completedTipIds = new Set()) => (
  game.cats.length >= MAX_FIELD_CATS || completedTipIds.has('squad-full')
);
export const tutorialWaitsForSquadFull = (game, completedTipIds = new Set()) => (
  completedTipIds.has('tip-new-cats') && !tutorialSellingUnlocked(game, completedTipIds)
);

const purrcyCopyCount = (game) => game.cats
  .filter((cat) => cat.coat === CAT_COAT.ORANGE)
  .reduce((total, cat) => total + (cat.copies ?? 1), 0);
const inventoryHasKind = (game, kind) => game.inventory.some((item) => item?.kind === kind);
const houseIsFull = (game) => game.workers.every(Boolean);

const TUTORIAL_LANE_ORDER = [2, 3, 1, 4, 0, 5].filter((col) => col < COLS);

export function tutorialShopFighterSelector(game, coat) {
  const shopIndex = game.shop.findIndex((slot) => slot
    && !slot.sold
    && slot.category === 'fighter'
    && slot.coat === coat);
  return shopIndex < 0 ? null : `#shop .shop-card[data-shop-index="${shopIndex}"]`;
}

export function tutorialShopWorkerSelector(game, role) {
  const shopIndex = game.shop.findIndex((slot) => slot
    && !slot.sold
    && slot.category === 'worker'
    && slot.role === role);
  return shopIndex < 0 ? null : `#shop .shop-card[data-shop-index="${shopIndex}"]`;
}

export function tutorialShopTierSelector(game, shopTier) {
  const shopIndex = game.shop.findIndex((slot) => slot
    && !slot.sold
    && slot.category === 'fighter'
    && CAT_COAT_INFO[slot.coat]?.shopTier === shopTier);
  return shopIndex < 0 ? null : `#shop .shop-card[data-shop-index="${shopIndex}"]`;
}

const CAT_DRAG_SOURCE_TYPES = new Set([
  'shop-fighter', 'shop-worker', 'cat', 'bench', 'worker', 'bench-worker',
]);

function tutorialDragSourceMatches(criteria, source) {
  if (criteria.types && !criteria.types.includes(source.type)) return false;
  if (criteria.coat !== undefined && source.coat !== criteria.coat) return false;
  if (criteria.shopTier !== undefined && source.shopTier !== criteria.shopTier) return false;
  if (criteria.role !== undefined && source.role !== criteria.role) return false;
  if (criteria.itemKind !== undefined && source.itemKind !== criteria.itemKind) return false;
  return true;
}

export function tutorialBlockedCatDragMessage(item, source) {
  if (!item?.blockOtherCatDrags || !CAT_DRAG_SOURCE_TYPES.has(source?.type)) return null;
  const allowed = item.dragSources?.some((criteria) => tutorialDragSourceMatches(criteria, source));
  return allowed ? null : item.blockedCatDragText;
}

export function tutorialBlockedDropMessage(item, action, source = null) {
  if (!item?.allowedDropActions || action?.type === 'invalid') return null;
  if (item.bounceOtherCatDrags && CAT_DRAG_SOURCE_TYPES.has(source?.type)) {
    const allowedSource = item.dragSources?.some((criteria) => tutorialDragSourceMatches(criteria, source));
    if (!allowedSource) return item.blockedCatDragText;
  }
  return item.allowedDropActions.includes(action.type) ? null : item.blockedDropText;
}

export function tutorialOpenLaneSelector(game) {
  const occupiedColumns = new Set(game.cats.map((cat) => cat.col));
  const col = TUTORIAL_LANE_ORDER.find((candidate) => !occupiedColumns.has(candidate));
  if (col === undefined) return null;
  return `#board .cell[data-row="${Math.max(CAT_ZONE_START, ROWS - 1)}"][data-col="${col}"]`;
}

export const TUTORIAL_MERGE_TASK = Object.freeze({
  BATTLEFIELD: 'battlefield',
  CART: 'cart',
});

export function tutorialMergeTaskForDrop(action, source) {
  if (action?.targetType !== 'cat' || source?.coat !== CAT_COAT.ORANGE) return null;
  if (action.type === 'merge' && source.type === 'cat') return TUTORIAL_MERGE_TASK.BATTLEFIELD;
  if (action.type === 'purchase-merge' && source.type === 'shop-fighter') return TUTORIAL_MERGE_TASK.CART;
  return null;
}

const boardCatSelector = (cat) => `#board .cell[data-row="${cat.row}"][data-col="${cat.col}"]`;
const boardCatCanvasSelector = (cat) => `${boardCatSelector(cat)} .unit:not(.dog-unit):not(.decoy-unit) > canvas`;

export function tutorialCatInfoSelectors(game) {
  const fieldCat = game.cats[0];
  return [fieldCat ? boardCatSelector(fieldCat) : null, '#cart-info'].filter(Boolean);
}

export function tutorialMovableCatSelectors(game) {
  if (game.phase !== 'prep' && game.phase !== 'tactics') return [];
  return game.cats
    .filter((cat) => game.phase === 'tactics'
      ? !cat.tacticsMoved
      : !cat.hasEnteredBattle || !cat.prepMoved)
    .map(boardCatCanvasSelector);
}

export const allTutorialCatsMoved = (game) => game.cats.length > 0
  && game.cats.every((cat) => cat.tacticsMoved);

export function tutorialWoundedCatSelector(game) {
  const purrcy = game.cats.find((cat) => cat.coat === CAT_COAT.ORANGE && cat.hp < cat.maxHp);
  return purrcy ? `${boardCatSelector(purrcy)} .unit:not(.dog-unit):not(.decoy-unit)` : null;
}

export const tutorialPurrcyIsWounded = (game) => Boolean(tutorialWoundedCatSelector(game));

export function woundTutorialPurrcy(game) {
  const purrcy = game.cats.find((cat) => cat.coat === CAT_COAT.ORANGE);
  if (purrcy && purrcy.hp >= purrcy.maxHp) purrcy.hp = Math.max(1, purrcy.maxHp - 2);
  return purrcy ?? null;
}

export function tutorialMergeHints(game, completedTasks = new Set()) {
  const purrcys = game.cats
    .filter((cat) => cat.coat === CAT_COAT.ORANGE && cat.level === 1)
    .sort((a, b) => (b.copies ?? 1) - (a.copies ?? 1) || a.row - b.row || a.col - b.col);
  const target = purrcys[0];
  const hints = [];

  if (!completedTasks.has(TUTORIAL_MERGE_TASK.BATTLEFIELD) && purrcys.length >= 2) {
    hints.push({
      id: TUTORIAL_MERGE_TASK.BATTLEFIELD,
      from: boardCatSelector(purrcys[1]),
      to: boardCatSelector(target),
    });
  }
  if (!completedTasks.has(TUTORIAL_MERGE_TASK.CART) && target) {
    const from = tutorialShopFighterSelector(game, CAT_COAT.ORANGE);
    if (from) hints.push({ id: TUTORIAL_MERGE_TASK.CART, from, to: boardCatSelector(target) });
  }
  return hints;
}

export function tutorialMergeText(completedTasks = new Set()) {
  const battlefieldDone = completedTasks.has(TUTORIAL_MERGE_TASK.BATTLEFIELD);
  const cartDone = completedTasks.has(TUTORIAL_MERGE_TASK.CART);
  if (battlefieldDone && !cartDone) {
    return 'Battlefield cats stacked! Now merge the shop cat: drag the matching Purrcy from the Cat Cart onto that stack.';
  }
  if (cartDone && !battlefieldDone) {
    return 'Cat Cart cat stacked! Now drag one battlefield Purrcy onto the other.';
  }
  return 'Complete both merges: drag one battlefield Purrcy onto the other, and drag the matching Purrcy from the Cat Cart onto the stack.';
}

// --- coach steps: linear, rounds 1-3. Informational mode 'tap' steps advance
// with Continue. Action mode 'gate' steps have no Continue; their bubble leaves
// when the requested interaction starts, then the real game-state/action gate
// decides when the tutorial advances. showWhen (optional) delays the bubble
// until the right phase. ---
export const CORE_STEPS = [
  // Round 1 — the core loop
  // `intro` asks the glue layer for the title-card treatment (dimmed backdrop,
  // animated CATS VS DOGS logo) instead of the standard coach bubble.
  { id: 'r1-welcome', round: 1, mode: 'tap', spotlight: null, intro: true,
    text: 'The cats are comfy, and they are NOT taking new guests. Cats get what cats want.\n\nWho let the dogs in? Not these cats!' },
  { id: 'r1-stakes', round: 1, mode: 'tap', spotlight: '#board',
    text: "Dogs charge down these 6 lanes. If one reaches your house you lose a life — lose all 3 and it's game over." },
  { id: 'r1-scout', round: 1, mode: 'gate', spotlight: '#next-wave-toggle',
    actionStartSelectors: ['#next-wave-toggle'],
    completeOnActions: ['view-next-wave'],
    advanceDelayMs: 2600,
    text: "Tap NEXT WAVE to see which dogs are coming." },
  { id: 'r1-buy1', round: 1, mode: 'gate', spotlight: '#shop',
    dragFrom: (g) => tutorialShopFighterSelector(g, CAT_COAT.ORANGE),
    dragTo: tutorialOpenLaneSelector,
    dragSources: [{ types: ['shop-fighter'], coat: CAT_COAT.ORANGE }],
    mutedRegion: '.dog-lawn-preview',
    text: "You have 10 gold and cats cost 3. Drag Purrcy Pew-Pew from the shop onto the battlefield.",
    isDone: (g) => catOnBoard(g, CAT_COAT.ORANGE) },
  { id: 'r1-buy2', round: 1, mode: 'gate', spotlight: '#shop',
    dragFrom: (g) => tutorialShopFighterSelector(g, CAT_COAT.ORANGE),
    dragTo: tutorialOpenLaneSelector,
    dragSources: [{ types: ['shop-fighter'], coat: CAT_COAT.ORANGE }],
    text: "Purrcy only shoots straight up his own lane. Grab a second Purrcy — spreading them across lanes gives you better coverage.",
    isDone: (g) => purrcyCopyCount(g) >= 2 },
  { id: 'r1-cat-info', round: 1, mode: 'gate', spotlight: null,
    focusSelectors: tutorialCatInfoSelectors,
    completeOnActions: ['view-cat-info', 'open-glossary'],
    actionStartSelectors: tutorialCatInfoSelectors,
    bubblePlacement: 'between-targets',
    text: 'Want to know what a cat does? Tap the cat you just placed for quick stats and ability details. Or tap the yellow “i” in the Cat Cart for the full cat and dog guide. Try either one now.',
    isDone: () => false },
  { id: 'r1-refresh', round: 1, mode: 'gate', spotlight: '#refresh',
    completeOnActions: ['refresh'],
    actionStartSelectors: ['#refresh'],
    text: "Want different cats? Refresh rerolls the shop for 1 gold. Give it a try.",
    isDone: (g) => producerInShop(g) },
  { id: 'r1-produce', round: 1, mode: 'gate', spotlight: '#production-grid',
    dragFrom: (g) => tutorialShopWorkerSelector(g, WORKER_ROLE.COOK), dragTo: '#production-grid .worker-slot',
    dragSources: [{ types: ['shop-worker'], role: WORKER_ROLE.COOK }],
    blockOtherCatDrags: true,
    blockedCatDragText: 'Drag Whisker Biscuit into the House first — another cat would spend the gold you need for her.',
    text: "Not every cat fights. Whisker Biscuit bakes healing treats — drop her into the House.",
    isDone: (g) => ownsWorkerRole(g, WORKER_ROLE.COOK) },
  { id: 'r1-start', round: 1, mode: 'gate', spotlight: '#done',
    actionStartSelectors: ['#done'],
    text: "That's your setup — unspent gold is lost, so you spent it well. Start the round!",
    isDone: (g) => g.phase !== 'prep' },
  { id: 'r1-pause', round: 1, mode: 'gate', spotlight: '#done', showWhen: (g) => g.phase === 'tactics',
    actionStartSelectors: ['#done'],
    text: "This is a breather between attacks. More actions to come here soon. Tap Continue Fight.",
    isDone: (g) => g.phase !== 'tactics' },

  // Round 2 — collect + first merge
  { id: 'r2-collect', round: 2, mode: 'gate', spotlight: '#production-grid', showWhen: (g) => g.phase === 'prep',
    completeOnActions: ['collect-food'],
    actionStartSelectors: ['#production-grid .station-output'],
    text: "Whisker baked a treat overnight. Tap it to collect it — supplies stay below the Cat Field.",
    isDone: (g) => inventoryHasKind(g, 'food') },
  { id: 'r2-merge', round: 2, mode: 'gate', spotlight: '#shop', showWhen: (g) => g.phase === 'prep',
    dragHints: tutorialMergeHints,
    dragSources: [{ types: ['cat', 'shop-fighter'], coat: CAT_COAT.ORANGE }],
    blockOtherCatDrags: true,
    blockedCatDragText: 'Only Purrcy moves during this lesson. Follow the arrows to combine the three matching Purrcys.',
    allowedDropActions: ['merge', 'purchase-merge'],
    blockedDropText: 'Drop Purrcy onto the highlighted matching Purrcy to merge them. Other moves are paused for this lesson.',
    text: (_g, completedTasks) => tutorialMergeText(completedTasks),
    isDone: (_g, completedTasks) => completedTasks.has(TUTORIAL_MERGE_TASK.BATTLEFIELD)
      && completedTasks.has(TUTORIAL_MERGE_TASK.CART) },
  { id: 'r2-admire', round: 2, mode: 'tap', spotlight: '#board',
    text: 'Power spike! Level 2 cats hit harder and survive longer than Level 1 cats. Combining three into one also clears two spaces for your squad.' },
  { id: 'r2-spend-ready', round: 2, mode: 'gate',
    spotlight: (g) => g.gold > 0 ? '#shop' : '#done', showWhen: (g) => g.phase === 'prep',
    actionStartSelectors: ['#done'],
    text: 'Spend the rest of the gold, then tap READY.',
    isDone: (g) => g.phase !== 'prep' },
  { id: 'r2-move', round: 2, mode: 'gate', spotlight: null, showWhen: (g) => g.phase === 'tactics',
    focusSelectors: tutorialMovableCatSelectors,
    actionStartSelectors: ['#done'],
    dragSources: [{ types: ['cat'] }],
    text: "there's a pause during every battle to perform tactics like move. Each cat can move once: move up to 2 squares, while Clawdius moves 1. Drag a cat now",
    isDone: (g) => g.phase !== 'tactics' || g.cats.some((cat) => cat.tacticsMoved) },
  { id: 'r2-heal', round: 2, mode: 'gate', spotlight: '#board', showWhen: (g) => g.phase === 'tactics' && tutorialPurrcyIsWounded(g),
    completeOnActions: ['use-food'],
    dragFrom: '#inventory .pet-draggable', dragTo: tutorialWoundedCatSelector,
    dragSources: [{ types: ['item'], itemKind: 'food' }],
    bubblePlacement: 'target-top',
    text: "Great move, now heal Purrcy, who's been hurt, with the food from below. That's the payoff of worker cats!",
    isDone: (g) => !tutorialPurrcyIsWounded(g) },
  { id: 'r2-healed', round: 2, mode: 'tap', spotlight: null, blockBackground: true,
    text: 'Purrfect! Full HP. Now finish up your moves and continue the battle.' },
];

// --- just-in-time tips: shown once each, one at a time, when `when` first holds ---
// Note: the squad-full coaching (5/5 max → sell / combine / bench) fires
// proactively from app.js the moment you hit the cap, not as a queued tip.
export const TIPS = [
  { id: 'tip-new-cats', mode: 'gate', spotlight: '#shop',
    completeOnActions: ['purchase-tier-two-cat'], isDone: ownsTierTwoFieldCat,
    dragFrom: (g) => tutorialShopTierSelector(g, 2), dragTo: tutorialOpenLaneSelector,
    dragSources: [{ types: ['shop-fighter'], shopTier: 2 }],
    bounceOtherCatDrags: true,
    blockedCatDragText: 'Buy a T2 cat for this lesson — T1 cats can wait.',
    allowedDropActions: ['purchase-place'],
    blockedDropText: 'Place the T2 cat on an open battlefield square.',
    text: 'Round 4 introduces stronger cats with abilities you can use during the pause. Buy one now.',
    when: (g) => g.round >= 4 },
  { id: 'tip-coins', mode: 'tap', spotlight: '#production-grid',
    completeOnActions: ['collect-coins'],
    text: "Cashmere Cat's coins go straight to your gold — more coins, more cats.",
    when: (g) => ownsWorkerRole(g, WORKER_ROLE.TRADER) },
  { id: 'tip-ability', mode: 'gate', spotlight: '#tactics-panel',
    completeOnActions: ['use-ability'], isDone: (g) => g.cats.some((cat) => cat.activeUsed),
    actionStartSelectors: ['#active-abilities .active-ability'],
    text: "This new cat has a special move — it only fires here in the Tactics Window. Use it now.",
    when: (g) => g.phase === 'tactics' && ownsAbilityCat(g) },
  { id: 'tip-fill-house', mode: 'tap', spotlight: '#production-grid',
    completeOnActions: ['fill-house'], isDone: houseIsFull,
    text: "You've still got a free House slot — a second producer means more healing, coins, weapons, or armour. Grab one when it shows in the shop.",
    when: (g) => g.round >= 7 && g.workers.some((w) => !w) },
];
