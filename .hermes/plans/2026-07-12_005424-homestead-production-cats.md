# Homestead Production Cats Implementation Plan

> **For Hermes:** Implement this plan task-by-task with tests first. Do not commit, push, or deploy unless Joe separately asks.

**Goal:** Add a separate six-slot worker-cat system that produces collectible food, coins, weapons, and armour between battles, plus a nine-slot persistent inventory and live food/equipment interactions.

**Architecture:** Keep the deterministic game state authoritative in the rules layer. Add pure production/inventory/equipment transitions alongside the existing combat rules, render a new always-visible Homestead column to the left of the battlefield, and refactor combat timing enough that pause and live food use cannot be overwritten by a precomputed combat result. Reuse existing stable IDs, same-role/level merge rules, custom pointer interactions, and upgrade reveals.

**Tech Stack:** Static HTML, CSS, JavaScript ES modules, Canvas pixel art, Pointer Events, Web Animations API, Web Audio, Node’s built-in test runner, Vite.

---

## Locked product decisions

1. The existing shop gains **Fighters** and **Workers** tabs.
2. One paid refresh rerolls every unsaved offering in both sets together.
3. A worker-shop card is selected first; gold is charged and the card is marked sold only after a valid placement or compatible direct merge in the Homestead.
4. There are six worker slots in a 3-column × 2-row grid.
5. Each top-row worker owns the station above it; each bottom-row worker owns the station below it, creating a 3-column × 4-row visual block.
6. Workers merge only with the same role and level: three copies promote to level 2, then three level-2 copies promote to level 3. Level 3 is the maximum.
7. The persistent item inventory has nine slots in a 3×3 grid.
8. Identical items stack. Food uses one shared item identity; weapons and armour stack only when kind and tier match.
9. Battlefield cats have one weapon slot and one armour slot.
10. Dropping new equipment onto an occupied equipment slot destroys and replaces the old equipment.
11. Equipment is destroyed when its cat dies.
12. Food restores 2 HP, cannot target a full-health cat, and can be used during live combat.
13. Weapons and armour can be equipped during preparation or while combat is manually paused.
14. Coins require collection from the merchant station and receive a satisfying station-to-HUD microinteraction; they do not occupy inventory.
15. Uncollected station output expires when the next production cycle replaces it. Collected inventory never expires.
16. The Calico remains one of the six combat coats but loses self-healing and becomes a non-healing support attacker.

## Initial balance constants

| Worker | Level 1 | Level 2 | Level 3 | Output behavior |
|---|---:|---:|---:|---|
| Calico Cook | 1 food | 2 food | 4 food | Each food heals 2 HP |
| Tuxedo Trader | 1 coin | 2 coins | 3 coins | Collected directly into gold |
| Ginger Weaponsmith | 1 tier-1 weapon | 1 tier-2 weapon | 1 tier-3 weapon | +1/+2/+3 attack |
| Silver Armourer | 1 tier-1 armour | 1 tier-2 armour | 1 tier-3 armour | +2/+4/+6 maximum HP |

All four worker roles are available from round 1 and cost 3 gold unless playtesting shows that early merchant snowballing requires an unlock or production adjustment.

## Explicit default rules to confirm during implementation kickoff

These are reasonable defaults but were not explicitly decided:

- Worker shop has three offerings at all rounds; fighter shop retains its current 3→4→5 schedule.
- Saving works independently per offering in both tabs; refresh rerolls unsaved fighter and worker slots together for one gold.
- A worker’s pending output follows that worker when repositioned. When compatible workers merge, their already-produced pending stacks combine on the surviving worker.
- When battlefield cats merge, the target cat’s equipment survives and equipment on the consumed source cat is destroyed.
- Armour raises both current and maximum HP by its bonus when equipped. Replacing/removing the bonus clamps current HP to the new maximum.
- A weapon or armour item is consumed from inventory when equipped.
- The proposed Calico support ability is **Marking Yarn**: a homing yarn hit marks its target; the next damaging hit from another cat receives +1 damage and consumes the mark. This needs Joe’s approval before that task is implemented.

