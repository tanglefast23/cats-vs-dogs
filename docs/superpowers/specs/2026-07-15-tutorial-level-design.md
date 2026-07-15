# Tutorial Level — Design Doc

- **Date:** 2026-07-15
- **Status:** Draft for review
- **Goal in one line:** Teach a brand-new player the whole core loop — place, defend, produce, merge, manage the squad — through a guided opening, without a wall of text.

---

## Approach

**Guided core, then just-in-time tips** (the option chosen during brainstorming).

- **Rounds 1–2 are hand-held.** Each step spotlights one thing on screen, says one short line, and waits for the player to actually do it before moving on. This is where the core loop is taught.
- **Everything after is taught the moment it becomes relevant.** Merging, a full squad, selling, the workbench, and mid-fight abilities each pop up as a **single coached tip the first time the player hits that situation** — not as a forced march. Less tiring, and each lesson lands when it's useful.

A light **scripted setup** runs underneath (fixed opening wave + a curated shop on a few key rounds) so the teaching moments are guaranteed to happen. Once the lessons are done (~round 4), guidance quietly switches off and the game plays normally.

---

## What the player learns

1. **Stakes** — dogs march down the 6 lanes; one reaching your house costs a life; lose all 3 → game over.
2. **Buy & place** — cats cost **3 gold**; drag a cat from the shop onto the battlefield.
3. **Lane coverage** — Purrcy only shoots straight up his own lane, so spread cats to cover lanes.
4. **Scout Report** — peek at *which* dogs are coming (not their lane) to shop smart.
5. **Refresh** — 1 gold rerolls the shop to hunt for what you want.
6. **Production** — place a producer in the House; it makes something after the battle.
7. **Production payoff** — *collect* the output (tap the station) and *use* it (drag food onto a hurt cat, +2 heal).
8. **The between-battle pause** — a breather mid-round; heal or act here, then Continue.
9. **Merge = power spike** — stack 3 matching cats into one much stronger cat.
10. **Squad cap (5)** — when full, you must merge, bench, or sell to make room.
11. **Sell / adoption** — drag your weakest cat to the Adoption Box for gold + a free slot.
12. **Workbench** — park cats on the side (3 slots) to hold pairs and overflow.
13. **Stronger cats + mid-fight abilities** — round-4 cats unlock; some have a button you press *in the pause*.

---

## The correction that shaped this

The **Scout Report shows which dogs are coming (type + tier), not which lane** (`renderDogPreview`, `src/app.js:1210` — dogs are packed into a roster grid in queue order; `dog.col` is not shown). So the placement lesson is **lane coverage** ("spread out; an uncovered lane lets a dog through"), and the Scout Report lesson is **"read what's coming so you buy the right counters."**

---

## How combat actually paces (verified in code)

This shapes which lesson lands in which round:

- **Dogs accumulate and approach slowly.** A round is 2 exchanges; dogs advance 2 rows/exchange (~4 rows/round) across a 14-row board, and `startRound` *pushes* each new wave onto the surviving dogs (`src/game-engine.js:1398`). So dogs first reach the cat rows around **round 3** and only breach (cost a life) around round 4 if a lane is left open.
- **Cats shoot at range**, so a covered lane usually kills a dog *before* it lands a bite — a "wounded cat" is not automatic.
- **Cat wounds persist between rounds** (`finishRound` preserves HP, `src/game-engine.js:2100`); there is no between-round heal.
- **Base Purrcy is glass (4 HP): any dog bite (≥4) kills it outright** — and a Level-2 cat one-shots a gentle biter before it can bite. So the heal lesson does **not** rely on a live bite; it scripts a small persisted wound at R3 prep (wounds carry between rounds) that one treat fully heals.

Net effect: **R1–R2 are low-pressure setup rounds** (buy, produce, merge); **R3 is when dogs reach the front**, which is exactly where the production-payoff (heal) lesson belongs, and R4 is where mid-fight abilities do.

## Guided core — Round 1 (gated, step by step)

Each beat = spotlight a target, show one line, advance when the player does the action.

