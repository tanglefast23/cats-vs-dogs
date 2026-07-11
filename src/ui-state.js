export function selectionAfterPurchase(previousSelection, purchaseSucceeded) {
  return purchaseSucceeded ? null : previousSelection;
}

export function shopPetAvailability({ sold, gold, benchLength, benchSize, phase, playing }) {
  if (sold) return { interactive: false, canBuy: false, reason: 'sold' };
  if (phase !== 'prep' || playing) return { interactive: false, canBuy: false, reason: 'phase' };
  if (gold < 3) return { interactive: true, canBuy: false, reason: 'gold' };
  if (benchLength >= benchSize) return { interactive: true, canBuy: false, reason: 'bench' };
  return { interactive: true, canBuy: true, reason: null };
}
