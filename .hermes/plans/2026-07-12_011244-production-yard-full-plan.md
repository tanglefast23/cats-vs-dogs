# Cats vs Dogs — Production Cats, Items, Equipment, and Live Healing
## Full Implementation Plan for Second-Opinion Review

> **Status:** Implementation is in progress. Core worker/shop/production/inventory/equipment rules and initial Production Yard scaffolding have started under tests; the combat-controller refactor has not started.
>
> **Implementation constraint:** Do not commit, push, deploy, or modify unrelated Electron/Vite work unless Joe separately requests it.

## Second-opinion amendments accepted after review

The external review found several real balance and sequencing problems. The following amendments supersede conflicting rules later in this document:

### Accepted for v1

1. **Phase the build before touching combat internals.** Phase 1 delivers the mixed shop, workers, production, collection, inventory, worker selling, item merging, weapons, finite armour, and a playable preparation loop using the existing combat engine. Run a full browser balance pass before Phase 2 considers pause/live-food combat changes.
2. **Trader output becomes 2/3/5 coins** at levels 1/2/3. With a fresh-10-gold reset and only seven rounds, 1/2/3 makes upgraded Traders a trap.
3. **Armour scales one primary axis.** Armour blocks 2/3/4 damage by tier, but every tier has 3 hit uses. Keep minimum 1 HP damage on every successful enemy bite. This changes total maximum prevention from quadratic 4/9/16 to linear 6/9/12.
4. **Items use the familiar three-copy merge rule.** Three same-tier weapons merge into one next-tier weapon; three same-tier armour pieces merge into one next-tier armour piece. Tier 3 is the cap. This gives smith output a long-term sink and makes duplicates meaningful.
5. **Shop odds roll category first.** Each ordinary slot is 65% fighter / 35% worker, then uniform within that category. The opening round-1 shop guarantees at least two fighters so a player cannot be unable to start. Saved cards remain exceptions because the player deliberately kept them.
6. **Workers can be sold for 1 gold during preparation.** Use an explicit drag-to-sell target or two-step Sell action. Selling destroys pending output and prevents a six-slot permanent lock.
7. **Calico support defaults to Tangle Yarn, not Marking Yarn.** A hit dog skips its next movement. If blocked by a cat and therefore biting instead of moving, it may still bite and keeps the tangle until its next attempted move. This is visible, thematic, and avoids a new generic damage-mark framework.
8. **Warn before losing station output.** Starting a battle with pending output requires a clear warning naming the number of uncollected stations; a second activation confirms Start Round.
9. **Collection is preparation-only.** Pending output may remain visible through combat but cannot be collected until preparation. Merchant coins follow the same rule.
10. **Weapon bonuses apply before ability math.** Tabby splits the effective attack across pellets; Prism uses effective attack for each pierced target; Bomber’s fixed 1-point secondary splash remains fixed.
11. **Restart resets every new system.** Workers, inventory, pending output, equipment, item reservations, pause state, and transient locks must reset.

### Deliberately not accepted without further playtesting or Joe approval

1. **Do not silently replace true real-time food with next-lull healing.** The review is correct that frame-precise healing is expensive. We will defer that refactor until the Phase-1 loop is playable, then compare true real-time against queued-next-exchange behavior. Joe’s current requested behavior remains true real-time unless he changes it.
2. **Do not change free between-round healing yet.** Persistent attrition or healing half the missing HP could make the Cook more strategically useful, but it also changes the base game’s difficulty and can make runs depend on worker-shop RNG. Evaluate after Phase-1 balance testing. If changed, test food at 3 HP instead of 2.
3. **Do not transfer source equipment on merge.** Joe explicitly chose the Super Auto Pets-style target-survival rule: the cat being dragged onto keeps its equipment; source equipment is destroyed even when the target slot is empty.
4. **Do not restrict equipment to preparation only yet.** Joe explicitly approved preparation-or-pause equipment. Pause-scumming is a known risk to evaluate if Phase 2 is built.
5. **Do not add production critical hits or higher-tier smith RNG in v1.** Collection feedback already supplies delight; production variance adds balance noise before baseline economy tuning is stable.

### Revised phase gates

- **Phase 1A — playable economy:** mixed weighted shop, drag-to-buy, workers, production, collection, inventory, sell-for-1, item merging, Trader 2/3/5.
- **Phase 1B — equipment and support:** weapon math, armour block 2/3/4 with 3 uses, durability UI, Tangle Yarn, output-loss warning.
- **Phase 1C — browser balance gate:** complete seven-round runs measuring shop dead starts, Trader payback, Cook usefulness, armour prevention, inventory pressure, and worker-slot lock frequency.
- **Phase 2 — only after the gate:** pause and live-food model. Decide between frame-precise impact commits and next-exchange queued healing using actual playtest evidence.

## 1. Goal

Add a second class of cats—production workers—that occupy their own six-slot production area and generate food, coins, weapons, and armour after battles. Integrate those resources into the existing shared shop, economy, battlefield, merging rules, real-time combat, and pixel-art presentation.

The feature should create a second strategic layer:

- Fighters compete for shop rolls and gold with workers.
- Workers compete for six production slots.
- Uncollected output expires, but collected items persist.
- Inventory space constrains item variety rather than raw quantity.
- Food creates real-time battle decisions.
- Weapons increase attack until lost.
- Armour reduces incoming damage for a limited number of hits before breaking.

## 2. Current game context

The current project is a static JavaScript browser auto-battler with:

