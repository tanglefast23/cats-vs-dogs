# Tutorial Level Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a guided "Tutorial Level" — launched by an always-visible top-right button — that hand-holds a new player through rounds 1–3 (buy, place, refresh, produce, collect, merge, heal) and pops just-in-time tips for the rest (squad cap, sell, workbench, coins, mid-fight abilities).

**Architecture:** A new **pure** module `src/tutorial.js` holds all the teaching data (ordered coach steps, tips, scripted shops/waves) and state predicates — unit-tested like `production-rules.js`/`movement-rules.js`. The **engine stays untouched**. `src/app.js` gains a thin glue layer: a spotlight/bubble overlay, a "look at game state after each render and advance" loop, scripted-state injection at round transitions, and the button. Guidance runs rounds 1–4 then graduates to normal play.

**Tech Stack:** Vanilla ES modules, Vite, `node --test` (no framework), plain DOM + CSS. No new dependencies.

---

## Key mechanics this plan relies on (verified in code)

- Scripted waves: `startRound` consumes `game.nextWave` verbatim (`src/game-engine.js:1397-1398`) and **pushes** onto surviving dogs. Set `game.nextWave` right before the round starts.
- Cat HP persists across rounds; dogs approach ~4 rows/round, reaching the front ~round 3 (`finishRound` preserves HP, `src/game-engine.js:2100`).
- Base Purrcy = 4 HP (dies to any bite); Level-2 Purrcy = 13 HP (survives a bite). Heal lesson targets the merged L2 cat, with the bite staged.
- Shop size is 3 for rounds 1–4 (`shopSizeForRound`), so scripted shops have 3 slots.
- Shop slot shapes (must match exactly, `makeShopSlot` `src/game-engine.js:583-616`):
  - Fighter: `{ id, kind:'alley-cat', category:'fighter', level:1, coat, shopTier, ability, sold:false, saved:false }`
  - Worker: `{ id, kind:'production-cat', category:'worker', role, level:1, ability:'produce-<kind>', sold:false, saved:false }`
- Overlay must be hidden while `playing === true` (combat animating); during the tactics pause `playing === false`.
- Cats fully heal is NOT a thing — do not assume resets.

## File Structure

- **Create `src/tutorial.js`** — pure teaching data + predicates + scripted builders. One responsibility: "what to teach and when," as data + pure functions. No DOM.
- **Create `tests/tutorial.test.js`** — unit tests for the pure module.
- **Modify `index.html`** — add the `#tutorial` button to `.titlebar-actions` (line 49-52); add an empty overlay root before `</body>`.
- **Modify `styles.css`** — overlay backdrop, spotlight ring, and coach bubble styles.
- **Modify `src/app.js`** — overlay controller + tutorial state machine + integration hooks (render tail, `playRound` wave/round injection, refresh intercept, button wiring).

---

### Task 1: `src/tutorial.js` — scripted builders + state predicates

**Files:**
- Create: `src/tutorial.js`
- Test: `tests/tutorial.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/tutorial.test.js
import test from 'node:test';
import assert from 'node:assert/strict';

import { CAT_COAT, WORKER_ROLE, createGame, createCat } from '../src/game-engine.js';
import {
  fighterSlot, workerSlot, tutorialShop, tutorialShopAfterRefresh, tutorialWave,
  catOnBoard, boardCatCount, producerInHouse, producerInShop, catAtLevel,
  squadFull, anyWoundedCat, ownsAbilityCat, inventoryHasItem, ownsWorkerRole,
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

test('tutorialWave scripts R1 in the covered lanes and R3 as one close biter', () => {
  const r1 = tutorialWave(1, [2, 4]);
  assert.equal(r1.length, 2);
  assert.deepEqual(r1.map((d) => d.col).sort(), [2, 4]);
  assert.ok(r1.every((d) => d.row === 0));

  const r3 = tutorialWave(3, [3]);
  assert.equal(r3.length, 1);
  assert.equal(r3[0].col, 3);
  assert.ok(r3[0].row > 0 && r3[0].row < 10, 'spawns close, above the cat zone');

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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/tutorial.test.js`
Expected: FAIL — `Cannot find module '../src/tutorial.js'`.