---

## State model

Extend game state with:

- `workerShop`: independent worker offerings with stable IDs, `saved`, and `sold`.
- `workers`: up to six workers, each with stable ID, role, level, copies, slot index, and optional pending output.
- `inventory`: up to nine stack records with stable ID, item kind, tier, quantity, and stat/heal value.
- Battlefield-cat `equipment`: `{ weapon, armour }` descriptors or null.
- Battlefield-cat derived combat stats that distinguish base coat/level stats from equipment bonuses.
- Combat controller state for paused/resumed operation and safe live item commands. Keep UI-only pause promises outside serializable game state if possible.

Output belongs to the worker rather than the station DOM. The renderer derives station location from worker slot, so moving or merging a worker cannot orphan output.

---

### Task 1: Freeze behavior with failing production-state tests

**Objective:** Define the new economy contract before changing game logic.

**Files:**
- Create: `tests/production.test.js`
- Read/modify later: `src/game-engine.js`
- Likely create: `src/production-rules.js`

**Steps:**
1. Add failing tests for initial `workerShop`, empty six-slot workforce, and empty nine-slot inventory.
2. Add failing tests for worker-shop generation, fixed three worker offerings, all four roles being possible, stable IDs, and 3-gold pricing.
3. Add failing tests proving one refresh spends one gold and rerolls unsaved slots in both `shop` and `workerShop` while preserving saved slots in each.
4. Add failing tests proving fighter shop progression remains unchanged.
5. Run `npm test` and verify only the new contract tests fail for missing APIs/state.

### Task 2: Add worker and item definitions

**Objective:** Establish one data-driven source of truth for worker roles, production, item stats, labels, station art type, and tooltips.

**Files:**
- Create: `src/production-rules.js`
- Test: `tests/production.test.js`

**Steps:**
1. Define worker role IDs: cook, trader, weaponsmith, armourer.
2. Define level 1/2/3 output tables and shared worker cost.
3. Define item IDs: food, weapon tiers 1–3, armour tiers 1–3.
4. Export normalization and tooltip helpers.
5. Make all definition tests pass without touching DOM code.

### Task 3: Extend cloning and initial game state safely

**Objective:** Ensure every new nested state field survives immutable transitions without shared references.

**Files:**
- Modify: `src/game-engine.js:184-209` (`createGame`, `copy`)
- Test: `tests/production.test.js`

**Steps:**
1. Add initial worker shop, workers, and inventory state.
2. Deep-clone worker pending outputs, inventory stacks, and cat equipment.
3. Add a mutation-isolation test that changes a returned state and proves the prior state is untouched.
4. Run all tests and ensure existing combat/economy tests still pass.

### Task 4: Make one refresh reroll both shops

**Objective:** Implement the locked combined-refresh behavior without changing its one-gold cost.

**Files:**
- Modify: `src/game-engine.js:212-296` (`makeShop`, `toggleSaveShopSlot`, `refreshShop`)
- Modify: `src/production-rules.js`
- Test: `tests/production.test.js`
- Test: `tests/game-engine.test.js`

**Steps:**
1. Add worker-shop generation and saved-slot preservation helpers.
2. Generalize save toggling so fighter and worker offerings can be targeted explicitly.
3. Update refresh to reroll both shop arrays atomically after charging one gold.
4. Update end-of-round shop rebuilding to preserve saved offerings in both arrays.
5. Verify refresh failure for zero gold mutates neither shop.
6. Run `npm test`.

### Task 5: Implement deferred worker purchase and placement

**Objective:** Charge only after a valid Homestead placement or direct compatible merge.

**Files:**
- Modify: `src/game-engine.js`
- Modify: `src/production-rules.js`
- Modify later: `src/app.js`
- Test: `tests/production.test.js`

