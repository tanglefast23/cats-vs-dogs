import {
  WORKER_ROLE, WORKER_INFO, workerShopEntries, outputForWorker,
  sameInventoryItem, WEAPON_INFO, ARMOUR_INFO, FOOD_HEAL,
} from './production-rules.js';

export { WORKER_ROLE, WORKER_INFO } from './production-rules.js';

export const ROWS = 14;
export const COLS = 6;
export const CAT_ZONE_START = 10;
export const MAX_WAVES = 7;
export const BENCH_SIZE = 6;
export const MAX_SHOP_SIZE = 5;
const GOLD_ROUNDING_EPSILON = 1e-9;

/** All real-time pacing in one table. Values are game-clock milliseconds at 1× speed. */
export const REALTIME = Object.freeze({
  dogActMs: 2000,
  dogJitterMs: 150,
  catAttackMs: 2000,
  abilityCooldownMs: 20000,
  workerProduceMs: 20000,
  goldPerWave: 10,
  waveFirstMs: 15000,
  waveIntervalMs: 24000,
  slowMoFactor: 0.25,
});

/** Coat 0 orange tabby: column shot. Coat 1 grey/blue: melee tank. Coat 2 white: homing shot. */
export const CAT_COAT = {
  ORANGE: 0,
  GREY: 1,
  WHITE: 2,
  CALICO: 3,
  BLACK: 4,
  PRISM: 5,
  FROST: 6,
  RIFT: 7,
  MIRAGE: 8,
  STORM: 9,
  ENCORE: 10,
};