- [ ] **Step 3: Write the implementation**

```js
// src/tutorial.js
// Pure teaching layer. No DOM. The engine is untouched; this only reads game
// state and builds engine-shaped shop slots / dog waves for a scripted opening.
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
  if (round === 3) {
    const col = catColumns[0] ?? 2;
    return [createDog(1, 8, col, DOG_ROLE.SCRUFFY)]; // close range → guaranteed bite
  }
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/tutorial.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/tutorial.js tests/tutorial.test.js
git commit -m "feat: tutorial scripted builders and state predicates"
```

---

### Task 2: `src/tutorial.js` — coach steps + tips content

**Files:**
- Modify: `src/tutorial.js`
- Test: `tests/tutorial.test.js`

- [ ] **Step 1: Add the failing test** (append to `tests/tutorial.test.js`)

```js
import { CORE_STEPS, TIPS } from '../src/tutorial.js';

test('every core step is well-formed', () => {
  assert.ok(CORE_STEPS.length > 0);
  for (const step of CORE_STEPS) {
    assert.ok(step.id && typeof step.id === 'string');
    assert.ok(step.text && step.text.length > 0);
    assert.ok(['tap', 'gate'].includes(step.mode));
    if (step.mode === 'gate') assert.equal(typeof step.isDone, 'function');
    if (step.spotlight !== null) assert.equal(typeof step.spotlight, 'string');
  }
  // ids are unique
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/tutorial.test.js`
Expected: FAIL — `CORE_STEPS`/`TIPS` are not exported.

- [ ] **Step 3: Implement** (append to `src/tutorial.js`)

```js
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
    text: "You have 10 gold and cats cost 3. Drag Purrcy Pew-Pew from the shop onto the battlefield.",
    isDone: (g) => catOnBoard(g, CAT_COAT.ORANGE) },
  { id: 'r1-buy2', round: 1, mode: 'gate', spotlight: '#shop',
    text: "Purrcy only shoots straight up his own lane. Grab a second Purrcy and cover another lane.",
    isDone: (g) => boardCatCount(g) >= 2 },
  { id: 'r1-refresh', round: 1, mode: 'gate', spotlight: '#refresh',
    text: "Want different cats? Refresh rerolls the shop for 1 gold. Give it a try.",
    isDone: (g) => producerInShop(g) },
  { id: 'r1-produce', round: 1, mode: 'gate', spotlight: '#production-grid',
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
    text: "Three matching cats merge into one powerhouse. Drag a Purrcy onto another, then buy the third and drop it on too.",
    isDone: (g) => catAtLevel(g, CAT_COAT.ORANGE, 2) },
  { id: 'r2-admire', round: 2, mode: 'tap', spotlight: '#board',
    text: "See the jump? One strong cat beats three weak ones — and it's tough enough to survive a bite now." },
  { id: 'r2-start', round: 2, mode: 'gate', spotlight: '#done', showWhen: (g) => g.phase === 'prep',
    text: "Start the round — the dogs are getting closer.", isDone: (g) => g.phase !== 'prep' },

  // Round 3 — production payoff (heal), staged
  { id: 'r3-bite', round: 3, mode: 'tap', spotlight: '#board', showWhen: (g) => anyWoundedCat(g),
    text: "A dog got through and bit your cat! Wounds stick between rounds — patch it up." },
  { id: 'r3-heal', round: 3, mode: 'gate', spotlight: '#tactics-panel', showWhen: (g) => g.phase === 'tactics',
    text: "In the pause, drag Whisker's treat from storage onto the hurt cat — heal +2.",
    isDone: (g) => !anyWoundedCat(g) },
  { id: 'r3-continue', round: 3, mode: 'gate', spotlight: '#done', showWhen: (g) => g.phase === 'tactics',
    text: "That's the whole loop: produce → collect → use it when it counts. Continue the fight.",
    isDone: (g) => g.phase !== 'tactics' },
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/tutorial.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/tutorial.js tests/tutorial.test.js
git commit -m "feat: tutorial coach steps and just-in-time tips"
```