**Steps:**
1. Add pure validation for empty worker slots and compatible same-role/same-level merge targets.
2. Add an atomic `purchaseWorkerIntoSlot` transition that checks prep phase, offering state, gold, target legality, and level cap before charging.
3. Add direct shop-to-worker merge support so a full Homestead does not block buying a compatible third copy.
4. Prove invalid placement, insufficient gold, sold offerings, and incompatible targets preserve all state.
5. Prove valid placement deducts 3 gold exactly once and marks the offering sold.
6. Run tests.

### Task 6: Add worker movement and three-copy evolution

**Objective:** Support prep-only repositioning, stacking, and level promotion across all six worker slots.

**Files:**
- Modify: `src/production-rules.js`
- Modify: `src/game-engine.js`
- Test: `tests/production.test.js`
- Modify later: `src/drag-drop.js`

**Steps:**
1. Add movement between empty worker slots.
2. Add same-role/same-level stacking with `copies` progressing 1→2→promotion.
3. Reject cross-role, cross-level, same-ID, and level-3 merges.
4. Preserve the surviving target ID for animation anchoring.
5. Combine same-kind pending outputs when workers merge and ensure no production is duplicated.
6. Test all six slot indices, including top/bottom station mapping.

### Task 7: Generate and expire production at the round boundary

**Objective:** Produce exactly once after the worker has lived through a completed battle.

**Files:**
- Modify: `src/game-engine.js:684-714` (`finishRound`)
- Modify: `src/production-rules.js`
- Test: `tests/production.test.js`
- Test: `tests/game-engine.test.js`

**Steps:**
1. Add a production-cycle helper that replaces every old uncollected pending output.
2. Generate food/coins/equipment from each placed worker’s current level.
3. Do not generate on purchase, refresh, combat start, failed round finish, game over, or victory without a completed transition to prep.
4. Preserve the existing fresh-10-gold round reset; merchant output is pending and does not alter gold until collected.
5. Add events describing produced output so the UI can animate stations after battle.
6. Verify surviving combat cats still receive their existing between-round heal after equipment-derived max HP is calculated.

### Task 8: Implement inventory stacking and collection

**Objective:** Move food and equipment from stations into a persistent nine-slot inventory safely.

**Files:**
- Modify: `src/production-rules.js`
- Modify: `src/game-engine.js`
- Test: `tests/production.test.js`

**Steps:**
1. Add exact stack matching by item kind and tier.
2. Collect into an existing compatible stack before requiring an empty slot.
3. Reject collection when nine slots are occupied and no compatible stack exists; leave station output untouched.
4. Collect a station’s complete pending stack atomically on click.
5. Add trader collection that clears pending coins and increments gold but never touches inventory.
6. Test persistence over round transitions and expiration only for output still on stations.

### Task 9: Add battlefield equipment rules

**Objective:** Apply one replaceable weapon and one replaceable armour to each living battlefield cat.

**Files:**
- Modify: `src/game-engine.js` (`createCat`, `applyLevelStats`, merge/death paths)
- Modify: `src/production-rules.js`
- Test: `tests/production.test.js`
- Test: `tests/game-engine.test.js`

**Steps:**
1. Separate base attack/base max HP from effective attack/max HP.
2. Add pure stat recomputation from coat, cat level, weapon, and armour.
3. Equip only during prep or a confirmed paused-combat state.
4. Consume one inventory item on successful equip.
5. Replace and destroy prior equipment of the same slot.
6. Clamp HP correctly when replacing stronger armour with weaker armour.
7. Destroy both equipment items when the cat dies.
8. Preserve target equipment and destroy source equipment during cat merges unless Joe changes the default rule.
9. Verify level promotion recomputes base stats while retaining target gear bonuses.
10. Run the full suite.

### Task 10: Implement food healing rules

**Objective:** Consume one food and heal a living damaged cat by 2 HP without exceeding max HP.

**Files:**
- Modify: `src/production-rules.js`
- Modify: `src/game-engine.js`
- Test: `tests/production.test.js`

