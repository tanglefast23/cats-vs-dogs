# Style Guide — Cats vs Dogs: Backyard Battle

Date: 2026-07-17
Status: descriptive — this documents the game as it is built today

How to use this: the rules below were reverse-engineered from `styles.css` (3,521 lines),
`src/pixel-art.js`, and the FX/motion/sound modules. Where the game already has a rule,
it is stated with real values and line references. Where the game contradicts itself,
that is recorded in [Known deviations](#13-known-deviations) rather than hidden — those are
the places where copying the existing code will copy a mistake.

---

## 1. The feel

**A hand-built arcade cabinet standing in a suburban backyard.**

Four intentions, and every rule in this document serves one of them:

1. **Retro arcade.** Pixel font, pixel sprites, and motion that ticks in frames instead of
   gliding. In combat nothing eases; everything snaps. (The exceptions are deliberate and
   short-listed in [§9.2](#92-the-one-sanctioned-curve).)
2. **Sticker book.** Every object is hard-outlined in one ink color and dropped with a
   blur-free shadow. Square corners, die-cut, no soft edges. (Think vinyl stickers on a
   notebook, not the soft shadows of a modern web app.)
3. **A physical diorama.** The yard is *built*, not drawn — timber planks with nail lines,
   a picket fence with one picket deliberately smashed, a cardboard adoption box with its
   label stuck on crooked. Things look handled.
4. **Character first.** The animation budget goes almost entirely to personality. Nine dog
   hit reactions, twenty bespoke death gags, fourteen projectile recipes. The polish is in
   the jokes.

**One-sentence test for new work:** hard-outlined, square-cornered, pixel-rendered, dropped
with a blur-free offset shadow, and animated in `steps()`. If your new thing has a rounded
corner and a soft shadow, it belongs to a different game.

---

## 2. The five non-negotiables

Break these and the piece stops looking like it belongs.

| # | Rule | Why |
| --- | --- | --- |
| 1 | **Everything is outlined in ink `#172b36`.** | 120 uses. The single load-bearing decision in the whole look. |
| 2 | **Shadows are hard: an offset, zero blur, down-right.** | The offset *is* the height. Blur appears twice in 3,521 lines. |
| 3 | **No border-radius on any UI container.** | Not one panel, chip, card, button, badge, or modal is rounded. Only things that *fly* are round. |
| 4 | **Motion is quantised — `steps()`, not easing.** | 137 of 147 animations. This is the aesthetic thesis. |
| 5 | **State lives in resting CSS values; animation only decorates.** | An effect that can only be seen while animating disappears for reduced-motion users. See [§11](#11-the-accessibility-invariant). |

---

## 3. Color

### 3.1 The tokens that actually work

```css
--ink:         #172b36;   /* the universal outline — borders, shadows, focus rings */
--paper:       #fff8dc;   /* default panel and chip fill (cornsilk) */
--orange:      #e87832;   /* THE ONE THING TO PRESS — never a background */
--orange-dark: #a94829;   /* only ever paired under orange */
--red:         #d84a45;   /* you are losing something — lives, destructive confirm */
--px:          'Press Start 2P', ui-monospace, monospace;
```

Plus the page backdrop, which is not a token: `background: #10242e` on `:root`.

**`--orange` is scarce — 7 uses in the whole stylesheet — and it means "action" or "brand."**
Two are CTA fills: `.done-button` and the splash screen's `CAMPAIGN`. The splash covers the
game, so only one orange button is ever on screen at a time. The other five are small
accents: the `VS` in both titles, the result-card kicker, the active glossary tab, and the
sound-slider fill. It is never a panel fill, never decoration — the moment orange stops
being scarce it stops meaning "press here."

### 3.2 The two colors that should be tokens but aren't

These carry more semantic weight than any token except `--ink`, and both are hardcoded:

| Color | Uses | Rule |
| --- | --- | --- |
| `#ffe56e` **badge yellow** | 23× | **A number on a yellow chip with an ink border is always a quantity.** Levels, counts, stacks, costs. No exceptions in the codebase. |
| `#8ee7ff` **ability cyan** (outlined `#164d78`) | 17× | **Cyan means a cat ability is happening, or armour.** Freeze shells, decoy shields, bomb footprints, storm charge, target pulses. |

If you add a quantity chip, it is yellow. If you add a cat ability effect, it is cyan.
Treat these as tokens even though `:root` doesn't yet declare them.

### 3.3 Semantic color — the rules that never break

Despite ~400 hex literals in the stylesheet, the *meanings* are near-perfectly consistent.
These are real rules, not tendencies:

**Teams.** Cats are green/cream; dogs are tan/brown.

| | Cat | Dog | Storm (third faction) |
| --- | --- | --- | --- |
| Turn tag | `#d7edb9` pale lawn | `#f0d2b4` pale kibble | `#17233f` bg, `#d8fbff` border, `#fff36b` text |
| Tooltip | `linear-gradient(#fff8dc, #e7f3c8)` | `linear-gradient(#fff1e4, #f0d2b4)` | — |

**Damage — stated as a rule in the source** (`styles.css:1577`):
> *"Damage you deal lands gold; damage you take stays red — an exchange reads from color alone."*

| Event | Fill | Outline |
| --- | --- | --- |
| Damage you take | `#ff5347` | `#4a1016` |
| Damage you deal (`.to-dog`) | `#ffd743` | `#59380b` |
| Blocked | `#bff6ff` | `#164d78` |

**Board rings — four colors, four meanings, zero exceptions:**

| Ring | Color | Means |
| --- | --- | --- |
| Yellow | `#ffe56e` / `#ffe14b` / `#fff27b` | selected, or hovering |
| Green | `#38ff86` | this move is legal |
| Red/pink | `#ff315f` / `#e33f46` | this move is illegal |
| Cyan | `#8ee7ff` | an ability is targeting here |

Rings are drawn as `inset 0 0 0 3–4px <bright>` — inside the tile, so they never shift layout.

**Shadow colors are darker than the outline.** The world's shadow is deeper than an
object's keyline: `#08171e` (world) / `#08151a` (modals) / `#030d12` (topmost). All three
are darker than `--ink` `#172b36`.

### 3.4 Progression color is a cross-faction language

This is the subtlest and best idea in the palette, and it is entirely implicit in the code
today. **Cats and dogs converge on the same endgame colors** — `#d95c9f` magenta is
literally shared between cat level 3 and dog tier 4.

```
ivory / cobalt  →  cyan  →  magenta + gold
   (level 1)      (level 2)     (level 3 / tier 4)
```

| | Cat L2 "skyguard armor" | Cat L3 "royal power armor" |
| --- | --- | --- |
| armour | `#176b9e` cobalt | `#6d285e` magenta |
| light | `#55d6e8` cyan | `#d95c9f` pink |
| trim | `#f4f0ce` ivory | `#ffd94f` gold |

Dog tiers ramp the same way: tier 2 `#62c9dc` cyan ≈ cat L2 `#55d6e8`; tier 4 `#d95c9f`
**is** cat L3's pink. **Magenta means maxed out, whichever species is wearing it.**
Anything new that represents "final tier" should land in magenta + gold.

### 3.5 Character palettes

Cat coats are keyed **per character** (11 triplets); dog coats are keyed **per tier**
(4 triplets — all nine dog roles at a tier share one coat). That asymmetry is deliberate:
a cat is an individual, a dog is a rank.

**`COAT_PALETTES`** — `src/pixel-art.js:113`. Array order *is* the roster.

| # | Character | fur | light | dark |
| --- | --- | --- | --- | --- |
| 0 | Purrcy Pew-Pew | `#e9963f` orange tabby | `#ffd18a` | `#9c4d2e` |
| 1 | Clawdius | `#71868d` slate | `#cdd9d5` | `#3e5159` |
| 2 | Hissiletoe | `#f0e1bc` cream | `#fff7df` | `#9a7759` |
| 3 | Knotty Kitty | `#f2d7a7` calico | `#fff0ce` | `#a84f35` |
| 4 | Bombay Boom | `#2f3540` black | `#697482` | `#151923` |
| 5 | Laserpaw | `#9f71d8` violet | `#d9c7ff` | `#593c91` |
| 6 | Frosty Paws | `#8fd3e8` ice blue | `#e5fbff` | `#3f7f9f` |
| 7 | Purrtal | `#6044a5` deep purple | `#b9a7ff` | `#2a205f` |
| 8 | Faux Paw | `#dca4e8` pink-lilac | `#fff0ff` | `#79528f` |
| 9 | Thunderpaws | `#536675` storm grey | `#a8c7d4` | `#252f3a` |
| 10 | Meowstro | `#b8444c` wine | `#f1c083` | `#632733` |

**`DOG_PALETTES`** — `src/pixel-art.js:578`, keyed by tier.

| tier | name | fur | light | dark |
| --- | --- | --- | --- | --- |
| 1 | yard punk | `#9c613b` warm brown | `#dcaa6d` | `#623a2c` |
| 2 | ironhide | `#66727a` slate | `#aeb8b9` | `#38444d` |
| 3 | bonecrusher | `#75483d` umber | `#c18462` | `#422b2b` |
| 4 | top dog | `#732f46` wine | `#cf6a6c` | `#351e35` |

Shared sprite details (de-facto tokens, currently inline literals): `#dc7f76` ear/nose pink ·
`#ecf3c5` cat eye whites · `#eef0c2` dog eye whites · `#f2eee0` teeth and socks · `#fff` sparkle.

### 3.6 Gradients — allowed, in two disciplines only

Gradients are *not* avoided (54 linear, 41 radial). But they only ever do one of two jobs:

1. **A subtle two-stop vertical wash on a panel** — a lit-from-above bevel, not decoration.
   `linear-gradient(180deg, #edf6d9, #c7dfa9)`.
2. **Hard-stop gradients used as a drawing tool** — zero interpolation, `0 Npx` stops. This
   is the signature move: gradients replace bitmaps.
   ```css
   /* timber siding with nail lines */
   repeating-linear-gradient(90deg, #4b352e 0 4px, transparent 4px 44px),
   linear-gradient(180deg, #59413a 0 2px, #b17c5d 2px 6px, #8c6250 6px 13px, #4b352e 13px);
   ```

**Never use a soft gradient as decoration.** If it blends, it's a panel bevel. If it's
drawing an object, the stops are hard.

### 3.7 The ratio holds

Roughly 60% cream/paper canvas, 30% ink + lawn-green structure, 10% orange + badge-yellow
accent. Keep it. Orange and red are meaning-bearing — spending them on decoration is the
fastest way to break this look.

---

## 4. Typography

### 4.1 Two faces, one job each

```css
--px: 'Press Start 2P', ui-monospace, monospace;              /* display */
font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;  /* reading + numerals */
```

The stylesheet states its own rule three times (lines 1, 2653, 3314):
> *"The pixel face stays reserved for short display labels; running text remains mono so it
> can grow without turning every panel into a wall of pixels."*

**Press Start 2P — short, loud, non-reading text only.** Headings, eyebrows, chips, badges,
combat callouts, button labels, wave banners.

**Mono — everything you actually read.** Body copy, ability blurbs, all stat numbers,
tooltips, tutorial prose. Mono is also re-asserted explicitly wherever a pixel-font parent
would otherwise pass its face down to a child (`styles.css:2659`).

The intended ramp, per the source's own comment:
**Press Start 2P at 8 / 12 / 16. Mono at 10 / 12 / 16.** (8px is the pixel font's native
grid — it is designed for exactly that size and multiples of it.)

### 4.2 Three guards protect the pixel grid

These are not stylistic preferences — they stop the browser from destroying the glyphs:

```css
:root { font-synthesis: none; }        /* no faux bold, ever */
.some-px-element {
  font-weight: 400;                    /* explicit on every pixel-font element */
  letter-spacing: 0;                   /* the font is pre-spaced */
}
```

**The weight rule: pixel font → always 400. Mono → 900 when emphatic, inherit otherwise.**
`900` is the mono "bold" (19 uses). 700 and 800 appear 5 times total, all in the
tutorial/tooltip layer, and all are drift.

The font ships **self-hosted as a base64 woff2 data URI** (`styles.css:8`, ~5KB latin
subset) so it can never flash-swap. Don't move it to a network request.

### 4.3 Case and tracking

- **`text-transform` is effectively unused** — capitalisation is authored in the HTML.
  Write `READY` in the markup, not `text-transform: uppercase` in the CSS.
- Positive tracking (`1px`, `2px`) is for mono all-caps labels only.
- `letter-spacing: 0` on pixel-font elements is the guard above, not a style choice.

---

## 5. Depth — the elevation ladder

**The shadow offset *is* the z-height.** This is literal and consistent enough to use as a
lookup table. All are zero-blur, offset down-right.

| Offset | Color | Meaning | Examples |
| --- | --- | --- | --- |
| `1px 1px 0` | `rgba(23,43,54,.35–.62)` | micro-chip sitting on a surface | `.shop-tier`, `.tooltip-category` |
| `2px 2px 0` | `var(--ink)` | chip / secondary button | `.hud-chip`, `.refresh-button`, `.turn-tag` |
| `3px 3px 0` | `var(--ink)` | panel | `.shop-panel`, `.workbench-panel`, `.icon-button` |
| `4px 4px 0` | `var(--ink)` / `#08151a` | hero button / floating callout | `.done-button`, `.wave-banner`, `.unit-tooltip` |
| `7px 7px 0` | `#08151a` | modal card | `.result-card`, `.settings-card` |
| **`7px 8px 0`** | `#08171e` | **the world itself** | `.board`, `.production-panel`, `.information-section` |
| `10px 10px 0` | `#030d12` | topmost modal | `.glossary-card` |

Note the asymmetry in `7px 8px 0` — 7 across, 8 down. It is used on exactly the four
elements that make up the physical backyard. The extra pixel of vertical drop reads as
"this object is resting on the ground, lit from upper-left." Don't tidy it to `7px 7px`.

### 5.1 Borders — the width ramp is the hierarchy

| Width | Role |
| --- | --- |
| `1px` | board cell hairline |
| `2px` | chip, badge, small button, shop card |
| `3px` | panel, primary button, tooltip |
| `4px` | major panel |
| `5px` | modal frame, board outline |

Default is `2px solid var(--ink)` (29×) or `3px solid var(--ink)` (27×). **Everything is
ink-bordered.** Dashed borders have one meaning: **empty / potential / boundary** — empty
slots, drop targets, and the front line (`.cell.middle`).

### 5.2 Corners

**Square. All of them.** Zero radius on any UI container.

`border-radius: 50%` appears 41 times and every single one is a projectile or an effect —
pellets, bombs, yarn, coins, blast rings, drop rings. The rule: **physics objects are round;
interface objects are square.**

### 5.3 Blur is almost banned

Two legitimate soft shadows exist in 3,521 lines: `.drag-floor-shadow { filter: blur(4px) }`
(a real cast shadow under a lifted piece) and the tutorial bubble (which is drift — see
[§13](#13-known-deviations)).

The **one** place blur is allowed is a glow on a light-emitting game object:
```css
box-shadow: 0 0 0 3px #ffe56e, 0 0 20px 7px rgba(255,231,91,.72);  /* station output */
```

### 5.4 Three compound recipes

```css
/* 1. The bevel — hard shadow + inner light edge */
box-shadow: 3px 3px 0 #06141c, inset 0 0 0 2px rgba(255,255,255,.28);

/* 2. The selection ring — inset, bright, no blur */
box-shadow: inset 0 0 0 4px #ffe56e, 0 0 0 2px var(--ink);

/* 3. The glow — the only sanctioned blur */
box-shadow: inset 0 0 18px #8ee7ff, 0 0 18px rgba(92,209,255,.75);
```

### 5.5 The overlay stack

`z-index` follows the same discipline as the shadows. From the yard up:

| z | Layer |
| --- | --- |
| 20 | floating gains and callouts on the board |
| 30 | result modal |
| 32 | splash start screen (covers the game, sits under every modal it can open) |
| 35 | settings modal — reachable from the splash, so above it |
| 45 | glossary — reachable from settings, so above *it* |
| 9000 | tutorial overlay |
| 10000 | unit tooltip — stats stay readable even mid-tutorial |

New overlays slot into this ladder by asking one question: what must still be able to open
on top of me?

---

## 6. Buttons and feedback

```css
button { transition: translate 140ms ease-out, scale 140ms ease-out, opacity 140ms ease-out; }
button:focus-visible { outline: 3px solid #ffe55d; outline-offset: 2px; }

@media (hover: hover) and (pointer: fine) {
  button:hover { translate: 0 -1px; scale: 1.012; }   /* lifts */
}
button:active { translate: 0 1px; scale: .985; opacity: .9; }  /* presses in */
```

Three things to preserve:

1. **Use `translate`/`scale`, not `transform`.** They compose with an element's own
   `transform`, which many units already carry. Overwriting a stacked dog's offset would
   snap it across the tile.
2. **Hover-lift is gated to real pointers.** Touch devices never get a stuck hover state.
3. **Board cells opt out** (`button:not(.cell)`) — tiles own their own placement cues.

**Disabled drops the shadow to zero**, so the button visually sinks flush into the panel:
```css
:disabled { opacity: .45; box-shadow: none; }
```
That is a nice trick and it is used consistently — a disabled button isn't just dimmed, it's
physically pressed flat. Keep it.

### 6.1 The three button tiers

| Tier | Recipe |
| --- | --- |
| **Hero CTA** (`.done-button`) | full width · `3px` ink border · `var(--orange)` · `4px 4px 0 var(--ink)` · label in pixel font · `text-shadow: 1px 1px var(--orange-dark)` |
| **Icon** (`.icon-button`) | `40×40` · `3px` ink · `var(--paper)` · `3px 3px 0` · hover `#fff3b8` |
| **Small** (`.refresh-button`, `.small-button`) | `2px` ink · `#d8eec4` · `2px 2px 0` · mono 900 |

There is exactly one hero CTA on screen at a time. That is the whole point of orange.

---

## 7. Spacing and layout

**Be honest about this one: there is no 4px or 8px grid.** The most common gap is `5px`,
followed by `4px` and `7px`. Panel padding runs a continuous `7 → 15px` ramp.

This is not simply sloppiness — the spacing is tuned to the **pixel-art sprite scale**
(64px sprites, 32px halves, 16px timber, a 6×14 board) and the odd numbers are largely a
consequence of centring odd-width borders. A 2px border + 5px gap + 2px border reads as a
9px optical trough. Optical tuning beats arithmetic here.

**But the sprawl is real**, and the only coarse scale that *is* consistent is the layout
tier: **16 / 24 / 32**.

**Guidance for new work:** reach for an existing value in the component you're extending
before inventing a new one. Use `16 / 24 / 32` for layout-level spacing. Don't "fix" the
odd values in existing components — they're optically tuned against sprite edges, and
rounding them to 8 will visibly shift art off-centre.

### 7.1 Breakpoints — three, and the base is desktop

| Query | Purpose |
| --- | --- |
| `min-width: 1181px` | desktop: control panel scrolls independently |
| `max-width: 1180px` and `min-width: 881px` | tablet: control panel drops below the board |
| `max-width: 880px` | **phone — the big reorganisation** |

There is no mobile-first ladder; the base stylesheet *is* the desktop design.

### 7.2 The mobile rules worth knowing

Three decisions here are load-bearing and well-reasoned:

1. **The battlefield's physical scale is invariant.** When the window narrows, the utility
   wing gives up a share first — `5fr 6fr` becomes `4fr 6fr` (`styles.css:2961`).
   *The six-column board never shrinks to make room for controls.*
2. **Text is hidden, not shrunk.** Names on shop cards, worker slots, and bench slots go
   `display: none` rather than to an illegible size.
3. **Level badges come off the board** (`styles.css:3466`) — *"Battlefield pets must read
   from their silhouette, clothing and armor. The large yellow level tiles obscure most of
   a 32px sprite on phone layouts."*

Mobile also grows a component desktop never sees: `.mobile-status-plank`, a wooden sign
nailed to the fence, complete with two nail heads drawn as `::before`/`::after`.

---

## 8. Pixel art

### 8.1 The system

Sprites are **not data** — each one is a JavaScript function painting rectangles. The whole
primitive is four lines (`src/pixel-art.js:3`):

```js
const px = (ctx, color, x, y, w = 1, h = 1) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};
```

**Every sprite is 32×32.** `prepare(canvas, size = 32)` sets `imageSmoothingEnabled = false`.

**The house style, follow it:**
- **Draw the outline block first, then inset the fill by 1px.** That's how every silhouette
  gets its keyline.
  ```js
  px(ctx, OUTLINE, 8, 14, 17, 14); px(ctx, fur, 9, 15, 15, 12); px(ctx, light, 12, 20, 9, 7);
  ```
- **Pack the `px` calls onto one line per body part**, with a comment naming the part above.
- **Props may bleed past the 32px edge.** The tile is a soft boundary — Thunderpaws' rod and
  Meowstro's baton both run off it.
- **Textures are deterministic, never random**: `const seed = row * 7 + col * 13`, then
  `seed % 17`. The yard looks the same every load.

### 8.2 Scaling

**Author at 32×32; upscale with `image-rendering: pixelated`** (applied to all 18 sprite
surfaces, without exception). Scale to clean 2× multiples: 64px on the board and bench,
50px in the shop, 112px on the result card.

**Never fill 100% of the tile** — `.unit canvas` is `82%`, station output `88%`. The
breathing room is intentional.

The sprite's own shadow is a hard pixel offset, matching §5:
```css
filter: drop-shadow(2px 3px 0 rgba(17,38,32,.4));
```

### 8.3 The art rules, quoted from the source

These are stated as comments in `pixel-art.js` and they are genuinely good:

> **"Every battle cat gets its own silhouette matched to its combat role: the melee tank is
> a wide bruiser, the casters are thin and frail."** (line 44)

> **"A cat keeps its role silhouette and coat at every level, while the equipment color and
> outline change enough to identify its level *without a text badge*."** (line 26)

> **"Workers share the neutral house-cat frame; their tools tell the story."** (line 502)

So: **silhouette carries role, equipment color carries level, props carry job.** A new unit
needs a silhouette you can identify in black at 32px before it needs any color.

### 8.4 Composing scenes out of the sprites

Two facts you only discover when arranging sprites outside the board (splash screen,
result card, future cutscenes):

- **No unit is drawn walking rightward.** The locomotion poses (Fetch Armstrong, Bone Jovi,
  Barkour Bandit, Bombay Boom) all travel left; everyone else stands front-on, usually with
  a signature prop extending right. To send a sprite right nose-first, flip the canvas with
  `transform: scaleX(-1)` — and keep motion on a wrapper element so the flip never fights
  the animation's transform.
- **Silhouettes claim different parts of the tile.** Most stand feet-at-bottom with the head
  in the top half, but Bombay Boom prowls along the bottom edge and Bone Jovi is a low
  dachshund. Anything that crops sprites at a horizon line (the splash's fence) must audit
  poses instead of assuming head-at-top — this is why the splash pop pool skips coat 4.

---

## 9. Motion

### 9.1 The thesis

**`steps()` on 137 of 147 animations.** `steps(4)` alone appears 47 times. A `steps(4)` hit
over `.34s` is 11.8fps — a hand-animated feel, enforced. **Nothing interpolates.**

**`.34s` is the combat heartbeat** — 19 animations share it. Impacts, flashes, knockbacks,
all nine dog hit reactions.

### 9.2 The one sanctioned curve

Ten `cubic-bezier`s exist. Every one overshoots (y₂ > 1), and they're all variations on a
single hand-tuned curve:

```
cubic-bezier(.2, .9, .25, 1.3 – 1.4)     /* "the reward curve" */
```

It fires on collecting output, a cat landing, an upgrade revealing, a drag ghost lifting —
**every one a positive player moment.** That's the rule: *the game snaps; rewards bounce.*

`ease-in-out` appears 8 times: 5 in the tutorial, 2 on the splash screen's idle sway and
`VS` pulse, 1 under a lifted drag piece. **The rule generalises: simulation snaps; ambient
chrome — the tutorial, the title screen, a hovering shadow — may breathe.** Nothing that
deals damage, moves a unit, or spends gold ever eases.

### 9.3 The timing tables

Durations live in frozen tables, not scattered in the code. `COMBAT_TIMING`
(`src/combat-animation.js:3`) — the highlights:

| key | ms | note |
| --- | --- | --- |
| `projectileMs` | 820 | |
| `homingMs` | 1650 | the sine-seek needs room to read |
| `lobMs` | 900 | *"a lobbed bomb hangs in the air"* |
| `impactMs` | 340 | the heartbeat |
| `damageNumberMs` | 950 | pop in with overshoot, drift up, fade |
| `blastMs` | 520 | |
| `burstStaggerMs` / `pierceStaggerMs` | **90** | the "rapid succession" unit |
| `shotStaggerMs` / `stormFlashLeadMs` | **130** | the other stagger unit |

`DEATH_TIMING` (`src/death-animation.js:77`) — *"the beats of a death, in order"*, 920ms total:

| beat | ms | |
| --- | --- | --- |
| `hitstopMs` | **70** | *"the killing blow freezes for a frame — the hit lands harder"* |
| `launchMs` | 170 | popped off its feet |
| `flopMs` | 200 | comes down on its back |
| `settleMs` | 110 | squash, wobble, go still |
| `restMs` | 60 | lie there long enough to see the pose |
| `strobeMs` | 140 | flash |
| `fadeMs` | 170 | and fade out |

**Yes, there is hit-stop and squash.** They're small — 70ms and 110ms — and they do a lot.

**Impact lands late.** `BLUE_SCRATCH_FLURRY.hitAtMs` is 560 of 800ms — **70% through**.
Anticipation, then snap. Use that ratio for new melee.

### 9.4 The speed toggle — the architectural rule

Stated verbatim in two files:
> **"Scaled copy of COMBAT_TIMING for the speed toggle; the tuned table itself never changes."**

```js
export function combatTiming(speed = 1) {
  const factor = speed > 0 ? speed : 1;
  return Object.fromEntries(
    Object.entries(COMBAT_TIMING).map(([key, ms]) => [key, Math.round(ms / factor)]),
  );
}
```

**Frozen tuned table + a pure scaling function.** New timings go in a table and get scaled;
they never get hand-divided at the call site. (There is drift here — see [§13](#13-known-deviations).)

### 9.5 Layering reactions

`animation-composition` lets a per-role reaction stack on the universal red flash instead of
replacing it:

```css
.unit.hurt.dog-reaction-brace canvas {
  animation: hurt-flash .34s steps(4), dog-hit-brace .34s steps(4);
  animation-composition: replace, add;
}
```
> *"Added to the unit's own transform, never replacing it: stacked dogs already carry a stack
> offset, and overwriting it would snap them across the tile as they got hit."*

### 9.6 Two-axis composition

The FX system's best idea (`src/battle-fx.js:199`):
> **"The attack contributes its contact flavour; the dog contributes its own performance."**

`HURT_FX` says what a pellet/claw/bomb/yarn *does*. `DOG_REACTION_FX` says how each dog
*performs* being hit. Multiplied: a 14 × 9 = 126-cell matrix from 23 authored entries.
**When adding an attack or a role, add one row — never a special case.**

Recoil is measured in **fractions of one unit width** (0.08–0.34), with three shake grades.
The pairing rule: `hard` shake goes with recoil ≥ 0.30; `rattle` is for *continuous* contact
(raking, boring, electrocuting) and pairs with **low** recoil.

### 9.7 Death: choreography instead of assets

> **"Every sprite is drawn standing, feet at the bottom of its 32×32 tile. So a half turn
> puts the unit on its back with all four paws in the air... That means no unit needs a
> second 'corpse' sprite: the comedy comes from the choreography and from a gag built out of
> the prop that unit is already carrying."**

The spec schema, and the constraints that make it work:
- `spin` — **always a half turn mod 360**, so it lands belly-up. Only ±180, ±540, ±900.
- `tilt` — the resting lean, **so no two corpses lie at the same angle**. Range −20…21.
- `hop` — launch height, and **this is where mass reads**: Clawdius 10 and Bone Jovi 14 are
  heavy; Barkour 48 and Purrtal 46 are light.
- `bounces` — 0–3.
- `gag` — a signature prop. *"Bombay Boom's bomb finally goes off. It is a dud."*
- `tongue` — **maps to comedy.** Every dignified death sets it false.

---

## 10. Sound

**Everything is synthesized — no SFX files.** One 27-second mp3 ("Backyard Bounce")
streamed via `HTMLAudioElement`, deliberately outside the Web Audio graph. Two primitives —
`tone()` and `noiseBurst()` — are the entire vocabulary.

### 10.1 Waveform semantics

| Type | Means | Used for |
| --- | --- | --- |
| `square` | impact, aggression, mechanical | hits, chomps, bombs, coins, UI clicks, the woof |
| `triangle` | warmth, friendliness, melody | fanfares, collection, merges, heal, cat death, the meow |
| `sine` | soft, glinting, ethereal | final sparkle notes, warp blips, victory pad |
| `sawtooth` | harsh, electric, scraping | **only 3 uses** — claws, laser burn, static zap |

### 10.2 The musical rule: C major, always

- **Success always ascends C major.** Celebration `C-E-G-C` (523/659/784/1047). Merge
  level-up `G-C-E-G-C`. Round complete `C-E-G`.
- **Defeat is the same notes descending and detuned** — `G-E-C` (392/330/262), each sliding
  down to `freq * 0.92`, spaced 200ms instead of 70–110ms. Sagging by design.

### 10.3 Two conventions worth keeping

- **`slideTo` is the signature move.** Nearly every effect glides in pitch, and almost
  everything slides **down** (impact = energy dissipating). The exceptions are semantically
  motivated: `frost` rises (crystallizing), `warp` goes up-then-down (a portal), `slice`
  rises (the whoosh before the cut), and the meow rises then falls (a question).
- **Combat jitters; ceremony does not.** `jitter()` applies ±7% pitch wobble *"so repeated
  hits never sound machine-stamped"* — applied to every combat sound, and never to UI,
  music cues, or fanfares. (Animal voices jitter too — no two meows are the same cat.)
- **Ambient voices are rate-limited; combat is not.** The splash screen's meows and woofs
  pass through a voice gate (`createVoiceGate`, `src/splash.js`) — a chance roll plus an
  enforced quiet gap — so idle chatter stays an accent over the music. Combat sounds never
  gate: if two hits land, you hear two hits.

Volumes: `SOUND_OUTPUT_CAP` 0.8 · `MUSIC_OUTPUT_CAP` 0.4 (music is capped at half of SFX) ·
`UI_CLICK_VOLUME` 0.024 is the quietest thing in the game. Recipe volumes run 0.015–0.075;
the loudest sound is `scorch` at 0.075.

**Every impact the graphics can show must have a sound** — `IMPACT_SOUNDS` mirrors `HURT_FX`
one-for-one and is *"guarded by a test."* Add an impact, add a voice.

---

## 11. The accessibility invariant

This is the most rigorous rule in the codebase and it's worth stating as law:

> **State is expressed in resting CSS values. Animation only decorates.**

The source says it three times:
- *"An effect that can only be seen while its animation is running disappears entirely the
  moment animations do not run."* (`styles.css:1743`)
- *"Scale only — never opacity. An animation that does not run must not be able to hide the
  eyes."* (`styles.css:3029`)
- *"Visible by default — the animation only adds the pop. Anything that says 'this unit is
  dead' must not depend on an animation actually running to be seen."* (`styles.css:3012`)

Practically: if you build a status indicator, it must be fully readable with every animation
stripped. Animate the entrance, never the existence.

Reduced motion also **swaps rather than kills** where it can — the coin-spend bounce is
dropped but its color beat survives; deaths keep their flash and fade (*"that is the part
that says the unit is gone"*) but lose the acrobatics and props.

Also: **focus is never gated on window focus** — only tab-level visibility, because embedded
webviews report `hasFocus()` false while fully on screen.

---

## 12. Copy voice

**Pixel font = SHOUT. Mono = talk.** The two faces are two registers.

| Register | Style | Examples |
| --- | --- | --- |
| Display (pixel) | SCREAMING CAPS, no punctuation | `READY` · `NEXT WAVE` · `LEVEL COMPLETE` · `FIELD GUIDE` · `GOLD` `LIVES` `ROUND` |
| Celebration (pixel) | CAPS + `!` | `LEVEL 3!` · `PRODUCTION BOOST!` · `NEW LOOK!` |
| Progress | `N / 3` | the stack counter |
| Reading (mono) | Sentence case, warm, brief | *"Backyard Defended!"* · *"The porch is safe—for now."* · *"Cat reserved safely on the Cat Workbench."* |
| Instruction (mono) | Imperative, concrete, names the target | *"Drag onto a damaged battlefield cat"* · *"Choose a dog column. The strike deals 2/4/6 damage by level."* |

**Objects get proper nouns, capitalised**: Cat Cart · Cat Workbench · Adoption Box ·
House Storage · Tactics · Supplies. They're places in the yard, so they're named like places.

**Naming characters** — the two rosters have two different jokes, and both are consistent:

- **Cats: a cat-sound pun plus a genre archetype.** Purrcy Pew-Pew (gunslinger) · Clawdius
  (bruiser) · Bombay Boom (saboteur) · Meowstro (conductor) · Purrtal (phantom).
- **Dogs: a celebrity or musician pun.** Chomps McGraw · Fetch Armstrong · Bark McEnroe ·
  Howl Pacino · Bone Jovi · Growl Gadot · Dr. Droolittle · Sir Flinches-a-Lot.

The dog joke is the tighter and more consistent of the two. A new dog needs a famous name
bent around a bark; a new cat needs a cat noise bent around an archetype.

**The tone is affectionate, never mean.** The dogs are the antagonists and they are still
lovingly drawn — Sir Flinches-a-Lot clutches a security blanket. Deaths are gags, not
violence: *"Chomps flops. That is the whole joke."*

---

## 13. Known deviations

These exist in the code today. **Don't copy them.**

### 13.1 The tutorial is a different design system

`styles.css:3143–3312` ignores nearly every rule above: `border-radius: 8/10/12/16px`, `1px`
borders, a **32px-blur soft shadow** `0 12px 32px rgba(0,0,0,.5)`, navy `#12203a` on
`#eaf1ff`, `ease-in-out`, `transition: all 180ms ease`, and 18px/1.55 body copy. Its accent
`--tutorial-accent: #63e6ff` is *almost but not quite* the game's ability cyan `#8ee7ff`.

It is a modern-web tooltip pasted into an arcade cabinet, and it is the single largest
aesthetic discontinuity in the project. **If the tutorial gets touched, it should be brought
back to the house style**: square corners, ink border, hard `4px 4px 0` shadow, `steps()`
pulses, cyan `#8ee7ff`.

### 13.2 Dead and missing tokens

- `--cream` `#f4e7bd` — **0 uses.** Dead.
- `--amber` `#e4a928` — **0 uses**, but the literal is hardcoded 3× for coins and half-health.
  The semantic is coherent; the token just isn't wired up.
- `--green` `#75a64b` — **1 use** (the music slider). Meanwhile green is everywhere as
  literals: lawn `#6ea24c`, HP-full `#6ed25e`.
- `--paper`'s value `#fff8dc` is written raw **16 times** vs. 11 uses of the token.
- **`#ffe56e` and `#8ee7ff` should be tokens** — 40 combined uses, more semantic weight than
  any token but `--ink`.

**Prefer `var(--ink)` and `var(--paper)` over their literals in new code.**

### 13.3 The outline color has no importable symbol

`OUTLINE = '#172b36'` (`pixel-art.js:17`) is module-private and **re-declared as a local
literal twice more** (lines 525, 558). The most important color in the game can't be
imported. Same for the number `32` — the sprite size is a default arg in one place, a literal
in three others.

### 13.4 The type ramp sprawled across three passes

The stylesheet is structured **base → correction → correction**: the original design, then a
"Type system" block at 2653, then a "Large-type interface scale" block at 3314, then mobile
re-corrections at 3463. Same-specificity later-wins does all the work, and `.upgrade-callout`
is declared **three times in one file** (2598, 2776, 3453).

Result: ~33 distinct font sizes against a stated ramp of six. The *effective* ramp is
narrower than the raw count, but new work should target the stated ramp
(**pixel 8/12/16, mono 10/12/16**) and edit the existing declaration rather than appending a
fourth override.

### 13.5 Reduced motion is a real gap

`prefers-reduced-motion` is honoured in CSS (4 blocks, thoughtfully). **But in JS it does not
disable anything** — `src/app.js:69` uses it *only* to default the 1×/2× speed toggle to 2×
("the shorter show"). A reduced-motion user still sees every spin, bounce, shake, and strobe,
just at double speed.

That's a defensible design position (motion *is* the game), but it should be a conscious one.
The CSS blocks catch the worst of it; the JS-driven animations aren't covered.

### 13.6 Timing constants that escaped the tables

`TANGLE_BIND_TIMING`, `BLUE_SCRATCH_FLURRY`, and `UPGRADE_TIMING` aren't covered by a scaler
function — callers divide by hand. Worse, `src/app.js:2693–2757` has bare literals (`440`,
`220`, `680`, `1000`, `1100`) divided inline by `combatSpeed`. **New timings belong in a
frozen table with a scaler**, per §9.4.

---

## 14. Checklist

Before shipping a new piece of UI:

- [ ] Outlined in `--ink`? Square corners? Hard offset shadow with no blur?
- [ ] Is the shadow offset the right rung on the elevation ladder (§5)?
- [ ] Pixel font only for short shouty labels; mono for anything you read?
- [ ] Pixel font pinned to `font-weight: 400` and `letter-spacing: 0`?
- [ ] Is orange used exactly once, on the one thing to press?
- [ ] Does every quantity sit on a `#ffe56e` chip? Every ability effect in `#8ee7ff`?
- [ ] Animations in `steps()` — or the reward curve if it's a positive moment?
- [ ] **Does it fully read with all animation disabled?** (§11)
- [ ] Disabled state drops the shadow rather than only dimming?
- [ ] New sprite: silhouette identifiable in black at 32px? Level readable without a badge?
- [ ] New attack or role: one new row in the FX tables, no special cases?
- [ ] New impact: does it have a sound? (`IMPACT_SOUNDS` is test-guarded.)
- [ ] Copy: CAPS to shout, sentence case to talk, affectionate never mean?

---

## Source map

| What | Where |
| --- | --- |
| Colors, type, depth, components, keyframes, responsive | `styles.css` |
| Sprites, coat/tier palettes, equipment ramps, silhouettes | `src/pixel-art.js` |
| Timing tables, projectile paths, speed scaler | `src/combat-animation.js` |
| Death beats and per-character gags | `src/death-animation.js` |
| Attack/hurt/reaction registries, damage numbers | `src/battle-fx.js` |
| Melee choreography contract | `src/melee-animation.js` |
| Upgrade beats and celebration labels | `src/upgrade-animation.js` |
| Synthesized SFX, music, volume rules | `src/sound.js` |
| Placement impact constants | `src/drag-drop.js` |
| Start-screen peekaboo, pop pools, the ambient voice gate | `src/splash.js` |