---

### Task 3: The Tutorial button + overlay markup + styles

**Files:**
- Modify: `index.html:49-52` (titlebar actions) and before `</body>`
- Modify: `styles.css` (append overlay styles)

- [ ] **Step 1: Add the button** — in `index.html`, change the `.titlebar-actions` block (currently Settings + Restart) to include Tutorial first:

```html
<div class="titlebar-actions">
  <button id="tutorial" class="icon-button tutorial-button" aria-label="Start the tutorial" title="Tutorial">TUTORIAL</button>
  <button id="settings" class="icon-button" aria-label="Open settings" title="Settings">⚙</button>
  <button id="restart" class="icon-button" aria-label="Restart game" title="Restart">↻</button>
</div>
```

- [ ] **Step 2: Add the overlay root** — in `index.html`, immediately before `</body>`:

```html
<div id="tutorial-overlay" class="tutorial-overlay" hidden>
  <div class="tutorial-spotlight" id="tutorial-spotlight"></div>
  <div class="tutorial-bubble" id="tutorial-bubble" role="dialog" aria-live="polite">
    <p id="tutorial-text"></p>
    <button id="tutorial-next" type="button" class="tutorial-next" hidden>Continue</button>
    <button id="tutorial-skip" type="button" class="tutorial-skip">Skip tutorial</button>
  </div>
</div>
```

- [ ] **Step 3: Append styles** to `styles.css` (match the existing dark backyard palette; tune in the browser):

```css
.tutorial-button { width: auto; padding: 0 10px; font-size: 11px; letter-spacing: 0.08em; font-weight: 700; }

.tutorial-overlay { position: fixed; inset: 0; z-index: 9000; pointer-events: none; }
.tutorial-overlay[hidden] { display: none; }
/* Dim everything except the spotlight, using a huge ring shadow as the mask. */
.tutorial-spotlight {
  position: absolute; border-radius: 12px;
  box-shadow: 0 0 0 4px #ffd24a, 0 0 0 9999px rgba(6, 10, 20, 0.72);
  transition: all 180ms ease; pointer-events: none;
}
.tutorial-bubble {
  position: absolute; max-width: 300px; padding: 16px 18px; border-radius: 14px;
  background: #12203a; color: #eaf1ff; border: 1px solid #2c4066;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5); pointer-events: auto;
}
.tutorial-bubble p { margin: 0 0 12px; font-size: 14px; line-height: 1.45; }
.tutorial-next, .tutorial-skip { font: inherit; cursor: pointer; border-radius: 8px; }
.tutorial-next { padding: 8px 16px; background: #ffd24a; color: #12203a; border: 0; font-weight: 700; }
.tutorial-skip { margin-left: 10px; padding: 8px 12px; background: transparent; color: #8fa6c9; border: 0; font-size: 12px; }
```

- [ ] **Step 4: Verify it renders** — `npm run dev`, open http://127.0.0.1:4173. The "TUTORIAL" button shows top-right next to ⚙/↻; the overlay is present but hidden (no visual change yet).

- [ ] **Step 5: Commit**

```bash
git add index.html styles.css
git commit -m "feat: tutorial button, overlay root, and styles"
```

---

### Task 4: Overlay controller in `src/app.js`

**Files:**
- Modify: `src/app.js`

- [ ] **Step 1: Add element handles** — after the existing element handles block (`src/app.js:80`, after `soundToggleEl`), add:

```js
const tutorialOverlayEl = $('#tutorial-overlay');
const tutorialSpotlightEl = $('#tutorial-spotlight');
const tutorialBubbleEl = $('#tutorial-bubble');
const tutorialTextEl = $('#tutorial-text');
const tutorialNextEl = $('#tutorial-next');
```

