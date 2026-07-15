# Elite Squad Redesign — Design Doc

- **Date:** 2026-07-13
- **Status:** Implemented (balance core + Tactics-window movement); pacing under playtest per §5
- **Goal in one line:** Make the game genuinely strategic by capping how many cats you can field, so that saving units, hunting for combos, and merging finally matter.

---

## The problem

The strategy feels flat right now. Two root causes, both measurable:

**1. The battlefield is never a real limit.**
The cat zone is 4 rows × 6 columns = **24 squares** (`CAT_ZONE_START = 10`, `ROWS = 14`). You earn 10 gold a round and cats cost 3, so you buy ~3 cats a round — about **30 cats across all 10 rounds**, and only if you spend every coin on cats. The board doesn't fill until the last few rounds (~round 8 of 10), and even a packed 24-square board is nothing like an "elite squad". *(In plain terms: the board barely bites, and only at the very end, so the game almost never forces the question "which cats make the team?")*

**2. Merging currently makes your army weaker.**
Compare three level-1 orange cats to the single level-2 they merge into:

| | HP | Attack/action | Columns covered |
|---|---|---|---|
| 3 × Level-1 orange | 18 | 6 | up to 3 |
| 1 × Level-2 orange | 9 | 3 | 1 |

Merging **halves** your total HP and damage and drops your lane coverage. So spreading cheap level-1s everywhere is the *optimal* play, and hunting for combos is a trap. That's why leveling up feels unrewarding.

**The core principle:** strategy comes from **opportunity cost** — every choice should cost something. Today the board has none (units never compete for space) and merging costs you stats. The fix is to make board space genuinely scarce, so "fewer, stronger units" becomes the winning idea.

---

## The design

### 1. Field cap — a flat 5 cats

You may **deploy at most 5 cats on the battlefield**, in every round (flat, no ramp).

- The bench (3) and the shop are **unchanged** — you still buy freely. The squeeze is purely on *deployment*.
- Why this works: once slots are scarce, the comparison that matters flips from "3 level-1s vs 1 level-2" (where spreading wins) to **"1 level-2 vs 1 level-1 in the same slot"** (where the level-2 clearly wins). Scarcity is what makes merging correct.
- Consequence, by design: the whole progression becomes **"upgrade your 5 slots"** rather than "add more bodies." You hold pairs on the bench hoping for the third copy, and benching/selling a weak cat becomes a real decision.

### 2. Merges become real power spikes

Rescale level-2 and level-3 stats so a merged cat is **slightly stronger than the three cats you spent** — and clearly stronger than one cat in the same slot.

Illustrative, orange coat (exact per-coat numbers to be tuned):

| In one slot | HP | Attack |
|---|---|---|
| Level 1 | 6 | 2 |
| Level 2 — today → new | 9 → ~20 | 3 → ~7 |
| Level 3 | a proper "monster" | |

- Apply the same **"beat the sum by a little"** rule to every coat.
- **Chosen philosophy:** combined *slightly beats* the three inputs added together — rather than the alternative "combined merely equals the sum, and the freed slot is the whole reward." The slight-beat version makes every merge a felt power spike (fits the elite-squad fantasy) and feels good even early, before you have spare cats to fill the freed slots.
- **Keep the premium small.** If a merged cat crushes three spread cats so hard you'd *always* merge, the decision dies again. The natural counterweight is already in the game (see #3): dogs pour down 6 lanes and an open lane costs a life, so one giant cat can't guard six lanes.

### 3. Board stays 6 columns wide

Do **not** narrow the board. The width is doing important balancing work: 6 lanes + "an undefended lane costs a life" is the pressure that stops "just merge everything" from being an auto-win. Narrowing it would kill the concentrate-vs-spread tension that is the whole point.

### 4. Movement — reposition to meet threats

**Between rounds — already exists, just surface it.**
The engine already lets a surviving cat move **one square, once per prep phase** (tracked by `prepOrigin` / `prepMoved` in `moveCat`/`placeCat`, reset each round in `finishRound`). Players likely don't know it's there. **Make it visible in the UI** so it becomes a real lever. No rule change.

**During a battle pause — new.**
In a Tactics window, allow moving **1 cat, 1 square**, capped at **once per combat**.

- Same motion as prep: one step up/down/left/right into an empty, legal cat-zone square.
- **Once per combat, not once per pause** — otherwise opening the Tactics window several times in a round would quietly become unlimited free repositioning, which is both fiddly and overpowered. The single move must stay a real decision.
- Purpose: react to how the battle unfolds — slide a tank over to plug a lane a dog is about to break through, or pull a wounded shooter back.

