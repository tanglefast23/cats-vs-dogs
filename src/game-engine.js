import {
  WORKER_ROLE, WORKER_INFO, workerShopEntries, outputForWorker,
  sameInventoryItem, WEAPON_INFO, ARMOUR_INFO, FOOD_HEAL,
} from './production-rules.js';

export { WORKER_ROLE, WORKER_INFO } from './production-rules.js';

export const ROWS = 14;
export const COLS = 6;
export const CAT_ZONE_START = 10;
export const MAX_ROUNDS = 7;
export const ACTIONS_PER_ROUND = 2;
export const BENCH_SIZE = 6;
export const MAX_SHOP_SIZE = 5;

/** Coat 0 orange tabby: column shot. Coat 1 grey/blue: melee tank. Coat 2 white: homing shot. */
export const CAT_COAT = {
  ORANGE: 0,
  GREY: 1,
  WHITE: 2,
  CALICO: 3,
  BLACK: 4,
  PRISM: 5,
};

export const CAT_COAT_INFO = {
  0: {
    name: 'Orange Tabby',
    shortName: 'Tabby',
    ability: 'column-shot',
    blurb: '3-shot column burst',
    attackDetail: 'Each action, fires 3 rapid column shots that split its attack damage. Shots retarget the nearest dog ahead in its column.',
    shopTier: 1,
  },
  1: {
    name: 'Blue Brawler',
    shortName: 'Brawler',
    ability: 'melee',
    blurb: 'Heavy melee · 2× HP',
    attackDetail: 'Does not shoot. Only melee-attacks the dog directly in the tile in front. Double HP and very high damage.',
    shopTier: 1,
  },
  2: {
    name: 'Snow Ghost',
    shortName: 'Ghost',
    ability: 'homing',
    blurb: 'Homing wave shot',
    attackDetail: 'Each action, fires one weaker sine-wave shot that homes by nearest column first (own column, then adjacent, then farther). In a tied column distance, it picks the lowest dog; a full tie is random.',
    shopTier: 1,
  },
  3: {
    name: 'Calico Tangler',
    shortName: 'Tangler',
    ability: 'tangle-homing',
    blurb: 'Yarn stops next move',
    attackDetail: 'Unlocked on round 3. Fires homing yarn at the nearest-column dog. A hit tangles that dog so its next unblocked move is skipped.',
    shopTier: 2,
  },
  4: {
    name: 'Black Bombardier',
    shortName: 'Bomber',
    ability: 'splash',
    blurb: 'Adjacent splash bomb',
    attackDetail: 'Unlocked on round 5. Bombs the nearest-column dog, then deals 1 splash damage to dogs beside it in adjacent columns.',
    shopTier: 3,
  },
  5: {
    name: 'Prism Sphinx',
    shortName: 'Prism',
    ability: 'piercing',
    blurb: '3-target prism beam',
    attackDetail: 'Unlocked on round 7. Fires a prism beam through up to three dogs ahead in its own column.',
    shopTier: 4,
  },
};

// Shared level shell; coat multipliers apply on top.
export const CAT_STATS = {
  1: { hp: 6, attack: 2 },
  2: { hp: 9, attack: 3 },
  3: { hp: 13, attack: 5 },
};

// Grey/blue melee damage is intentionally high; white shot damage is intentionally low.
const COAT_ATTACK = {
  0: { 1: 2, 2: 3, 3: 5 },
  1: { 1: 5, 2: 8, 3: 12 },
  2: { 1: 1, 2: 2, 3: 3 },
  3: { 1: 2, 2: 3, 3: 5 },
  4: { 1: 3, 2: 5, 3: 7 },
  5: { 1: 3, 2: 5, 3: 8 },
};

const COAT_HP = {
  0: { 1: 6, 2: 9, 3: 13 },
  1: { 1: 12, 2: 18, 3: 26 },
  2: { 1: 6, 2: 9, 3: 13 },
  3: { 1: 7, 2: 11, 3: 16 },
  4: { 1: 5, 2: 8, 3: 12 },
  5: { 1: 8, 2: 12, 3: 18 },
};

export const DOG_STATS = {
  1: { hp: 7, attack: 3 },
  2: { hp: 11, attack: 4 },
  3: { hp: 16, attack: 6 },
  4: { hp: 22, attack: 8 },
};

export const DOG_TIER_INFO = {
  1: { name: 'Scruffy Scout', blurb: 'Standard yard invader.' },
  2: { name: 'Helmet Hound', blurb: 'Armored dog with more HP and bite.' },
  3: { name: 'Bulldog Bruiser', blurb: 'Heavy bruiser with a punishing bite.' },
  4: { name: 'Alpha Hound', blurb: 'Round-seven boss placeholder with alpha armor.' },
};

let nextId = 1;
const id = (prefix) => `${prefix}-${nextId++}`;

export function normalizeCoat(coat = 0) {
  const value = Number(coat);
  return CAT_COAT_INFO[value] ? value : CAT_COAT.ORANGE;
}