- One mixed fighter shop that starts with three offerings and expands later.
- Six bench slots.
- A 6-column × 14-row battlefield with four fighter-placement rows.
- Three-copy, same-coat, same-level merging up to level 3.
- Ten fresh gold each preparation phase.
- One-gold refresh and Super Auto Pets-style Save/freeze.
- Deterministic game rules in `src/game-engine.js`.
- DOM/controller and animations in `src/app.js`.
- Procedural canvas pixel art in `src/pixel-art.js`.
- Pointer drag/drop support in `src/drag-drop.js`.
- Node test suites in `tests/`.

A major technical constraint is that the current combat controller resolves an entire combat section before its animations play. Live healing cannot safely be added on top of that model because an already-computed result could overwrite a food heal. Combat must be changed to intent-at-animation-start and state-commit-at-impact.

---

# Part A — Locked Product Rules

## 3. Shared shop

There is one Cat Cart. Fighters and workers appear together in the same shop grid.

### Shop generation

- Shop slots retain their existing progression: three initially, four on round 5, five on round 9 if later levels use it.
- All four worker roles are available immediately from round 1.
- Existing fighter unlock timing remains unchanged.
- Every eligible fighter or worker role has equal weight in the random pool.
- There is no guaranteed worker slot and no guaranteed fighter slot.
- A roll may contain all fighters, all workers, or any mixture.
- Worker types have equal odds relative to each other.

### Refresh and Save

- Refresh still costs one gold.
- One refresh rerolls every unsaved card in the shared shop.
- Save works identically for fighters and workers.
- Saved cards survive manual refresh and the next round’s automatic shop rebuild.
- Buying a saved card clears its saved state and marks it sold.

### Shared price

- Fighters and workers both cost three gold initially.
- Balance may change later, but separate worker pricing is not part of the first implementation.

## 4. All shop purchases use drag-to-buy

Clicking a shop card must never auto-add a cat anywhere.

### Pointer flow

1. Pointer-down records the shop card as an unpurchased drag source.
2. Crossing the existing movement threshold lifts a custom drag ghost.
3. Valid destinations highlight according to cat type.
4. Gold is charged and the shop card is marked sold only after a valid drop resolves.
5. An invalid drop returns the ghost to the shop with no state mutation.

### Fighter destinations

A fighter shop card may be dropped onto:

- An empty fighter bench slot.
- An empty legal battlefield cat-territory cell.
- A compatible same-coat, same-level fighter on the bench or battlefield for direct purchase-and-merge.

### Worker destinations

A worker shop card may be dropped onto:

- An empty production-cat slot.
- A compatible same-role, same-level worker for direct purchase-and-merge.

Workers cannot be placed on the battlefield. Fighters cannot be placed in production slots.

### Click and keyboard behavior

- A normal pointer click may show/select the card for information, but it must not complete a purchase.
- Pointer users purchase by dragging.
- Keyboard accessibility may use Enter/Space to enter explicit placement mode and Enter on a valid destination to complete the equivalent operation. This is an accessibility fallback, not auto-add.

## 5. Production Yard layout

Keep the separate production grid from the original design. The panel may be named **Production Yard**, **Workshop**, or another final art-direction label; this plan uses Production Yard.

There are six production-cat slots arranged as three columns × two worker rows. Every worker has a paired station outside its row, producing a four-row × three-column presentation:

```text
Row 1: station/output for top worker row
Row 2: top worker cats
Row 3: bottom worker cats
Row 4: station/output for bottom worker row
```

Slot mapping is fixed:

- Worker slots 0–2 occupy row 2 and use stations directly above them in row 1.
- Worker slots 3–5 occupy row 3 and use stations directly below them in row 4.

The nine-slot item inventory sits immediately beneath the Production Yard so food remains visible and reachable during combat.

### Desktop placement

Use a three-column desktop shell:

```text
[ Production Yard + Inventory ] [ Battlefield ] [ Existing HUD/Shop/Bench ]
```

Do not add the Production Yard inside the existing right control panel; that panel is already vertically constrained and scrollable.

### Responsive behavior

- Wide desktop: all three columns remain visible.
- Medium laptop width: Production Yard may compact or collapse its worker details, but the 3×3 inventory remains directly reachable during combat.
- Narrow/mobile: stack battlefield, inventory, Production Yard, and controls in a deliberate order.
- The full 14-row battlefield must remain visible during active combat where practical.

## 6. Worker roles and production

All workers cost three gold, are available immediately, and merge to level 3.

### Calico Cook

- Visual identity: calico worker, straw hat, apron, spoon, produce basket.
- Station: campfire with hanging cooking pot.
- Output after each completed battle:
  - Level 1: 1 food
  - Level 2: 2 food
  - Level 3: 4 food
- Every food heals 2 HP.
- Food is one shared inventory item identity regardless of cook level.

### Tuxedo Trader

- Visual identity: black-and-white worker, waistcoat, small merchant hat, coin purse.
- Station: merchant wagon or market stall.
- Output after each completed battle:
  - Level 1: 1 coin
  - Level 2: 2 coins
  - Level 3: 3 coins
- Coins require manual collection during preparation.
- Coins never occupy inventory slots.

### Ginger Weaponsmith

- Visual identity: ginger worker, leather apron, hammer, weapon strapped to back.
- Station: grindstone, small forge, and weapon rack.
- Output after each completed battle:
  - Level 1: one tier-1 weapon
  - Level 2: one tier-2 weapon
  - Level 3: one tier-3 weapon
- Weapon bonuses:
  - Tier 1: +1 attack
  - Tier 2: +2 attack
  - Tier 3: +3 attack