**Steps:**
1. Permit food during prep, paused combat, and running combat.
2. Reject full-health, missing, or dead targets without consuming food.
3. Decrement the food stack and remove it when quantity reaches zero.
4. Emit a semantic item-heal event with before/after HP for presentation.
5. Test partial healing near max HP and rapid repeated uses.

### Task 11: Replace Calico self-healing with support attack

**Objective:** Keep six combat coats while removing all automatic healing from Calico.

**Files:**
- Modify: `src/game-engine.js:44-50, 531-549`
- Modify: `src/pixel-art.js:23-27, 75-78`
- Modify: `src/app.js:918-955`
- Test: `tests/game-engine.test.js:306-318`
- Test: `tests/ui-state.test.js:188-193`

**Steps:**
1. Confirm the exact support mechanic with Joe; default proposal is Marking Yarn.
2. Replace `medic-homing` metadata, tooltip copy, legend copy, and projectile style naming.
3. Remove self-heal state mutation and `heal` event generation from Calico attacks.
4. Add focused tests for the support status, its consumption, target death, misses, and no lingering mark after the intended duration.
5. Replace the medic-cross pixel marker with a yarn/support marker.
6. Keep food healing visuals separate from Calico projectile visuals.

### Task 12: Add Homestead and inventory markup

**Objective:** Establish the always-visible desktop layout without crowding the existing right control panel.

**Files:**
- Modify: `index.html:12-73`
- Modify: `styles.css:36-103, 770-776`

**Steps:**
1. Add a left `Homestead` panel before the battlefield column.
2. Add the four-row × three-column station/worker structure with accessible labels.
3. Add the 3×3 inventory below it with `0/9` occupied-slot status.
4. Change the desktop shell to three columns: Homestead, battlefield, controls.
5. Keep battlefield dimensions and all 14 rows visible.
6. For medium widths, allow the Homestead worker grid to collapse while keeping inventory reachable.
7. For narrow/mobile layouts, stack battlefield, inventory, Homestead, then controls in a deliberate order.
8. Verify no horizontal clipping or hidden controls at supported viewport sizes.

### Task 13: Add shop tabs and worker placement UI

**Objective:** Render both offering sets while preserving one shared refresh control.

**Files:**
- Modify: `index.html:46-52`
- Modify: `src/app.js:182-240, 957-965`
- Modify: `styles.css:124-167`
- Modify: `src/ui-state.js`
- Test: `tests/ui-state.test.js`

**Steps:**
1. Add Fighters/Workers tabs with Fighters selected by default.
2. Keep both shop arrays in state even when hidden.
3. Render worker cards with production stats instead of HP/attack.
4. Selecting a worker offering enters pending-placement mode without charging or marking it sold.
5. Highlight empty and compatible worker slots; incompatible slots return clear feedback.
6. Escape, tab switching, refresh, start round, restart, and successful placement clear pending selection.
7. Save buttons work on the currently visible shop while refresh updates both.
8. Add exact purchase-denial messages for gold, sold slot, and no valid Homestead destination.

### Task 14: Render workers, stations, output, and item art

**Objective:** Give each production role a distinct readable silhouette and station.

**Files:**
- Modify: `src/pixel-art.js`
- Modify: `src/app.js`
- Modify: `styles.css`
- Test: `tests/ui-state.test.js`

**Steps:**
1. Add worker-cat canvas renderers with role-specific clothing/tools.
2. Add station renderers: cooking pot/fire, merchant wagon, grindstone/weapon rack, anvil/armour stand.
3. Add item icons for food, coin pile, three weapon tiers, and three armour tiers.
4. Add worker level/copy pips and tooltips.
5. Render pending output as an interactive overlay on its station with quantity.
6. Ensure art remains recognizable at actual slot size, not only enlarged.
7. Add marker-contract tests for each role and tier.

### Task 15: Add collection microinteractions

**Objective:** Make every collection feel rewarding while keeping frequent interactions quick.

**Files:**
- Modify: `src/app.js`
- Modify: `styles.css`
- Modify: `src/sound.js`
- Test: `tests/ui-state.test.js`