export function catStatsFor(level = 1, coat = 0) {
  const safeLevel = CAT_STATS[level] ? level : 1;
  const safeCoat = normalizeCoat(coat);
  const hp = COAT_HP[safeCoat][safeLevel];
  const attack = COAT_ATTACK[safeCoat][safeLevel];
  return {
    hp,
    attack,
    ability: CAT_COAT_INFO[safeCoat].ability,
    name: CAT_COAT_INFO[safeCoat].name,
  };
}

export function catTooltipInfo(cat) {
  const level = cat.level ?? 1;
  const coat = normalizeCoat(cat.coat);
  const info = CAT_COAT_INFO[coat];
  const stats = catStatsFor(level, coat);
  const hp = cat.hp ?? stats.hp;
  const maxHp = cat.maxHp ?? stats.hp;
  return {
    kind: 'cat',
    title: `L${level} ${info.name}`,
    stats: `♥ ${hp}/${maxHp} · ↑ ${stats.attack}`,
    attack: info.attackDetail,
    note: info.blurb,
  };
}

export function dogTooltipInfo(dog) {
  const tier = dog.tier ?? 1;
  const stats = DOG_STATS[tier] ?? DOG_STATS[1];
  const info = DOG_TIER_INFO[tier] ?? DOG_TIER_INFO[1];
  const hp = dog.hp ?? stats.hp;
  const maxHp = dog.maxHp ?? stats.hp;
  const attack = dog.attack ?? stats.attack;
  return {
    kind: 'dog',
    title: `T${tier} ${info.name}`,
    stats: `♥ ${hp}/${maxHp} · ↑ ${attack}`,
    attack: 'Each action, steps one tile toward the porch. If a cat is in the tile ahead, it bites that cat instead of moving.',
    note: info.blurb,
  };
}

export function createCat(level = 1, coat = 0) {
  const safeCoat = normalizeCoat(coat);
  const stats = catStatsFor(level, safeCoat);
  return {
    id: id('cat'),
    kind: 'alley-cat',
    level,
    hp: stats.hp,
    maxHp: stats.hp,
    baseAttack: stats.attack,
    attack: stats.attack,
    coat: safeCoat,
    ability: stats.ability,
    equipment: { weapon: null, armour: null },
  };
}

export function createDog(tier = 1, row = 0, col = 0) {
  const safeTier = DOG_STATS[tier] ? tier : 1;
  const stats = DOG_STATS[safeTier];
  return { id: id('dog'), kind: 'scruffy-dog', tier: safeTier, row, col, hp: stats.hp, maxHp: stats.hp, attack: stats.attack };
}

export function createGame(random = Math.random) {
  return {
    phase: 'prep',
    round: 1,
    section: 0,
    gold: 10,
    lives: 3,
    cats: [],
    dogs: [],
    bench: [],
    workers: Array(6).fill(null),
    inventory: Array(9).fill(null),
    shop: makeShop(random),
    events: [],
    random,
    message: 'Build your team, then start the round.',
  };
}

function copy(game) {
  const cloneCat = (unit) => ({
    ...unit,
    equipment: {
      weapon: unit.equipment?.weapon ? { ...unit.equipment.weapon } : null,
      armour: unit.equipment?.armour ? { ...unit.equipment.armour } : null,
    },
  });
  return {
    ...game,
    cats: game.cats.map(cloneCat),
    dogs: game.dogs.map((unit) => ({ ...unit })),
    bench: game.bench.map(cloneCat),
    workers: game.workers.map((worker) => worker ? {
      ...worker,
      pendingOutput: worker.pendingOutput ? { ...worker.pendingOutput } : null,
    } : null),
    inventory: game.inventory.map((stack) => stack ? { ...stack } : null),
    shop: game.shop.map((slot) => ({ ...slot })),
    events: [],
  };
}

export function shopTierForRound(round = 1) {
  return Math.min(4, Math.max(1, Math.ceil(Number(round) / 2)));
}

export function shopSizeForRound(round = 1) {
  const turn = Math.max(1, Number(round) || 1);
  if (turn >= 9) return MAX_SHOP_SIZE;
  if (turn >= 5) return 4;
  return 3;
}

export function availableCatCoatsForRound(round = 1) {
  const tier = shopTierForRound(round);
  return Object.keys(CAT_COAT_INFO)
    .map(Number)
    .filter((coat) => CAT_COAT_INFO[coat].shopTier <= tier);
}

export function availableShopEntriesForRound(round = 1) {
  const fighters = availableCatCoatsForRound(round)
    .map((coat) => ({ category: 'fighter', coat }));
  return [...fighters, ...workerShopEntries()];
}