### Silver Armourer

- Visual identity: silver worker, goggles, heavy gloves, metalworking tools.
- Station: anvil, forge, and armour stand.
- Output after each completed battle:
  - Level 1: one tier-1 armour
  - Level 2: one tier-2 armour
  - Level 3: one tier-3 armour

Initial armour contract:

| Tier | Damage blocked per enemy hit | Durability in hits |
|---|---:|---:|
| 1 | 2 | 2 |
| 2 | 3 | 3 |
| 3 | 4 | 4 |

A successful enemy bite/swipe consumes one durability use. When durability reaches zero after resolving that hit, the armour breaks and disappears permanently.

### Armour balance proposal for review

Use a minimum of 1 HP damage for any successful enemy hit. Effective damage is:

```text
max(1, enemy attack - armour block)
```

Examples:

- Attack 3 against block 2 deals 1 HP damage and consumes one armour use.
- Attack 6 against block 3 deals 3 HP damage and consumes one armour use.
- Attack 3 against block 4 still deals 1 HP damage and consumes one armour use.

This minimum prevents tier-2/3 armour from completely nullifying early dogs for several consecutive hits. It is a balance proposal, not an explicitly confirmed rule, and should be highlighted to the second reviewer.

A separate higher-tier Armourer role is an expansion possibility, not part of the first build. The first implementation uses one Armourer whose level controls both block strength and durability.

## 7. Worker merging

Workers follow the existing three-copy evolution model:

- Same role and same level only.
- First merge creates a two-copy stack.
- Third copy promotes it to the next level.
- Three level-1 copies produce one level-2 worker.
- Three level-2 copies produce one level-3 worker.
- Level 3 is the maximum.
- The surviving target worker keeps its stable ID and slot.
- Cross-role and cross-level merges are rejected.

### Worker movement

- Workers may move between empty production slots during preparation.
- Moving a worker moves its station identity and uncollected pending output with it.
- Worker movement is disabled during combat.

### Pending output during merges

- Pending output from compatible workers combines on the surviving target worker.
- A promotion does not immediately generate extra production.
- The promoted worker’s new production rate applies after the next completed battle.
- No pending output may be duplicated by merge ordering.

### Worker removal

The first implementation does not include a Dismiss or refund action. Production slots are freed through merging. This is a deliberate scope choice but a meaningful soft-lock risk: six mismatched workers could fill all production slots. The second reviewer should specifically evaluate whether a two-step no-refund Dismiss action is necessary.

## 8. Production timing and expiration

The production lifecycle is:

1. A worker is purchased and placed during preparation.
2. It produces nothing immediately.
3. The player completes the following battle.
4. On transition into the next preparation phase, each placed worker generates output according to its current level.
5. Food/equipment appear on the paired station. Coins appear as a coin pile on the merchant station.
6. The player may collect output during that preparation phase.
7. Starting the next battle does not immediately erase uncollected output.
8. When that battle ends and the next production cycle occurs, any still-uncollected old output is replaced by the new output.

Output does not accumulate across production cycles unless it was collected into inventory. Pending output follows its worker when moved and combines fairly when workers merge.

No production occurs on:

- Purchase.
- Placement.
- Manual refresh.
- Combat start.
- Failed or invalid round transitions.
- Game-over transitions that do not return to preparation.

## 9. Inventory

The item inventory is a persistent 3×3 grid with nine distinct stack slots.

### Stacking

- Identical items stack with no quantity limit.
- Food always stacks with food.
- Weapons stack only with the same weapon tier.
- Armour stacks only with the same armour tier and full durability.
- The nine-slot limit constrains distinct item kinds/tiers, not raw quantity.

### Collection

- Clicking pending food or equipment collects the full pending stack.
- The system first looks for a compatible existing inventory stack.
- If no stack exists, it uses the first empty inventory slot.
- If all nine slots contain incompatible items, collection fails safely and output remains on the station.
- Rapid clicking cannot collect the same output twice.
- Inventory persists across rounds and never expires.

### Merchant collection

- Merchant coins can only be collected during preparation.
- Clicking the coin pile starts the collection microinteraction.
- Coins never enter the inventory.
- Uncollected coins expire at the next production cycle like other station output.

## 10. Coin collection microinteraction

Coin collection should feel materially different from an automatic counter increment:

1. Merchant station compresses/bounces as the pile is collected.
2. The displayed amount splits into a short stagger of coin sprites.
3. Coins arc from the merchant station to the Gold HUD chip.
4. The HUD gold value counts upward in sync with arrivals.
5. Each arrival has a light coin tick.
6. The final arrival has a stronger chime and HUD pulse.
7. Level-3 output gets a slightly richer final effect without becoming slow.
8. Reduced-motion mode uses a short fade/count transition.

The state transition must be single-commit and double-click safe. Either reserve/lock output before animation and guarantee completion, or commit first and make animation purely presentational. Do not leave authoritative gold dependent on an animation promise that can be interrupted.

## 11. Battlefield equipment

Each fighter has:

- One weapon slot.
- One armour slot.

### Weapons

- Add +1/+2/+3 attack by tier.
- Have no durability.
- Remain equipped between battles.
- Remain attached when the fighter moves between battlefield and bench.
- Are destroyed when replaced.
- Are destroyed when the fighter dies.

### Armour

