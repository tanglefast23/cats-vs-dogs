export const ROWS = 14;
export const COLS = 6;
export const CAT_ZONE_START = 10;
export const MAX_ROUNDS = 7;
export const ACTIONS_PER_ROUND = 2;
export const BENCH_SIZE = 6;
export const SHOP_SIZE = 5;

/** Coat 0 orange tabby: column shot. Coat 1 grey/blue: melee tank. Coat 2 white: homing shot. */
export const CAT_COAT = {
  ORANGE: 0,
  GREY: 1,
  WHITE: 2,
};

export const CAT_COAT_INFO = {
  0: {
    name: 'Orange Tabby',
    shortName: 'Tabby',
    ability: 'column-shot',
    blurb: '3-shot column burst',
    attackDetail: 'Each action, fires 3 rapid column shots that split its attack damage. Shots retarget the nearest dog ahead in its column.',
  },
  1: {
    name: 'Blue Brawler',
    shortName: 'Brawler',
    ability: 'melee',
    blurb: 'Heavy melee · 2× HP',
    attackDetail: 'Does not shoot. Only melee-attacks the dog directly in the tile in front. Double HP and very high damage.',
  },
  2: {
    name: 'Snow Ghost',
    shortName: 'Ghost',
    ability: 'homing',
    blurb: 'Homing wave shot',
    attackDetail: 'Each action, fires one weaker sine-wave shot that homes by nearest column first (own column, then adjacent, then farther). In a tied column distance, it picks the lowest dog; a full tie is random.',
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
};

export const DOG_STATS = {
  1: { hp: 7, attack: 3 },
  2: { hp: 11, attack: 4 },
  3: { hp: 16, attack: 6 },
};

let nextId = 1;
const id = (prefix) => `${prefix}-${nextId++}`;

export function normalizeCoat(coat = 0) {
  const value = Number(coat);
  if (value === 1 || value === 2) return value;
  return 0;
}

export function catStatsFor(level = 1, coat = 0) {
  const safeLevel = CAT_STATS[level] ? level : 1;
  const safeCoat = normalizeCoat(coat);
  const base = CAT_STATS[safeLevel];
  const hp = safeCoat === CAT_COAT.GREY ? base.hp * 2 : base.hp;
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
  const hp = dog.hp ?? stats.hp;
  const maxHp = dog.maxHp ?? stats.hp;
  const attack = dog.attack ?? stats.attack;
  return {
    kind: 'dog',
    title: `T${tier} Scruffy Dog`,
    stats: `♥ ${hp}/${maxHp} · ↑ ${attack}`,
    attack: 'Each action, steps one tile toward the porch. If a cat is in the tile ahead, it bites that cat instead of moving.',
    note: tier >= 2 ? 'Tougher mutt with more HP and bite.' : 'Standard yard invader.',
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
    attack: stats.attack,
    coat: safeCoat,
    ability: stats.ability,
  };
}

export function createDog(tier = 1, row = 0, col = 0) {
  const stats = DOG_STATS[tier];
  return { id: id('dog'), kind: 'scruffy-dog', tier, row, col, hp: stats.hp, maxHp: stats.hp, attack: stats.attack };
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
    shop: makeShop(random),
    events: [],
    random,
    message: 'Build your team, then start the round.',
  };
}

function copy(game) {
  return {
    ...game,
    cats: game.cats.map((unit) => ({ ...unit })),
    dogs: game.dogs.map((unit) => ({ ...unit })),
    bench: game.bench.map((unit) => ({ ...unit })),
    shop: game.shop.map((slot) => ({ ...slot })),
    events: [],
  };
}

export function makeShopSlot(random = Math.random) {
  const coat = Math.floor(random() * 3);
  const stats = catStatsFor(1, coat);
  return {
    id: id('shop'),
    kind: 'alley-cat',
    level: 1,
    coat,
    ability: stats.ability,
    sold: false,
    saved: false,
  };
}

export function makeShop(random = Math.random, previous = null) {
  return Array.from({ length: SHOP_SIZE }, (_, index) => {
    const prior = previous?.[index];
    // Saved, still-available pets stay put through refresh and into the next round.
    if (prior && prior.saved && !prior.sold) {
      return { ...prior, saved: true, sold: false };
    }
    return makeShopSlot(random);
  });
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
  next.shop = makeShop(game.random, game.shop);
  const kept = next.shop.filter((slot) => slot.saved).length;
  next.message = kept
    ? `Shop refreshed. ${kept} saved pet${kept === 1 ? '' : 's'} kept.`
    : 'The shop has been refreshed.';
  return next;
}

export function combineCats(game) {
  const next = copy(game);
  for (let level = 1; level <= 2; level += 1) {
    for (const coat of [0, 1, 2]) {
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
  cat.attack = stats.attack;
  cat.ability = stats.ability;
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
  const available = Array.from({ length: COLS }, (_, col) => col);
  const dogs = [];
  for (let i = 0; i < count; i += 1) {
    const pick = Math.floor(random() * available.length);
    const col = available.splice(pick, 1)[0];
    const tierTwoChance = round >= 5 ? (round === 5 ? 0.3 : 0.45) : 0;
    const tier = random() < tierTwoChance ? 2 : 1;
    dogs.push(createDog(tier, 0, col));
  }
  if (round === MAX_ROUNDS && !dogs.some((dog) => dog.tier === 2)) dogs[dogs.length - 1] = createDog(2, 0, dogs[dogs.length - 1].col);
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
      blockingCat.hp = Math.max(0, blockingCat.hp - dog.attack);
      next.events.push({
        type: 'melee',
        from: dog.id,
        to: blockingCat.id,
        col: dog.col,
        fromRow: dog.row,
        toRow: blockingCat.row,
        damage: dog.attack,
        hpBefore,
        hpAfter: blockingCat.hp,
        maxHp: blockingCat.maxHp,
      });
    } else {
      const dogAhead = next.dogs.some((other) => other.id !== dog.id && other.col === dog.col && other.row === dog.row + 1);
      if (!dogAhead) {
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
  next.shop = makeShop(game.random, game.shop);
  const kept = next.shop.filter((slot) => slot.saved).length;
  next.message = kept
    ? `Round ${next.round} prep: 10 fresh gold! ${kept} saved pet${kept === 1 ? '' : 's'} held over.`
    : next.dogs.length === 0
      ? `Wave cleared! Round ${next.round} prep: 10 fresh gold!`
      : `Round ${next.round} prep: 10 fresh gold!`;
  // Surviving cats heal between rounds for a forgiving first level.
  next.cats.forEach((cat) => { cat.hp = cat.maxHp; });
  return next;
}