export function makeShopSlot(random = Math.random, round = 1, forcedCategory = null) {
  const fighterEntries = availableCatCoatsForRound(round)
    .map((coat) => ({ category: 'fighter', coat }));
  const workerEntries = workerShopEntries();
  const category = forcedCategory ?? (random() < 0.65 ? 'fighter' : 'worker');
  const entries = category === 'fighter' ? fighterEntries : workerEntries;
  const entry = entries[Math.min(entries.length - 1, Math.floor(random() * entries.length))];
  if (entry.category === 'worker') {
    const info = WORKER_INFO[entry.role];
    return {
      id: id('shop'),
      kind: 'production-cat',
      category: 'worker',
      role: entry.role,
      level: 1,
      ability: `produce-${info.output[1].kind}`,
      sold: false,
      saved: false,
    };
  }
  const coat = entry.coat;
  const stats = catStatsFor(1, coat);
  return {
    id: id('shop'),
    kind: 'alley-cat',
    category: 'fighter',
    level: 1,
    coat,
    shopTier: CAT_COAT_INFO[coat].shopTier,
    ability: stats.ability,
    sold: false,
    saved: false,
  };
}

export function makeShop(random = Math.random, previous = null, round = 1) {
  return Array.from({ length: shopSizeForRound(round) }, (_, index) => {
    const prior = previous?.[index];
    // Saved, still-available pets stay put through refresh and into the next round.
    if (prior && prior.saved && !prior.sold) {
      return { ...prior, saved: true, sold: false };
    }
    const openingGuarantee = round === 1 && !previous && index < 2 ? 'fighter' : null;
    return makeShopSlot(random, round, openingGuarantee);
  });
}

export function createWorker(role = WORKER_ROLE.COOK, level = 1) {
  const safeRole = WORKER_INFO[role] ? role : WORKER_ROLE.COOK;
  const safeLevel = [1, 2, 3].includes(Number(level)) ? Number(level) : 1;
  return {
    id: id('worker'), kind: 'production-cat', role: safeRole,
    level: safeLevel, copies: 1, pendingOutput: null,
  };
}

function combinePendingOutput(target, source) {
  if (!source?.pendingOutput) return;
  if (!target.pendingOutput) target.pendingOutput = { ...source.pendingOutput };
  else if (sameInventoryItem(target.pendingOutput, source.pendingOutput)) {
    target.pendingOutput.quantity += source.pendingOutput.quantity;
  }
}

function stackWorkerInto(target, source) {
  if (!target || !source || target.role !== source.role || target.level !== source.level || target.level >= 3) return false;
  combinePendingOutput(target, source);
  target.copies = (target.copies ?? 1) + (source.copies ?? 1);
  if (target.copies >= 3) {
    target.level += 1;
    target.copies = 1;
  }
  return true;
}

function purchasableFighterSlot(game, shopIndex) {
  const slot = game.shop[shopIndex];
  return game.phase === 'prep' && game.gold >= 3 && slot && !slot.sold && slot.category === 'fighter'
    ? slot
    : null;
}

function finishShopPurchase(next, shopIndex) {
  next.gold -= 3;
  next.shop[shopIndex].sold = true;
  next.shop[shopIndex].saved = false;
}

export function purchaseShopFighterToBench(game, shopIndex, targetIndex) {
  const slot = purchasableFighterSlot(game, shopIndex);
  if (!slot || targetIndex < 0 || targetIndex >= BENCH_SIZE || game.bench.length >= BENCH_SIZE || game.bench[targetIndex]) return game;
  const next = copy(game);
  next.bench.push(createCat(slot.level ?? 1, slot.coat));
  finishShopPurchase(next, shopIndex);
  next.message = `${CAT_COAT_INFO[normalizeCoat(slot.coat)].name} adopted to the bench.`;
  return next;
}

export function purchaseShopFighterToBoard(game, shopIndex, row, col) {
  const slot = purchasableFighterSlot(game, shopIndex);
  if (
    !slot || row < CAT_ZONE_START || row >= ROWS || col < 0 || col >= COLS
    || game.cats.some((cat) => cat.row === row && cat.col === col)
  ) return game;
  const next = copy(game);
  next.cats.push({ ...createCat(slot.level ?? 1, slot.coat), row, col });
  finishShopPurchase(next, shopIndex);
  next.message = `${CAT_COAT_INFO[normalizeCoat(slot.coat)].name} deployed!`;
  return next;
}

export function purchaseShopFighterOnto(game, shopIndex, targetType, targetId) {
  const slot = purchasableFighterSlot(game, shopIndex);
  const listName = targetType === 'bench' ? 'bench' : targetType === 'cat' ? 'cats' : null;
  const target = listName ? game[listName].find((cat) => cat.id === targetId) : null;
  if (
    !slot || !target || target.level !== (slot.level ?? 1)
    || normalizeCoat(target.coat) !== normalizeCoat(slot.coat) || target.level >= 3
  ) return game;
  const next = copy(game);
  const nextTarget = next[listName].find((cat) => cat.id === targetId);
  nextTarget.copies = (nextTarget.copies ?? 1) + 1;
  if (nextTarget.copies >= 3) {
    nextTarget.level += 1;
    nextTarget.copies = 1;
    applyLevelStats(nextTarget);
    next.events.push({ type: 'combine', level: nextTarget.level, id: nextTarget.id });
  }
  finishShopPurchase(next, shopIndex);
  next.message = `${CAT_COAT_INFO[normalizeCoat(slot.coat)].name} stacked onto the target cat.`;
  return next;
}

