export const BIG_MELEE_MOVE_LIMIT = 1;
export const SMALL_CAT_MOVE_LIMIT = 2;
export const CAT_PLANNING_MOVE_SPENT_MESSAGE = '1 move per setup or battle break.';

export function catMoveLimit(cat) {
  return cat?.ability === 'melee' ? BIG_MELEE_MOVE_LIMIT : SMALL_CAT_MOVE_LIMIT;
}

export function catMoveLimitMessage(catOrLimit) {
  const limit = typeof catOrLimit === 'number' ? catOrLimit : catMoveLimit(catOrLimit);
  return `This cat can only move ${limit} ${limit === 1 ? 'square' : 'squares'}.`;
}

// Draw a stable shortest route: across columns first, then across rows.
export function catMovementPath(source, target, phase = 'prep') {
  if (
    source?.type !== 'cat' || target?.kind !== 'cell'
    || target.occupied
    || !Number.isInteger(source.row) || !Number.isInteger(source.col)
    || !Number.isInteger(target.row) || !Number.isInteger(target.col)
  ) return [];

  const unrestrictedSetup = phase === 'prep' && !source.hasEnteredBattle;
  const limit = unrestrictedSetup ? Number.POSITIVE_INFINITY : catMoveLimit(source);
  const canMove = unrestrictedSetup || (phase === 'tactics' ? !source.tacticsMoved : !source.prepMoved);
  const path = [{ row: source.row, col: source.col, withinLimit: canMove }];
  let row = source.row;
  let col = source.col;
  let steps = 0;

  while (col !== target.col) {
    col += Math.sign(target.col - col);
    steps += 1;
    path.push({ row, col, withinLimit: canMove && steps <= limit });
  }
  while (row !== target.row) {
    row += Math.sign(target.row - row);
    steps += 1;
    path.push({ row, col, withinLimit: canMove && steps <= limit });
  }
  return path;
}
