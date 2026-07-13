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

/** Equipment badges shown on a deployed cat, ordered weapon then armour. */
export function equippedItemMarkers(cat = {}) {
  return ['weapon', 'armour'].flatMap((kind) => {
    const item = cat.equipment?.[kind];
    return item ? [{ kind, tier: item.tier ?? 1 }] : [];
  });
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

/** Order glossary roster entries by unlock round, then preserve their numeric roster order. */
export function glossaryEntriesByUnlockRound(infoByKey = {}) {
  return Object.entries(infoByKey).sort(([leftKey, left], [rightKey, right]) => (
    (left.unlockRound ?? 1) - (right.unlockRound ?? 1)
    || Number(leftKey) - Number(rightKey)
  ));
}

/** Queue dogs by arrival, then by their battlefield column for simultaneous arrivals. */
export function dogPreviewQueue(dogs = []) {
  return dogs
    .map((dog, index) => ({ dog, index }))
    .sort((left, right) => (
      (left.dog.appearanceIndex ?? 0) - (right.dog.appearanceIndex ?? 0)
      || (left.dog.col ?? 0) - (right.dog.col ?? 0)
      || left.index - right.index
    ))
    .map(({ dog }) => dog);
}

/** Resolve where production output will land so collection animation matches engine behavior. */
export function productionCollectionDestination(inventory = [], output = null) {
  if (!output?.kind) return null;
  if (output.kind === 'coins') return { type: 'gold', index: null };
  const matchingIndex = inventory.findIndex((stack) => (
    stack?.kind === output.kind && (stack.tier ?? null) === (output.tier ?? null)
  ));
  if (matchingIndex >= 0) return { type: 'storage', index: matchingIndex };
  const emptyIndex = inventory.findIndex((stack) => !stack);
  return emptyIndex >= 0 ? { type: 'storage', index: emptyIndex } : null;
}

/** Minimal Cat Cart copy; detailed abilities remain in the glossary. */
export function shopCardSummary(slot, info) {
  return {
    badge: slot.category === 'worker' ? 'WORK' : `T${info.shopTier}`,
    name: slot.sold ? 'ADOPTED' : info.name,
    cost: 3,
  };
}

export function workerTooltipInfo(worker, info) {
  const level = worker.level ?? 1;
  const output = info.output[level] ?? info.output[1];
  const tier = output.tier ? ` T${output.tier}` : '';
  const productionRounds = info.productionRounds ?? 1;
  const timing = productionRounds === 1 ? 'after each battle' : `every ${productionRounds} battles`;
  return {
    kind: 'cat',
    title: `L${level} ${info.name}`,
    stats: `Produces ${output.quantity}${tier} ${output.kind} ${timing}`,
    detailLabel: 'Production',
    attack: 'Place in the Production House. Three matching workers evolve to the next level.',
    note: worker.pendingOutput
      ? 'Collect the ready output before the next production cycle replaces it.'
      : productionRounds > 1 && worker.productionProgress
        ? `${worker.productionProgress} of ${productionRounds} battles completed.`
        : info.blurb,
  };
}

export function shopPetAvailability({ sold, gold, benchLength, benchSize, phase, playing }) {
  if (sold) return { interactive: false, canBuy: false, reason: 'sold' };
  if (phase !== 'prep' || playing) return { interactive: false, canBuy: false, reason: 'phase' };
  if (gold < 3) return { interactive: true, canBuy: false, reason: 'gold' };
  if (benchLength >= benchSize) return { interactive: true, canBuy: false, reason: 'bench' };
  return { interactive: true, canBuy: true, reason: null };
}