| # | Spotlight | Coach line | Advances when |
|---|---|---|---|
| 1 | Lives + the board | "Dogs charge down these 6 lanes. If one reaches your house, you lose a life — lose all 3 and it's over." | player taps to continue |
| 2 | Scout Report | "Here's what's coming. Check it before every round so you know what to buy." | player taps to continue |
| 3 | Gold chip + a Purrcy in the shop | "You've got 10 gold. Cats cost 3. Drag **Purrcy Pew-Pew** onto the battlefield." | a Purrcy is on the board |
| 4 | The empty lanes | "Purrcy only shoots straight up his own lane. Grab a **second Purrcy** and cover another lane." | a 2nd cat is on the board |
| 5 | Refresh button | "Want different cats? **Refresh** rerolls the shop for 1 gold." | player refreshes once |
| 6 | The House + a producer in the shop | "Not every cat fights. **Whisker Biscuit** bakes healing treats. Drop her in the House." | a producer is in the House |
| 7 | Start Round button | "That's your setup. **Start the round** and watch them work." | round starts |
| 8 | (first exchange plays) → the pause | "This is a breather between attacks. Nothing to spend yet — press **Continue**." | player continues |
| — | round finishes | — | → Round 2 |

*Gold math: 2 Purrcy (6) + refresh (1) + Whisker Biscuit (3) = 10. Spends the round to zero, which is correct ("unspent gold is lost").*
*Scripted R1 wave: 2 basic (tier-1) dogs spawned in the player's covered lanes. They start far up the board and only advance a few rows this round, so **no cat is bitten in R1** — but dogs remain after the first exchange, so the **pause** in step 8 opens naturally while the cats chip them down at range.*

## Guided core — Round 2 (gated: collect + first merge)

| # | Spotlight | Coach line | Advances when |
|---|---|---|---|
| 1 | Whisker Biscuit's station (now has output) | "Whisker baked a treat overnight. **Tap the station** to collect it — it waits in storage until a cat needs it." | output collected |
| 2 | Your two Purrcys + a 3rd in the shop | "Three matching cats **merge** into one powerhouse. Drag one Purrcy onto the other." | a Purrcy stack reaches 2 copies |
| 3 | The stack + the 3rd Purrcy | "Buy the third and drop it on — **merge!**" | a Purrcy hits level 2 |
| 4 | The new Level-2 cat (13 HP) | "See the jump? One strong cat beats three weak ones — and it's tough enough to survive a bite now." | player taps to continue |
| — | start and play the round | — | → Round 3 |

*Scripted R2 shop guarantees a 3rd Purrcy is available.*

## Guided core — Round 3 (gated: production payoff)

The heal is taught in R3 **prep**, not in the pause. Reason (found in verification): the Level-2 cat's attack **one-shots** a gentle biter before it can bite (cats act before dogs), and a tougher survivor only bites in exchange 2 — after the pause. So a staged biter is unreliable. Instead we lean on a real rule — **wounds persist between rounds** — and script a small persisted wound at R3 prep, which one treat fully heals. Food works in prep, so no combat timing is involved.

| # | Spotlight | Coach line | Advances when |
|---|---|---|---|
| 1 | the wounded cat | "One of your cats is still hurt — wounds carry over between rounds. Let's patch it up." | player taps (shown once a cat is wounded) |
| 2 | House Storage → the wounded cat | "Drag Whisker's treat onto the hurt cat — **heal +2**. That's the payoff of production." | no cat is wounded (healed) |

*Scripted R3: at prep, the strongest cat is left `maxHp − 2` (a persisted scrape from the advancing pack), so exactly one Whisker treat restores it — guaranteeing a clean heal lesson.*

---

## Just-in-time tips (round 2 onward — fire once, when the situation first happens)

Each is a single coached pop-up (spotlight + one line + dismiss). No forced sequence.

