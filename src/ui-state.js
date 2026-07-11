export function selectionAfterPurchase(previousSelection, purchaseSucceeded) {
  return purchaseSucceeded ? null : previousSelection;
}
