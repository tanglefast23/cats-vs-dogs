# Cats vs Dogs: Backyard Battle

A personal turn-based backyard defense game.

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

- Six cat coats with different abilities; later coats unlock on rounds 3, 5, and 7:
  - **Purrcy Pew-Pew** — 3-shot column burst
  - **Clawdius** — heavy front melee, double HP
  - **Hissiletoe** — weaker homing sine-wave shot
  - **Knotty Kitty** (R3) — homing yarn that skips the target's next move
  - **Bombay Boom** (R5) — bomb with splash to adjacent columns
  - **Laserpaw** (R7) — beam that pierces up to three dogs in its lane
- Dog roles escalate from **Chomps McGraw** to **Bark McEnroe**, **Howl Pacino**, and **Barkour Bandit**
- Dog tiers scale from **Yard Punk** through **Ironhide** and **Bonecrusher** to round-seven **Top Dog**
- Cats only stack/merge with the **same color and level**
- Shop pets can be **Saved** through refresh and into the next round
- HUD **SPEED** chip toggles 1×/2× combat (persisted; reduced-motion users default to 2×)
- Settings includes sound on/off
- Layout stacks below ~880px, so narrow windows and phones stay playable

## Deploy

Static site. Vercel serves `index.html` from the repo root.

## Desktop target

The intended release target is Steam on Windows and macOS. Keep new work compatible with the staged Electron transition described in [docs/brainstorms/2026-07-12-electron-transition.md](docs/brainstorms/2026-07-12-electron-transition.md).