export function purchaseShopWorker(game, shopIndex, targetIndex) {
  const slot = game.shop[shopIndex];
  if (
    game.phase !== 'prep' || game.gold < 3 || !slot || slot.sold
    || slot.category !== 'worker' || targetIndex < 0 || targetIndex >= game.workers.length
  ) return game;
  const next = copy(game);
  const worker = createWorker(slot.role, slot.level ?? 1);
  const target = next.workers[targetIndex];
  if (target) {
    if (!stackWorkerInto(target, worker)) return game;
  } else next.workers[targetIndex] = worker;
  next.gold -= 3;
  next.shop[shopIndex].sold = true;
  next.shop[shopIndex].saved = false;
  next.message = `${WORKER_INFO[worker.role].name} joined the Production Yard.`;
  return next;
}

export function moveWorker(game, sourceIndex, targetIndex) {
  if (
    game.phase !== 'prep' || sourceIndex < 0 || sourceIndex >= game.workers.length
    || targetIndex < 0 || targetIndex >= game.workers.length
    || !game.workers[sourceIndex] || game.workers[targetIndex]
  ) return game;
  const next = copy(game);
  next.workers[targetIndex] = next.workers[sourceIndex];
  next.workers[sourceIndex] = null;
  return next;
}

export function mergeWorkerOnto(game, sourceIndex, targetIndex) {
  if (
    game.phase !== 'prep' || sourceIndex === targetIndex
    || sourceIndex < 0 || sourceIndex >= game.workers.length
    || targetIndex < 0 || targetIndex >= game.workers.length
  ) return game;
  const next = copy(game);
  const source = next.workers[sourceIndex];
  const target = next.workers[targetIndex];
  if (!stackWorkerInto(target, source)) return game;
  next.workers[sourceIndex] = null;
  next.events.push({ type: 'worker-combine', id: target.id, level: target.level, copies: target.copies });
  return next;
}

function addInventoryStackTo(next, item) {
  const quantity = Math.max(1, Math.floor(Number(item?.quantity) || 1));
  const matchingIndex = next.inventory.findIndex((stack) => sameInventoryItem(stack, item));
  if (matchingIndex >= 0) {
    next.inventory[matchingIndex].quantity += quantity;
    return matchingIndex;
  }
  const emptyIndex = next.inventory.findIndex((stack) => !stack);
  if (emptyIndex < 0) return -1;
  next.inventory[emptyIndex] = {
    id: id('item'), kind: item.kind,
    ...(item.tier ? { tier: item.tier } : {}), quantity,
  };
  return emptyIndex;
}

export function addInventoryStack(game, item) {
  if (!item?.kind || item.kind === 'coins') return game;
  const next = copy(game);
  return addInventoryStackTo(next, item) >= 0 ? next : game;
}

export function mergeInventoryItems(game, inventoryIndex) {
  const stack = game.inventory[inventoryIndex];
  if (
    game.phase !== 'prep' || !stack || (stack.kind !== 'weapon' && stack.kind !== 'armour')
    || stack.tier >= 3 || stack.quantity < 3
  ) return game;
  const next = copy(game);
  next.inventory[inventoryIndex].quantity -= 3;
  if (next.inventory[inventoryIndex].quantity <= 0) next.inventory[inventoryIndex] = null;
  if (addInventoryStackTo(next, { kind: stack.kind, tier: stack.tier + 1, quantity: 1 }) < 0) return game;
  next.events.push({ type: 'item-merge', kind: stack.kind, tier: stack.tier + 1 });
  return next;
}

export function sellWorker(game, workerIndex) {
  if (game.phase !== 'prep' || !game.workers[workerIndex]) return game;
  const next = copy(game);
  const worker = next.workers[workerIndex];
  next.workers[workerIndex] = null;
  next.gold += 1;
  next.events.push({ type: 'sell-worker', workerId: worker.id, gold: 1 });
  next.message = `${WORKER_INFO[worker.role].name} sold for 1 gold.`;
  return next;
}

export function collectWorkerOutput(game, workerIndex) {
  if (game.phase !== 'prep') return game;
  const worker = game.workers[workerIndex];
  const output = worker?.pendingOutput;
  if (!output) return game;
  const next = copy(game);
  if (output.kind === 'coins') next.gold += output.quantity;
  else if (addInventoryStackTo(next, output) < 0) return game;
  next.workers[workerIndex].pendingOutput = null;
  next.events.push({ type: 'collect-output', workerId: worker.id, output: { ...output } });
  return next;
}

function consumeInventoryOne(next, inventoryIndex) {
  const stack = next.inventory[inventoryIndex];
  if (!stack) return;
  stack.quantity -= 1;
  if (stack.quantity <= 0) next.inventory[inventoryIndex] = null;
}

function recomputeCatAttack(cat) {
  const stats = catStatsFor(cat.level, cat.coat);
  cat.baseAttack = stats.attack;
  cat.attack = stats.attack + (cat.equipment?.weapon?.attack ?? 0);
  cat.ability = stats.ability;
}