| Tip | Fires the first time… | Coach line |
|---|---|---|
| **Squad full** | player has 5 cats on the board and tries to add a 6th | "Your Elite Squad maxes at **5**. Merge two, bench one, or sell one to make room." |
| **Sell** | (shown alongside Squad-full) | "Drag your weakest cat to the **Adoption Box** — gold back, and a free slot." |
| **Workbench** | player has a spare cat / a pair with no third yet | "Park cats on the **Workbench** (3 slots) to hold a pair until the third shows up." |
| **Ability cat** | player owns a cat with a mid-fight ability (round-4 unlock) | "This cat has a special move. It only fires in the **pause** — open the Tactics window and use it." |
| **Coins** | player collects from Cashmere Cat for the first time | "Coins go straight to your gold — more coins, more cats." |

---

## Scripted scenario (kept minimal)

Only script what's needed to guarantee the lessons:

- **R1 wave:** hand-built, gentle — dogs spawn in the player's covered lanes and only approach this round, no bite yet (`game.nextWave` is consumed verbatim by `startRound`, `src/game-engine.js:1397`).
- **R3:** normal wave; the heal is staged via a scripted `maxHp − 2` wound on the strongest cat at prep (not a wave dog).
- **R1 shop:** Purrcy-forward; after the refresh, show the producers (Whisker Biscuit + Cashmere Cat).
- **R2 shop:** guarantee a 3rd Purrcy (for the merge).
- **R4 shop:** guarantee one round-4 cat with a mid-fight ability (for the ability tip).
- **All other rounds/waves:** normal procedural generation.

---

## The Tutorial button

- A **"Tutorial"** control in the top-right title bar, next to ⚙ Settings and ↻ Restart (`.titlebar-actions`, `index.html:49`).
- **Always visible** (per request — tap anytime to test).
- On tap: reset to a fresh game in **tutorial mode** and start the guided sequence from Round 1.

## Graduation

Guidance is active rounds 1–4. Once the core steps and all tips have played, tutorial mode turns off and the run continues as a normal game (through round 10). No separate "tutorial complete" screen needed — it just stops guiding.

---

## Architecture

Keep the engine pure and untouched. The tutorial is a **layer on top**.

- **`src/tutorial.js` (new, pure + testable)** — the data and rules, no DOM:
  - `CORE_STEPS` — the R1–R2 gated beats: each `{ id, round, text, spotlight, isDone(game), setup?(game) }`.
  - `TIPS` — the just-in-time triggers: each `{ id, when(game), text, spotlight, once: true }`.
  - `tutorialWaveForRound(round)` / `tutorialShopForRound(round)` — the scripted setup (return `null` when a round isn't scripted).
  - Pure predicates over game state (e.g. `catOnBoard(game, coat)`, `squadIsFull(game)`), unit-testable like `movement-rules.js`.
- **`src/app.js` (glue)** — the impure parts:
  - A small **overlay**: a dimmed layer with a highlighted cut-out around the spotlight target + a text bubble. New CSS in `styles.css`.
  - **Observe, don't intercept:** after each `render()`, if tutorial mode is on, evaluate the current step's `isDone` / the tips' `when` and advance. No need to instrument every action.
  - **Inject scripted state** at game start and at each `finishRound` (set `game.nextWave` / `game.shop` from the tutorial tables).
  - The **Tutorial button** wiring.
- Reuse the existing **pause** system to freeze combat if a coached tip ever appears during a battle.

## Testing

- Unit-test `src/tutorial.js` pure logic (`npm test` / `node --test`, matching the repo pattern):
  - every core step and tip resolves to a spotlight target and non-empty text;
  - the gate predicates fire correctly for representative game states (cat placed, squad full, ability cat owned, etc.);
  - `tutorialShopForRound` returns a 3rd Purrcy on R2 and an ability cat on R4.
- Browser check: run the tutorial end-to-end via the button; confirm each gate advances only on the real action and the scripted moments occur.

---

## Out of scope / open questions

- **Showing incoming lanes in the Scout Report** — desirable per the elite-squad doc's open items, but a *game* feature, not the tutorial. Excluded unless requested.
- **Skippable / auto-launch for first-time players** — for now it's launched only by the button. Auto-showing on first run can come later.
- **Exact coach copy** — the lines above are drafts to tighten during build.
- **Whether guidance ends at R4 or the tutorial ends the run there** — proposed: guidance stops, normal play continues. Confirm.
