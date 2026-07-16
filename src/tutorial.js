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
  // R3's heal lesson is staged via a scripted persisted wound (see app.js
  // applyTutorialRound), not a biter — the strong merged cat would one-shot any
  // gentle dog before it could land a bite, and a survivor only bites after the
  // pause. So R3 uses the normal wave.
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
export const ownsFighterCoat = (game, coat) => [...game.cats, ...game.bench]
  .some((cat) => cat.kind !== 'production-cat' && cat.coat === coat);
export const ownsAdvancedCat = (game) => [...game.cats, ...game.bench]
  .some((cat) => cat.kind !== 'production-cat' && CAT_COAT_INFO[cat.coat]?.unlockRound >= 4);

const purrcyLaneCount = (game) => new Set(game.cats
  .filter((cat) => cat.coat === CAT_COAT.ORANGE)
  .map((cat) => cat.col)).size;
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

export function tutorialOwnedCatSelector(game, coat) {
  const fieldCat = game.cats.find((cat) => cat.coat === coat);
  if (fieldCat) return boardCatSelector(fieldCat);
  const benchCat = game.bench.find((cat) => cat?.kind !== 'production-cat' && cat.coat === coat);
  return benchCat ? `#workbench .bench-slot[data-unit-id="${benchCat.id}"]` : null;
}

export function tutorialMovableCatSelectors(game) {
  if (game.phase !== 'prep' && game.phase !== 'tactics') return [];
  return game.cats
    .filter((cat) => game.phase === 'tactics'
      ? !cat.tacticsMoved
      : !cat.hasEnteredBattle || !cat.prepMoved)
    .map(boardCatCanvasSelector);
}

export function tutorialWoundedCatSelector(game) {
  const wounded = game.cats.find((cat) => cat.hp < cat.maxHp);
  return wounded ? `${boardCatSelector(wounded)} .unit:not(.dog-unit):not(.decoy-unit)` : null;
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
    return 'Battlefield cats stacked! Now drag the matching Purrcy from the Cat Cart onto that stack.';
  }
  if (cartDone && !battlefieldDone) {
    return 'Cat Cart cat stacked! Now drag one battlefield Purrcy onto the other.';
  }
  return 'Complete both merges: drag one battlefield Purrcy onto the other, and drag the matching Purrcy from the Cat Cart onto the stack.';
}