- Reduces every successful enemy bite/swipe by its block value.
- Uses finite hit durability: 2/3/4 hits for tiers 1/2/3.
- Decrements once per enemy damage event.
- Breaks permanently after the hit that consumes its last use.
- Remains attached when the fighter moves to the bench.
- Is destroyed when replaced.
- Is destroyed when the fighter dies.

### Separate armour display

Armour is not extra HP. Render a distinct armour/durability bar or segmented meter separate from the HP bar.

Recommended display:

- Armour icon plus current/maximum hit uses.
- Segmented bar with 2, 3, or 4 segments according to tier.
- One segment breaks on each enemy hit.
- Final segment shatters when armour breaks.
- Tooltip shows `BLOCK N · HITS X/Y`.

### Equipment use timing

- Weapons and armour may be equipped during preparation.
- They may also be equipped while combat is manually paused.
- They may not be equipped during running combat.
- Equipping consumes one item from inventory.
- Dropping onto an occupied slot destroys old equipment and equips the new item.
- Replacement should require a clear valid-target highlight and replacement warning in the tooltip/status message, but not a second confirmation because it is a frequent tactical action.

### Fighter merging with equipment

Follow the Super Auto Pets target-survival rule:

- The fighter being dragged is the consumed source.
- The fighter it is dragged onto is the surviving target.
- The target fighter’s equipment stays.
- The source fighter’s equipment is destroyed.
- The target’s stable ID and board/bench location stay.
- After promotion, base coat/level stats are recalculated and target equipment bonuses are reapplied.

This applies to shop-to-fighter direct merges and owned-fighter merges.

## 12. Food healing

- Every food heals 2 HP.
- Food targets a living battlefield fighter.
- It cannot target a full-health or dead fighter.
- Invalid/full-health drops consume nothing.
- Healing is clamped to maximum HP.
- Food can be used during running combat in true real time.
- Combat does not automatically slow while food is being dragged.
- The player may manually pause if desired.
- Food can also be used while combat is paused.
- Ordinary preparation-phase food use is disabled because surviving fighters currently heal to full between rounds.

### Food interaction

1. Drag food from its inventory stack.
2. Valid damaged fighters highlight.
3. Drop on a valid fighter.
4. Consume one food immediately and atomically.
5. Animate food travelling to the fighter.
6. Show a quick eating reaction, green `+2 HP`, and HP-bar increase.
7. Decrement/remove the inventory stack.

A user releasing food before a lethal enemy impact commits may save the fighter. A food drop after the fighter has died must fail and consume nothing.

## 13. Pause and speed

Add a real Pause control separate from the existing 1×/2× speed control.

- Pause freezes combat advancement and active combat animation progress.
- Resume continues from the same visual and logical point.
- Food remains usable while paused.
- Equipment becomes usable while paused.
- Speed remains independently selectable at 1× or 2×.
- Restart, victory, and game over must cancel any pending pause promises and interaction locks.
- Pausing during a projectile or bite windup must not duplicate or skip its impact.

## 14. Calico fighter redesign

The Calico remains one of the six battlefield fighter coats but loses all self-healing. Food and Cook production fully own the healing mechanic.

### Proposed support ability: Marking Yarn

This ability remains a proposal requiring final approval or second-opinion feedback:

- Calico fires its existing homing yarn projectile.
- The hit deals Calico’s normal attack damage.
- It applies a visible yarn mark to the dog.
- The next damaging hit from another fighter receives +1 damage.
- The mark is then consumed.
- Calico cannot trigger its own newly applied mark on the same attack.
- A missed yarn shot applies no mark.
- A mark disappears when its dog dies.
- Only one mark may exist per dog; repeated Calico hits refresh rather than stack it.

All Medic names, cross symbols, self-heal events, heal animation coupling, tooltip text, and legend copy must be removed or replaced.

---

# Part B — Technical Architecture

## 15. State model

Extend authoritative game state with:

### Shared shop cards

Each card needs:

- Stable ID.
- Category: fighter or worker.
- Fighter coat or worker role.
- Level, initially 1.
- Saved state.
- Sold state.

The renderer derives card stats and valid destination types from category.

### Workers

Each worker needs:

- Stable ID.
- Role.
- Level.
- Copy count.
- Production slot index 0–5.
- Optional pending output record.

### Pending output

Each pending output needs:

- Kind: food, coins, weapon, armour.
- Tier where applicable.
- Quantity.
- Production cycle/round identifier for debugging and duplicate prevention.

### Inventory

Each stack needs:

- Stable ID.
- Kind.
- Tier where applicable.
- Quantity.
- Full/default durability for armour inventory items.

### Fighter equipment

Each fighter needs:

- Weapon descriptor or null.
- Armour descriptor or null.
- Armour current uses and max uses.

Do not mutate attack ad hoc. Keep base coat/level attack separate from effective attack after weapon bonuses. Armour affects incoming damage resolution, not maximum HP.

### Combat intents

A combat intent describes a not-yet-committed action:

- Acting unit ID.
- Target ID if one exists.
- Visual source/target positions.
- Attack style.
- Base damage or damage formula inputs.
- Any support/status intent.

The controller animates the intent. The engine commits it against the latest authoritative state at impact, allowing food used during travel to remain valid and preventing stale section results.

## 16. Rules module boundaries

Recommended organization:

- Keep existing broad game lifecycle and combat rules in `src/game-engine.js`.
- Add `src/production-rules.js` for worker definitions, worker shop generation, production cycles, inventory stacking, collection, equipment definitions, and pure item transitions.
- Add `src/combat-controller.js` for a DOM-independent pause gate and ordered intent/impact orchestration helpers.
- Keep DOM rendering and browser animations in `src/app.js`.
- Keep art renderers in `src/pixel-art.js`.
- Extend typed drag/drop routing in `src/drag-drop.js` rather than creating category-specific DOM mutation branches.

