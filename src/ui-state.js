export function selectionAfterPurchase(previousSelection, purchaseSucceeded) {
  return purchaseSucceeded ? null : previousSelection;
}

export function catSelectionAdvice(cat, info, phase) {
  if (phase === 'tactics') {
    return `Level ${cat.level} ${info.name} selected. Move it to an empty glowing tile for its battle-break movement.`;
  }
  if (!cat.hasEnteredBattle) {
    return `Level ${cat.level} ${info.name} selected. Before its first battle, you can freely place or reposition this cat anywhere in cat territory.`;
  }
  return `Level ${cat.level} ${info.name} selected (${info.blurb}). Tap an empty cat-territory tile to place it, or merge only onto the same color + level.`;
}

function petMergeKey(pet) {
  if (!pet) return null;
  const level = Number(pet.level ?? 1);
  if (level >= 3) return null;
  if (pet.category === 'worker' || pet.kind === 'production-cat') {
    return pet.role ? `worker:${pet.role}:${level}` : null;
  }
  return `fighter:${Number(pet.coat ?? 0)}:${level}`;
}

export function shopOfferHasOwnedMatch(slot, ownedCats = []) {
  if (!slot || slot.sold) return false;
  const offerKey = petMergeKey(slot);
  return offerKey != null && ownedCats.some((cat) => petMergeKey(cat) === offerKey);
}

export function shopOfferMatchingFieldCatIds(slot, fieldCats = []) {
  if (!slot || slot.sold || slot.category === 'worker') return [];
  const offerKey = petMergeKey(slot);
  if (offerKey == null) return [];
  return fieldCats
    .filter((cat) => petMergeKey(cat) === offerKey)
    .map((cat) => cat.id);
}

/** Health color band for unit HP bars: green above half, amber to a quarter, red below. */
export function hpTone(hp, maxHp) {
  const pct = maxHp > 0 ? hp / maxHp : 0;
  if (pct > 0.5) return 'full';
  if (pct > 0.25) return 'mid';
  return 'low';
}

/** Large equipment plates shown on a cat, ordered weapon then armour. */
export function equippedItemMarkers(cat = {}) {
  return ['weapon', 'armour'].flatMap((kind) => {
    const item = cat.equipment?.[kind];
    if (!item) return [];
    return [{
      kind,
      tier: item.tier ?? 1,
      value: kind === 'weapon' ? item.attack ?? 0 : item.block ?? 0,
      uses: kind === 'armour' ? item.uses ?? 0 : null,
      maxUses: kind === 'armour' ? item.maxUses ?? item.uses ?? 0 : null,
    }];
  });
}

/** Temporary cat effects that need to remain readable after their cast animation ends. */
export function catStatusMarkers(cat = {}) {
  const markers = [];
  if ((cat.guard ?? 0) > 0) {
    markers.push({ kind: 'guard', value: String(cat.guard), label: `Guard blocks ${cat.guard} damage from the next hit` });
  }
  if ((cat.nextAttackBonus ?? 0) > 0) {
    markers.push({ kind: 'attack-up', value: `+${cat.nextAttackBonus}`, label: `Next attack gains ${cat.nextAttackBonus} damage` });
  }
  if ((cat.nextAttackPenalty ?? 0) > 0) {
    markers.push({ kind: 'attack-down', value: `-${cat.nextAttackPenalty}`, label: `Next attack loses ${cat.nextAttackPenalty} damage` });
  }
  return markers;
}

/** Persistent dog effects that otherwise disappear after their one-off animation. */
export function dogStatusMarkers(dog = {}) {
  const markers = [];
  if ((dog.frozenActions ?? 0) > 0) {
    const rounds = dog.frozenRoundsRemaining ?? Math.ceil(dog.frozenActions / 2);
    markers.push({ kind: 'frozen', value: String(rounds), label: `Frozen for ${rounds} round${rounds === 1 ? '' : 's'}` });
  }
  if (dog.tangled) {
    markers.push({ kind: 'tangled', value: '1', label: 'Next movement is skipped' });
  }
  if ((dog.attackBoost ?? 0) > 0) {
    markers.push({ kind: 'attack-up', value: `+${dog.attackBoost}`, label: `Next damaging attack gains ${dog.attackBoost} damage` });
  }
  return markers;
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

/** Living dogs Storm would hit in the hovered battlefield column. */
export function stormTargetDogIds(dogs = [], col) {
  if (!Number.isInteger(col)) return [];
  return dogs
    .filter((dog) => dog.hp > 0 && dog.col === col)
    .map((dog) => dog.id);
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

/** Visible battle-based progress for slower Production House stations. */
export function productionProgressStatus(worker = {}, info = {}) {
  const total = Math.max(1, Number(info.productionRounds) || 1);
  const completed = worker.pendingOutput
    ? total
    : Math.min(total, Math.max(0, Number(worker.productionProgress) || 0));
  const remaining = worker.pendingOutput ? 0 : total - completed;
  return {
    completed,
    total,
    remaining,
    percent: Math.round((completed / total) * 100),
    label: worker.pendingOutput
      ? 'READY'
      : `${remaining} ${remaining === 1 ? 'BATTLE' : 'BATTLES'}`,
  };
}

const PRODUCTION_WORK_VISUALS = Object.freeze({
  cook: 'stir',
  trader: 'coin',
  weaponsmith: 'hammer',
  armourer: 'polish',
});

/** Role-specific planning-stage action used by each Production House station. */
export function productionWorkVisual(role) {
  return PRODUCTION_WORK_VISUALS[role] ?? null;
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