export function equipInventoryItem(game, inventoryIndex, targetType, targetId, paused = false) {
  const allowedPhase = game.phase === 'prep' || (game.phase === 'combat' && paused);
  const stack = game.inventory[inventoryIndex];
  if (!allowedPhase || !stack || (stack.kind !== 'weapon' && stack.kind !== 'armour')) return game;
  const listName = targetType === 'bench' ? 'bench' : targetType === 'cat' ? 'cats' : null;
  const target = listName ? game[listName].find((cat) => cat.id === targetId) : null;
  if (!target) return game;
  const next = copy(game);
  const nextTarget = next[listName].find((cat) => cat.id === targetId);
  if (stack.kind === 'weapon') {
    const info = WEAPON_INFO[stack.tier];
    if (!info) return game;
    nextTarget.equipment.weapon = { tier: stack.tier, attack: info.attack };
    recomputeCatAttack(nextTarget);
  } else {
    const info = ARMOUR_INFO[stack.tier];
    if (!info) return game;
    nextTarget.equipment.armour = {
      tier: stack.tier, block: info.block, uses: info.uses, maxUses: info.uses,
    };
  }
  consumeInventoryOne(next, inventoryIndex);
  next.events.push({ type: 'equip', to: targetId, kind: stack.kind, tier: stack.tier });
  return next;
}

export function useFood(game, inventoryIndex, catId) {
  const stack = game.inventory[inventoryIndex];
  const target = game.cats.find((cat) => cat.id === catId);
  if (game.phase !== 'combat' || stack?.kind !== 'food' || !target || target.hp <= 0 || target.hp >= target.maxHp) return game;
  const next = copy(game);
  const nextTarget = next.cats.find((cat) => cat.id === catId);
  const hpBefore = nextTarget.hp;
  nextTarget.hp = Math.min(nextTarget.maxHp, nextTarget.hp + FOOD_HEAL);
  consumeInventoryOne(next, inventoryIndex);
  next.events.push({
    type: 'item-heal', to: catId, row: nextTarget.row, col: nextTarget.col,
    amount: nextTarget.hp - hpBefore, hpBefore, hpAfter: nextTarget.hp, maxHp: nextTarget.maxHp,
  });
  return next;
}

export function addCatToBench(game, cat = { level: 1 }, charge = false) {
  if (game.bench.length >= BENCH_SIZE || (charge && game.gold < 3)) return game;
  const next = copy(game);
  next.bench.push(createCat(cat.level ?? 1, cat.coat ?? 0));
  if (charge) next.gold -= 3;
  return next;
}

export function buyShopCat(game, slotIndex) {
  const slot = game.shop[slotIndex];
  if (!slot || slot.sold || game.phase !== 'prep' || game.gold < 3 || game.bench.length >= BENCH_SIZE) return game;
  const next = addCatToBench(game, slot, true);
  next.shop[slotIndex].sold = true;
  next.shop[slotIndex].saved = false;
  next.message = `${CAT_COAT_INFO[normalizeCoat(slot.coat)].name} added to the bench.`;
  return next;
}

export function toggleSaveShopSlot(game, slotIndex) {
  if (game.phase !== 'prep') return game;
  const slot = game.shop[slotIndex];
  if (!slot || slot.sold) return game;
  const next = copy(game);
  next.shop[slotIndex].saved = !next.shop[slotIndex].saved;
  next.message = next.shop[slotIndex].saved
    ? 'Pet saved — it stays through refresh and the next round.'
    : 'Pet unsaved — it can roll away on refresh.';
  return next;
}

export function refreshShop(game) {
  if (game.phase !== 'prep' || game.gold < 1) return game;
  const next = copy(game);
  next.gold -= 1;
  next.shop = makeShop(game.random, game.shop, game.round);
  const kept = next.shop.filter((slot) => slot.saved).length;
  next.message = kept
    ? `Shop refreshed. ${kept} saved pet${kept === 1 ? '' : 's'} kept.`
    : 'The shop has been refreshed.';
  return next;
}

export function combineCats(game) {
  const next = copy(game);
  for (let level = 1; level <= 2; level += 1) {
    for (const coat of Object.keys(CAT_COAT_INFO).map(Number)) {
      while (next.bench.filter((cat) => cat.level === level && normalizeCoat(cat.coat) === coat).length >= 3) {
        const selected = next.bench
          .filter((cat) => cat.level === level && normalizeCoat(cat.coat) === coat)
          .slice(0, 3);
        const selectedIds = new Set(selected.map((cat) => cat.id));
        next.bench = next.bench.filter((cat) => !selectedIds.has(cat.id));
        next.bench.push(createCat(level + 1, coat));
        next.events.push({ type: 'combine', level: level + 1, coat });
      }
    }
  }
  return next;
}

function applyLevelStats(cat) {
  const stats = catStatsFor(cat.level, cat.coat);
  cat.maxHp = stats.hp;
  cat.hp = stats.hp;
  recomputeCatAttack(cat);
}