**Steps:**
1. On food/equipment collection, lift the item from the station, arc it into the resolved inventory slot, land with a restrained squash, increment the stack badge, and pulse the inventory frame.
2. On coin collection, split the displayed pile into a short stagger of coin sprites that arc toward the gold HUD.
3. Increment the HUD count in sync with coin arrivals, ending on the authoritative total.
4. Add a light station bounce, coin chime sequence, and stronger final `ka-ching` for level-3 merchant output.
5. Keep the pending output authoritative until the animation commits or guarantee rollback if animation is cancelled.
6. Respect reduced-motion by using a short fade/count transition.
7. Verify rapid clicking cannot collect the same output twice.

### Task 16: Extend pointer interaction routing

**Objective:** Support worker movement/merge and item-to-cat use without breaking existing fighter drag/drop.

**Files:**
- Modify: `src/drag-drop.js`
- Modify: `src/app.js` drag source/target routing
- Test: `tests/ui-state.test.js`

**Steps:**
1. Add typed source descriptors for worker, food, weapon, and armour.
2. Add typed targets for worker slots, battlefield cats, and inventory slots.
3. Keep worker placement/merge prep-only.
4. Permit food targets during live combat and reject full-health cats visually.
5. Permit equipment targets only in prep or paused combat.
6. Reuse movement threshold, ghost redraw, valid-target highlights, landing cleanup, and synthetic-click suppression.
7. Verify existing bench↔board movement and same-coat merge tests still pass.

### Task 17: Refactor combat control for pause and safe live food

**Objective:** Ensure live item commands are applied to current authoritative HP and are never overwritten by a combat section computed earlier.

**Files:**
- Create: `src/combat-controller.js`
- Create: `tests/combat-controller.test.js`
- Modify: `src/app.js:969-1027, 1099-1103`
- Modify: `src/game-engine.js:505-681` as narrowly as required
- Modify: `index.html:39-44`
- Modify: `styles.css:112-122`

**Steps:**
1. Add a real Pause control separate from the 1×/2× speed control.
2. Build a DOM-independent pause gate with resume promises and cancellation on restart/game end.
3. Break combat advancement into safe, ordered commits so damage/heal state changes commit at their visual impact rather than precomputing an entire section that can later overwrite food use.
4. Preserve existing cat-action order, dog-action order, targeting, movement, breach, final-wave, and event presentation semantics when no item is used.
5. Allow food commands between impact commits while combat is running.
6. Freeze new combat commits and animation progress while paused; allow equipment and food interactions during the pause.
7. Decide and test the exact race rule: an item released before a lethal impact commits can save the cat; an item released after death cannot.
8. Add regression tests comparing old full-section outcomes with the new step controller when no intervention occurs.
9. Test pause/resume repeatedly, pause during projectile travel, restart while paused, victory while paused, and speed changes around pause.

### Task 18: Render equipped gear and healing feedback

**Objective:** Make equipped items and item use obvious on battlefield cats.

**Files:**
- Modify: `src/pixel-art.js`
- Modify: `src/app.js:242-252, 712-859`
- Modify: `styles.css:183-220`
- Test: `tests/ui-state.test.js`

**Steps:**
1. Draw equipped weapon and armour overlays distinct from level-progression costume art.
2. Add small weapon/armour equipment badges without covering HP bars or copy pips.
3. Animate food from inventory to target, a quick eating beat, green `+2 HP`, and HP-bar growth.
4. Animate replacement gear shattering/fading before the new item settles.
5. Remove gear immediately and visibly when a cat dies.
6. Verify food rejection at full HP gives feedback but consumes nothing.

### Task 19: Update copy, legend, README, and accessibility

**Objective:** Teach the new system without relying on hidden rules.

**Files:**
- Modify: `index.html`
- Modify: `src/app.js`
- Modify: `README.md`
- Modify: `styles.css`

