export const DRAG_FEEDBACK = Object.freeze({
  thresholdPx: 7,
  liftMs: 150,
  liftScale: 1.22,
  hoverScale: 1.28,
  dropMs: 280,
  returnMs: 260,
});

export const CAT_MOVE_LIMIT_MESSAGE = 'During prep, each cat can move only one adjacent square.';

// Placement feedback retains 40% of the original landing force (a 60% cut).
export const DROP_IMPACT = Object.freeze({
  intensity: 0.4,
  boardShakePx: 1.2,
  landingLiftPercent: 11.2,
  ghostSettleScale: 0.928,
  ringEndScale: 1.68,
  soundGain: 0.4,
});

const invalid = (reason = null) => ({ type: 'invalid', ...(reason ? { reason } : {}) });

function sameCatKind(source, occupied) {
  if (!occupied || source.id === occupied.id) return false;
  const sameLevel = Number(source.level) === Number(occupied.level);
  const sourceCoat = source.coat == null ? null : Number(source.coat);
  const targetCoat = occupied.coat == null ? null : Number(occupied.coat);
  const sameCoat = sourceCoat == null || targetCoat == null || sourceCoat === targetCoat;
  return sameLevel && sameCoat;
}

export function getDropAction({ source, target, catZoneStart, rows, cols, phase = 'prep', paused = false }) {
  if (!source || !target) return invalid();

  if (target.kind === 'sell') {
    return phase === 'prep'
      && (source.type === 'cat' || source.type === 'bench')
      && source.sellable
      ? { type: 'sell', value: source.sellValue }
      : invalid();
  }

  if (source.type === 'item' && target.kind === 'fighter') {
    if (source.itemKind === 'food') {
      return phase === 'tactics' && target.hp > 0 && target.hp < target.maxHp
        ? { type: 'use-food', targetId: target.id }
        : invalid();
    }
    if ((source.itemKind === 'weapon' || source.itemKind === 'armour') && (phase === 'prep' || phase === 'tactics' || paused)) {
      return { type: 'equip', targetId: target.id };
    }
    return invalid();
  }

  if (target.kind === 'worker-slot') {
    const occupied = target.occupied;
    const compatible = occupied
      && occupied.id !== source.id
      && occupied.role === source.role
      && Number(occupied.level) === Number(source.level)
      && Number(occupied.level) < 3;
    if (source.type === 'shop-worker') {
      return !occupied || compatible
        ? { type: 'purchase-worker', index: target.index, ...(compatible ? { targetId: occupied.id } : {}) }
        : invalid();
    }
    if (source.type === 'worker') {
      if (compatible) return { type: 'merge-worker', index: target.index, targetId: occupied.id };
      return !occupied ? { type: 'move-worker', index: target.index } : invalid();
    }
    return invalid();
  }

  if (target.kind === 'cell') {
    if (source.type !== 'shop-fighter' && source.type !== 'bench' && source.type !== 'cat') return invalid();
    const inBounds = target.row >= 0 && target.row < rows && target.col >= 0 && target.col < cols;
    if (!inBounds || target.row < catZoneStart) return invalid();
    if (target.occupied) {
      if (!sameCatKind(source, target.occupied)) return invalid();
      return source.type === 'shop-fighter'
        ? { type: 'purchase-merge', targetType: 'cat', targetId: target.occupied.id }
        : { type: 'merge', targetType: 'cat', targetId: target.occupied.id };
    }
    if (source.type === 'shop-fighter') return { type: 'purchase-place', row: target.row, col: target.col };
    if ((source.type === 'cat' || source.type === 'bench') && source.prepMoved) return invalid();
    if ((source.type === 'cat' || source.type === 'bench') && source.prepOrigin) {
      const distance = Math.abs(target.row - source.prepOrigin.row) + Math.abs(target.col - source.prepOrigin.col);
      if (distance > 1) return invalid('move-distance');
    }
    return source.type === 'bench'
      ? { type: 'place', row: target.row, col: target.col }
      : { type: 'move', row: target.row, col: target.col };
  }

  if (target.kind === 'bench') {
    if (source.type !== 'shop-fighter' && source.type !== 'cat') return invalid();
    if (target.occupied) {
      if (!sameCatKind(source, target.occupied)) return invalid();
      return source.type === 'shop-fighter'
        ? { type: 'purchase-merge', targetType: 'bench', targetId: target.occupied.id }
        : { type: 'merge', targetType: 'bench', targetId: target.occupied.id };
    }
    if (source.type === 'shop-fighter') return { type: 'purchase-bench', index: target.index };
    return source.type === 'cat' ? { type: 'return' } : invalid();
  }

  return invalid();
}