export function mergeUnitOnto(game, sourceType, sourceId, targetType, targetId) {
  const next = copy(game);
  const sourceList = sourceType === 'bench' ? next.bench : next.cats;
  const targetList = targetType === 'bench' ? next.bench : next.cats;
  const source = sourceList.find((cat) => cat.id === sourceId);
  const target = targetList.find((cat) => cat.id === targetId);
  if (!source || !target || source.id === target.id) return game;
  // Stacks only form within the same coat — each color keeps its own ability line.
  if (source.level !== target.level || normalizeCoat(source.coat) !== normalizeCoat(target.coat)) return game;

  // First merge creates a two-copy stack; the third promotes it.
  target.copies = (target.copies ?? 1) + (source.copies ?? 1);
  const removeFrom = sourceType === 'bench' ? 'bench' : 'cats';
  next[removeFrom] = next[removeFrom].filter((cat) => cat.id !== source.id);
  if (target.copies >= 3 && target.level < 3) {
    target.level += 1;
    target.copies = 1;
    applyLevelStats(target);
    next.events.push({ type: 'combine', level: target.level, id: target.id });
  }
  return next;
}

export function placeCat(game, benchIndex, row, col) {
  if (game.phase !== 'prep' || row < CAT_ZONE_START || row >= ROWS || col < 0 || col >= COLS) return game;
  if (game.cats.some((cat) => cat.row === row && cat.col === col)) return game;
  if (!game.bench[benchIndex]) return game;
  const next = copy(game);
  const [cat] = next.bench.splice(benchIndex, 1);
  next.cats.push({ ...cat, row, col });
  return next;
}

export function moveCat(game, catId, row, col) {
  if (game.phase !== 'prep' || row < CAT_ZONE_START || row >= ROWS || col < 0 || col >= COLS) return game;
  if (game.cats.some((cat) => cat.row === row && cat.col === col && cat.id !== catId)) return game;
  const next = copy(game);
  const cat = next.cats.find((unit) => unit.id === catId);
  if (!cat) return game;
  cat.row = row;
  cat.col = col;
  return next;
}

export function returnCatToBench(game, catId) {
  if (game.phase !== 'prep' || game.bench.length >= BENCH_SIZE) return game;
  const next = copy(game);
  const index = next.cats.findIndex((cat) => cat.id === catId);
  if (index < 0) return game;
  const [cat] = next.cats.splice(index, 1);
  delete cat.row;
  delete cat.col;
  next.bench.push(cat);
  return next;
}

export function generateWave(round, random = Math.random) {
  const counts = [1, 2, 2, 3, 3, 4, 4];
  const count = counts[Math.min(round - 1, counts.length - 1)];
  const maxTier = shopTierForRound(round);
  const available = Array.from({ length: COLS }, (_, col) => col);
  const dogs = [];
  for (let i = 0; i < count; i += 1) {
    const pick = Math.floor(random() * available.length);
    const col = available.splice(pick, 1)[0];
    const tier = 1 + Math.min(maxTier - 1, Math.floor(random() * maxTier));
    dogs.push(createDog(tier, 0, col));
  }
  // Always introduce the newly unlocked placeholder dog on odd unlock rounds.
  if (round % 2 === 1 && !dogs.some((dog) => dog.tier === maxTier)) {
    dogs[dogs.length - 1] = createDog(maxTier, 0, dogs[dogs.length - 1].col);
  }
  return dogs;
}

export function startRound(game) {
  if (game.phase !== 'prep') return game;
  const next = copy(game);
  next.phase = 'combat';
  next.section = 0;
  next.dogs.push(...generateWave(next.round, game.random));
  next.message = `Round ${next.round}: defend the yard!`;
  next.events = [{ type: 'wave', round: next.round }];
  return next;
}

function livingDogs(dogs) {
  return dogs.filter((dog) => dog.hp > 0);
}

function nearestDogInColumn(cat, dogs) {
  return livingDogs(dogs)
    .filter((dog) => dog.col === cat.col && dog.row < cat.row)
    .sort((a, b) => b.row - a.row)[0] ?? null;
}

/**
 * Snow Ghost targeting:
 * 1) nearest column first (0 = own column, then 1, then 2, ...)
 * 2) within that column distance, lowest dog on the board (highest row index = closest to cats)
 * 3) full ties (same col distance + same row) → random among them
 */
export function closestDogByColumnPriority(cat, dogs, random = Math.random) {
  const candidates = livingDogs(dogs);
  if (!candidates.length) return null;

  let bestColDist = Infinity;
  for (const dog of candidates) {
    bestColDist = Math.min(bestColDist, Math.abs(dog.col - cat.col));
  }

  const nearestColumns = candidates.filter((dog) => Math.abs(dog.col - cat.col) === bestColDist);
  let bestRow = -Infinity;
  for (const dog of nearestColumns) {
    bestRow = Math.max(bestRow, dog.row);
  }

  const ties = nearestColumns.filter((dog) => dog.row === bestRow);
  if (ties.length === 1) return ties[0];
  return ties[Math.floor(random() * ties.length)];
}