Every transition must return new state or otherwise follow the project’s existing immutable-copy convention. Nested equipment, pending output, worker shop, workers, and inventory must be deep-cloned.

## 17. Combat refactor

The existing `resolveSection()` resolves all cats and dogs before animation. Replace or wrap it with ordered intent generation and impact commits.

### Required order preservation

Without player intervention, the new stepwise controller must produce the same outcomes as current combat:

1. Fighters act in current fighter order.
2. Fighter targeting sees deaths caused by earlier fighter attacks where the current rules do.
3. Dogs are filtered/updated appropriately.
4. Front dogs act before rear dogs.
5. Dog bites occur instead of movement when blocked.
6. Dog movement, breach, life loss, Super Cat, victory, and final-wave behavior remain unchanged.

### Intent/impact lifecycle

For each combat action:

1. Engine creates an intent from current authoritative state.
2. Controller starts the corresponding visual animation.
3. Pause may suspend visual progress and future intents.
4. Food may mutate current HP during running or paused combat.
5. At visual impact, engine validates source/target still exist and commits damage/status against current state.
6. Armour reduction and durability apply at this commit.
7. UI renders impact, HP change, armour segment loss/break, death, or miss.
8. Controller proceeds to the next intent.

### Race rules

- Food committed before lethal impact affects the latest HP and can save the fighter.
- Food released after death fails.
- If a target disappears before an attack impact due to another committed effect, the intent resolves according to existing retarget/miss semantics for that attack type.
- Equipment added while paused before a pending dog impact may protect against that impact. This is a tactical consequence of allowing paused equipment and must be tested explicitly.
- One inventory item cannot be reserved by two simultaneous drags.

---

# Part C — Implementation Work Plan

## 18. Task 1: Add failing production-contract tests

**Files:**

- Create `tests/production.test.js`.
- Read `src/game-engine.js` and `src/drag-drop.js`.

**Tests to add before implementation:**

- Initial game has empty workers and inventory.
- Shared shop may contain fighters and workers.
- All workers are eligible on round 1.
- Eligible cards are equally weighted under deterministic random inputs.
- Shop remains fully random with no guaranteed category.
- Save/refresh behavior works for both categories.
- One refresh charges one gold exactly once.
- Invalid drag purchases charge nothing and preserve shop state.

Run `npm test` and verify the new tests fail only because APIs/state do not yet exist.

## 19. Task 2: Define worker, item, weapon, and armour data

**Files:**

- Create `src/production-rules.js`.
- Modify `tests/production.test.js`.

**Implement data-driven definitions for:**

- Four worker roles.
- Worker output at levels 1–3.
- Shared worker cost.
- Food heal value.
- Weapon attack bonuses.
- Armour block and hit durability.
- Worker/station/item labels and tooltip descriptions.
- Normalization helpers that reject unknown role/item IDs safely.

No DOM code in this task.

## 20. Task 3: Extend game creation and cloning

**Files:**

- Modify `src/game-engine.js` around `createGame()` and `copy()`.
- Modify `tests/production.test.js`.

**Requirements:**

- Add workers, inventory, and mixed shop-card category state.
- Deep-clone pending output, inventory stacks, and equipment.
- Prove old state cannot be mutated through returned nested references.
- Preserve injected randomness.
- Preserve all existing fighter-shop progression tests after adapting shop-card shape.

## 21. Task 4: Convert the shop to one mixed random pool

**Files:**

- Modify `src/game-engine.js` shop generation, refresh, save, and buy helpers.
- Modify `src/production-rules.js`.
- Modify `tests/game-engine.test.js` and `tests/production.test.js`.

**Requirements:**

- Build the eligible pool from currently unlocked fighters plus all four workers.
- Give each eligible card equal selection weight.
- Preserve current shop slot-count schedule.
- Preserve saved cards at the same slot index.
- Reroll every unsaved slot with one refresh.
- Keep sold/saved behavior category-neutral.
- Update shop messages from fighter-only language to cat language.

## 22. Task 5: Generalize drag/drop descriptors before wiring UI

**Files:**

- Modify `src/drag-drop.js`.
- Modify `tests/ui-state.test.js`.

**Add typed source descriptors for:**

- Owned bench fighter.
- Owned battlefield fighter.
- Owned worker.
- Unpurchased fighter shop card.
- Unpurchased worker shop card.
- Food inventory stack.
- Weapon inventory stack.
- Armour inventory stack.

**Add typed targets for:**

- Battlefield cell.
- Fighter bench slot.
- Fighter merge target.
- Production worker slot.
- Worker merge target.
- Battlefield fighter item target.

Pure routing must determine `purchase-place`, `purchase-merge`, `move`, `return`, `merge`, `use-food`, `equip`, or `invalid` before any DOM or game-state mutation.

## 23. Task 6: Implement atomic drag-to-buy transitions

**Files:**

- Modify `src/game-engine.js`.
- Modify `src/production-rules.js`.
- Modify `tests/production.test.js` and `tests/game-engine.test.js`.

**Requirements:**

- Validate phase, card state, price, source category, target category, occupancy, merge compatibility, and level cap.
- Charge three gold only after all validation succeeds.
- Mark sold and clear saved only on success.
- Support fighter placement directly onto legal battlefield cells.
- Support fighter placement into empty bench slots.
- Support fighter direct purchase-and-merge.
- Support worker placement and direct purchase-and-merge.
- Preserve current explicit selection after failure.
- Clear purchase placement state after success, refresh, phase change, restart, or Escape.

