---
date: 2026-07-12
topic: realtime-conversion
---

# Real-Time Conversion

## Decision

Convert the game from button-stepped rounds to one continuous real-time level. Keep the grid, the pure-state engine, the event-list animation contract, and every targeting/damage rule. Change *when* rules fire: each unit carries its own timer, and the player manages the fight live.

## Approved rules

- **Fully continuous.** No prep phase. The clock starts at once; waves spawn on visible countdowns whether or not the board is clear.
- **One attack per dog step.** In the time a dog walks 4 squares, every fighting cat attacks 4 times — today's balance made continuous.
- **Placement is permanent.** Cats never reposition after they land on the board. Purrtal's teleport is the only way to move a placed cat. Selling stays, and works live.
- **Slow motion while interacting.** The clock drops to 25% while the player aims an ability or drags anything toward the board or a cat — a bench/shop cat, food, a weapon, armour. It snaps back on release or cancel.
- **Producers nap.** When a house cat finishes an item, the item waits and the cat visibly naps. Collecting the item starts the next production cycle. Output never stacks and is never replaced.
- **Passive gold.** 10 gold per 4 dog-step intervals, accrued continuously (fractional accumulator; the HUD shows the floor).

## Timers at 1× speed (tunable constants)

| Timer | Value | Notes |
|---|---|---|
| Dog act (step, or bite when blocked) | 2000 ms | ±150 ms per-dog spawn jitter |
| Cat auto-attack (every coat, incl. melee) | 2000 ms | countdown ring on each cat |
| Active ability cooldown | 20 000 ms | starts on cooldown at placement; repeatable forever |
| Worker production | 20 000 ms | then naps until collected |
| Gold drip | 1.25 gold/s | = 10 per 8 s |
| Wave 1 grace | 15 000 ms | shop open from second zero |
| Later waves | every 24 000 ms | measured spawn to spawn |
| Slow-mo factor | 0.25× | multiplies the clock |
| Speed chip | 1× / 2× | multiplies the clock; persists as today |

## Game flow

- Start: 10 gold, empty board, shop open, wave-1 countdown running.
- Waves 1–7 reuse `generateWave` and the tier/role unlock schedule, keyed by wave number instead of round.
- Victory: wave 7 has spawned and no dogs remain. Lives and the breach (super-cat) rule are unchanged.
- **No between-wave healing.** Food from Whisker Biscuit is the only healing.
- Shop: re-rolls free at each wave spawn; the 1-gold refresh and the Save toggle work as today; buying, stacking, and placing are allowed at any moment.
- The bench remains as a staging area. Deployment is one-way; return-to-bench is removed.
- Decoys persist until destroyed (they no longer clear between rounds).
- Freeze still skips the dog's next action and stores shatter damage; the Jumper still jumps once per lifetime; the Howler still howls once. These map one-to-one from "per section" to "per timer fire".

## Architecture

- **Engine.** Split `resolveSection` into per-unit actions (`catAttack`, `dogAct`, `workerFinish`, …). Add `advance(game, elapsedMs)`: it fires every due timer in timestamp order and returns new state plus events. All timing state lives on the game object as plain numbers (`clockMs`, per-unit `nextActionAt`, `abilityReadyAt`, `waveDueAt`, `goldFraction`) so saves stay serializable JSON, per the Electron rules.
- **Clock.** `game.clockMs` is the single time source. Pause, slow-mo, and 1×/2× are one multiplier applied to wall-clock delta before calling `advance`. The game auto-pauses when the window loses focus.
- **UI loop.** `app.js` runs a `requestAnimationFrame` loop. Animations become fire-and-forget overlays; nothing awaits them and they never block the clock. This animation rework is the largest single piece of the job.
- **Countdown rings.** Pure CSS conic-gradient sweeps with duration = interval ÷ speed, restarted when the unit acts; paused via `animation-play-state`. No per-frame JavaScript.

## Removed

- Phases `prep` and `tactics`, the Tactics Window, and the Done/Continue button.
- `activeUsed` (once-per-battle abilities), `ACTIONS_PER_ROUND`, the per-round 10-gold reset, and the between-round full heal.
- The prep move rule (`prepOrigin`/`prepMoved`), board repositioning, and `returnCatToBench`.
- Phase gates on selling, equipping, and food — these all work at any time.

## Interactions

- Ability: tap a READY cat → slow-mo plus targeting highlights → tap a legal target → cast → cooldown restarts. Tap elsewhere cancels.
- Collect: tap a napping worker's finished item → it flies to storage (coins to the gold counter) → the next cycle starts.
- Pause button: full stop; menus only, no game interactions. Slow-mo is the in-play tool.

## Testing

- Engine tests drive `advance` with fixed steps and seeded random — no real waiting.
- Keep the existing 110 tests where the mechanic survives; replace tests for removed mechanics (prep moves, tactics gating, phase-locked shop).
- New coverage: due-timer ordering, ability cooldown cycle, worker nap/collect cycle, gold accrual, wave countdown and victory, clock-multiplier math, and the no-reposition rule.

## Risks and follow-ups

- Balance will shift: repeatable abilities and no between-wave heal need a tuning pass after the first playable build.
- Copy referring to rounds needs rewording — including the worker tooltip added in 6bacfba ("after each battle") and cat tooltips that quote damage "per round".
- Keep the renderer browser-pure and the state JSON-serializable so the staged Electron transition is unaffected.
