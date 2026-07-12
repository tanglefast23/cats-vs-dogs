# Real-Time Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline; tasks form a hard dependency chain through game-engine.js → app.js, so no parallel dispatch). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the game from button-stepped rounds to one continuous real-time level per `docs/brainstorms/2026-07-12-realtime-conversion.md`.

**Architecture:** The engine keeps its pure `state in → new state + events out` pattern. `resolveSection` splits into per-unit actions fired by a new `advance(game, elapsedMs)` that processes due timers in timestamp order against a single `game.clockMs`. The UI runs a `requestAnimationFrame` loop that scales wall-clock time by one rate (pause 0 / slow-mo 0.25 / speed 1–2), renders units as persistent absolutely-positioned elements (no grid rebuilds), and plays event animations fire-and-forget.

**Tech Stack:** Vanilla ES modules, node:test, Vite, WAAPI + CSS custom properties.

**Branch:** `feature/realtime-conversion`

---

## File map

| File | Change |
|---|---|
| `src/game-engine.js` | Add `REALTIME` constants, clock/timer state, per-unit actions, `advance`, wave scheduler; delete prep/tactics/section machinery, `moveCat`, `returnCatToBench`, prep-move rules, `activeUsed`, `ACTIONS_PER_ROUND`; rename `MAX_ROUNDS`→`MAX_WAVES` |
| `src/app.js` | Rewrite: rAF loop, persistent `#units` layer, JS-driven countdown rings, fire-and-forget event animations, live shop/equip/sell, on-board ability targeting with slow-mo, blur auto-pause |
| `src/drag-drop.js` | Remove move/return actions, prep-distance rule, phase gates; food gated only by damage |
| `src/ui-state.js` | Simplify `shopPetAvailability` (no phase/playing); real-time worker tooltip copy |
| `index.html` | Add `#units` layer + wave countdown chip; remove Done button, tactics panel, turn tag |
| `styles.css` | Rings, READY badge, nap visual, slow-mo tint, death fade, wave chip; delete tactics styles |
| `tests/realtime.test.js` | New: clock, ordering, gold, waves, abilities, workers, victory/defeat, determinism |
| `tests/game-engine.test.js`, `tests/tactics.test.js`, `tests/production.test.js`, `tests/ui-state.test.js` | Update for new API; delete tests of removed mechanics |
| `README.md`, glossary copy in `app.js` | Real-time wording |

## Engine contracts (single source of truth)

```js
export const REALTIME = Object.freeze({
  dogActMs: 2000, dogJitterMs: 150,
  catAttackMs: 2000,
  abilityCooldownMs: 20000,
  workerProduceMs: 20000,
  goldPerSecond: 1.25,
  waveFirstMs: 15000, waveIntervalMs: 24000,
  slowMoFactor: 0.25,
});
export const MAX_WAVES = 7;
```

New state on `createGame()`: `phase: 'battle'`, `clockMs: 0`, `waveNumber: 0`, `waveDueAt: REALTIME.waveFirstMs`, `goldFraction: 0`, `nextWave: generateWave(1, random)`. Placement stamps timers: cats get `nextAttackAt = clockMs + catAttackMs` and (ability cats) `abilityReadyAt = clockMs + abilityCooldownMs`; dogs get `nextActAt = clockMs + dogActMs + jitter(random)`; workers get `outputReadyAt = clockMs + workerProduceMs`.