## 24. Task 7: Add worker movement and evolution

**Files:**

- Modify `src/production-rules.js` and `src/game-engine.js`.
- Modify `tests/production.test.js`.

**Requirements:**

- Move workers between empty production slots during preparation.
- Merge same-role/same-level workers only.
- Preserve target ID and slot.
- Promote on the third copy.
- Reject level-3 promotion attempts.
- Move pending output with workers.
- Combine pending output during compatible merges without duplication.
- Reuse existing stack/level-up semantic events for presentation.

## 25. Task 8: Generate production on valid round completion

**Files:**

- Modify `src/game-engine.js` around `finishRound()`.
- Modify `src/production-rules.js`.
- Modify `tests/production.test.js` and existing round tests.

**Requirements:**

- Replace old pending output at each completed battle-to-prep transition.
- Generate output from every placed worker’s current level.
- Emit semantic production-ready events.
- Do not generate at purchase or combat start.
- Do not alter merchant gold until collection.
- Preserve fresh ten-gold prep reset.
- Preserve existing surviving-fighter between-round healing.
- Ensure final-wave victory/game-over transitions do not accidentally produce an inaccessible extra cycle.

## 26. Task 9: Implement inventory stacking and collection

**Files:**

- Modify `src/production-rules.js` and `src/game-engine.js`.
- Modify `tests/production.test.js`.

**Requirements:**

- Nine distinct stack slots.
- Unlimited quantity per compatible stack.
- Exact tier matching for weapons and armour.
- Food shared across all cook levels.
- Collect into compatible stack before allocating empty slot.
- Leave output untouched on full incompatible inventory.
- Collect entire pending stack atomically.
- Lock against duplicate rapid collection.
- Persist inventory through every round transition.

## 27. Task 10: Implement merchant collection

**Files:**

- Modify `src/production-rules.js`, `src/game-engine.js`, and later `src/app.js`.
- Modify `tests/production.test.js`.

**Requirements:**

- Preparation phase only.
- Increment gold by exact pending quantity.
- Clear pending output exactly once.
- Never consume inventory capacity.
- Preserve output if collection validation fails.
- Expose enough before/after data for synchronized count-up animation.

## 28. Task 11: Add equipment state and effective stat recomputation

**Files:**

- Modify `src/game-engine.js` around `createCat()`, level stat application, merge logic, and death filtering.
- Modify `src/production-rules.js`.
- Modify `tests/production.test.js` and `tests/game-engine.test.js`.

**Requirements:**

- Store base attack separately from weapon bonus.
- Recompute effective attack after level changes and merges.
- Equip one weapon and one armour only.
- Consume one inventory item on equip.
- Destroy replaced equipment.
- Preserve target equipment and destroy source equipment on merge.
- Preserve equipment between battlefield and bench.
- Destroy both items on death.
- Prevent dead or missing targets from accepting equipment.

## 29. Task 12: Add armour reduction, durability, and breakage

**Files:**

- Modify dog damage resolution in `src/game-engine.js`.
- Modify `src/production-rules.js`.
- Modify `tests/production.test.js` and combat regression tests.

**Tests must cover:**

- Block 2/3/4 by tier.
- Durability 2/3/4 enemy hits by tier.
- One durability decrement per successful enemy hit.
- Proposed minimum-one-damage rule.
- Damage larger than block.
- Attack equal to or lower than block.
- Final durability use still protects against its triggering hit.
- Armour disappears after that hit.
- Multiple dogs hitting one fighter in order.
- Armour replacement resetting durability.
- Bench movement preserving durability.
- Merge target preserving current durability rather than refilling it.
- Source armour destruction on merge.
- Death destroying remaining armour.

Emit semantic `armour-hit` and `armour-break` events for presentation.

## 30. Task 13: Add food healing rules

**Files:**

- Modify `src/production-rules.js` and `src/game-engine.js`.
- Modify `tests/production.test.js`.

**Requirements:**

- Heal exactly 2 HP, clamped to maximum.
- Running-combat and paused-combat validity.
- Reject full-health/dead/missing targets without consumption.
- Consume one item atomically.
- Remove zero-quantity stacks.
- Emit item-heal event with before/after HP.
- Handle rapid repeated uses safely.

## 31. Task 14: Replace Calico healing with support behavior

**Files:**

- Modify `src/game-engine.js` Calico metadata and ability branch.
- Modify `src/pixel-art.js` Calico markers.
- Modify `src/app.js` legend/projectile copy.
- Modify Calico tests in `tests/game-engine.test.js` and `tests/ui-state.test.js`.

**Requirements if Marking Yarn is approved:**

- Remove every self-heal mutation/event.
- Add non-stacking mark state to dogs.
- Consume mark on the next damaging hit from another fighter.
- Add +1 damage once.
- Clean marks on death and appropriate round cleanup.
- Replace medic cross with yarn/support art.
- Keep food healing visuals semantically separate.

Do not implement Marking Yarn until it is approved or replaced after second-opinion review.

## 32. Task 15: Add Production Yard and inventory markup/layout

**Files:**

- Modify `index.html` main shell.
- Modify `styles.css` desktop and responsive layouts.

**Requirements:**

- New left Production Yard panel.
- Exact four-row × three-column visual structure.
- Six accessible worker slots.
- Six paired stations derived from slot location.
- 3×3 inventory with occupied count.
- Three-column desktop layout.
- Medium/narrow responsive behavior.
- No battlefield geometry regression.
- No important right-panel control hidden by the new layout.