Today `moveCat` only runs in the `prep` phase; this adds a limited move path to the `tactics` phase (alongside the existing feed/cast actions).

### 5. Pacing / difficulty — test, then trim

The player observed the game feels "too easy / no fear of approaching doom / too vertical" — but this was seen in the **current uncapped build**, where you can field a whole boardful of cats.

- **Do the cap first, then judge.** The flat-5 cap cuts firepower from ~20 cats down to 5, which by itself lets dogs march much deeper before dying. Much of the "no doom" feeling should fix itself. Implement the cap, playtest a few rounds, *then* decide whether pacing still needs work — so we don't stack two big difficulty changes at once and overshoot into "too hard, no time to react."
- **If it's still too easy after the cap:** prefer **shrinking the vertical approach** over speeding dogs up.
  - Trim the empty approach so dogs cross ~5–6 rows to reach the front line instead of ~10, and shrink the cat zone to ~2–3 rows (5 cats don't need 4 rows of depth).
  - *Not* "every dog moves 3 rows/turn": normal dogs advance 2 squares, while T2+ Barkour Bandit is the readable 3-square speed specialist. Its Light Gear makes every damaging hit deal +1 damage, paying for that speed without slowing the rest of the pack.
  - T2+ Sir Flinches-a-Lot uses Panic Shuffle after surviving a hit: it sidesteps left or right when possible, and only a square already holding two dogs counts as dog-blocked.
- **Reserve lever (only if shrinking + cap still isn't enough):** cap how far cats can shoot, so dogs get a "safe" far zone and dread builds as they enter range. Bigger change — hold it back.

---

## Open items (to tune / verify, not blocking)

- **Exact merge stat curves** per coat — start from the "beat the sum by a little" rule, tune in playtest.
- **Whether flat 5 holds** — confirm it feels right after playing; adjust the number if not.
- **Incoming-wave visibility** — confirm the UI shows the *columns* of the next wave during prep. The engine knows them (`nextWave`); movement is far more strategic if the player can see where the dogs are about to come. If it's not shown, showing it becomes part of this work.

## Implemented balance baseline

- Field cap: **5 cats**, shown in the HUD; purchases and bench placements cannot create a sixth field cat, while moves and merges remain legal.
- Merge curve: every coat's level 2 health and attack are just over 3× level 1; level 3 is just over 3× level 2.
- Wave sizes by round: **2, 3, 3, 4, 4, 5, 5, 6, 7, 8**.
- Tier floors: tier 1 in rounds 1–4, tier 2 in rounds 5–8, and tier 3 in rounds 9–10.
- Featured specialists: Fetch Armstrong and Bone Jovi are forced into round 6; Bone Jovi and Dr. Droolittle into round 8; the last two waves guarantee three ranged/support roles, including Growl Gadot in round 10.
- Tactics-window movement: `moveCatInTactics` moves 1 cat 1 orthogonal square onto an empty legal tile, once per combat (`tacticsMoveUsed`, reset by `startRound`); drag-only during tactics (clicks stay reserved for ability targeting), with the drop rule blocking mid-combat deploys/merges and the tactics-help line advertising the move until it is spent.

## Non-goals (explicitly out of scope for now)

- Narrowing the board width.
- Changing the economy numbers (10 gold/round, 3 gold/cat).
- Adding new cat coats or dog types.
- The reserve "cat shooting range" lever (only if pacing still fails after the cheaper fixes).

---

## Rough implementation notes

Likely touch points (from the current engine):

- **Field cap:** gate placement/deployment on a count of on-board cats < 5. Affects `placeCat`, `purchaseShopFighterToBoard`, and any path that adds a cat to `game.cats`. Surface the cap (e.g. "5 / 5") in the UI.
- **Merge stats:** rescale `COAT_HP` / `COAT_ATTACK` (and the shared `CAT_STATS` shell if used) for levels 2 and 3.
- **In-pause movement:** add a limited move action to the `tactics` phase mirroring `moveCat`'s prep rules, with a per-combat "used" flag.
- **Surface between-round movement:** UI affordance for the existing `prepOrigin`/`prepMoved` one-step move.
- **Pacing (only if needed):** `ROWS` / `CAT_ZONE_START` for a shorter board; keep dog movement at one row per section.
- **Tests:** extend `tests/` to cover the cap, the new merge stats, and in-pause movement.