// --- coach steps: linear, rounds 1-3. mode 'tap' shows a Continue button;
// mode 'gate' advances when isDone(game) is true. showWhen (optional) delays
// the bubble until the game is in the right phase. ---
export const CORE_STEPS = [
  // Round 1 — the core loop
  { id: 'r1-stakes', round: 1, mode: 'tap', spotlight: '#board',
    text: "Dogs charge down these 6 lanes. If one reaches your house you lose a life — lose all 3 and it's game over." },
  { id: 'r1-scout', round: 1, mode: 'tap', spotlight: '#dog-preview-grid',
    completeOnActions: ['purchase-place', 'purchase-bench', 'purchase-merge'],
    text: "This Scout Report shows which dogs are coming. Check it each round so you buy the right defenders." },
  { id: 'r1-buy1', round: 1, mode: 'gate', spotlight: '#shop',
    dragFrom: (g) => tutorialShopFighterSelector(g, CAT_COAT.ORANGE),
    dragTo: tutorialOpenLaneSelector,
    mutedRegion: '.dog-lawn-preview',
    text: "You have 10 gold and cats cost 3. Drag Purrcy Pew-Pew from the shop onto the battlefield.",
    isDone: (g) => catOnBoard(g, CAT_COAT.ORANGE) },
  { id: 'r1-buy2', round: 1, mode: 'gate', spotlight: '#shop',
    dragFrom: (g) => tutorialShopFighterSelector(g, CAT_COAT.ORANGE),
    dragTo: tutorialOpenLaneSelector,
    text: "Purrcy only shoots straight up his own lane. Grab a second Purrcy and cover another lane.",
    isDone: (g) => purrcyLaneCount(g) >= 2 },
  { id: 'r1-refresh', round: 1, mode: 'gate', spotlight: '#refresh',
    completeOnActions: ['refresh'],
    text: "Want different cats? Refresh rerolls the shop for 1 gold. Give it a try.",
    isDone: (g) => producerInShop(g) },
  { id: 'r1-produce', round: 1, mode: 'gate', spotlight: '#production-grid',
    dragFrom: '#shop .pet-draggable', dragTo: '#production-grid .worker-slot',
    text: "Not every cat fights. Whisker Biscuit bakes healing treats — drop her into the House.",
    isDone: (g) => ownsWorkerRole(g, WORKER_ROLE.COOK) },
  { id: 'r1-start', round: 1, mode: 'gate', spotlight: '#done',
    text: "That's your setup — unspent gold is lost, so you spent it well. Start the round!",
    isDone: (g) => g.phase !== 'prep' },
  { id: 'r1-pause', round: 1, mode: 'gate', spotlight: '#done', showWhen: (g) => g.phase === 'tactics',
    text: "This is a breather between attacks. More actions to come here soon. Press continue.",
    isDone: (g) => g.phase !== 'tactics' },

  // Round 2 — collect + first merge
  { id: 'r2-collect', round: 2, mode: 'gate', spotlight: '#production-grid', showWhen: (g) => g.phase === 'prep',
    completeOnActions: ['collect-food'],
    text: "Whisker baked a treat overnight. Tap her station to collect it — it waits in storage until a cat needs it.",
    isDone: (g) => inventoryHasKind(g, 'food') },
  { id: 'r2-merge', round: 2, mode: 'gate', spotlight: '#shop', showWhen: (g) => g.phase === 'prep',
    dragHints: tutorialMergeHints,
    text: (_g, completedTasks) => tutorialMergeText(completedTasks),
    isDone: (_g, completedTasks) => completedTasks.has(TUTORIAL_MERGE_TASK.BATTLEFIELD)
      && completedTasks.has(TUTORIAL_MERGE_TASK.CART) },
  { id: 'r2-admire', round: 2, mode: 'tap', spotlight: '#board',
    text: 'Power spike! Level 2 cats hit harder and survive longer than Level 1 cats. Combining three into one also clears two spaces for your squad.' },
  { id: 'r2-adopt-buy', round: 2, mode: 'gate', spotlight: '#shop', showWhen: (g) => g.phase === 'prep',
    dragFrom: (g) => tutorialShopFighterSelector(g, CAT_COAT.WHITE),
    dragTo: tutorialOpenLaneSelector,
    text: 'Now learn how to make room. Drag Hissiletoe from the Cat Cart onto an open battlefield lane.',
    isDone: (g) => ownsFighterCoat(g, CAT_COAT.WHITE) },
  { id: 'r2-adopt', round: 2, mode: 'gate', spotlight: '#next-wave-zone', showWhen: (g) => g.phase === 'prep',
    completeOnActions: ['sell'],
    dragFrom: (g) => tutorialOwnedCatSelector(g, CAT_COAT.WHITE),
    dragTo: '#next-wave-zone',
    text: 'Pick Hissiletoe up, then hover over NEXT WAVE. It turns into the Adoption Box while you hold a cat — drop Hissiletoe there to sell the cat for gold and free the squad slot.',
    isDone: () => false },
  { id: 'r2-spend', round: 2, mode: 'gate', spotlight: '#shop', showWhen: (g) => g.phase === 'prep',
    text: (g) => `You still have ${g.gold} gold. Buy cats or refresh the Cat Cart until it's gone — every unspent coin is lost when battle begins.`,
    isDone: (g) => g.gold === 0 },
  { id: 'r2-start', round: 2, mode: 'gate', spotlight: '#done', showWhen: (g) => g.phase === 'prep' && g.gold === 0,
    text: "Start the round — the dogs are getting closer.", isDone: (g) => g.phase !== 'prep' },
  { id: 'r2-move', round: 2, mode: 'gate', spotlight: null, showWhen: (g) => g.phase === 'tactics',
    focusSelectors: tutorialMovableCatSelectors,
    text: 'This Tactics Window lets you reposition between attacks. Each cat can move once: most move up to 2 squares, while Clawdius moves 1. Drag a cat now, or Continue Fight to keep your formation.',
    isDone: (g) => g.phase !== 'tactics' || g.cats.some((cat) => cat.tacticsMoved) },

  // Round 3 — production payoff (heal). A small wound persists from the advancing
  // pack (scripted in app.js), so one Whisker treat fully patches it.
  { id: 'r3-hurt', round: 3, mode: 'tap', spotlight: '#board', showWhen: (g) => g.phase === 'prep' && anyWoundedCat(g),
    completeOnActions: ['use-food'],
    text: "One of your cats is still hurt — wounds carry over between rounds. Let's patch it up." },
  { id: 'r3-heal', round: 3, mode: 'gate', spotlight: '#inventory', showWhen: (g) => g.phase === 'prep',
    completeOnActions: ['use-food'],
    dragFrom: '#inventory .pet-draggable', dragTo: tutorialWoundedCatSelector,
    text: "Drag Whisker's treat from House Storage onto the hurt cat — heal +2. That's the payoff of production.",
    isDone: () => false },
];

// --- just-in-time tips: shown once each, one at a time, when `when` first holds ---
// Note: the squad-full coaching (5/5 max → sell / combine / bench) fires
// proactively from app.js the moment you hit the cap, not as a queued tip.
export const TIPS = [
  { id: 'tip-new-cats', spotlight: '#shop',
    completeOnActions: ['purchase-advanced-cat'], isDone: ownsAdvancedCat,
    text: "New round, new arrivals — stronger cats just unlocked in the shop. Some have a special move you can fire during the pause.",
    when: (g) => g.round >= 4 },
  { id: 'tip-coins', spotlight: '#production-grid',
    completeOnActions: ['collect-coins'],
    text: "Cashmere Cat's coins go straight to your gold — more coins, more cats.",
    when: (g) => ownsWorkerRole(g, WORKER_ROLE.TRADER) },
  { id: 'tip-ability', spotlight: '#tactics-panel',
    completeOnActions: ['use-ability'], isDone: (g) => g.cats.some((cat) => cat.activeUsed),
    text: "This new cat has a special move — it only fires here in the Tactics Window. Use it now.",
    when: (g) => g.phase === 'tactics' && ownsAbilityCat(g) },
  { id: 'tip-fill-house', spotlight: '#production-grid',
    completeOnActions: ['fill-house'], isDone: houseIsFull,
    text: "You've still got a free House slot — a second producer means more healing, coins, weapons, or armour. Grab one when it shows in the shop.",
    when: (g) => g.round >= 7 && g.workers.some((w) => !w) },
];