**Steps:**
1. Update instructions for Fighters vs Workers, worker placement, production timing, output expiration, stacking, food use, pause, and equipment replacement/destruction.
2. Update Calico role copy and remove every Medic/healing-yarn reference.
3. Add screen-reader labels announcing station output, quantity, inventory capacity, valid worker destinations, equipment slots, and collection results.
4. Ensure keyboard users can select a worker shop card, place it, collect output, select inventory, and target a cat.
5. Keep important text at the project’s established readable pixel-font sizes.

### Task 20: Full verification and balance pass

**Objective:** Prove the feature works as a complete game loop, not only as isolated state transitions.

**Files:**
- All changed files
- Tests under `tests/`

**Automated verification:**
1. Run `npm test` and require zero failures.
2. Run `npm run build` and require a successful Vite production build.
3. Check browser console for errors throughout the tested flow.

**Desktop browser flow:**
1. Refresh both shop pools with saved and unsaved offerings.
2. Select a worker, cancel, place into all six slot positions, move it, stack it, and promote it through levels 2 and 3.
3. Complete a battle and verify output appears only after the battle.
4. Leave output uncollected and verify it is replaced after the next production cycle.
5. Collect food/equipment into empty and existing stacks; fill all nine slots and verify overflow is safe.
6. Collect merchant coins and verify each visual arrival matches the final authoritative gold total.
7. Equip, replace, merge, level up, and kill geared cats; verify the agreed destruction/preservation rules.
8. Use food during live combat before and after damage; reject use on full-health/dead cats.
9. Pause during projectile travel, equip while paused, resume, change speed, and restart while paused.
10. Verify Calico support behavior and confirm no automatic combat healing remains.

**Visual/responsive verification:**
1. Inspect wide desktop three-column layout.
2. Inspect a medium laptop viewport where the Homestead may collapse but inventory remains reachable.
3. Inspect narrow/mobile stacking order.
4. Confirm the full 14-row battlefield remains visible during combat.
5. Confirm no important panel has horizontal overflow, clipped labels, or unreachable controls.
6. Verify normal and reduced-motion collection/equipment animations.

**Balance review after one full seven-round run:**
- Merchant payback and refresh snowballing.
- Whether 1/2/4 food overwhelms dog damage.
- Whether +1/+2/+3 weapon and +2/+4/+6 armour bonuses outscale current dog tiers.
- Whether three worker offerings provide enough access to all four roles.
- Whether six worker slots and nine inventory slots create meaningful constraints without excessive housekeeping.

---

## Files likely to change

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

## Files likely to be created

- `src/production-rules.js`
- `src/combat-controller.js`
- `tests/production.test.js`
- `tests/combat-controller.test.js`

## Main risks and mitigations

1. **Live-food race conditions:** Current combat computes a whole section before animation. Refactor to safe impact commits before enabling live food; do not patch around this with stale parallel state.
2. **Economy snowball:** Merchant gold is additive on top of the existing fresh 10-gold reset. Keep the initial 1/2/3 output conservative and playtest a full run.
3. **Equipment stat drift:** Always recompute effective stats from base coat/level plus gear; never increment/decrement attack or HP ad hoc.
4. **Layout crowding:** Do not add the Homestead inside the already-scrollable right control panel. Keep inventory persistently reachable beside combat.
5. **Interaction ambiguity:** Use typed source/target descriptors and pure validation before DOM mutation. Charge worker purchases only after a valid target resolves.
6. **Animation double-spend:** Lock pending output/item stacks while a collection/use animation is active and commit exactly once.
7. **Existing uncommitted work:** The repo currently contains unrelated modified and untracked Electron/Vite files. Implementation must preserve them and avoid broad rewrites.

## Definition of done

The feature is done only when a player can buy, save, refresh, place, move, merge, and evolve all four worker roles; complete a battle; collect expiring station output; manage persistent stacked inventory; equip and replace weapons/armour; heal with food during live combat; pause and equip safely; collect coins with synchronized feedback; and finish the existing seven-round game with all automated tests, production build, browser console, and responsive visual checks passing.
