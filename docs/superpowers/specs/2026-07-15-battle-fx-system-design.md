# Battle FX System — attacks, hurt reactions, and death animations

Date: 2026-07-15
Status: approved to build

## Goal

Three connected things, built on one system:

1. **Every cat and dog attack has its own graphics** — including the effect it leaves
   behind. Bombay Boom's splash must read as a bomb exploding across every square it
   damages, not as stray pellets.
2. **Every cat and dog has its own hurt reaction** — a red flash plus a recoil and an
   impact mark that matches whatever hit it (a bite, a tennis ball, a bone, a beam).
3. **Every cat and dog has its own death animation** — it flips over, lands on its back
   in its own funny way, then flashes and fades out.

## The problem being fixed

The engine emits one damage event per victim. The renderer draws one projectile per
damage event. So an area attack — which is *one* projectile and *one* blast hitting
*several* victims — comes out as several projectiles and no blast.

| Attack | Engine emits | Renderer draws today | Should draw |
| --- | --- | --- | --- |
| Bombay Boom splash | `splash` + one `splash-secondary` per neighbour | a ball, then more balls flying sideways | one lobbed bomb, one explosion covering all 3 squares |
| Bone Jovi bomb | `bone-bomb` + `bone-bomb-secondary` | same bug | same fix |
| Laserpaw pierce | 3 × `piercing` | 3 separate balls | one beam through all 3 dogs |
| Knotty Kitty tangle | `tangle` | generic yellow ball (no CSS rule exists) | yarn ball trailing string, dog left tethered |
| Purrcy volley | 3 × `column` burst | 3 balls, no muzzle | 3 pellets with muzzle flash |
| Frosty / Purrtal / Faux Paw / Thunderpaws / Meowstro | `homing` | all five share Hissiletoe's projectile | one skin each |

Death has no animation at all: a killed unit simply vanishes when the board re-renders.
Hurt is a single shared red overlay with no direction and no source flavour.

## Architecture

The fix is a **granularity change plus three data tables**. Graphics stop being keyed to
damage events and start being keyed to *attacks*.

```
engine events ──► group into attacks ──► ATTACK_FX ──► projectile / path / impact
                        │
                        ├─ per victim ──► HURT_FX  ──► red flash + recoil + source mark
                        │
                        └─ hpAfter === 0 ──► DEATH_FX ──► flip, flop, strobe, fade
```

### New module: `src/battle-fx.js` (pure, testable)

Holds the attack graphics registry and the geometry helpers. No DOM.

- `attackSignature(event, caster)` — resolves an event to a stable graphics key. Mostly
  this is `event.style`, with one refinement: six cats share `style: 'homing'`, so the
  caster's coat splits them into `homing`, `frost`, `rift`, `mirage`, `spark`, `note`.
  The caster is looked up in the pre-section game snapshot, so **the engine does not
  change**.
- `ATTACK_FX[signature]` — `{ projectile, path, muzzle, impact, blast, hurt, sound }`.
  `path` is one of `straight | lob | homing | beam | melee`. `blast` is set only for area
  attacks and names the footprint rule.
- `HURT_FX[kind]` — `{ mark, recoil, shake, flash }`. `mark` is the source-specific
  decal: `chomp`, `dent`, `slice`, `thud`, `scorch`, `frost`, `burn`, `rake`, `spark`.
- `blastCells(row, col, cols)` — the squares an explosion covers. Mirrors the engine's
  own splash rule exactly (target square plus the adjacent columns in the same row), so
  the fire lands on precisely the dogs that took damage. This is the single source of
  truth for "where the explosion is drawn", and it is unit-tested against the engine's
  targeting.
- `contactVector(fromRow, fromCol, toRow, toCol)` — the attacker→victim direction, used
  to place the impact spark on the edge of the victim facing the attacker and to throw
  the recoil the right way.

### New module: `src/death-animation.js` (pure, testable)

Per-unit death choreography. Follows the existing `CAT_GEOM` / `DOG_GEOM` idiom: a table
per unit, consumed by one shared runtime.