function dogInMeleeFront(cat, dogs) {
  return livingDogs(dogs).find((dog) => dog.col === cat.col && dog.row === cat.row - 1) ?? null;
}

export function splitDamage(total, parts = 3) {
  const amount = Math.max(0, Math.floor(Number(total) || 0));
  const chunks = Array.from({ length: parts }, () => 0);
  for (let i = 0; i < amount; i += 1) chunks[i % parts] += 1;
  return chunks;
}

function pushDamageEvent(events, type, from, to, extra = {}) {
  const damage = typeof extra.damage === 'number' ? extra.damage : from.attack;
  if (damage <= 0) return;
  const hpBefore = to.hp;
  to.hp = Math.max(0, to.hp - damage);
  events.push({
    type,
    from: from.id,
    to: to.id,
    fromCol: from.col,
    col: to.col,
    fromRow: from.row,
    toRow: to.row,
    damage,
    hpBefore,
    hpAfter: to.hp,
    maxHp: to.maxHp,
    miss: false,
    ...extra,
    damage,
    miss: false,
  });
}

function pushMissEvent(events, type, from, extra = {}) {
  const col = extra.col ?? from.col;
  const toRow = extra.toRow ?? 0;
  events.push({
    type,
    from: from.id,
    to: null,
    fromCol: from.col,
    col,
    fromRow: from.row,
    toRow,
    damage: 0,
    hpBefore: 0,
    hpAfter: 0,
    maxHp: 0,
    miss: true,
    ...extra,
    miss: true,
    damage: 0,
    to: null,
  });
}

