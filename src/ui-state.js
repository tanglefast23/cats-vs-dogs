export function selectionAfterPurchase(previousSelection, purchaseSucceeded) {
  return purchaseSucceeded ? null : previousSelection;
}

/** Health color band for unit HP bars: green above half, amber to a quarter, red below. */
export function hpTone(hp, maxHp) {
  const pct = maxHp > 0 ? hp / maxHp : 0;
  if (pct > 0.5) return 'full';
  if (pct > 0.25) return 'mid';
  return 'low';
}

const PRODUCTION_ROLE_COPY = Object.freeze({
  cook: 'cooks healing food',
  trader: 'earns bonus coins',
  weaponsmith: 'forges attack weapons',
  armourer: 'makes bite-blocking armour',
});

export function productionLegendRows(workerInfo) {
  return Object.entries(workerInfo).map(([role, info]) => ({
    role,
    name: info.shortName.toUpperCase(),
    description: PRODUCTION_ROLE_COPY[role] ?? info.blurb,
  }));
}

const GLOSSARY_TABS = Object.freeze([
  Object.freeze({ id: 'battle', label: 'Battle Cats' }),
  Object.freeze({ id: 'production', label: 'Production Cats' }),
  Object.freeze({ id: 'dogs', label: 'Dogs' }),
]);

export function glossaryTabs(activeId = 'battle') {
  return GLOSSARY_TABS.map((tab) => ({ ...tab, active: tab.id === activeId }));
}

export function shopPetAvailability({ sold, gold, benchLength, benchSize, phase, playing }) {
  if (sold) return { interactive: false, canBuy: false, reason: 'sold' };
  if (phase !== 'prep' || playing) return { interactive: false, canBuy: false, reason: 'phase' };
  if (gold < 3) return { interactive: true, canBuy: false, reason: 'gold' };
  if (benchLength >= benchSize) return { interactive: true, canBuy: false, reason: 'bench' };
  return { interactive: true, canBuy: true, reason: null };
}
