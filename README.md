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

- Battle cats have different abilities; later cats unlock on rounds 4 and 7:
  - **Purrcy Pew-Pew** — highest damage, but only in its own column
  - **Clawdius** — extreme HP, but tiny front-only melee damage
  - **Hissiletoe** — balanced health and medium homing damage
  - **Knotty Kitty** — very low damage; tangles each dog once
  - **Bombay Boom** (R4) — weak single hit with strong adjacent-column splash
  - **Laserpaw** (R7) — fragile beam that pierces up to three dogs in one lane
  - **Frosty, Purrtal, Faux Paw, Thunderpaws, and Meowstro** (R4) — low normal stats traded for one specialized Tactics ability
- Dog roles are equally specialized: **Chomps McGraw** bites hardest; **Fetch Armstrong**, **Bark McEnroe**, and **Bone Jovi** attack at range; **Howl Pacino** buffs the pack; **Barkour Bandit** bypasses a defender; **Dr. Droolittle** heals allies; and **Growl Gadot** weakens a cat's next attack
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