export function resolveSection(game) {
  if (game.phase === 'gameover' || game.phase === 'victory') return game;
  const next = copy(game);
  next.section += 1;

  // Cats always act. If nothing is in range they still shoot/swing (miss animations).
  // orange = column shot, white = weaker homing shot, grey = strong front melee only.
  for (const cat of next.cats) {
    const ability = cat.ability ?? catStatsFor(cat.level, cat.coat).ability;
    if (ability === 'melee') {
      const target = dogInMeleeFront(cat, next.dogs);
      if (target) {
        pushDamageEvent(next.events, 'cat-melee', cat, target, {
          col: cat.col,
          style: 'melee',
        });
      } else {
        pushMissEvent(next.events, 'cat-melee', cat, {
          col: cat.col,
          toRow: Math.max(0, cat.row - 1),
          style: 'melee',
        });
      }
      continue;
    }

    if (ability === 'tangle-homing') {
      const target = closestDogByColumnPriority(cat, next.dogs, game.random);
      if (target) {
        pushDamageEvent(next.events, 'shot', cat, target, {
          fromCol: cat.col,
          col: target.col,
          style: 'tangle',
        });
        if (target.hp > 0) target.tangled = true;
      } else {
        pushMissEvent(next.events, 'shot', cat, { fromCol: cat.col, col: cat.col, toRow: 0, style: 'tangle' });
      }
      continue;
    }

    if (ability === 'splash') {
      const target = closestDogByColumnPriority(cat, next.dogs, game.random);
      if (target) {
        pushDamageEvent(next.events, 'shot', cat, target, {
          fromCol: cat.col,
          col: target.col,
          style: 'splash',
        });
        const splashTargets = livingDogs(next.dogs)
          .filter((dog) => dog.row === target.row && Math.abs(dog.col - target.col) === 1);
        splashTargets.forEach((dog) => pushDamageEvent(next.events, 'shot', cat, dog, {
          fromCol: target.col,
          col: dog.col,
          style: 'splash-secondary',
          damage: 1,
        }));
      } else {
        pushMissEvent(next.events, 'shot', cat, { fromCol: cat.col, col: cat.col, toRow: 0, style: 'splash' });
      }
      continue;
    }

    if (ability === 'piercing') {
      const targets = livingDogs(next.dogs)
        .filter((dog) => dog.col === cat.col && dog.row < cat.row)
        .sort((a, b) => b.row - a.row)
        .slice(0, 3);
      if (targets.length) {
        targets.forEach((target, index) => pushDamageEvent(next.events, 'shot', cat, target, {
          fromCol: cat.col,
          col: target.col,
          style: 'piercing',
          pierceIndex: index,
        }));
      } else {
        pushMissEvent(next.events, 'shot', cat, { fromCol: cat.col, col: cat.col, toRow: 0, style: 'piercing' });
      }
      continue;
    }

    if (ability === 'homing') {
      const target = closestDogByColumnPriority(cat, next.dogs, game.random);
      if (target) {
        pushDamageEvent(next.events, 'shot', cat, target, {
          fromCol: cat.col,
          col: target.col,
          style: 'homing',
        });
      } else {
        pushMissEvent(next.events, 'shot', cat, {
          fromCol: cat.col,
          col: cat.col,
          toRow: 0,
          style: 'homing',
        });
      }
      continue;
    }

    // Orange tabby: 3 rapid pellets that split the cat's attack power.
    // Always fire the volley — leftover pellets fly off-screen if no dog remains.
    const pellets = splitDamage(cat.attack, 3).filter((amount) => amount > 0);
    pellets.forEach((amount, pelletIndex) => {
      const target = nearestDogInColumn(cat, next.dogs);
      const shared = {
        fromCol: cat.col,
        col: cat.col,
        style: 'column',
        burst: true,
        pelletIndex,
        pelletCount: pellets.length,
        damage: amount,
      };
      if (target) {
        pushDamageEvent(next.events, 'shot', cat, target, shared);
      } else {
        pushMissEvent(next.events, 'shot', cat, {
          ...shared,
          toRow: 0,
        });
      }
    });
  }
  next.dogs = next.dogs.filter((dog) => dog.hp > 0);

  // Front dogs act first so followers may advance into newly opened cells.
  const actingDogs = [...next.dogs].sort((a, b) => b.row - a.row);
  for (const dog of actingDogs) {
    const blockingCat = next.cats.find((cat) => cat.col === dog.col && cat.row === dog.row + 1 && cat.hp > 0);
    if (blockingCat) {
      const hpBefore = blockingCat.hp;
      const armour = blockingCat.equipment?.armour;
      const blocked = armour ? Math.min(armour.block, Math.max(0, dog.attack - 1)) : 0;
      const damage = Math.max(1, dog.attack - blocked);
      let armourBroken = false;
      let armourUsesAfter = null;
      if (armour) {
        armour.uses -= 1;
        armourUsesAfter = Math.max(0, armour.uses);
        if (armour.uses <= 0) {
          blockingCat.equipment.armour = null;
          armourBroken = true;
        }
      }
      blockingCat.hp = Math.max(0, blockingCat.hp - damage);
      next.events.push({
        type: 'melee',
        from: dog.id,
        to: blockingCat.id,
        col: dog.col,
        fromRow: dog.row,
        toRow: blockingCat.row,
        damage,
        blocked,
        armourUsesAfter,
        armourBroken,
        hpBefore,
        hpAfter: blockingCat.hp,
        maxHp: blockingCat.maxHp,
      });
    } else {
      const dogAhead = next.dogs.some((other) => other.id !== dog.id && other.col === dog.col && other.row === dog.row + 1);
      if (!dogAhead && dog.tangled) {
        dog.tangled = false;
        next.events.push({ type: 'tangle-skip', id: dog.id, row: dog.row, col: dog.col });
      } else if (!dogAhead) {
        const fromRow = dog.row;
        dog.row += 1;
        next.events.push({ type: 'move', id: dog.id, fromRow, toRow: dog.row, row: dog.row, col: dog.col });
      }
    }
  }
  next.cats = next.cats.filter((cat) => cat.hp > 0);

  const breachedCols = [...new Set(next.dogs.filter((dog) => dog.row >= ROWS).map((dog) => dog.col))];
  for (const col of breachedCols) {
    next.lives = Math.max(0, next.lives - 1);
    next.dogs = next.dogs.filter((dog) => dog.col !== col);
    next.events.push({ type: 'super-cat', col });
  }
  if (next.lives <= 0) {
    next.phase = 'gameover';
    next.message = 'The dogs reached the porch. Game over!';
  } else if (next.dogs.length === 0 && next.round >= MAX_ROUNDS) {
    // Level 1 keeps the same wave counts, but ends by clearing dogs — not by clock.
    next.phase = 'victory';
    next.message = 'All dogs cleared! Level 1 complete.';
    next.events.push({ type: 'level-clear' });
  }
  return next;
}

export function finishRound(game) {
  if (game.phase !== 'combat') return game;
  const next = copy(game);

  // Final wave already out: only win when every dog is gone.
  if (next.round >= MAX_ROUNDS) {
    if (next.dogs.length === 0) {
      next.phase = 'victory';
      next.message = 'All dogs cleared! Level 1 complete.';
      return next;
    }
    next.message = 'Clear every remaining dog to finish the level!';
    return next;
  }

  // Earlier waves: even if the board is empty, the next scheduled wave still comes.
  next.round += 1;
  next.section = 0;
  next.phase = 'prep';
  next.gold = 10;
  next.shop = makeShop(game.random, game.shop, next.round);
  const kept = next.shop.filter((slot) => slot.saved).length;
  next.message = kept
    ? `Round ${next.round} prep: 10 fresh gold! ${kept} saved pet${kept === 1 ? '' : 's'} held over.`
    : next.dogs.length === 0
      ? `Wave cleared! Round ${next.round} prep: 10 fresh gold!`
      : `Round ${next.round} prep: 10 fresh gold!`;
  // Surviving cats heal between rounds for a forgiving first level.
  next.cats.forEach((cat) => { cat.hp = cat.maxHp; });
  next.workers.forEach((worker) => {
    if (!worker) return;
    worker.pendingOutput = outputForWorker(worker.role, worker.level);
    next.events.push({
      type: 'production-ready', workerId: worker.id,
      output: worker.pendingOutput ? { ...worker.pendingOutput } : null,
    });
  });
  return next;
}