- `CAT_DEATH[coat]` for all 11 coats, `DOG_DEATH[role]` for all 9 roles.
- Each spec: `{ spin, tilt, hop, bounces, gag, tongue }`.
  - `spin` — degrees, signed. Negative spins away from the attacker. Around 180° for a
    heavy unit that just topples; 540° for a kitten that cartwheels.
  - `tilt` — the resting angle, a few degrees either side of a flat 180°, so no two
    corpses lie at the same angle.
  - `hop` — launch height. `bounces` — how many times it settles.
  - `gag` — the signature prop: Knotty's yarn ball rolls away, Bombay's bomb fizzles out,
    Meowstro's monocle pops and spins, Bone Jovi's bone clatters, Purrtal dissolves into
    motes rather than falling at all.
- `DEATH_TIMING` — `hitstop → launch → flop → settle → strobe → fade`, scaled by the
  existing 1×/2× combat speed toggle.

**Why the sprites do not need redrawing.** Every unit is drawn standing, feet at the
bottom of its 32×32 canvas. Rotating the sprite 180° therefore *already* puts it on its
back with all four paws in the air, and it keeps its silhouette — a dachshund still reads
as a dachshund. The per-unit comedy comes from the choreography and the gag, not from 20
new hand-drawn corpses. X-eyes are overlaid at each unit's head using the **helm anchor
already tabulated** in `CAT_GEOM` / `DOG_GEOM`, so they land on the right face every time.

## Sequencing

`animateEvents` becomes phase-structured, and deaths resolve at the end of the phase that
caused them:

1. **Cats act** — grouped attacks play concurrently. Then every dog with `hpAfter === 0`
   flips over. All deaths in the phase play at once, so a wipe costs one beat, not N.
2. **Dogs act** — buffs, shots, moves, bites. Then every cat killed this phase dies.
3. Kills from the tactics window (storm, encore) and the super-cat column wipe route
   through the same `playDeaths` call.

`render()` is held until deaths finish, because that is what removes the DOM element the
animation is running on.

## Pacing

A death runs ~920ms at 1× (`hitstop 70 → launch 170 → flop 200 → settle 110 → rest 60 →
strobe 140 → fade 170`) and overlaps with its neighbours, so a wipe costs one beat rather
than one beat per body. The existing speed toggle halves all of it. Under
`prefers-reduced-motion` the flip and the gag are skipped and the unit goes straight to
the flash-and-fade, which is the part carrying the information ("this unit is gone").

## Rule: the resting state must be right without the animation

Found the hard way while verifying. The X-eyes were drawn by an animation that began at
`opacity: 0`, so anywhere that animation did not run, the eyes were **permanently
invisible** — the unit died with no sign it was dead. The same trap had swallowed the
tier badge and the pierce beam.

Anything that carries meaning — X-eyes, a beam that is currently firing, a hidden health
bar — must be correct as a static style, with the animation adding only flourish.
Decoration (the gags, the muzzle flashes) may live purely in animation. This also means
the effects degrade sanely for reduced-motion users rather than vanishing.

## Rule: compose transforms, never replace them

Dogs stack two to a cell and carry a CSS `transform` for the stack offset. The knockback
and the death flip also animate `transform`, which would overwrite that offset and snap a
stacked dog across its tile the instant it was hit. Both use additive composition
(`composite: 'add'` in WAAPI, `animation-composition: add` in CSS) so the flip happens
relative to wherever the unit already sits.

## Testing

`npm test` (node --test) covers the pure modules:

- every cat coat and every dog role resolves to a death spec — no unit can be added
  without one;
- every attack style the engine can emit resolves to an `ATTACK_FX` entry, so a new
  ability cannot silently fall back to a generic ball (this is the bug class that hid
  the bomb explosion);
- `blastCells` matches the engine's splash targeting for every board position, including
  the board edges where a column is clipped;
- `contactVector` points from attacker to victim for all eight directions.

`npm test` also runs `npm run check` first — `node --check` over every source file. A stray
duplicate declaration in `app.js` is a top-level `SyntaxError` that stops the whole game
from booting while every unit test still passes, because `app.js` has no test coverage.
That happened during this work and the suite reported 173/173 green. The syntax gate
closes it.

Browser verification (done): the bomb blast covers all three damaged squares with one
explosion and no stray projectiles; Laserpaw fires one beam through three dogs rather than
three shots; a bitten cat flips over; and three different dogs each fall in their own way.

## Out of scope

No engine rule changes. No balance changes. No new sprites in `pixel-art.js` beyond
reading the head anchors it already exports.
