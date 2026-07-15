// Pure teaching layer for the Tutorial Level. No DOM. The engine is untouched;
// this only reads game state and builds engine-shaped shop slots / dog waves for
// a scripted opening. Consumed by the glue layer in app.js.
import {
  CAT_COAT, CAT_COAT_INFO, catStatsFor, createDog, DOG_ROLE,
  MAX_FIELD_CATS, WORKER_ROLE, WORKER_INFO,
} from './game-engine.js';

let seq = 0;
const nextId = (prefix) => `${prefix}-${(seq += 1)}`;

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

// --- scripted waves ---
export function tutorialWave(round, catColumns = []) {
  if (round === 1) {
    const cols = catColumns.length ? catColumns.slice(0, 2) : [2, 3];
    return cols.map((col) => createDog(1, 0, col, DOG_ROLE.SCRUFFY));
  }
  // R3's heal lesson is staged via a scripted persisted wound (see app.js
  // applyTutorialRound), not a biter — the strong merged cat would one-shot any
  // gentle dog before it could land a bite, and a survivor only bites after the
  // pause. So R3 uses the normal wave.
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

// --- coach steps: linear, rounds 1-3. mode 'tap' shows a Continue button;
// mode 'gate' advances when isDone(game) is true. showWhen (optional) delays
// the bubble until the game is in the right phase. ---
export const CORE_STEPS = [
  // Round 1 — the core loop
  { id: 'r1-stakes', round: 1, mode: 'tap', spotlight: '#board',
    text: "Dogs charge down these 6 lanes. If one reaches your house you lose a life — lose all 3 and it's game over." },
  { id: 'r1-scout', round: 1, mode: 'tap', spotlight: '#dog-preview-grid',
    text: "This Scout Report shows which dogs are coming. Check it each round so you buy the right defenders." },
  { id: 'r1-buy1', round: 1, mode: 'gate', spotlight: '#shop',
    dragFrom: '#shop .pet-draggable', dragTo: '#board .cell[data-row="13"][data-col="2"]',
    text: "You have 10 gold and cats cost 3. Drag Purrcy Pew-Pew from the shop onto the battlefield.",
    isDone: (g) => catOnBoard(g, CAT_COAT.ORANGE) },
  { id: 'r1-buy2', round: 1, mode: 'gate', spotlight: '#shop',
    dragFrom: '#shop .pet-draggable', dragTo: '#board .cell[data-row="13"][data-col="3"]',
    text: "Purrcy only shoots straight up his own lane. Grab a second Purrcy and cover another lane.",
    isDone: (g) => boardCatCount(g) >= 2 },
  { id: 'r1-refresh', round: 1, mode: 'gate', spotlight: '#refresh',
    text: "Want different cats? Refresh rerolls the shop for 1 gold. Give it a try.",
    isDone: (g) => producerInShop(g) },
  { id: 'r1-produce', round: 1, mode: 'gate', spotlight: '#production-grid',
    dragFrom: '#shop .pet-draggable', dragTo: '#production-grid .worker-slot',
    text: "Not every cat fights. Whisker Biscuit bakes healing treats — drop her into the House.",
    isDone: (g) => producerInHouse(g) },
  { id: 'r1-start', round: 1, mode: 'gate', spotlight: '#done',
    text: "That's your setup — unspent gold is lost, so you spent it well. Start the round!",
    isDone: (g) => g.phase !== 'prep' },
  { id: 'r1-pause', round: 1, mode: 'gate', spotlight: '#done', showWhen: (g) => g.phase === 'tactics',
    text: "This is a breather between attacks. Nothing to spend yet — press Continue.",
    isDone: (g) => g.phase !== 'tactics' },

  // Round 2 — collect + first merge
  { id: 'r2-collect', round: 2, mode: 'gate', spotlight: '#production-grid', showWhen: (g) => g.phase === 'prep',
    text: "Whisker baked a treat overnight. Tap her station to collect it — it waits in storage until a cat needs it.",
    isDone: (g) => inventoryHasItem(g) },
  { id: 'r2-merge', round: 2, mode: 'gate', spotlight: '#shop', showWhen: (g) => g.phase === 'prep',
    dragFrom: '#shop .pet-draggable', dragTo: '#board .cell .unit',
    text: "Three matching cats merge into one powerhouse. Drag a Purrcy onto another, then buy the third and drop it on too.",
    isDone: (g) => catAtLevel(g, CAT_COAT.ORANGE, 2) },
  { id: 'r2-admire', round: 2, mode: 'tap', spotlight: '#board',
    text: "See the jump? One strong cat beats three weak ones — and it's tough enough to survive a bite now." },
  { id: 'r2-start', round: 2, mode: 'gate', spotlight: '#done', showWhen: (g) => g.phase === 'prep',
    text: "Start the round — the dogs are getting closer.", isDone: (g) => g.phase !== 'prep' },

  // Round 3 — production payoff (heal). A small wound persists from the advancing
  // pack (scripted in app.js), so one Whisker treat fully patches it.
  { id: 'r3-hurt', round: 3, mode: 'tap', spotlight: '#board', showWhen: (g) => g.phase === 'prep' && anyWoundedCat(g),
    text: "One of your cats is still hurt — wounds carry over between rounds. Let's patch it up." },
  { id: 'r3-heal', round: 3, mode: 'gate', spotlight: '#inventory', showWhen: (g) => g.phase === 'prep',
    dragFrom: '#inventory .pet-draggable', dragTo: '#board .cell .unit',
    text: "Drag Whisker's treat from House Storage onto the hurt cat — heal +2. That's the payoff of production.",
    isDone: (g) => !anyWoundedCat(g) },
];

// --- just-in-time tips: shown once each, one at a time, when `when` first holds ---
export const TIPS = [
  { id: 'tip-squad-full', spotlight: '#squad-count',
    text: "Your Elite Squad maxes at 5. To add another cat you must merge, bench, or sell one.",
    when: (g) => squadFull(g) },
  { id: 'tip-sell', spotlight: '#adoption-box',
    text: "Drag your weakest cat to the Adoption Box — you get gold back and a free slot.",
    when: (g) => squadFull(g) },
  { id: 'tip-workbench', spotlight: '#workbench',
    text: "Or park a cat on the Workbench (3 slots) to hold it off the battlefield.",
    when: (g) => squadFull(g) },
  { id: 'tip-coins', spotlight: '#production-grid',
    text: "Cashmere Cat's coins go straight to your gold — more coins, more cats.",
    when: (g) => ownsWorkerRole(g, WORKER_ROLE.TRADER) },
  { id: 'tip-ability', spotlight: '#board',
    text: "This new cat has a special move — it only fires in the pause. Open the Tactics window and use it.",
    when: (g) => ownsAbilityCat(g) },
];