- [ ] **Step 2: Add the overlay controller** — add this function group near the other render helpers (e.g. just above `function render()` at `src/app.js:2520`):

```js
// --- Tutorial overlay: spotlight a target element + show a coach bubble. ---
function positionTutorialOverlay(selector, showContinue) {
  const target = selector ? document.querySelector(selector) : null;
  const pad = 8;
  if (target) {
    const r = target.getBoundingClientRect();
    tutorialSpotlightEl.style.display = 'block';
    tutorialSpotlightEl.style.left = `${r.left - pad}px`;
    tutorialSpotlightEl.style.top = `${r.top - pad}px`;
    tutorialSpotlightEl.style.width = `${r.width + pad * 2}px`;
    tutorialSpotlightEl.style.height = `${r.height + pad * 2}px`;
    // Bubble below the target, clamped to the viewport.
    const bubbleTop = Math.min(r.bottom + 12, window.innerHeight - 160);
    const bubbleLeft = Math.min(Math.max(12, r.left), window.innerWidth - 320);
    tutorialBubbleEl.style.top = `${bubbleTop}px`;
    tutorialBubbleEl.style.left = `${bubbleLeft}px`;
  } else {
    tutorialSpotlightEl.style.display = 'none';
    tutorialBubbleEl.style.top = '50%';
    tutorialBubbleEl.style.left = '50%';
  }
  tutorialNextEl.hidden = !showContinue;
}

function showTutorialBubble(text, selector, showContinue) {
  tutorialTextEl.textContent = text;
  tutorialOverlayEl.hidden = false;
  positionTutorialOverlay(selector, showContinue);
}

function hideTutorialOverlay() {
  tutorialOverlayEl.hidden = true;
}
```

- [ ] **Step 3: Reposition on resize** — near the other `window.addEventListener` calls (`src/app.js:2633`):

```js
window.addEventListener('resize', () => { if (tutorialActive) syncTutorial(); });
```

(`tutorialActive` and `syncTutorial` are added in Task 5; this references them but the file only runs them at event time, so ordering is fine.)

- [ ] **Step 4: Verify** — no behavior change yet (nothing calls these). Confirm the app still boots without console errors: `npm run dev`, check the browser console.

- [ ] **Step 5: Commit**

```bash
git add src/app.js
git commit -m "feat: tutorial overlay controller (spotlight + bubble)"
```

---

### Task 5: Tutorial state machine + integration hooks in `src/app.js`

**Files:**
- Modify: `src/app.js`

- [ ] **Step 1: Import the tutorial module** — add to the import block (after `src/app.js:25`):

```js
import {
  CORE_STEPS, TIPS, tutorialShop, tutorialShopAfterRefresh, tutorialWave,
} from './tutorial.js';
```

- [ ] **Step 2: Add tutorial state** — after the module state vars (`src/app.js:40`, after `collectingStations`):

```js
let tutorialActive = false;
let tutorialStepIndex = 0;
const tutorialSeenTips = new Set();
let tutorialCurrentTip = null;
```

- [ ] **Step 3: Add the state machine** — add this function group next to the overlay controller from Task 4:

