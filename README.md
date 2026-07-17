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
  - **Bombay Boom** (R4) — medium lane bomb; once per battle, aims a half-damage five-square plus blast
  - **Laserpaw** (R7) — fragile beam that pierces up to three dogs in one lane
  - **Frosty, Purrtal, Faux Paw, Thunderpaws, and Meowstro** (R4) — low normal stats traded for one specialized Tactics ability
- Dog roles are equally specialized: **Chomps McGraw** bites hardest; **Fetch Armstrong**, **Bark McEnroe**, and **Bone Jovi** attack at range; **Howl Pacino** buffs the pack; **Barkour Bandit** moves 3 squares and vaults over a defender but takes +1 damage per hit; **Sir Flinches-a-Lot** panic-steps sideways after surviving a hit; **Dr. Droolittle** heals allies; and **Growl Gadot** weakens a cat's next attack
- Dog tiers scale from **Yard Punk** through **Ironhide** and **Bonecrusher** to round-seven **Top Dog**
- The battlefield is an **Elite Squad**: deploy up to 5 cats, then strengthen those slots through same-color merges; level 2 doubles and level 3 triples a level-1 cat's attack and numerical ability strength
- Waves grow from 2 dogs in round 1 to 7 in round 10; rounds 5–8 no longer roll tier-one dogs, rounds 9–10 start at tier three, and late waves guarantee a mix of the new ranged/support specialists
- Cats only stack/merge with the **same color and level**
- In round 10, every Tactics Window refreshes each cat's active ability
- Shop pets can be **Saved** through refresh and into the next round
- HUD **SPEED** chip toggles 1×/2× combat (persisted; reduced-motion users default to 2×)
- Settings includes independent sound-effects and music volume sliders
- Layout stacks below ~880px, so narrow windows and phones stay playable

## Design

[docs/STYLE.md](docs/STYLE.md) is the style guide — the game's colors, type, depth,
pixel-art rules, motion, sound, and copy voice, with the reasons behind each. Read it
before adding UI, art, or effects. It also records where the code currently drifts from
its own rules, so those parts don't get copied forward.

## Deploy

Static site. Vercel serves `index.html` from the repo root.

## Desktop target

The intended release target is Steam on Windows and macOS. Keep new work compatible with the staged Electron transition described in [docs/brainstorms/2026-07-12-electron-transition.md](docs/brainstorms/2026-07-12-electron-transition.md).