## 33. Task 16: Render the mixed shop and drag-to-buy UX

**Files:**

- Modify `src/app.js` shop rendering and pointer handlers.
- Modify `src/ui-state.js` availability helpers.
- Modify `styles.css` shop card styles.
- Modify `tests/ui-state.test.js`.

**Requirements:**

- Fighter cards show HP/attack and combat role.
- Worker cards show production role and level-1 output.
- Shared Save UI.
- No click-to-auto-buy.
- Custom shop drag ghost redraws sprite correctly.
- Valid destination highlights depend on category.
- Gold/bench/production-full errors remain legible without greying out card identity.
- Invalid drops animate back without state change.
- Successful drops animate to destination before mutation/render removal where practical.

## 34. Task 17: Add worker, station, output, and item pixel art

**Files:**

- Modify `src/pixel-art.js`.
- Modify `src/app.js` render helpers.
- Modify `styles.css`.
- Modify `tests/ui-state.test.js` marker contracts.

**Art deliverables:**

- Four worker silhouettes with role-specific clothing/tools.
- Cooking station.
- Merchant wagon/stall.
- Weaponsmith grindstone/rack.
- Armourer anvil/armour stand.
- Food icon.
- Coin pile.
- Three weapon tiers.
- Three armour tiers.
- Worker level and copy indicators.
- Pending-output quantity badges.

Verify every role at actual in-game scale and enlarged comparison scale.

## 35. Task 18: Add collection microinteractions and sound

**Files:**

- Modify `src/app.js`, `styles.css`, and `src/sound.js`.
- Modify `tests/ui-state.test.js` for timing/cleanup contracts.

**Food/equipment collection:**

- Lift from station.
- Arc into resolved inventory slot.
- Restrained landing squash.
- Quantity badge increment.
- Inventory frame pulse.

**Coin collection:**

- Staggered coin sprites.
- Curved station-to-HUD path.
- Synchronized gold count-up.
- Arrival ticks and final chime.
- Reduced-motion fallback.

All transient DOM nodes, locks, and classes must clean up after success, cancellation, restart, and reduced-motion paths.

## 36. Task 19: Build pause gate and stepwise combat controller

**Files:**

- Create `src/combat-controller.js`.
- Create `tests/combat-controller.test.js`.
- Modify `src/app.js` combat loop.
- Modify `src/game-engine.js` combat stepping as narrowly as possible.
- Modify HUD markup/styles for Pause.

**Requirements:**

- DOM-independent pause/resume/cancel behavior.
- Ordered intent generation.
- State commit at animation impact.
- Existing no-intervention combat outcome parity.
- True real-time food commands.
- Equipment allowed only while paused/prep.
- Speed independent of pause.
- Restart/game end safely cancel pending waits.
- No duplicated impacts after repeated pause/resume.

## 37. Task 20: Add battlefield item-use presentation

**Files:**

- Modify `src/app.js`, `src/pixel-art.js`, and `styles.css`.
- Modify `tests/ui-state.test.js`.

**Requirements:**

- Food drag ghost and valid damaged-target highlights.
- Food-to-cat arc, eating beat, `+2 HP`, HP-bar update.
- Weapon and armour inventory drag ghosts.
- Prep/paused valid-target highlighting.
- Weapon and armour overlays/badges on fighters.
- Separate segmented armour bar.
- Armour segment loss on every bite.
- Armour break/shatter effect after final protected hit.
- Replacement destroys/fades old gear before new gear settles.
- Death removes all equipment presentation.

## 38. Task 21: Update instructions, tooltips, legend, and README

**Files:**

- Modify `index.html`, `src/app.js`, `README.md`, and relevant styles.

**Copy must explain:**

- Mixed random shop.
- Drag-to-buy for every cat.
- Fighter vs worker destinations.
- Three-copy worker evolution.
- Production timing and expiration.
- Nine distinct inventory stacks with unlimited quantities.
- Coin collection.
- Food live use.
- Pause and equipment timing.
- Weapon permanence.
- Armour block/durability/breakage.
- Target equipment survival on merge.
- Updated non-healing Calico support role.

Add accessible labels for every source, target, pending output, inventory quantity, equipment slot, HP bar, and armour durability state.

## 39. Task 22: Automated verification

Run and require success from:

```text
npm test
npm run build
```

Add or update tests for:

- Mixed shop probability boundaries under deterministic random values.
- Save/refresh across fighter and worker cards.
- Drag-to-buy atomicity.
- Fighter direct battlefield/bench placement.
- Shop-to-owned merge rules.
- Worker placement, movement, pending output, and evolution.
- Production timing and expiration.
- Unlimited stack quantities and nine distinct slots.
- Inventory-full safe failure.
- Coin single-collection behavior.
- Weapon equipment/replacement/death/merge.
- Armour blocking, uses, breakage, replacement, death, and merge.
- Food live healing and invalid targets.
- Pause/resume/cancel races.
- Stepwise combat parity without intervention.
- Calico’s final approved support mechanic.
- Reduced-motion transient cleanup.

## 40. Task 23: Real browser verification

Exercise a complete game flow in a running browser:

1. Observe rolls containing only fighters, only workers, and mixtures under controlled randomness.
2. Save one fighter and one worker through refresh/round transition.
3. Drag a fighter shop card directly to battlefield and bench.
4. Drag a fighter shop card directly onto a compatible fighter merge target.
5. Drag each worker role to all six production positions.
6. Reposition and merge workers to levels 2 and 3.
7. Complete battles and confirm production occurs only at valid boundaries.
8. Leave output uncollected and confirm replacement next cycle.
9. Fill nine distinct inventory slots and confirm safe overflow behavior.
10. Build unlimited compatible stack quantity.
11. Collect trader coins and verify animation count matches authoritative gold.
12. Equip and replace weapons.
13. Equip each armour tier; verify separate durability display and exact hit counts.
14. Merge equipped fighters in both drag directions and verify target gear survives.
15. Return equipped fighters to bench and back.
16. Use food during live projectile/bite timing without auto-slowdown.
17. Pause during combat, equip gear, resume, and verify one impact only.
18. Break armour and verify it disappears after protecting against its final hit.
19. Kill a geared fighter and verify both equipment items are destroyed.
20. Verify Calico has no self-heal.
21. Complete the existing seven-round game.
22. Inspect browser console throughout.

## 41. Responsive and visual verification

Inspect at minimum:

- Wide desktop three-column layout.
- Typical laptop viewport.
- Narrow desktop/Electron window.
- Mobile-width stacked layout.
- Reduced-motion mode.

Verify:

- Full combat board remains readable.
- Inventory is reachable throughout combat.
- No horizontal clipping.
- Production/output quantities remain legible.
- Shop cards do not become unreadably small when mixing categories.
- HP and armour bars are visually distinct.
- Drag targets remain inside viewport or scroll safely before hit-testing.
- Production microinteractions do not compete with combat impact effects.

---

# Part D — Files Expected to Change

## Existing files

- `index.html`
- `styles.css`
- `src/game-engine.js`
- `src/app.js`
- `src/pixel-art.js`
- `src/drag-drop.js`
- `src/ui-state.js`
- `src/sound.js`
- `tests/game-engine.test.js`
- `tests/ui-state.test.js`
- `README.md`

## New files

- `src/production-rules.js`
- `src/combat-controller.js`
- `tests/production.test.js`
- `tests/combat-controller.test.js`

Avoid adding dependencies unless browser or test limitations prove they are necessary. The feature should remain compatible with the current static/Vite build.

---

# Part E — Main Risks and Second-Opinion Questions

## 42. Mixed-shop dilution

Because there is no category guarantee, early rolls can contain no fighters or no workers. With three fighters plus four workers eligible on round 1, workers occupy a large portion of the initial pool. Review whether equal weight across every eligible role creates too much variance or prevents reliable team building.

## 43. Armour strength

Tier-3 armour blocks up to four damage for four hits, potentially preventing sixteen damage before the minimum-one-damage rule. Review:

- Whether 2/3/4 block and 2/3/4 hits are too strong.
- Whether minimum 1 HP damage is the right guardrail.
- Whether durability should decrement on every hit or only when it blocks at least one damage.
- Whether higher block and higher durability on the same worker progression double-scales too aggressively.
- Whether a future separate heavy-armour worker should be deferred until after playtesting.

## 44. No worker dismissal

Six mismatched workers can fill the Production Yard. Review whether merging alone is sufficient or whether a no-refund, two-step Dismiss action is required to prevent a frustrating permanent board lock.

## 45. True real-time food complexity

The intent/impact combat refactor is materially larger than the production UI. Review whether commit-at-impact is necessary and sufficient, especially for:

- Food during bite windup.
- Equipment added while paused during a pending bite.
- Cat death and item drops racing at impact.
- Burst attacks and retargeting.
- Armour durability events.
- Restart while paused or dragging.

Do not accept a simpler implementation that precomputes a whole section and later overwrites healing.

## 46. Inventory pressure

Unlimited food quantity in one slot makes slot pressure primarily about holding multiple weapon/armour tiers. Review whether that creates enough meaningful inventory decisions or whether equipment tiers should consolidate when stronger versions arrive.

## 47. Worker economy snowball

Trader output is additive on top of the game’s fresh ten-gold reset. Review whether 1/2/3 coins per battle pays back too quickly, especially when all workers are available from round 1.

## 48. Calico support ability

Marking Yarn is not yet locked. Review whether +1 on the next allied hit is readable and balanced with the Orange Tabby’s burst, Black Bombardier splash, and Prism piercing attacks. Specify whether one pellet, one splash target, or an entire multi-hit action should consume the mark.

---

# Part F — Definition of Done

The feature is complete only when a player can:

- Encounter fighters and all four worker roles randomly in one shared shop.
- Save and refresh any card under the existing economy.
- Drag every shop cat to a valid destination without auto-buy on click.
- Place fighters directly on battlefield or bench.
- Place workers in the separate six-slot Production Yard.
- Direct-purchase and merge compatible fighters/workers.
- Move and evolve workers through level 3.
- Complete a battle and receive correctly timed production.
- Collect expiring station output into persistent unlimited stacks across nine distinct slots.
- Collect merchant coins through a synchronized station-to-HUD interaction.
- Equip, replace, preserve, and destroy weapons according to the agreed rules.
- Use finite armour that blocks damage, loses one hit use, displays separate durability, and breaks permanently.
- Merge fighters with target equipment surviving exactly like Super Auto Pets.
- Heal damaged fighters with food during true real-time combat.
- Pause, equip items, and resume without skipped or duplicated combat.
- Play the existing seven-round level without regression.
- Pass all automated tests and production build.
- Pass real-browser functional, console, accessibility, responsive, normal-motion, and reduced-motion verification.