```js
function tutorialCatColumns(state) {
  // Highest-level cat's column first (the merged Purrcy for the R3 biter), then the rest.
  return [...state.cats]
    .sort((a, b) => (b.level - a.level))
    .map((cat) => cat.col)
    .filter((col) => typeof col === 'number');
}

function startTutorial() {
  game = createGame();
  selected = null;
  playing = false;
  manualPaused = false;
  glossaryPaused = false;
  if (glossaryModalEl) glossaryModalEl.hidden = true;
  if (modalEl) modalEl.hidden = true;
  syncPauseState();
  tutorialActive = true;
  tutorialStepIndex = 0;
  tutorialCurrentTip = null;
  tutorialSeenTips.clear();
  game.shop = tutorialShop(1) ?? game.shop;
  game.message = 'Tutorial: follow the highlights.';
  render();
}

function endTutorial() {
  tutorialActive = false;
  tutorialCurrentTip = null;
  hideTutorialOverlay();
}

// Set the scripted wave for the round we are about to start (R1 uses the player's
// lanes; R3 puts one biter in the merged cat's lane). Called right before startRound.
function applyTutorialWave() {
  const wave = tutorialWave(game.round, tutorialCatColumns(game));
  if (wave) game.nextWave = wave;
}

// Set the scripted shop when a new prep round begins; graduate after round 4.
function applyTutorialRound() {
  if (game.round > 4) { endTutorial(); return; }
  const shop = tutorialShop(game.round);
  if (shop) game.shop = shop;
}

// Called at the tail of every render() while the tutorial is active.
function syncTutorial() {
  // Never cover a live combat animation.
  if (playing) { hideTutorialOverlay(); return; }

  // Advance any completed gate steps.
  while (tutorialStepIndex < CORE_STEPS.length) {
    const step = CORE_STEPS[tutorialStepIndex];
    if (step.mode === 'gate' && step.isDone(game)) { tutorialStepIndex += 1; continue; }
    break;
  }

  // Show the current core step (if its showWhen allows), else fall through to tips.
  if (tutorialStepIndex < CORE_STEPS.length) {
    const step = CORE_STEPS[tutorialStepIndex];
    if (!step.showWhen || step.showWhen(game)) {
      showTutorialBubble(step.text, step.spotlight, step.mode === 'tap');
      return;
    }
    hideTutorialOverlay();
    return;
  }

  // Core steps done — surface one unseen tip whose trigger holds.
  if (tutorialCurrentTip) {
    showTutorialBubble(tutorialCurrentTip.text, tutorialCurrentTip.spotlight, true);
    return;
  }
  const tip = TIPS.find((t) => !tutorialSeenTips.has(t.id) && t.when(game));
  if (tip) { tutorialCurrentTip = tip; showTutorialBubble(tip.text, tip.spotlight, true); return; }
  hideTutorialOverlay();
}

function advanceTutorialByTap() {
  if (tutorialCurrentTip) {
    tutorialSeenTips.add(tutorialCurrentTip.id);
    tutorialCurrentTip = null;
    syncTutorial();
    return;
  }
  const step = CORE_STEPS[tutorialStepIndex];
  if (step && step.mode === 'tap') { tutorialStepIndex += 1; syncTutorial(); }
}
```

- [ ] **Step 4: Hook the render tail** — in `render()` (`src/app.js:2520-2532`), add as the last line before the closing brace:

```js
  if (tutorialActive) syncTutorial();
```

- [ ] **Step 5: Inject the scripted wave/round in `playRound`** — in `playRound()` (`src/app.js:2566`), make two edits:

Before `game = startRound(game);` (line 2574), add the wave injection:

```js
  if (startingRound) {
    if (tutorialActive) applyTutorialWave();
    game = startRound(game);
```

After the `needsAnotherExchange ? openTacticsWindow : finishRound` line (line 2589), add the round injection:

```js
    game = needsAnotherExchange ? openTacticsWindow(game) : finishRound(game);
    if (tutorialActive && game.phase === 'prep') applyTutorialRound();
```

- [ ] **Step 6: Intercept refresh** (make it free during the tutorial and reveal the producers) — replace the refresh handler at `src/app.js:2637`:

```js
$('#refresh').addEventListener('click', () => {
  if (tutorialActive) {
    const before = game.gold;
    game = refreshShop(game);
    game.gold = before; // free reroll while learning
    const scripted = tutorialShopAfterRefresh(game.round);
    if (scripted) game.shop = scripted;
  } else {
    game = refreshShop(game);
  }
  selected = null;
  render();
});
```

- [ ] **Step 7: Wire the buttons** — near the other button wiring (after `src/app.js:2638`):

```js
$('#tutorial')?.addEventListener('click', startTutorial);
tutorialNextEl?.addEventListener('click', advanceTutorialByTap);
$('#tutorial-skip')?.addEventListener('click', endTutorial);
```

