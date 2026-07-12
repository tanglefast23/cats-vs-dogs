import { addCatToBench, placeCat, advance } from '../src/game-engine.js';

/** Buy-free shortcut: bench a coat and drop it straight onto the board. */
export function placeCoat(game, coat, row, col) {
  game = addCatToBench(game, { level: 1, coat });
  return placeCat(game, game.bench.length - 1, row, col);
}

/**
 * Fire every placed unit once at the same instant — cats first, then dogs —
 * matching the old lockstep exchange, so ported rule tests read the same.
 */
export function runExchange(game) {
  game.cats.forEach((cat) => { cat.nextAttackAt = game.clockMs + 1; });
  game.dogs.forEach((dog) => { dog.nextActAt = game.clockMs + 1; });
  return advance(game, 1);
}
