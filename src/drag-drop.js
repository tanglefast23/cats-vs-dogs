export const DRAG_FEEDBACK = Object.freeze({
  thresholdPx: 7,
  liftMs: 150,
  liftScale: 1.22,
  hoverScale: 1.28,
  dropMs: 280,
  returnMs: 260,
});

// Placement feedback retains 40% of the original landing force (a 60% cut).
export const DROP_IMPACT = Object.freeze({
  intensity: 0.4,
  boardShakePx: 1.2,
  landingLiftPercent: 11.2,
  ghostSettleScale: 0.928,
  ringEndScale: 1.68,
  soundGain: 0.4,
});

const invalid = () => ({ type: 'invalid' });

function sameCatKind(source, occupied) {
  if (!occupied || source.id === occupied.id) return false;
  const sameLevel = Number(source.level) === Number(occupied.level);
  const sourceCoat = source.coat == null ? null : Number(source.coat);
  const targetCoat = occupied.coat == null ? null : Number(occupied.coat);
  const sameCoat = sourceCoat == null || targetCoat == null || sourceCoat === targetCoat;
  return sameLevel && sameCoat;
}

export function getDropAction({ source, target, catZoneStart, rows, cols }) {
  if (!source || !target) return invalid();

  if (target.kind === 'cell') {
    const inBounds = target.row >= 0 && target.row < rows && target.col >= 0 && target.col < cols;
    if (!inBounds || target.row < catZoneStart) return invalid();
    if (target.occupied) {
      return sameCatKind(source, target.occupied)
        ? { type: 'merge', targetType: 'cat', targetId: target.occupied.id }
        : invalid();
    }
    return source.type === 'bench'
      ? { type: 'place', row: target.row, col: target.col }
      : { type: 'move', row: target.row, col: target.col };
  }

  if (target.kind === 'bench') {
    if (target.occupied) {
      return sameCatKind(source, target.occupied)
        ? { type: 'merge', targetType: 'bench', targetId: target.occupied.id }
        : invalid();
    }
    return source.type === 'cat' ? { type: 'return' } : invalid();
  }

  return invalid();
}