Also, when a real reset happens, make sure tutorial mode is cleared — in `resetGame()` (`src/app.js:2614`) add `tutorialActive = false; hideTutorialOverlay();` before `render()`.

- [ ] **Step 8: Syntax + unit check**

Run: `npm run check && node --test tests/tutorial.test.js`
Expected: PASS — no syntax errors, tutorial tests green.

- [ ] **Step 9: Commit**

```bash
git add src/app.js
git commit -m "feat: wire tutorial state machine and scripted-round injection"
```

---

### Task 6: End-to-end browser verification + graduation polish

**Files:**
- Modify: `src/app.js` / `styles.css` as needed from findings

- [ ] **Step 1: Run the dev server** — `npm run dev`, open http://127.0.0.1:4173, click **TUTORIAL**.

- [ ] **Step 2: Verify Round 1** — walk the gated steps: stakes → scout → buy Purrcy → buy 2nd → refresh (confirm gold does NOT drop and producers appear) → place Whisker Biscuit → Start → the pause bubble appears (`phase==='tactics'`, overlay visible, `playing` false) → Continue. Confirm each bubble only advances on the real action, and the spotlight sits on the right element.

- [ ] **Step 3: Verify Round 2** — collect the treat (bubble advances when it lands in storage), merge three Purrcys into a Level-2 (bubble advances at level 2), admire, start.

- [ ] **Step 4: Verify Round 3** — confirm the staged biter reaches the Level-2 Purrcy and wounds (not kills) it; the "bitten" bubble appears; heal in the pause (bubble advances when no cat is wounded); continue. If the biter kills instead of wounds, adjust `tutorialWave(3, ...)` spawn row toward the cats (e.g. row 9) or ensure the merged cat is the front cat.

- [ ] **Step 5: Verify tips** — buy cats to 5/5 and confirm the squad-full → sell → workbench tips appear one at a time and each only once; own a Cashmere Cat → coins tip; reach round 4, buy Bombay Boom → ability tip. Confirm "Skip tutorial" hides the overlay and leaves a normal game.

- [ ] **Step 6: Verify graduation** — play into round 5; confirm the overlay stops and shops are back to normal (random), and `MAX_ROUNDS` play still works.

- [ ] **Step 7: Screenshot** the R1 spotlight for the record, then commit any tuning:

```bash
git add -A
git commit -m "fix: tune tutorial staging and overlay positioning from browser verification"
```

---

## Self-Review

**Spec coverage:**
- Lessons 1–8 (stakes, buy/place, lanes, scout, refresh, produce, collect, pause) → Task 2 `CORE_STEPS` R1–R2 + Task 5 injection. ✅
- Lesson 9 merge → `r2-merge`. ✅  Lesson 10–12 squad cap / sell / workbench → `TIPS`. ✅
- Lesson 7 payoff + lesson 13 abilities → `r3-heal` + `tip-ability` with scripted R3 wave / R4 shop. ✅
- Scout Report = "what's coming, not lanes" → `r1-scout` copy. ✅
- Tutorial button top-right, always visible → Task 3. ✅  Graduation after R4 → `applyTutorialRound`. ✅
- Engine untouched → all logic in `tutorial.js` + `app.js`. ✅

**Placeholder scan:** none — every code step contains the full code.

**Type/name consistency:** `tutorialActive`, `tutorialStepIndex`, `syncTutorial`, `startTutorial`, `applyTutorialWave`, `applyTutorialRound`, `hideTutorialOverlay`, `showTutorialBubble` are defined in Task 4/5 and used consistently. Predicate/step/tip names match Task 1/2 exports. Shop-slot and dog shapes match the engine (verified against `makeShopSlot`/`createDog`).

**Open tuning (browser, Task 6):** exact R3 biter spawn row; overlay bubble placement on small viewports; whether the squad-full tip trio should gate on a 6th-cat attempt vs. simply reaching 5.
