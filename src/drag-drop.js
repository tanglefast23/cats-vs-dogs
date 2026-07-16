import { catCanCrossTerritoryBoundary, catMoveLimit } from './movement-rules.js';

export const DRAG_FEEDBACK = Object.freeze({
  thresholdPx: 7,
  liftMs: 150,
  liftScale: 1.22,
  hoverScale: 1.28,
  dropMs: 280,
  returnMs: 260,
});

export const FIELD_CAP_MESSAGE = 'Elite Squad full (5/5). Merge, workbench, or sell a cat before deploying another.';

// Placement motion stays gentle, while the audio cue remains loud enough to register.
export const DROP_IMPACT = Object.freeze({
  intensity: 0.4,
  boardShakePx: 1.2,
  landingLiftPercent: 11.2,
  ghostSettleScale: 0.928,
  ringEndScale: 1.68,
  soundGain: 0.9,
});

const invalid = (reason = null) => ({ type: 'invalid', ...(reason ? { reason } : {}) });

export function isBattlefieldDropAction(action) {
  return ['purchase-place', 'place', 'move', 'tactics-move'].includes(action?.type);
}

function sameCatKind(source, occupied) {
  if (!occupied || occupied.unitType === 'worker' || source.id === occupied.id) return false;
  const sameLevel = Number(source.level) === Number(occupied.level);
  const sourceCoat = source.coat == null ? null : Number(source.coat);
  const targetCoat = occupied.coat == null ? null : Number(occupied.coat);
  const sameCoat = sourceCoat == null || targetCoat == null || sourceCoat === targetCoat;
  return sameLevel && sameCoat;
}

function sameWorkerKind(source, occupied) {
  return Boolean(
    occupied && occupied.unitType === 'worker' && source.id !== occupied.id
    && occupied.role === source.role
    && Number(occupied.level) === Number(source.level)
    && Number(occupied.level) < 3,
  );
}

export function getDropAction({
  source, target, catZoneStart, rows, cols, phase = 'prep', paused = false,
  fieldCount = 0, fieldCap = Number.POSITIVE_INFINITY,
}) {
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
      return (phase === 'prep' || phase === 'tactics') && target.hp > 0 && target.hp < target.maxHp
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
    const compatible = sameWorkerKind(source, occupied);
    if (source.type === 'shop-worker') {
      return !occupied || compatible
        ? { type: 'purchase-worker', index: target.index, ...(compatible ? { targetId: occupied.id } : {}) }
        : invalid();
    }
    if (source.type === 'worker') {
      if (compatible) return { type: 'merge-worker', index: target.index, targetId: occupied.id };
      return !occupied ? { type: 'move-worker', index: target.index } : invalid();
    }
    if (source.type === 'bench-worker') {
      return !occupied || compatible
        ? { type: 'place-worker', index: target.index, ...(compatible ? { targetId: occupied.id } : {}) }
        : invalid();
    }
    return invalid();
  }

  if (target.kind === 'cell') {
    if (source.type !== 'shop-fighter' && source.type !== 'bench' && source.type !== 'cat') return invalid();
    const inBounds = target.row >= 0 && target.row < rows && target.col >= 0 && target.col < cols;
    if (!inBounds) return invalid();
    if (phase === 'tactics') {
      if (target.row < catZoneStart && !catCanCrossTerritoryBoundary(source)) return invalid();
      if (source.type !== 'cat' || target.occupied) return invalid();
      if (source.tacticsMoved) return invalid('prep-moved');
      const origin = source.tacticsOrigin ?? { row: source.row, col: source.col };
      const distance = Math.abs(target.row - origin.row) + Math.abs(target.col - origin.col);
      if (distance < 1 || distance > catMoveLimit(source)) return invalid('move-distance');
      return { type: 'tactics-move', row: target.row, col: target.col };
    }
    if (phase !== 'prep') return invalid('phase');
    if (target.occupied) {
      if (!sameCatKind(source, target.occupied)) return invalid();
      return source.type === 'shop-fighter'
        ? { type: 'purchase-merge', targetType: 'cat', targetId: target.occupied.id }
        : { type: 'merge', targetType: 'cat', targetId: target.occupied.id };
    }
    if (target.row < catZoneStart && !catCanCrossTerritoryBoundary(source)) return invalid();
    const restrictedSetupMove = (source.type === 'cat' || source.type === 'bench') && source.hasEnteredBattle;
    if (restrictedSetupMove && source.prepMoved) return invalid('prep-moved');
    const moveOrigin = source.prepOrigin
      ?? (source.type === 'cat' && Number.isInteger(source.row) && Number.isInteger(source.col)
        ? { row: source.row, col: source.col }
        : null);
    if (restrictedSetupMove && moveOrigin) {
      const distance = Math.abs(target.row - moveOrigin.row) + Math.abs(target.col - moveOrigin.col);
      if (distance > catMoveLimit(source)) return invalid('move-distance');
    }
    if ((source.type === 'shop-fighter' || source.type === 'bench') && fieldCount >= fieldCap) {
      return invalid('field-cap');
    }
    if (source.type === 'shop-fighter') return { type: 'purchase-place', row: target.row, col: target.col };
    return source.type === 'bench'
      ? { type: 'place', row: target.row, col: target.col }
      : { type: 'move', row: target.row, col: target.col };
  }

  if (target.kind === 'bench') {
    if (source.type === 'shop-worker') {
      const compatible = sameWorkerKind(source, target.occupied);
      return !target.occupied || compatible
        ? { type: 'purchase-worker-bench', index: target.index, ...(compatible ? { targetId: target.occupied.id } : {}) }
        : invalid();
    }
    if (source.type === 'worker') {
      const compatible = sameWorkerKind(source, target.occupied);
      return !target.occupied || compatible
        ? { type: 'return-worker', index: target.index, ...(compatible ? { targetId: target.occupied.id } : {}) }
        : invalid();
    }
    if (source.type === 'bench-worker') {
      return sameWorkerKind(source, target.occupied)
        ? { type: 'merge-bench-worker', index: target.index, targetId: target.occupied.id }
        : invalid();
    }
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