export const CAT_COAT_INFO = {
  0: {
    name: 'Purrcy Pew-Pew',
    shortName: 'Purrcy',
    ability: 'column-shot',
    blurb: '3-shot column burst',
    attackDetail: 'Every attack, fires 3 rapid column shots that split its attack damage. Shots retarget the nearest dog ahead in its column.',
    shopTier: 1,
  },
  1: {
    name: 'Clawdius',
    shortName: 'Clawdius',
    ability: 'melee',
    blurb: 'Heavy melee · 2× HP',
    attackDetail: 'Does not shoot. Only melee-attacks the dog directly in the tile in front. Double HP and very high damage.',
    shopTier: 1,
  },
  2: {
    name: 'Hissiletoe',
    shortName: 'Hissile',
    ability: 'homing',
    blurb: 'Homing wave shot',
    attackDetail: 'Every attack, fires one weaker sine-wave shot that homes by nearest column first (own column, then adjacent, then farther). In a tied column distance, it picks the lowest dog; a full tie is random.',
    shopTier: 1,
  },
  3: {
    name: 'Knotty Kitty',
    shortName: 'Knotty',
    ability: 'tangle-homing',
    blurb: 'Yarn stops next move',
    attackDetail: 'Unlocked on wave 3. Fires homing yarn at the nearest-column dog. A hit tangles that dog so its next unblocked move is skipped.',
    shopTier: 2,
  },
  4: {
    name: 'Bombay Boom',
    shortName: 'Bombay',
    ability: 'splash',
    blurb: 'Adjacent splash bomb',
    attackDetail: 'Unlocked on wave 5. Bombs the nearest-column dog, then deals 1 splash damage to dogs beside it in adjacent columns.',
    shopTier: 3,
  },
  5: {
    name: 'Laserpaw',
    shortName: 'Laser',
    ability: 'piercing',
    blurb: '3-target prism beam',
    attackDetail: 'Unlocked on wave 7. Fires a prism beam through up to three dogs ahead in its own column.',
    shopTier: 4,
  },
  6: {
    name: 'Frosty Paws', shortName: 'Frosty', ability: 'homing', activeAbility: 'freeze',
    blurb: 'Freezes one dog', attackDetail: 'Unlocked on wave 5. Fires a weak homing spell. Tap it when READY to freeze one dog.', shopTier: 3,
  },
  7: {
    name: 'Purrtal', shortName: 'Purrtal', ability: 'homing', activeAbility: 'teleport',
    blurb: 'Teleports one ally', attackDetail: 'Unlocked on wave 5. Tap it when READY to teleport an allied cat to any empty cat square — the only way a placed cat can move.', shopTier: 3,
  },
  8: {
    name: 'Faux Paw', shortName: 'Faux Paw', ability: 'homing', activeAbility: 'decoy',
    blurb: 'Summons a blocker', attackDetail: 'Unlocked on wave 5. Tap it when READY to summon a phantom blocker on an empty cat square.', shopTier: 3,
  },
  9: {
    name: 'Thunderpaws', shortName: 'Thunder', ability: 'homing', activeAbility: 'storm',
    blurb: 'Strikes one column', attackDetail: 'Unlocked on wave 5. Tap it when READY to strike every dog in one selected column with lightning.', shopTier: 3,
  },
  10: {
    name: 'Meowstro', shortName: 'Meowstro', ability: 'homing', activeAbility: 'encore',
    blurb: 'Grants an extra attack', attackDetail: 'Unlocked on wave 5. Tap it when READY to command one ally to make an immediate reduced-strength attack.', shopTier: 3,
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
  6: { 1: 2, 2: 3, 3: 5 },
  7: { 1: 2, 2: 3, 3: 5 },
  8: { 1: 2, 2: 3, 3: 5 },
  9: { 1: 1, 2: 2, 3: 3 },
  10: { 1: 1, 2: 2, 3: 4 },
};

const COAT_HP = {
  0: { 1: 6, 2: 9, 3: 13 },
  1: { 1: 12, 2: 18, 3: 26 },
  2: { 1: 6, 2: 9, 3: 13 },
  3: { 1: 7, 2: 11, 3: 16 },
  4: { 1: 5, 2: 8, 3: 12 },
  5: { 1: 8, 2: 12, 3: 18 },
  6: { 1: 6, 2: 9, 3: 13 },
  7: { 1: 7, 2: 11, 3: 16 },
  8: { 1: 6, 2: 9, 3: 13 },
  9: { 1: 5, 2: 8, 3: 12 },
  10: { 1: 6, 2: 10, 3: 15 },
};

export const DOG_STATS = {
  1: { hp: 7, attack: 3 },
  2: { hp: 11, attack: 4 },
  3: { hp: 16, attack: 6 },
  4: { hp: 22, attack: 8 },
};

export const DOG_ROLE = Object.freeze({
  SCRUFFY: 'scruffy',
  TENNIS: 'tennis',
  HOWLER: 'howler',
  JUMPER: 'jumper',
});

export const DOG_ROLE_INFO = Object.freeze({
  [DOG_ROLE.SCRUFFY]: Object.freeze({
    name: 'Chomps McGraw', unlockRound: 1, blurb: 'The dependable front-line biter.',
    attackDetail: 'Steps toward the porch and bites the cat directly ahead.',
  }),
  [DOG_ROLE.TENNIS]: Object.freeze({
    name: 'Bark McEnroe', unlockRound: 3, blurb: 'Ranged lane attacker with lower impact damage.',
    attackDetail: 'Stops two or three squares away and throws a tennis ball at the nearest cat in its lane.',
  }),
  [DOG_ROLE.HOWLER]: Object.freeze({
    name: 'Howl Pacino', unlockRound: 4, blurb: 'Support dog that empowers a nearby pack.',
    attackDetail: 'Its first useful action is a howl that grants nearby dogs +2 damage on their next attack.',
  }),
  [DOG_ROLE.JUMPER]: Object.freeze({
    name: 'Barkour Bandit', unlockRound: 5, blurb: 'Leaps over one isolated defender.',
    attackDetail: 'Once per battle, jumps over the cat directly ahead if the landing square is empty. Layered cats stop it.',
  }),
});

export const DOG_TIER_INFO = {
  1: { name: 'Yard Punk', blurb: 'Baseline dog stats.' },
  2: { name: 'Ironhide', blurb: 'Helmet gear adds HP and bite strength.' },
  3: { name: 'Bonecrusher', blurb: 'Heavy plates add substantial HP and bite strength.' },
  4: { name: 'Top Dog', blurb: 'Top Dog armor marks the strongest dog tier.' },
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
  const attack = cat.attack ?? stats.attack;
  return {
    kind: 'cat',
    title: `L${level} ${info.name}`,
    stats: `Health ${hp}/${maxHp} · hits for ${attack} every ${REALTIME.catAttackMs / 1000}s`,
    attack: info.attackDetail,
    note: info.blurb,
  };
}

export function dogTooltipInfo(dog) {
  const tier = dog.tier ?? 1;
  const stats = DOG_STATS[tier] ?? DOG_STATS[1];
  const tierInfo = DOG_TIER_INFO[tier] ?? DOG_TIER_INFO[1];
  const roleInfo = DOG_ROLE_INFO[dog.role] ?? DOG_ROLE_INFO[DOG_ROLE.SCRUFFY];
  const hp = dog.hp ?? stats.hp;
  const maxHp = dog.maxHp ?? stats.hp;
  const attack = dog.attack ?? stats.attack;
  return {
    kind: 'dog',
    title: `T${tier} ${roleInfo.name}`,
    stats: `♥ ${hp}/${maxHp} · ↑ ${attack}`,
    attack: roleInfo.attackDetail,
    note: `${tierInfo.blurb} ${roleInfo.blurb}`,
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
    activeAbility: CAT_COAT_INFO[safeCoat].activeAbility ?? null,
    equipment: { weapon: null, armour: null },
  };
}

export function createDog(tier = 1, row = 0, col = 0, role = DOG_ROLE.SCRUFFY) {
  const safeTier = DOG_STATS[tier] ? tier : 1;
  const stats = DOG_STATS[safeTier];
  const safeRole = DOG_ROLE_INFO[role] ? role : DOG_ROLE.SCRUFFY;
  return { id: id('dog'), kind: 'scruffy-dog', role: safeRole, tier: safeTier, row, col, hp: stats.hp, maxHp: stats.hp, attack: stats.attack };
}

export function createGame(random = Math.random) {
  return {
    phase: 'battle',
    clockMs: 0,
    waveNumber: 0,
    waveDueAt: REALTIME.waveFirstMs,
    gold: 10,
    goldFraction: 0,
    lives: 3,
    cats: [],
    dogs: [],
    decoys: [],
    bench: [],
    workers: Array(6).fill(null),
    inventory: Array(6).fill(null),
    shop: makeShop(random),
    nextWave: generateWave(1, random),
    events: [],
    random,
    message: 'Wave 1 is coming — drag cats from the Cat Cart into the yard!',
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
    nextWave: (game.nextWave ?? []).map((unit) => ({ ...unit })),
    decoys: (game.decoys ?? []).map((unit) => ({ ...unit })),
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
    // Saved, still-available pets stay put through refresh and into the next wave.
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
    level: safeLevel, copies: 1, pendingOutput: null, outputReadyAt: null,
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
  return game.phase === 'battle' && game.gold >= 3 && slot && !slot.sold && slot.category === 'fighter'
    ? slot
    : null;
}

function finishShopPurchase(next, shopIndex) {
  next.gold -= 3;
  next.shop[shopIndex].sold = true;
  next.shop[shopIndex].saved = false;
}

/** Placement is permanent, so a fresh fighter's timers start the moment it lands. */
function stampFighterTimers(next, cat) {
  cat.nextAttackAt = next.clockMs + REALTIME.catAttackMs;
  const active = cat.activeAbility ?? CAT_COAT_INFO[normalizeCoat(cat.coat)].activeAbility;
  if (active) cat.abilityReadyAt = next.clockMs + REALTIME.abilityCooldownMs;
}

/** One square, one unit: cats, decoys, and living dogs all claim their cell. */
export function cellBlocked(game, row, col, ignoreCatId = null) {
  return game.cats.some((cat) => cat.id !== ignoreCatId && cat.row === row && cat.col === col)
    || (game.decoys ?? []).some((decoy) => decoy.row === row && decoy.col === col)
    || game.dogs.some((dog) => dog.hp > 0 && dog.row === row && dog.col === col);
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
    || cellBlocked(game, row, col)
  ) return game;
  const next = copy(game);
  const cat = { ...createCat(slot.level ?? 1, slot.coat), row, col };
  stampFighterTimers(next, cat);
  next.cats.push(cat);
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
    game.phase !== 'battle' || game.gold < 3 || !slot || slot.sold
    || slot.category !== 'worker' || targetIndex < 0 || targetIndex >= game.workers.length
  ) return game;
  const next = copy(game);
  const worker = createWorker(slot.role, slot.level ?? 1);
  const target = next.workers[targetIndex];
  if (target) {
    if (!stackWorkerInto(target, worker)) return game;
  } else {
    worker.outputReadyAt = next.clockMs + REALTIME.workerProduceMs;
    next.workers[targetIndex] = worker;
  }
  next.gold -= 3;
  next.shop[shopIndex].sold = true;
  next.shop[shopIndex].saved = false;
  next.message = `${WORKER_INFO[worker.role].name} joined the Production Yard.`;
  return next;
}