`advance(game, elapsedMs)`:
1. No-op unless `phase === 'battle'`.
2. Loop: find the minimum due time ≤ target among cat `nextAttackAt`, dog `nextActAt`, worker `outputReadyAt` (skipped while `pendingOutput` exists — that's the nap), and `waveDueAt`. Move the clock there (accruing `goldFraction += dt/1000 × goldPerSecond`, spilling whole gold), then fire everything due at that instant in canonical order: **cats (by row, col) → dogs (by row desc, col) → workers (by index) → wave spawn**. Reschedule each timer from its due time (`+= interval`), never from the loop end, so cadence never drifts.
3. Stop immediately when phase leaves `'battle'`.
4. Finish by moving the clock to target. Determinism requirement: `advance(advance(g, a), b) ≡ advance(g, a + b)`.

Per-unit actions are verbatim extractions from `resolveSection`: `fireCatAttack(next, cat)` (all five ability branches + orange burst + `nextAttackBonus` handling, dead dogs filtered after), `fireDogAct(next, dog)` (frozen skip → howl → tennis → blocked: jump-or-bite → tangle skip → step; breach on `row >= ROWS` immediately costs a life, sweeps that column, pushes `super-cat`).

Waves: on `waveDueAt` due — merge `nextWave` dogs onto row 0 (reassign column if occupied; drop the dog if row 0 is full), `waveNumber += 1`, stamp `nextActAt`, re-roll shop free via `makeShop(random, shop, waveNumber)`, push `{type:'wave', wave}` event; set `waveDueAt = due + waveIntervalMs`, or `null` after wave `MAX_WAVES`; regenerate `nextWave` for preview (empty after last). Victory check after every dog removal: `waveDueAt === null && dogs.length === 0 → phase 'victory'`.

Ability/food/equip/sell/buy/place/merge/collect: gate is `phase === 'battle'` only (UI adds its own pause gate). `useActiveAbility` requires `clockMs >= abilityReadyAt` and on success sets `abilityReadyAt = clockMs + abilityCooldownMs`. Worker collect sets `outputReadyAt = clockMs + workerProduceMs`.

## Tasks

### Task 1: Engine — constants, clock state, placement timers
- [ ] Write failing tests in `tests/realtime.test.js`: createGame shape (`phase 'battle'`, clock 0, waveDueAt 15000, nextWave length 1), placement stamps `nextAttackAt`/`abilityReadyAt`/`outputReadyAt`.
- [ ] Implement in `game-engine.js`. Run: `npm test` → new tests pass, old suite still passes (nothing removed yet).
- [ ] Commit.

### Task 2: Engine — advance(): clock, gold, cat/dog firing
- [ ] Failing tests: gold accrual (`advance(g, 8000)` → +10 gold), dog steps once per 2000ms and bites when blocked, cat fires each 2000ms, integration "dog walks 4 squares while Purrcy fires 4 times", split-vs-single advance determinism, frozen dog skips one act.
- [ ] Implement `advance` + `fireCatAttack` + `fireDogAct` (extracted from `resolveSection`, which stays temporarily). Run `npm test`.
- [ ] Commit.

### Task 3: Engine — waves, breach, victory/defeat
- [ ] Failing tests: wave 1 at 15000ms then cadence 24000ms; shop re-rolled on spawn (saved slot kept); preview refilled; column collision reassigns; victory after clearing final wave; breach sweeps column and decrements lives; lives 0 → gameover mid-advance stops firing.
- [ ] Implement. Run `npm test`. Commit.

### Task 4: Engine — repeatable abilities, live food/equip/sell
- [ ] Failing tests: cast blocked before `abilityReadyAt`, allowed after, cooldown resets, `activeUsed` gone; `useFood`/`equipInventoryItem`/`sellCat`/`purchase*` all work in `'battle'`; `equipInventoryItem(game, idx, 'cat', id)` signature (drop `paused`).
- [ ] Implement; update `tests/tactics.test.js` (rename intent: ability cooldowns) and any gated tests. Run `npm test`. Commit.

### Task 5: Engine — worker production cycle
- [ ] Failing tests in `tests/production.test.js`: output ready at 20000ms → `pendingOutput` set + `worker-output-ready` event; napping worker produces nothing more; collect restarts cycle; merged workers keep the target's timer.
- [ ] Implement (`fireWorkerFinish`). Run `npm test`. Commit.

### Task 6: Engine — deletions and copy
- [ ] Remove `resolveSection`, `startRound`, `finishRound`, `openTacticsWindow`, `continueCombat`, `moveCat`, `returnCatToBench`, `ACTIONS_PER_ROUND`, `section`, prep-move fields, phases `prep`/`tactics`; rename `MAX_ROUNDS`→`MAX_WAVES`; `catTooltipInfo` says damage per attack (`↑ N / 2s`).
- [ ] Purge dead tests from `tests/game-engine.test.js`; keep every rule test that survives (targeting, merging, shop, sell quotes) by porting setup to `'battle'` phase. Run `npm test`. Commit.

### Task 7: drag-drop.js + ui-state.js
- [ ] Failing tests: no `move`/`return` actions; board cat → cell is invalid; food valid on damaged cat with no phase argument; `shopPetAvailability({sold, gold})` only; worker tooltip says "every 20s" / nap copy.
- [ ] Implement both modules; update their test files. Run `npm test`. Commit.

### Task 8: index.html + styles.css scaffolding
- [ ] Add `<div id="units"></div>` sibling of `#effects` inside `#board`; HUD wave chip `#wave-chip` (`WAVE n/7` + `#wave-timer`); delete `#done`, `#tactics-panel`, `#turn-tag`. Preview sign copy → WAVE.
- [ ] styles.css: `.rt-unit` absolute positioning (left/top %, transform translate(-50%,-50%), `transition: left .28s steps(4), top .28s steps(4)`), `.cd-ring` conic-gradient from `--p`, `.ability-badge.is-ready` pulse, `.worker-napping` (zzz), `body.slow-mo #board` tint, `.rt-dying` fade, wave chip; remove tactics styles. Commit (UI not wired yet, site still renders).

### Task 9: app.js rewrite — loop, units layer, rings, HUD
- [ ] rAF loop: `dt = min(200, ts - last) × combatSpeed × (slowMo ? 0.25 : 1)`, skipped entirely when `uiPaused()` (manual, glossary, settings, window blur) or `phase !== 'battle'`; then `game = advance(game, dt)`; dispatch new events; `syncUnits()`; per-frame cheap HUD (gold, wave countdown, ring `--p` values).
- [ ] `syncUnits()`: persistent per-id elements in `#units` (cat/dog/decoy markup with hp bar, level badge, ring, ability badge), position via `cellCenter`, add on appear, fade-remove on disappear unless a kill animation owns the death.
- [ ] Board grid becomes static background cells (built once) used for drops, targeting highlights, and aria labels.
- [ ] Run `npm run dev`, verify: dogs march, cats fire, gold drips, waves arrive, victory/defeat modals. Commit.

### Task 10: app.js — event animations, fire-and-forget
- [ ] Handlers keyed by event type (shot, cat-melee, melee, dog-shot, move, dog-jump, howl, freeze-cast/skip, tangle-skip, teleport, decoy-cast, encore, item-heal, super-cat, wave, worker-output-ready, collect-output, combine, sell): all schedule WAAPI/timeouts, none await; kills resolve at impact (`hpAfter <= 0` → death pop then element removal). Reuse existing projectile/keyframe helpers and sounds.
- [ ] Manual browser check of each visual (freeze a dog, storm a column, collect output). Commit.

### Task 11: app.js — live interactions
- [ ] Drags allowed while unpaused battle (shop→board/bench/stack, bench→board/stack/sell, worker moves, item equip/food); dragging or ability-targeting sets slow-mo class + rate.
- [ ] On-board ability flow: click READY cat → targeting (reuse `ACTIVE_COPY`, highlight via existing `ability-target` rules incl. teleport two-step) → click target → cast → cooldown; Escape/board-miss cancels.
- [ ] Station collect clicks live; pause button hard-stops interactions; blur auto-pauses; restart/speed/glossary/settings rewired; `renderSidePanels()` re-runs on relevant events only.
- [ ] Full manual playthrough in browser pane. Commit.

### Task 12: Copy + docs
- [ ] Glossary production copy ("every 20 seconds, naps until collected"), legend, README gameplay bullets (SPEED chip note, real-time description), CLAUDE-visible tooltips. Run `npm test`. Commit.

### Task 13: Verification pass
- [ ] `npm test` (all green), `npm run build` (clean), browser-pane playthrough at 1× and 2×: place cats, survive waves, cast freeze via slow-mo, equip mid-fight, collect nap output, reach victory via dev seed or defeat naturally; screenshot proof. Fix everything found before proceeding.

### Task 14: Ship
- [ ] Invoke final-commit skill: quality checks, commit, push, merge branches per its procedure.

## Self-review notes
- Spec coverage: every spec section maps to a task (timers T1–5, removals T6–7, UI T8–11, copy T12, tests throughout). Rings are JS-progress-driven rather than the spec's pure-CSS sweep — deliberate change: CSS wall-clock animations cannot follow slow-mo/speed changes mid-sweep; noted for the summary.
- Determinism property test (T2) guards frame-rate independence.
- No placeholders; engine contracts block defines names used by later tasks (`fireCatAttack`, `fireDogAct`, `fireWorkerFinish`, `advance`, `REALTIME`, `MAX_WAVES`).
