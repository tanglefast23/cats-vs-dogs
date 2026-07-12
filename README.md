# Cats vs Dogs: Backyard Battle

A personal real-time backyard defense game.

## Play & develop

- Browser dev server: `npm run dev` (or `npm start`) → http://127.0.0.1:4173
- Browser production build: `npm run build` (outputs `dist/`)
- Preview the production bundle locally: `npm run preview` → http://127.0.0.1:4173
- Electron (dev, with Vite HMR): `npm run electron:dev`
- Electron (production renderer, no server needed): `npm run electron`
- Package the desktop app: `npm run package:electron` (outputs `out/`)
- Tests: `npm test`

The browser and Electron versions share the exact same renderer — everything
under `src/` stays browser-pure (no Electron/Node imports).

## Game notes

- **Fully real-time**: one continuous level. Waves 1–7 arrive on a visible countdown,
  cats auto-attack on countdown rings (one attack per dog step), and gold drips in
  continuously (10 per four dog-steps of time). No prep phase, no turn button.
- **Placement is permanent** — placed cats never reposition. Sell them to the
  Adoption Box, or let Purrtal teleport them.
- **Active abilities recharge on a 20s cooldown**: tap a READY cat, then tap the
  target. The world drops to 25% slow motion while you aim or carry items.
- **Production cats** craft every 20s, then nap until you collect; food, weapons,
  and armour equip live from Storage mid-battle.
- Six fighting coats plus five tap-ability coats; later coats unlock on waves 3, 5, and 7:
  - **Purrcy Pew-Pew** — 3-shot column burst
  - **Clawdius** — heavy front melee, double HP
  - **Hissiletoe** — weaker homing sine-wave shot
  - **Knotty Kitty** (W3) — homing yarn that skips the target's next move
  - **Bombay Boom** (W5) — bomb with splash to adjacent columns
  - **Laserpaw** (W7) — beam that pierces up to three dogs in its lane
  - **Frosty Paws / Purrtal / Faux Paw / Thunderpaws / Meowstro** (W5) — tap-to-cast freeze, teleport, decoy, column storm, and encore
- Dog roles escalate from **Chomps McGraw** to **Bark McEnroe**, **Howl Pacino**, and **Barkour Bandit**
- Dog tiers scale from **Yard Punk** through **Ironhide** and **Bonecrusher** to wave-seven **Top Dog**
- Cats only stack/merge with the **same color and level**
- Shop pets can be **Saved** through refresh and wave rerolls
- HUD **SPEED** chip toggles 1×/2× (persisted; reduced-motion users default to 2×); the game auto-pauses when the window loses focus
- Settings includes sound on/off
- Layout stacks below ~880px, so narrow windows and phones stay playable

## Deploy

Static site. Vercel serves `index.html` from the repo root.

## Desktop target

The intended release target is Steam on Windows and macOS. Keep new work compatible with the staged Electron transition described in [docs/brainstorms/2026-07-12-electron-transition.md](docs/brainstorms/2026-07-12-electron-transition.md).