export function moveWorker(game, sourceIndex, targetIndex) {
  if (
    game.phase !== 'battle' || sourceIndex < 0 || sourceIndex >= game.workers.length
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
    game.phase !== 'battle' || sourceIndex === targetIndex
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

export function catSellValue(cat) {
  return Math.max(1, Math.min(3, Math.floor(Number(cat?.level) || 1)));
}

function catForSale(game, sourceType, catId) {
  const collection = sourceType === 'cat' ? game.cats : sourceType === 'bench' ? game.bench : null;
  return collection?.find((cat) => cat.id === catId) ?? null;
}

function equippedItems(cat) {
  return ['weapon', 'armour']
    .filter((kind) => cat.equipment?.[kind])
    .map((kind) => ({ kind, tier: cat.equipment[kind].tier ?? 1, quantity: 1 }));
}

export function catSaleQuote(game, sourceType, catId) {
  const cat = catForSale(game, sourceType, catId);
  const value = catSellValue(cat);
  if (game.phase !== 'battle' || !cat) {
    return { canSell: false, value, reason: 'This cat cannot be adopted out right now.' };
  }
  const preview = copy(game);
  for (const item of equippedItems(cat)) {
    if (addInventoryStackTo(preview, item) < 0) {
      return { canSell: false, value, reason: 'Storage needs room for equipped items.' };
    }
  }
  return { canSell: true, value, reason: '' };
}

export function sellCat(game, sourceType, catId) {
  const quote = catSaleQuote(game, sourceType, catId);
  if (!quote.canSell) return game;
  const next = copy(game);
  const collection = sourceType === 'cat' ? next.cats : next.bench;
  const index = collection.findIndex((cat) => cat.id === catId);
  if (index < 0) return game;
  const [cat] = collection.splice(index, 1);
  const returnedItems = equippedItems(cat);
  returnedItems.forEach((item) => addInventoryStackTo(next, item));
  next.gold += quote.value;
  next.events.push({
    type: 'sell-cat', catId: cat.id, level: cat.level,
    gold: quote.value, returnedItems,
  });
  next.message = `${CAT_COAT_INFO[normalizeCoat(cat.coat)].name} adopted for ${quote.value} gold${returnedItems.length ? '; equipment returned to Storage' : ''}.`;
  return next;
}

export function mergeInventoryItems(game, inventoryIndex) {
  const stack = game.inventory[inventoryIndex];
  if (
    game.phase !== 'battle' || !stack || (stack.kind !== 'weapon' && stack.kind !== 'armour')
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
  if (game.phase !== 'battle' || !game.workers[workerIndex]) return game;
  const next = copy(game);
  const worker = next.workers[workerIndex];
  next.workers[workerIndex] = null;
  next.gold += 1;
  next.events.push({ type: 'sell-worker', workerId: worker.id, gold: 1 });
  next.message = `${WORKER_INFO[worker.role].name} sold for 1 gold.`;
  return next;
}

export function collectWorkerOutput(game, workerIndex) {
  if (game.phase !== 'battle') return game;
  const worker = game.workers[workerIndex];
  const output = worker?.pendingOutput;
  if (!output) return game;
  const next = copy(game);
  if (output.kind === 'coins') next.gold += output.quantity;
  else if (addInventoryStackTo(next, output) < 0) return game;
  next.workers[workerIndex].pendingOutput = null;
  // Collecting wakes the cat from its nap and starts the next batch.
  next.workers[workerIndex].outputReadyAt = next.clockMs + REALTIME.workerProduceMs;
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

export function equipInventoryItem(game, inventoryIndex, targetType, targetId) {
  const stack = game.inventory[inventoryIndex];
  if (game.phase !== 'battle' || !stack || (stack.kind !== 'weapon' && stack.kind !== 'armour')) return game;
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
  if (game.phase !== 'battle' || stack?.kind !== 'food' || !target || target.hp <= 0 || target.hp >= target.maxHp) return game;
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

function resolveEncore(next, caster, target, random) {
  const multiplier = [0, 0.5, 0.75, 1][caster.level] ?? 0.5;
  const damage = Math.max(1, Math.ceil(target.attack * multiplier));
  const ability = target.ability ?? catStatsFor(target.level, target.coat).ability;
  let targets = [];
  if (ability === 'melee') {
    const dog = dogInMeleeFront(target, next.dogs);
    if (dog) targets = [dog];
  } else if (ability === 'piercing') {
    targets = livingDogs(next.dogs).filter((dog) => dog.col === target.col && dog.row < target.row)
      .sort((a, b) => b.row - a.row).slice(0, 3);
  } else if (ability === 'column-shot') {
    const dog = nearestDogInColumn(target, next.dogs);
    if (dog) targets = [dog];
  } else {
    const dog = closestDogByColumnPriority(target, next.dogs, random);
    if (dog) targets = [dog];
  }
  targets.forEach((dog) => pushDamageEvent(next.events, 'shot', target, dog, {
    damage, style: 'encore', fromCol: target.col, col: dog.col,
  }));
  next.events.push({ type: 'encore', from: caster.id, to: target.id, damage, hitCount: targets.length });
  next.dogs = next.dogs.filter((dog) => dog.hp > 0);
}

export function useActiveAbility(game, casterId, target = {}) {
  if (game.phase !== 'battle') return game;
  const source = game.cats.find((cat) => cat.id === casterId);
  const active = source?.activeAbility ?? CAT_COAT_INFO[normalizeCoat(source?.coat)].activeAbility;
  if (!source || !active || game.clockMs < (source.abilityReadyAt ?? 0)) return game;
  const next = copy(game);
  const caster = next.cats.find((cat) => cat.id === casterId);
  let used = false;

  if (active === 'freeze') {
    const dog = next.dogs.find((unit) => unit.id === target.dogId && unit.hp > 0 && !unit.frozenActions);
    if (dog) {
      dog.frozenActions = 1;
      dog.shatterDamage = caster.level === 1 ? 0 : caster.level === 2 ? 2 : 4;
      next.events.push({ type: 'freeze-cast', from: caster.id, to: dog.id, row: dog.row, col: dog.col });
      used = true;
    }
  } else if (active === 'teleport') {
    const ally = next.cats.find((cat) => cat.id === target.targetCatId);
    const legal = Number.isInteger(target.row) && Number.isInteger(target.col)
      && target.row >= CAT_ZONE_START && target.row < ROWS && target.col >= 0 && target.col < COLS
      && !cellBlocked(next, target.row, target.col, ally?.id);
    if (ally && legal) {
      const fromRow = ally.row; const fromCol = ally.col;
      ally.row = target.row; ally.col = target.col;
      if (caster.level >= 2) ally.guard = Math.max(ally.guard ?? 0, 2);
      if (caster.level >= 3) ally.nextAttackBonus = Math.max(ally.nextAttackBonus ?? 0, 2);
      next.events.push({ type: 'teleport', from: caster.id, to: ally.id, fromRow, fromCol, row: ally.row, col: ally.col });
      used = true;
    }
  } else if (active === 'decoy') {
    const legal = Number.isInteger(target.row) && Number.isInteger(target.col)
      && target.row >= CAT_ZONE_START && target.row < ROWS && target.col >= 0 && target.col < COLS
      && !cellBlocked(next, target.row, target.col);
    if (legal) {
      const hp = [0, 3, 6, 9][caster.level] ?? 3;
      next.decoys.push({ id: id('decoy'), kind: 'phantom-cat', row: target.row, col: target.col, hp, maxHp: hp });
      next.events.push({ type: 'decoy-cast', from: caster.id, row: target.row, col: target.col });
      used = true;
    }
  } else if (active === 'storm') {
    if (Number.isInteger(target.col) && target.col >= 0 && target.col < COLS && next.dogs.some((dog) => dog.col === target.col && dog.hp > 0)) {
      const damage = [0, 2, 4, 6][caster.level] ?? 2;
      next.dogs.filter((dog) => dog.col === target.col && dog.hp > 0)
        .forEach((dog) => pushDamageEvent(next.events, 'spell', caster, dog, { damage, style: 'lightning' }));
      next.dogs = next.dogs.filter((dog) => dog.hp > 0);
      used = true;
    }
  } else if (active === 'encore') {
    const ally = next.cats.find((cat) => cat.id === target.targetCatId && cat.id !== caster.id);
    if (ally) {
      resolveEncore(next, caster, ally, game.random);
      used = true;
    }
  }

  if (!used) return game;
  caster.abilityReadyAt = next.clockMs + REALTIME.abilityCooldownMs;
  next.message = `${CAT_COAT_INFO[normalizeCoat(caster.coat)].name} cast ${active.toUpperCase()}!`;
  checkVictory(next);
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
  if (!slot || slot.sold || game.phase !== 'battle' || game.gold < 3 || game.bench.length >= BENCH_SIZE) return game;
  const next = addCatToBench(game, slot, true);
  next.shop[slotIndex].sold = true;
  next.shop[slotIndex].saved = false;
  next.message = `${CAT_COAT_INFO[normalizeCoat(slot.coat)].name} added to the bench.`;
  return next;
}

export function toggleSaveShopSlot(game, slotIndex) {
  if (game.phase !== 'battle') return game;
  const slot = game.shop[slotIndex];
  if (!slot || slot.sold) return game;
  const next = copy(game);
  next.shop[slotIndex].saved = !next.shop[slotIndex].saved;
  next.message = next.shop[slotIndex].saved
    ? 'Pet saved — it stays through refresh and the next wave.'
    : 'Pet unsaved — it can roll away on refresh.';
  return next;
}

export function refreshShop(game) {
  if (game.phase !== 'battle' || game.gold < 1) return game;
  const next = copy(game);
  next.gold -= 1;
  next.shop = makeShop(game.random, game.shop, Math.max(1, game.waveNumber));
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
  if (game.phase !== 'battle' || row < CAT_ZONE_START || row >= ROWS || col < 0 || col >= COLS) return game;
  if (cellBlocked(game, row, col)) return game;
  const source = game.bench[benchIndex];
  if (!source) return game;
  const next = copy(game);
  const [cat] = next.bench.splice(benchIndex, 1);
  const placed = { ...cat, row, col };
  stampFighterTimers(next, placed);
  next.cats.push(placed);
  return next;
}

export function availableDogRolesForRound(round = 1) {
  const safeRound = Math.max(1, Number(round) || 1);
  return Object.values(DOG_ROLE)
    .filter((role) => DOG_ROLE_INFO[role].unlockRound <= safeRound);
}

export function generateWave(round, random = Math.random) {
  const counts = [1, 2, 2, 3, 3, 4, 4];
  const count = counts[Math.min(round - 1, counts.length - 1)];
  const maxTier = shopTierForRound(round);
  const availableRoles = availableDogRolesForRound(round);
  const available = Array.from({ length: COLS }, (_, col) => col);
  const dogs = [];
  for (let i = 0; i < count; i += 1) {
    const pick = Math.floor(random() * available.length);
    const col = available.splice(pick, 1)[0];
    const tier = 1 + Math.min(maxTier - 1, Math.floor(random() * maxTier));
    const role = availableRoles[Math.min(availableRoles.length - 1, Math.floor(random() * availableRoles.length))];
    dogs.push(createDog(tier, 0, col, role));
  }
  // Always introduce the newly unlocked stat tier on odd unlock waves.
  if (round % 2 === 1 && !dogs.some((dog) => dog.tier === maxTier)) {
    const replaced = dogs[dogs.length - 1];
    dogs[dogs.length - 1] = createDog(maxTier, 0, replaced.col, replaced.role);
  }
  const debutRole = Object.values(DOG_ROLE)
    .find((role) => DOG_ROLE_INFO[role].unlockRound === round && role !== DOG_ROLE.SCRUFFY);
  if (debutRole && dogs.length && !dogs.some((dog) => dog.role === debutRole)) {
    const replaced = dogs[0];
    dogs[0] = createDog(replaced.tier, 0, replaced.col, debutRole);
  }
  return dogs;
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
 * Hissiletoe targeting:
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
  let damage = typeof extra.damage === 'number' ? extra.damage : from.attack;
  if (to.shatterDamage) {
    damage += to.shatterDamage;
    extra = { ...extra, shatterDamage: to.shatterDamage };
    to.shatterDamage = 0;
  }
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

function applyDogDamage(next, dog, target, type = 'melee', extra = {}) {
  const hpBefore = target.hp;
  const armour = target.equipment?.armour;
  const armourBlocked = armour?.block ?? 0;
  const guardBlocked = target.guard ?? 0;
  const attack = extra.damage ?? (dog.attack + (dog.attackBoost ?? 0));
  const blocked = Math.min(armourBlocked + guardBlocked, Math.max(0, attack - 1));
  const damage = Math.max(1, attack - blocked);
  let armourBroken = false;
  let armourUsesAfter = null;
  if (armour) {
    armour.uses -= 1;
    armourUsesAfter = Math.max(0, armour.uses);
    if (armour.uses <= 0) {
      target.equipment.armour = null;
      armourBroken = true;
    }
  }
  if (target.guard) target.guard = 0;
  target.hp = Math.max(0, target.hp - damage);
  dog.attackBoost = 0;
  next.events.push({
    type,
    from: dog.id,
    to: target.id,
    col: target.col,
    fromCol: dog.col,
    fromRow: dog.row,
    toRow: target.row,
    damage,
    blocked,
    armourUsesAfter,
    armourBroken,
    hpBefore,
    hpAfter: target.hp,
    maxHp: target.maxHp,
    ...extra,
    damage,
  });
}

function catMeleeAttack(next, cat) {
  const target = dogInMeleeFront(cat, next.dogs);
  if (target) {
    pushDamageEvent(next.events, 'cat-melee', cat, target, { col: cat.col, style: 'melee' });
  } else {
    pushMissEvent(next.events, 'cat-melee', cat, {
      col: cat.col, toRow: Math.max(0, cat.row - 1), style: 'melee',
    });
  }
}

function catTangleAttack(next, cat) {
  const target = closestDogByColumnPriority(cat, next.dogs, next.random);
  if (target) {
    pushDamageEvent(next.events, 'shot', cat, target, {
      fromCol: cat.col, col: target.col, style: 'tangle',
    });
    if (target.hp > 0) target.tangled = true;
  } else {
    pushMissEvent(next.events, 'shot', cat, { fromCol: cat.col, col: cat.col, toRow: 0, style: 'tangle' });
  }
}

function catSplashAttack(next, cat) {
  const target = closestDogByColumnPriority(cat, next.dogs, next.random);
  if (!target) {
    pushMissEvent(next.events, 'shot', cat, { fromCol: cat.col, col: cat.col, toRow: 0, style: 'splash' });
    return;
  }
  pushDamageEvent(next.events, 'shot', cat, target, {
    fromCol: cat.col, col: target.col, style: 'splash',
  });
  livingDogs(next.dogs)
    .filter((dog) => dog.row === target.row && Math.abs(dog.col - target.col) === 1)
    .forEach((dog) => pushDamageEvent(next.events, 'shot', cat, dog, {
      fromCol: target.col, col: dog.col, style: 'splash-secondary', damage: 1,
    }));
}

function catPierceAttack(next, cat) {
  const targets = livingDogs(next.dogs)
    .filter((dog) => dog.col === cat.col && dog.row < cat.row)
    .sort((a, b) => b.row - a.row)
    .slice(0, 3);
  if (targets.length) {
    targets.forEach((target, index) => pushDamageEvent(next.events, 'shot', cat, target, {
      fromCol: cat.col, col: target.col, style: 'piercing', pierceIndex: index,
    }));
  } else {
    pushMissEvent(next.events, 'shot', cat, { fromCol: cat.col, col: cat.col, toRow: 0, style: 'piercing' });
  }
}

function catHomingAttack(next, cat) {
  const target = closestDogByColumnPriority(cat, next.dogs, next.random);
  if (target) {
    pushDamageEvent(next.events, 'shot', cat, target, {
      fromCol: cat.col, col: target.col, style: 'homing',
    });
  } else {
    pushMissEvent(next.events, 'shot', cat, { fromCol: cat.col, col: cat.col, toRow: 0, style: 'homing' });
  }
}

// Orange tabby: 3 rapid pellets that split the cat's attack power.
// Always fire the volley — leftover pellets fly off-screen if no dog remains.
function catBurstAttack(next, cat) {
  const pellets = splitDamage(cat.attack, 3).filter((amount) => amount > 0);
  pellets.forEach((amount, pelletIndex) => {
    const target = nearestDogInColumn(cat, next.dogs);
    const shared = {
      fromCol: cat.col, col: cat.col, style: 'column', burst: true,
      pelletIndex, pelletCount: pellets.length, damage: amount,
    };
    if (target) {
      pushDamageEvent(next.events, 'shot', cat, target, shared);
    } else {
      pushMissEvent(next.events, 'shot', cat, { ...shared, toRow: 0 });
    }
  });
}

/** One cat attack; rules ported verbatim from the old per-section cat loop. */
function fireCatAttack(next, cat) {
  let restoreAttack = null;
  if (cat.nextAttackBonus) {
    restoreAttack = cat.attack;
    cat.attack += cat.nextAttackBonus;
    cat.nextAttackBonus = 0;
  }
  const ability = cat.ability ?? catStatsFor(cat.level, cat.coat).ability;
  if (ability === 'melee') catMeleeAttack(next, cat);
  else if (ability === 'tangle-homing') catTangleAttack(next, cat);
  else if (ability === 'splash') catSplashAttack(next, cat);
  else if (ability === 'piercing') catPierceAttack(next, cat);
  else if (ability === 'homing') catHomingAttack(next, cat);
  else catBurstAttack(next, cat);
  if (restoreAttack != null) cat.attack = restoreAttack;
}

function dogHowls(next, dog) {
  if (dog.role !== DOG_ROLE.HOWLER || dog.howlUsed) return false;
  const allies = next.dogs.filter((other) => other.id !== dog.id
    && other.hp > 0
    && Math.abs(other.col - dog.col) <= 1
    && Math.abs(other.row - dog.row) <= 2);
  if (!allies.length) return false;
  allies.forEach((ally) => { ally.attackBoost = Math.max(ally.attackBoost ?? 0, 2); });
  dog.howlUsed = true;
  next.events.push({
    type: 'howl', id: dog.id, row: dog.row, col: dog.col,
    targets: allies.map((ally) => ally.id), bonus: 2,
  });
  return true;
}

function dogThrowsTennisBall(next, dog) {
  if (dog.role !== DOG_ROLE.TENNIS) return false;
  const rangedTarget = [...next.cats, ...next.decoys]
    .filter((target) => target.hp > 0
      && target.col === dog.col
      && target.row - dog.row >= 2
      && target.row - dog.row <= 3)
    .sort((left, right) => left.row - right.row)[0];
  if (!rangedTarget) return false;
  const rangedDamage = Math.max(1, Math.ceil((dog.attack + (dog.attackBoost ?? 0)) * 0.6));
  applyDogDamage(next, dog, rangedTarget, 'dog-shot', { style: 'tennis', damage: rangedDamage });
  return true;
}

function dogFightsBlocker(next, dog, blockingCat) {
  const landingRow = dog.row + 2;
  const landingBlocked = landingRow >= ROWS
    || next.dogs.some((other) => other.id !== dog.id && other.col === dog.col && other.row === landingRow)
    || next.cats.some((cat) => cat.hp > 0 && cat.col === dog.col && cat.row === landingRow)
    || next.decoys.some((decoy) => decoy.hp > 0 && decoy.col === dog.col && decoy.row === landingRow);
  if (dog.role === DOG_ROLE.JUMPER && !dog.jumped && !landingBlocked) {
    const fromRow = dog.row;
    dog.row = landingRow;
    dog.jumped = true;
    next.events.push({
      type: 'dog-jump', id: dog.id, fromRow, toRow: dog.row,
      row: dog.row, col: dog.col, over: blockingCat.id,
    });
  } else {
    applyDogDamage(next, dog, blockingCat);
  }
}

function dogAdvances(next, dog, swept) {
  const dogAhead = next.dogs.some((other) => other.id !== dog.id && other.col === dog.col && other.row === dog.row + 1);
  if (dogAhead) return;
  if (dog.tangled) {
    dog.tangled = false;
    next.events.push({ type: 'tangle-skip', id: dog.id, row: dog.row, col: dog.col });
    return;
  }
  const fromRow = dog.row;
  dog.row += 1;
  next.events.push({ type: 'move', id: dog.id, fromRow, toRow: dog.row, row: dog.row, col: dog.col });
  if (dog.row < ROWS) return;
  // Breach: the porch super-cat sweeps the whole lane at the cost of a life.
  next.lives = Math.max(0, next.lives - 1);
  const col = dog.col;
  next.dogs.forEach((other) => { if (other.col === col) swept?.add(other.id); });
  next.dogs = next.dogs.filter((other) => other.col !== col);
  next.events.push({ type: 'super-cat', col });
  if (next.lives <= 0) {
    next.phase = 'gameover';
    next.message = 'The dogs reached the porch. Game over!';
  }
}

/** One dog act (move, bite, howl, throw, or jump); rules ported from the old dog loop. */
function fireDogAct(next, dog, swept) {
  if (dog.frozenActions > 0) {
    dog.frozenActions -= 1;
    next.events.push({ type: 'freeze-skip', id: dog.id, row: dog.row, col: dog.col });
    return;
  }
  if (dogHowls(next, dog)) return;
  if (dogThrowsTennisBall(next, dog)) return;
  const blockingCat = next.cats.find((cat) => cat.col === dog.col && cat.row === dog.row + 1 && cat.hp > 0)
    ?? next.decoys.find((decoy) => decoy.col === dog.col && decoy.row === dog.row + 1 && decoy.hp > 0);
  if (blockingCat) {
    dogFightsBlocker(next, dog, blockingCat);
    return;
  }
  dogAdvances(next, dog, swept);
}

function fireWorkerFinish(next, worker) {
  worker.pendingOutput = outputForWorker(worker.role, worker.level);
  worker.outputReadyAt = null;
  next.events.push({
    type: 'worker-output-ready', workerId: worker.id,
    output: worker.pendingOutput ? { ...worker.pendingOutput } : null,
  });
}

function jitterMs(random) {
  return Math.round((random() * 2 - 1) * REALTIME.dogJitterMs);
}

function passiveGoldFor(elapsedMs) {
  return (elapsedMs / REALTIME.waveIntervalMs) * REALTIME.goldPerWave;
}

function spawnWave(next) {
  const spawnAt = next.waveDueAt;
  next.waveNumber += 1;
  const displayWave = Math.min(MAX_WAVES, next.waveNumber);
  const arriving = (next.nextWave?.length ? next.nextWave : generateWave(displayWave, next.random))
    .map((dog) => ({ ...dog }));
  const occupied = new Set(next.dogs.filter((dog) => dog.row === 0).map((dog) => dog.col));
  const spawned = [];
  const delayed = [];
  for (const dog of arriving) {
    let col = dog.col;
    if (occupied.has(col)) {
      const free = Array.from({ length: COLS }, (_, candidate) => candidate)
        .filter((candidate) => !occupied.has(candidate));
      if (!free.length) {
        // Gate jam: the dog waits for the next spawn instead of vanishing,
        // so the level always delivers every generated enemy.
        delayed.push(dog);
        continue;
      }
      col = free[Math.floor(next.random() * free.length)];
    }
    occupied.add(col);
    spawned.push({
      ...dog, col, howlUsed: false, jumped: false, attackBoost: 0,
      nextActAt: next.clockMs + REALTIME.dogActMs + jitterMs(next.random),
    });
  }
  next.dogs.push(...spawned);
  if (next.waveNumber < MAX_WAVES) {
    next.waveDueAt = spawnAt + REALTIME.waveIntervalMs;
    next.nextWave = [...delayed, ...generateWave(next.waveNumber + 1, next.random)];
  } else if (delayed.length) {
    next.waveDueAt = spawnAt + REALTIME.dogActMs;
    next.nextWave = delayed;
  } else {
    next.waveDueAt = null;
    next.nextWave = [];
  }
  next.shop = makeShop(next.random, next.shop, displayWave);
  next.message = `Wave ${displayWave}: defend the yard!`;
  next.events.push({
    type: 'wave', wave: displayWave, count: spawned.length,
    roles: spawned.map((dog) => dog.role),
  });
}

function checkVictory(next) {
  if (
    next.phase === 'battle'
    && next.waveDueAt == null
    && next.waveNumber >= MAX_WAVES
    && next.dogs.length === 0
  ) {
    next.phase = 'victory';
    next.message = 'All dogs cleared! Level 1 complete.';
    next.events.push({ type: 'level-clear' });
  }
}

/** Move the clock and drip passive gold once the first wave has arrived. */
function moveClock(next, toMs) {
  const dt = toMs - next.clockMs;
  if (dt <= 0) return;
  next.clockMs = toMs;
  if (next.waveNumber === 0) return;
  next.goldFraction += passiveGoldFor(dt);
  const whole = Math.floor(next.goldFraction + GOLD_ROUNDING_EPSILON);
  if (whole > 0) {
    next.gold += whole;
    next.goldFraction = Math.max(0, next.goldFraction - whole);
  }
}

function nextDueAt(game) {
  let due = null;
  const consider = (time) => {
    if (time != null && (due == null || time < due)) due = time;
  };
  game.cats.forEach((cat) => consider(cat.nextAttackAt));
  game.dogs.forEach((dog) => consider(dog.nextActAt));
  game.workers.forEach((worker) => {
    if (worker && !worker.pendingOutput) consider(worker.outputReadyAt);
  });
  consider(game.waveDueAt);
  return due;
}

/** Fire everything due at the current clock instant, in canonical order. */
function fireDue(next) {
  const now = next.clockMs;

  const dueCats = next.cats
    .filter((cat) => cat.nextAttackAt != null && cat.nextAttackAt <= now)
    .sort((a, b) => a.row - b.row || a.col - b.col);
  const dogsVisible = livingDogs(next.dogs).length > 0;
  for (const cat of dueCats) {
    if (cat.hp <= 0) continue;
    cat.nextAttackAt += REALTIME.catAttackMs;
    if (dogsVisible) fireCatAttack(next, cat);
  }
  if (dogsVisible && dueCats.length) {
    next.dogs = next.dogs.filter((dog) => dog.hp > 0);
    checkVictory(next);
    if (next.phase !== 'battle') return;
  }

  const dueDogs = next.dogs
    .filter((dog) => dog.nextActAt != null && dog.nextActAt <= now)
    .sort((a, b) => b.row - a.row || a.col - b.col);
  const swept = new Set(); // Dogs a breach removed before their own turn came.
  for (const dog of dueDogs) {
    if (dog.hp <= 0 || swept.has(dog.id)) continue;
    dog.nextActAt += REALTIME.dogActMs;
    fireDogAct(next, dog, swept);
    if (next.phase !== 'battle') return;
  }
  next.cats = next.cats.filter((cat) => cat.hp > 0);
  next.decoys = next.decoys.filter((decoy) => decoy.hp > 0);
  checkVictory(next);
  if (next.phase !== 'battle') return;

  next.workers.forEach((worker) => {
    if (worker && !worker.pendingOutput && worker.outputReadyAt != null && worker.outputReadyAt <= now) {
      fireWorkerFinish(next, worker);
    }
  });

  if (next.waveDueAt != null && next.waveDueAt <= now) spawnWave(next);
}

/**
 * Advance the battle by elapsed game-time. Walks the clock from due-timer to
 * due-timer so results are identical however the time is sliced.
 */
export function advance(game, elapsedMs) {
  if (game.phase !== 'battle' || !(elapsedMs > 0)) return game;
  const idleTarget = game.clockMs + elapsedMs;
  const firstDue = nextDueAt(game);
  if (firstDue == null || firstDue > idleTarget) {
    // Nothing fires this slice (the common per-frame case): bump the clock and
    // gold without deep-cloning every unit, shop slot, and inventory stack.
    const goldFraction = game.goldFraction
      + (game.waveNumber > 0 ? passiveGoldFor(elapsedMs) : 0);
    const whole = Math.floor(goldFraction + GOLD_ROUNDING_EPSILON);
    return {
      ...game,
      clockMs: idleTarget,
      goldFraction: Math.max(0, goldFraction - whole),
      gold: game.gold + whole,
      events: [],
    };
  }
  const next = copy(game);
  const target = next.clockMs + elapsedMs;
  for (let guard = 0; guard < 10000; guard += 1) {
    const due = nextDueAt(next);
    if (due == null || due > target) break;
    moveClock(next, Math.max(next.clockMs, due));
    fireDue(next);
    if (next.phase !== 'battle') return next;
  }
  moveClock(next, target);
  return next;
}
