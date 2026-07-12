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

const invalid = (reason = null) => ({ type: 'invalid', ...(reason ? { reason } : {}) });

function sameCatKind(source, occupied) {
  if (!occupied || source.id === occupied.id) return false;
  const sameLevel = Number(source.level) === Number(occupied.level);
  const sourceCoat = source.coat == null ? null : Number(source.coat);
  const targetCoat = occupied.coat == null ? null : Number(occupied.coat);
  const sameCoat = sourceCoat == null || targetCoat == null || sourceCoat === targetCoat;
  return sameLevel && sameCoat;
}

/**
 * Everything is decided by what is dragged onto what — the battle always runs,
 * so there are no phase gates. Placed cats never move again: a board cat can
 * only merge onto a matching cat or ride to the adoption box.
 */
export function getDropAction({ source, target, catZoneStart, rows, cols }) {
  if (!source || !target) return invalid();

  if (target.kind === 'sell') {
    return (source.type === 'cat' || source.type === 'bench') && source.sellable
      ? { type: 'sell', value: source.sellValue }
      : invalid();
  }

  if (source.type === 'item' && target.kind === 'fighter') {
    if (source.itemKind === 'food') {
      return target.hp > 0 && target.hp < target.maxHp
        ? { type: 'use-food', targetId: target.id }
        : invalid();
    }
    if (source.itemKind === 'weapon' || source.itemKind === 'armour') {
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
    if (source.type === 'bench') return { type: 'place', row: target.row, col: target.col };
    return invalid('placement-permanent');
  }

  if (target.kind === 'bench') {
    if (source.type !== 'shop-fighter' && source.type !== 'cat') return invalid();
    if (target.occupied) {
      if (!sameCatKind(source, target.occupied)) return invalid();
      return source.type === 'shop-fighter'
        ? { type: 'purchase-merge', targetType: 'bench', targetId: target.occupied.id }
        : { type: 'merge', targetType: 'bench', targetId: target.occupied.id };
    }
    return source.type === 'shop-fighter' ? { type: 'purchase-bench', index: target.index } : invalid();
  }

  return invalid();
}
