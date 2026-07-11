# Cats vs Dogs: Backyard Battle

A personal turn-based backyard defense game.

## Play

- Local: `npm start` then open `http://localhost:4173`
- Tests: `npm test`

## Game notes

- Three cat coats with different abilities:
  - **Orange Tabby** — column shot
  - **Snow Ghost** — weaker homing sine-wave shot
  - **Blue Brawler** — heavy front melee, double HP
- Cats only stack/merge with the **same color and level**
- Shop pets can be **Saved** through refresh and into the next round
- Settings includes sound on/off

## Deploy

Static site. Vercel serves `index.html` from the repo root.
