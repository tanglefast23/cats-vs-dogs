import { REALTIME } from './game-engine.js';
import { FOOD_HEAL, WEAPON_INFO, ARMOUR_INFO } from './production-rules.js';

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
  return {
    kind: 'cat',
    title: `L${level} ${info.name}`,
    stats: `Produces ${output.quantity}${tier} ${output.kind} every ${REALTIME.workerProduceMs / 1000}s`,
    detailLabel: 'Production',
    attack: 'Place in the Production House. Three matching workers evolve to the next level.',
    note: worker.pendingOutput
      ? 'Napping — collect the finished item to start the next batch.'
      : info.blurb,
  };
}

export function itemTooltipInfo(item) {
  const quantity = item?.quantity ?? 1;
  if (item?.kind === 'food') {
    return {
      kind: 'item',
      title: 'Healing Food',
      stats: `Stored ×${quantity} · restores ${FOOD_HEAL} health`,
      detailLabel: 'Use',
      attack: 'Drag onto a damaged battlefield cat.',
      note: 'Consumed when used. Healing cannot exceed the cat\'s maximum health.',
    };
  }

  const tier = item?.tier ?? 1;
  if (item?.kind === 'weapon') {
    const attack = WEAPON_INFO[tier]?.attack ?? WEAPON_INFO[1].attack;
    return {
      kind: 'item',
      title: `Tier ${tier} Weapon`,
      stats: `Stored ×${quantity} · +${attack} attack`,
      detailLabel: 'Equip',
      attack: 'Drag onto a battlefield cat to increase its damage.',
      note: tier < 3
        ? 'Three matching weapons can merge into the next tier. Equipping replaces the current weapon.'
        : 'Maximum tier. Equipping replaces the cat\'s current weapon.',
    };
  }

  if (item?.kind === 'armour') {
    const armour = ARMOUR_INFO[tier] ?? ARMOUR_INFO[1];
    return {
      kind: 'item',
      title: `Tier ${tier} Armour`,
      stats: `Stored ×${quantity} · blocks ${armour.block} damage for ${armour.uses} hits`,
      detailLabel: 'Equip',
      attack: 'Drag onto a battlefield cat to reduce incoming bite damage.',
      note: tier < 3
        ? 'Three matching armour pieces can merge into the next tier. Equipping replaces current armour.'
        : 'Maximum tier. Equipping replaces the cat\'s current armour.',
    };
  }

  return null;
}

/** The shop is always open in real time; only pause and price gate a purchase. */
export function shopPetAvailability({ sold, gold, paused = false }) {
  if (sold) return { interactive: false, canBuy: false, reason: 'sold' };
  if (paused) return { interactive: false, canBuy: false, reason: 'paused' };
  if (gold < 3) return { interactive: true, canBuy: false, reason: 'gold' };
  return { interactive: true, canBuy: true, reason: null };
}
