import {
  WORKER_ROLE, WORKER_INFO, workerShopEntries, outputForWorker,
  sameInventoryItem, WEAPON_INFO, ARMOUR_INFO, FOOD_HEAL,
} from './production-rules.js';
import { catMoveLimit } from './movement-rules.js';

export { WORKER_ROLE, WORKER_INFO } from './production-rules.js';

export const ROWS = 14;
export const COLS = 6;
export const CAT_ZONE_START = 10;
export const MAX_ROUNDS = 10;
export const ACTIONS_PER_ROUND = 2;
export const BENCH_SIZE = 3;
export const PRODUCTION_CAPACITY = 2;
export const STORAGE_CAPACITY = 2;
export const MAX_FIELD_CATS = 5;
export const MAX_SHOP_SIZE = 5;
export const DOG_MOVE_DISTANCE = 2;
export const FAST_DOG_MOVE_DISTANCE = 3;
export const DOG_CELL_CAPACITY = 2;

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
    role: 'Lane damage specialist',
    strength: 'Highest reliable single-target damage',
    weakness: 'Fragile and cannot attack outside its column',
    blurb: 'High damage · one column',
    attackDetail: 'Fires 3 rapid shots that split its high attack damage. Shots retarget the nearest dog ahead, but never leave Purrcy\'s column.',
    shopTier: 1,
    unlockRound: 1,
  },
  1: {
    name: 'Clawdius',
    shortName: 'Clawdius',
    ability: 'melee',
    role: 'Defensive tank',
    strength: 'By far the highest health',
    weakness: 'Very low damage and only reaches the tile directly ahead',
    blurb: 'Extreme HP · tiny melee',
    attackDetail: 'Does not shoot. Clawdius has enormous health, but deals very low damage and can only hit the dog directly in the front tile.',
    shopTier: 1,
    unlockRound: 1,
  },
  2: {
    name: 'Hissiletoe',
    shortName: 'Hissile',
    ability: 'homing',
    role: 'Balanced homing generalist',
    strength: 'Reliable medium damage that can reach any column',
    weakness: 'Deals half or less of Purrcy\'s damage',
    blurb: 'Medium stats · homing',
    attackDetail: 'Fires one medium-strength sine-wave shot at the lowest dog row first, then the nearest column. It can reach any column, but deals half or less of Purrcy\'s straight-shot damage.',
    shopTier: 1,
    unlockRound: 1,
  },
  3: {
    name: 'Knotty Kitty',
    shortName: 'Knotty',
    ability: 'tangle-homing',
    role: 'Movement-control specialist',
    strength: 'Each dog hit for the first time skips its next move',
    weakness: 'Very low damage; a dog can only be tangled once',
    blurb: 'One-time stop · low damage',
    attackDetail: 'Fires weak homing yarn. The first hit on each dog tangles it so its next unblocked move is skipped; later hits on that dog only deal the low damage.',
    shopTier: 1,
    unlockRound: 1,
  },
  4: {
    name: 'Bombay Boom',
    shortName: 'Bombay',
    ability: 'bomb',
    activeAbility: 'bomb-cross',
    role: 'Lane bomber and crowd-damage specialist',
    strength: 'Medium lane damage plus a five-square Tactics bomb',
    weakness: 'Fragile and cannot normally attack outside its lane',
    blurb: 'Medium lane bomb · plus spell',
    attackDetail: 'Unlocked on round 4. Lobs one medium-strength bomb at the nearest dog ahead in Bombay\'s lane. Once per battle, his Tactics bomb hits a five-square plus — full damage to the dog at the center, half to the four sides.',
    shopTier: 2,
    unlockRound: 4,
  },
  5: {
    name: 'Laserpaw',
    shortName: 'Laser',
    ability: 'piercing',
    role: 'Lane-clearing specialist',
    strength: 'Full damage to as many as three dogs in one column',
    weakness: 'Very fragile and completely useless outside its column',
    blurb: 'Pierces 3 · glass cannon',
    attackDetail: 'Unlocked on round 7. Fires a strong prism beam through up to three dogs ahead in its own column. It cannot touch other columns and has very low health.',
    shopTier: 3,
    unlockRound: 7,
  },
  6: {
    name: 'Frosty Paws', shortName: 'Frosty', ability: 'homing', activeAbility: 'freeze',
    role: 'Freeze-control specialist', strength: 'Freezes one chosen dog for two rounds', weakness: 'Very low normal damage',
    blurb: 'Hard freeze · weak attack', attackDetail: 'Unlocked on round 4. Normal shots are very weak, but once per battle Frosty can freeze one chosen dog for the rest of the current round and all of the next round.', shopTier: 2, unlockRound: 4,
  },
  7: {
    name: 'Purrtal', shortName: 'Purrtal', ability: 'homing', activeAbility: 'teleport',
    role: 'Positioning specialist', strength: 'Teleports an ally anywhere or shifts one enemy up to two squares', weakness: 'Low normal damage',
    blurb: 'Best mobility · low attack', attackDetail: 'Unlocked on round 4. Normal shots are weak, but once per battle Purrtal can teleport one allied cat to any empty cat square, or move one enemy up to two squares onto a square holding at most one dog.', shopTier: 2, unlockRound: 4,
  },
  8: {
    name: 'Faux Paw', shortName: 'Faux Paw', ability: 'homing', activeAbility: 'decoy',
    role: 'Defensive-utility specialist', strength: 'Summons a blocker anywhere in cat territory', weakness: 'Fragile with low normal damage',
    blurb: 'Decaying blocker · frail caster', attackDetail: 'Unlocked on round 4. Faux Paw is fragile and shoots weakly, but once per battle can summon a phantom with one more attack block than Faux Paw\'s level. It loses one remaining block each later round.', shopTier: 2, unlockRound: 4,
  },
  9: {
    name: 'Thunderpaws', shortName: 'Thunder', ability: 'homing', activeAbility: 'storm',
    role: 'Burst-ability specialist', strength: 'Strikes every dog in one chosen column', weakness: 'Very fragile with the weakest normal attack',
    blurb: 'Huge spell · tiny attack', attackDetail: 'Unlocked on round 4. Normal shots barely hurt, but once per battle Thunderpaws can strike every dog in one selected column.', shopTier: 2, unlockRound: 4,
  },
  10: {
    name: 'Meowstro', shortName: 'Meowstro', ability: 'homing', activeAbility: 'duel',
    role: 'Enemy-control specialist', strength: 'Forces two nearby dogs to attack each other', weakness: 'Very low personal damage',
    blurb: 'Dog duel · tiny attack', attackDetail: 'Unlocked on round 4. Meowstro deals very little damage, but once per battle can select a dog square and make two dogs there or on adjacent squares deal their own attack damage to each other.', shopTier: 2, unlockRound: 4,
  },
};

// Default Purrcy stats are exported for older callers; every coat has its own curve below.
export const CAT_STATS = {
  1: { hp: 4, attack: 4 },
  2: { hp: 13, attack: 14 },
  3: { hp: 40, attack: 44 },
};

// A unit pays for targeting or active utility with damage. Purrcy is the damage benchmark.
const COAT_ATTACK = {
  0: { 1: 4, 2: 14, 3: 44 },
  1: { 1: 1, 2: 4, 3: 13 },
  2: { 1: 2, 2: 7, 3: 22 },
  3: { 1: 1, 2: 4, 3: 13 },
  4: { 1: 2, 2: 7, 3: 22 },
  5: { 1: 3, 2: 10, 3: 31 },
  6: { 1: 1, 2: 4, 3: 13 },
  7: { 1: 1, 2: 4, 3: 13 },
  8: { 1: 1, 2: 4, 3: 13 },
  9: { 1: 1, 2: 4, 3: 13 },
  10: { 1: 1, 2: 4, 3: 13 },
};

const COAT_HP = {
  0: { 1: 4, 2: 13, 3: 40 },
  1: { 1: 18, 2: 56, 3: 171 },
  2: { 1: 7, 2: 22, 3: 68 },
  3: { 1: 5, 2: 16, 3: 49 },
  4: { 1: 4, 2: 13, 3: 40 },
  5: { 1: 4, 2: 13, 3: 40 },
  6: { 1: 5, 2: 16, 3: 49 },
  7: { 1: 6, 2: 19, 3: 58 },
  8: { 1: 4, 2: 13, 3: 40 },
  9: { 1: 4, 2: 13, 3: 40 },
  10: { 1: 5, 2: 16, 3: 49 },
};

export const DOG_STATS = {
  1: { hp: 8, attack: 4 },
  2: { hp: 13, attack: 6 },
  3: { hp: 19, attack: 8 },
  4: { hp: 26, attack: 11 },
};

export const DOG_ROLE = Object.freeze({
  SCRUFFY: 'scruffy',
  FRISBEE: 'frisbee',
  TENNIS: 'tennis',
  HOWLER: 'howler',
  LOBBER: 'lobber',
  JUMPER: 'jumper',
  SKITTISH: 'skittish',
  MEDIC: 'medic',
  GROWLER: 'growler',
});

export function dogMoveDistance(dog) {
  return dog?.role === DOG_ROLE.JUMPER ? FAST_DOG_MOVE_DISTANCE : DOG_MOVE_DISTANCE;
}

const DOG_ROLE_STATS = Object.freeze({
  [DOG_ROLE.SCRUFFY]: Object.freeze({
    1: Object.freeze({ hp: 8, attack: 4 }), 2: Object.freeze({ hp: 13, attack: 6 }),
    3: Object.freeze({ hp: 19, attack: 8 }), 4: Object.freeze({ hp: 26, attack: 11 }),
  }),
  [DOG_ROLE.FRISBEE]: Object.freeze({
    1: Object.freeze({ hp: 5, attack: 2 }), 2: Object.freeze({ hp: 8, attack: 3 }),
    3: Object.freeze({ hp: 11, attack: 5 }), 4: Object.freeze({ hp: 15, attack: 7 }),
  }),
  [DOG_ROLE.TENNIS]: Object.freeze({
    1: Object.freeze({ hp: 5, attack: 3 }), 2: Object.freeze({ hp: 8, attack: 4 }),
    3: Object.freeze({ hp: 12, attack: 6 }), 4: Object.freeze({ hp: 16, attack: 8 }),
  }),
  [DOG_ROLE.HOWLER]: Object.freeze({
    1: Object.freeze({ hp: 6, attack: 1 }), 2: Object.freeze({ hp: 10, attack: 2 }),
    3: Object.freeze({ hp: 14, attack: 3 }), 4: Object.freeze({ hp: 19, attack: 4 }),
  }),
  [DOG_ROLE.LOBBER]: Object.freeze({
    1: Object.freeze({ hp: 4, attack: 2 }), 2: Object.freeze({ hp: 7, attack: 3 }),
    3: Object.freeze({ hp: 10, attack: 4 }), 4: Object.freeze({ hp: 13, attack: 6 }),
  }),
  [DOG_ROLE.JUMPER]: Object.freeze({
    1: Object.freeze({ hp: 5, attack: 2 }), 2: Object.freeze({ hp: 8, attack: 3 }),
    3: Object.freeze({ hp: 11, attack: 4 }), 4: Object.freeze({ hp: 15, attack: 6 }),
  }),
  [DOG_ROLE.SKITTISH]: Object.freeze({
    1: Object.freeze({ hp: 3, attack: 1 }), 2: Object.freeze({ hp: 6, attack: 1 }),
    3: Object.freeze({ hp: 9, attack: 2 }), 4: Object.freeze({ hp: 12, attack: 3 }),
  }),
  [DOG_ROLE.MEDIC]: Object.freeze({
    1: Object.freeze({ hp: 6, attack: 1 }), 2: Object.freeze({ hp: 9, attack: 2 }),
    3: Object.freeze({ hp: 13, attack: 2 }), 4: Object.freeze({ hp: 17, attack: 3 }),
  }),
  [DOG_ROLE.GROWLER]: Object.freeze({
    1: Object.freeze({ hp: 6, attack: 1 }), 2: Object.freeze({ hp: 9, attack: 2 }),
    3: Object.freeze({ hp: 13, attack: 3 }), 4: Object.freeze({ hp: 18, attack: 4 }),
  }),
});

const HOWL_BONUS = Object.freeze({ 1: 2, 2: 3, 3: 4, 4: 5 });
const MEDIC_HEAL = Object.freeze({ 1: 3, 2: 5, 3: 7, 4: 10 });
const FEAR_PENALTY = Object.freeze({ 1: 2, 2: 3, 3: 4, 4: 5 });

export const DOG_ROLE_INFO = Object.freeze({
  [DOG_ROLE.SCRUFFY]: Object.freeze({
    name: 'Chomps McGraw', unlockRound: 1, role: 'Bite-damage specialist',
    strength: 'Highest health and bite damage', weakness: 'No range, support, or bypass ability',
    blurb: 'The strongest direct front-line biter.',
    attackDetail: 'Steps toward the porch and delivers the strongest bite to the cat directly ahead.',
  }),
  [DOG_ROLE.FRISBEE]: Object.freeze({
    name: 'Fetch Armstrong', unlockRound: 2, role: 'Cross-lane ranged specialist',
    strength: 'Throws into its own or a neighboring lane from up to four squares away', weakness: 'Low health and weak close combat',
    blurb: 'A fragile frisbee sniper that bends lane pressure.',
    attackDetail: 'Throws a reduced-damage frisbee at the nearest cat two to four squares ahead in its own or a neighboring lane.',
  }),
  [DOG_ROLE.TENNIS]: Object.freeze({
    name: 'Bark McEnroe', unlockRound: 3, role: 'Ranged-pressure specialist',
    strength: 'Attacks from two or three squares away', weakness: 'Low health and reduced ball damage',
    blurb: 'A fragile ranged lane attacker.',
    attackDetail: 'Stops two or three squares away and throws a reduced-damage tennis ball at the nearest cat in its lane.',
  }),
  [DOG_ROLE.HOWLER]: Object.freeze({
    name: 'Howl Pacino', unlockRound: 4, role: 'Pack-support specialist',
    strength: 'Boosts nearby dogs\' next attack', weakness: 'By far the weakest personal bite',
    blurb: 'A low-damage support dog that empowers its pack.',
    attackDetail: 'Its first useful action is a howl that grants nearby dogs bonus damage on their next attack. Alone, it is a poor fighter.',
  }),
  [DOG_ROLE.LOBBER]: Object.freeze({
    name: 'Bone Jovi', unlockRound: 6, role: 'Ranged splash specialist',
    strength: 'Bone bombs damage cats beside the target', weakness: 'Lowest health and poor single-target damage',
    blurb: 'A frail artillery dog that punishes clustered cats.',
    attackDetail: 'Lobs a weak bone bomb two to five squares down its lane. The blast also damages cats beside the target in adjacent columns.',
  }),
  [DOG_ROLE.JUMPER]: Object.freeze({
    name: 'Barkour Bandit', unlockRound: 5, minimumTier: 2, role: 'Speed-bypass specialist',
    strength: 'Barkour Vault moves three squares and leaps over one isolated defender', weakness: 'Light Gear makes every damaging hit deal +1 damage; its bite is weak',
    blurb: 'A fragile three-square sprinter that trades protection for speed.',
    attackDetail: 'Barkour Vault: moves one square faster than other dogs and, once per battle, jumps over the cat directly ahead if the landing square is empty. Light Gear makes every damaging hit deal +1 damage.',
  }),
  [DOG_ROLE.SKITTISH]: Object.freeze({
    name: 'Sir Flinches-a-Lot', unlockRound: 7, minimumTier: 2, role: 'Panic-dodge specialist',
    strength: 'Panic Shuffle sidesteps after every surviving hit, breaking column focus', weakness: 'Lowest health and bite damage; edges, defenders, and full two-dog squares trap it',
    blurb: 'A nervous dodger that is much better at escaping trouble than fighting it.',
    attackDetail: 'Panic Shuffle: after surviving a damaging hit, immediately moves one square left or right if possible, preferring the side farther from its attacker. A square is dog-blocked only when it already holds two dogs.',
  }),
  [DOG_ROLE.MEDIC]: Object.freeze({
    name: 'Dr. Droolittle', unlockRound: 8, role: 'Pack-healing specialist',
    strength: 'Restores a badly hurt nearby dog once per battle', weakness: 'Very low personal damage and gives up an attack to heal',
    blurb: 'A support dog that patches up the pack.',
    attackDetail: 'Once per battle, spends its action healing the most injured dog within one column and two rows. Bites weakly when nobody needs help.',
  }),
  [DOG_ROLE.GROWLER]: Object.freeze({
    name: 'Growl Gadot', unlockRound: 10, role: 'Attack-disruption specialist',
    strength: 'Weakens a nearby cat\'s next attack', weakness: 'Can frighten only once and has a very weak bite',
    blurb: 'An intimidator that suppresses the strongest nearby cat.',
    attackDetail: 'Once per battle, frightens the strongest cat up to four squares ahead in its own or a neighboring lane, reducing that cat\'s next attack.',
  }),
});

export const DOG_TIER_INFO = {
  1: { name: 'Yard Punk', blurb: 'Entry-level stats for this role.' },
  2: { name: 'Ironhide', blurb: 'Helmet gear improves this role without erasing its weakness.' },
  3: { name: 'Bonecrusher', blurb: 'Heavy plates substantially scale this role\'s specialty.' },
  4: { name: 'Top Dog', blurb: 'Top Dog gear marks the strongest version of this role.' },
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

function catTooltipEffects(cat, info) {
  const effects = [];
  const weapon = cat.equipment?.weapon;
  const armour = cat.equipment?.armour;
  if (weapon) {
    const attack = weapon.attack ?? WEAPON_INFO[weapon.tier]?.attack ?? 0;
    effects.push({
      kind: 'weapon', label: `T${weapon.tier ?? 1} HOUSE WEAPON`, value: `+${attack} ATK`,
      detail: 'Permanently adds to every attack while equipped; replacing the weapon returns the old one to House Storage.',
    });
  }
  if (armour) {
    const block = armour.block ?? ARMOUR_INFO[armour.tier]?.block ?? 0;
    const uses = armour.uses ?? 0;
    const maxUses = armour.maxUses ?? ARMOUR_INFO[armour.tier]?.uses ?? uses;
    effects.push({
      kind: 'armour', label: `T${armour.tier ?? 1} HOUSE ARMOUR`, value: `${block} BLOCK`,
      detail: `${uses}/${maxUses} protected hits remain. It reduces each hit by ${block}, but at least 1 damage always gets through.`,
    });
  }
  if ((cat.guard ?? 0) > 0) {
    effects.push({
      kind: 'guard', label: 'PORTAL GUARD', value: `${cat.guard} BLOCK`,
      detail: `Blocks ${cat.guard} additional damage from the next hit, then expires.`,
    });
  }
  if ((cat.nextAttackBonus ?? 0) > 0) {
    effects.push({
      kind: 'attack-up', label: 'NEXT ATTACK', value: `+${cat.nextAttackBonus} ATK`,
      detail: 'Added once when this cat next attacks, then expires.',
    });
  }
  if ((cat.nextAttackPenalty ?? 0) > 0) {
    effects.push({
      kind: 'attack-down', label: 'FRIGHTENED', value: `-${cat.nextAttackPenalty} ATK`,
      detail: 'Subtracted once when this cat next attacks, then expires; attack cannot fall below 1.',
    });
  }
  const activeAbility = cat.activeAbility ?? info.activeAbility;
  if (activeAbility) {
    effects.push({
      kind: 'ability', label: 'TACTICS SPECIAL', value: cat.activeUsed ? 'USED' : 'READY',
      detail: cat.activeUsed ? 'Already used in this battle.' : 'Available once this battle during a Tactics Window.',
    });
  }
  return effects;
}

export function catTooltipInfo(cat) {
  const level = cat.level ?? 1;
  const coat = normalizeCoat(cat.coat);
  const info = CAT_COAT_INFO[coat];
  const stats = catStatsFor(level, coat);
  const hp = cat.hp ?? stats.hp;
  const maxHp = cat.maxHp ?? stats.hp;
  const attack = cat.attack ?? stats.attack;
  const attackDisplay = coat === CAT_COAT.ORANGE
    ? splitDamage(attack, 3).filter((amount) => amount > 0).join('+')
    : attack;
  return {
    kind: 'cat',
    category: `T${info.shopTier}`,
    title: `L${level} ${info.name}`,
    stats: `Health ${hp}/${maxHp} · Attack ${attackDisplay}`,
    attack: info.attackDetail,
    note: `${info.role} · Strength: ${info.strength} · Weakness: ${info.weakness}`,
    effects: catTooltipEffects(cat, info),
  };
}

export function dogStatsFor(tier = 1, role = DOG_ROLE.SCRUFFY) {
  const safeTier = DOG_STATS[tier] ? tier : 1;
  const safeRole = DOG_ROLE_INFO[role] ? role : DOG_ROLE.SCRUFFY;
  const stats = DOG_ROLE_STATS[safeRole][safeTier];
  return {
    ...stats,
    howlBonus: safeRole === DOG_ROLE.HOWLER ? HOWL_BONUS[safeTier] : 0,
    healPower: safeRole === DOG_ROLE.MEDIC ? MEDIC_HEAL[safeTier] : 0,
    fearPower: safeRole === DOG_ROLE.GROWLER ? FEAR_PENALTY[safeTier] : 0,
  };
}

function dogRoleStats(role, attack, stats) {
  switch (role) {
    case DOG_ROLE.FRISBEE:
      return `Frisbee ${Math.max(1, Math.ceil(attack * 0.7))} · Bite ${attack}`;
    case DOG_ROLE.TENNIS:
      return `Ball ${Math.max(1, Math.ceil(attack * 0.6))} · Bite ${attack}`;
    case DOG_ROLE.HOWLER:
      return `Howl +${stats.howlBonus} · Bite ${attack}`;
    case DOG_ROLE.LOBBER:
      return `Bomb ${Math.max(1, Math.floor(attack * 0.6))} splash · Bite ${attack}`;
    case DOG_ROLE.JUMPER:
      return `Speed ${FAST_DOG_MOVE_DISTANCE} · Jump 1× · Bite ${attack}`;
    case DOG_ROLE.SKITTISH:
      return `Panic step · Bite ${attack}`;
    case DOG_ROLE.MEDIC:
      return `Heal ${stats.healPower} 1× · Bite ${attack}`;
    case DOG_ROLE.GROWLER:
      return `Frighten -${stats.fearPower} 1× · Bite ${attack}`;
    default:
      return `Bite ${attack}`;
  }
}

export function dogTooltipInfo(dog) {
  const tier = dog.tier ?? 1;
  const role = DOG_ROLE_INFO[dog.role] ? dog.role : DOG_ROLE.SCRUFFY;
  const stats = dogStatsFor(tier, role);
  const tierInfo = DOG_TIER_INFO[tier] ?? DOG_TIER_INFO[1];
  const roleInfo = DOG_ROLE_INFO[role];
  const hp = dog.hp ?? stats.hp;
  const maxHp = dog.maxHp ?? stats.hp;
  const attack = dog.attack ?? stats.attack;
  const effects = [];
  if ((dog.attackBoost ?? 0) > 0) {
    effects.push({
      kind: 'attack-up', label: 'HOWL BOOST', value: `+${dog.attackBoost} ATK`,
      detail: 'Added to this dog’s next damaging attack, then expires.',
    });
  }
  if ((dog.frozenActions ?? 0) > 0) {
    const frozenRounds = dog.frozenRoundsRemaining ?? Math.ceil(dog.frozenActions / ACTIONS_PER_ROUND);
    effects.push({
      kind: 'frozen', label: 'FROZEN', value: `${frozenRounds} ROUND${frozenRounds === 1 ? '' : 'S'}`,
      detail: `Cannot act for ${frozenRounds} more round${frozenRounds === 1 ? '' : 's'} (${dog.frozenActions} combat exchange${dog.frozenActions === 1 ? '' : 's'} remaining).`,
    });
  }
  if (dog.tangled) {
    effects.push({
      kind: 'tangled', label: 'TANGLED', value: '1 MOVE',
      detail: 'The next movement path is skipped; the yarn is then removed.',
    });
  }
  return {
    kind: 'dog',
    title: `T${tier} ${roleInfo.name}`,
    stats: `Health ${hp}/${maxHp} · ${dogRoleStats(role, attack, stats)}`,
    attack: `${roleInfo.attackDetail} Otherwise it advances up to ${dogMoveDistance(dog)} squares, moving only left, right, or down, and attacks as soon as it reaches a defender.`,
    note: `${roleInfo.role} · Strength: ${roleInfo.strength} · Weakness: ${roleInfo.weakness}. ${tierInfo.blurb}`,
    effects,
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
    activeUsed: false,
    hasEnteredBattle: false,
    equipment: { weapon: null, armour: null },
  };
}

export function createDog(tier = 1, row = 0, col = 0, role = DOG_ROLE.SCRUFFY) {
  const safeTier = DOG_STATS[tier] ? tier : 1;
  const safeRole = DOG_ROLE_INFO[role] ? role : DOG_ROLE.SCRUFFY;
  const stats = dogStatsFor(safeTier, safeRole);
  return {
    id: id('dog'), kind: 'scruffy-dog', role: safeRole, tier: safeTier, row, col,
    hp: stats.hp, maxHp: stats.hp, attack: stats.attack,
    howlBonus: stats.howlBonus, healPower: stats.healPower, fearPower: stats.fearPower,
  };
}

export function createGame(random = Math.random) {
  return {
    phase: 'prep',
    round: 1,
    section: 0,
    gold: 10,
    lives: 3,
    tacticsMoveUsed: false,
    cats: [],
    dogs: [],
    decoys: [],
    bench: [],
    workers: Array(PRODUCTION_CAPACITY).fill(null),
    inventory: Array(STORAGE_CAPACITY).fill(null),
    shop: makeShop(random),
    nextWave: generateWave(1, random),
    events: [],
    random,
    message: 'Build your team, then start the round.',
  };
}

/** The centre square plus its four orthogonal neighbours, clipped to the battlefield. */
export function plusCells(row, col, rows = ROWS, cols = COLS) {
  return [
    { row, col },
    { row: row - 1, col },
    { row: row + 1, col },
    { row, col: col - 1 },
    { row, col: col + 1 },
  ].filter((cell) => cell.row >= 0 && cell.row < rows && cell.col >= 0 && cell.col < cols);
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
    bench: game.bench.map((unit) => unit.kind === 'production-cat'
      ? {
        ...unit,
        pendingOutput: unit.pendingOutput ? { ...unit.pendingOutput } : null,
      }
      : cloneCat(unit)),
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
  const safeRound = Math.max(1, Number(round) || 1);
  return Object.keys(CAT_COAT_INFO)
    .map(Number)
    .filter((coat) => CAT_COAT_INFO[coat].unlockRound <= safeRound);
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
  const shopSize = shopSizeForRound(round);
  const houseCatCap = Math.max(1, shopSize - 2);
  let houseCatCount = Array.from({ length: shopSize }, (_, index) => previous?.[index])
    .filter((slot) => slot?.saved && !slot.sold && slot.category === 'worker').length;

  return Array.from({ length: shopSize }, (_, index) => {
    const prior = previous?.[index];
    // Saved, still-available pets stay put through refresh and into the next round.
    if (prior && prior.saved && !prior.sold) {
      return { ...prior, saved: true, sold: false };
    }
    const openingGuarantee = round === 1 && !previous && index < 2 ? 'fighter' : null;
    const cappedCategory = houseCatCount >= houseCatCap ? 'fighter' : openingGuarantee;
    const slot = makeShopSlot(random, round, cappedCategory);
    if (slot.category === 'worker') houseCatCount += 1;
    return slot;
  });
}

export function createWorker(role = WORKER_ROLE.COOK, level = 1) {
  const safeRole = WORKER_INFO[role] ? role : WORKER_ROLE.COOK;
  const safeLevel = [1, 2, 3].includes(Number(level)) ? Number(level) : 1;
  return {
    id: id('worker'), kind: 'production-cat', role: safeRole,
    level: safeLevel, copies: 1, pendingOutput: null, productionProgress: 0,
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
  next.message = `${CAT_COAT_INFO[normalizeCoat(slot.coat)].name} reserved on the Cat Workbench.`;
  return next;
}

export function purchaseShopFighterToBoard(game, shopIndex, row, col) {
  const slot = purchasableFighterSlot(game, shopIndex);
  if (
    !slot || row < CAT_ZONE_START || row >= ROWS || col < 0 || col >= COLS
    || game.cats.length >= MAX_FIELD_CATS
    || game.cats.some((cat) => cat.row === row && cat.col === col)
  ) return game;
  const next = copy(game);
  next.cats.push({
    ...createCat(slot.level ?? 1, slot.coat), row, col,
    prepOrigin: { row, col }, prepMoved: false,
  });
  finishShopPurchase(next, shopIndex);
  next.message = `${CAT_COAT_INFO[normalizeCoat(slot.coat)].name} deployed!`;
  return next;
}

export function purchaseShopFighterOnto(game, shopIndex, targetType, targetId) {
  const slot = purchasableFighterSlot(game, shopIndex);
  const listName = targetType === 'bench' ? 'bench' : targetType === 'cat' ? 'cats' : null;
  const target = listName ? game[listName].find((cat) => cat.id === targetId) : null;
  if (
    !slot || !target || target.kind === 'production-cat' || target.level !== (slot.level ?? 1)
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

export function purchaseShopWorkerToBench(game, shopIndex, targetIndex) {
  const slot = game.shop[shopIndex];
  if (
    game.phase !== 'prep' || game.gold < 3 || !slot || slot.sold
    || slot.category !== 'worker' || targetIndex < 0 || targetIndex >= BENCH_SIZE
  ) return game;

  const target = game.bench[targetIndex];
  if (!target && game.bench.length >= BENCH_SIZE) return game;
  const worker = createWorker(slot.role, slot.level ?? 1);
  if (target && (
    target.kind !== 'production-cat' || target.role !== worker.role
    || Number(target.level) !== Number(worker.level) || Number(target.level) >= 3
  )) return game;

  const next = copy(game);
  if (next.bench[targetIndex]) stackWorkerInto(next.bench[targetIndex], worker);
  else next.bench.push(worker);
  finishShopPurchase(next, shopIndex);
  next.message = `${WORKER_INFO[worker.role].name} reserved on the Cat Workbench.`;
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

export function moveBenchWorkerToHouse(game, benchIndex, targetIndex) {
  if (
    game.phase !== 'prep' || benchIndex < 0 || benchIndex >= game.bench.length
    || targetIndex < 0 || targetIndex >= game.workers.length
  ) return game;
  const source = game.bench[benchIndex];
  if (source?.kind !== 'production-cat') return game;

  const target = game.workers[targetIndex];
  if (target && (
    target.role !== source.role || Number(target.level) !== Number(source.level)
    || Number(target.level) >= 3
  )) return game;

  const next = copy(game);
  const reservedWorker = next.bench[benchIndex];
  if (next.workers[targetIndex]) {
    if (!stackWorkerInto(next.workers[targetIndex], reservedWorker)) return game;
    next.bench.splice(benchIndex, 1);
  } else {
    const [worker] = next.bench.splice(benchIndex, 1);
    next.workers[targetIndex] = worker;
  }
  next.message = `${WORKER_INFO[source.role].name} moved into the Production House.`;
  return next;
}

export function returnWorkerToBench(game, workerIndex, targetIndex) {
  if (
    game.phase !== 'prep' || workerIndex < 0 || workerIndex >= game.workers.length
    || targetIndex < 0 || targetIndex >= BENCH_SIZE || !game.workers[workerIndex]
  ) return game;
  const source = game.workers[workerIndex];
  const target = game.bench[targetIndex];
  if (!target && game.bench.length >= BENCH_SIZE) return game;
  if (target && (
    target.kind !== 'production-cat' || target.role !== source.role
    || Number(target.level) !== Number(source.level) || Number(target.level) >= 3
  )) return game;

  const next = copy(game);
  const houseWorker = next.workers[workerIndex];
  if (next.bench[targetIndex]) {
    if (!stackWorkerInto(next.bench[targetIndex], houseWorker)) return game;
  } else next.bench.push(houseWorker);
  next.workers[workerIndex] = null;
  next.message = `${WORKER_INFO[source.role].name} reserved on the Cat Workbench.`;
  return next;
}

export function mergeBenchWorkerOnto(game, sourceIndex, targetIndex) {
  if (
    game.phase !== 'prep' || sourceIndex === targetIndex
    || sourceIndex < 0 || sourceIndex >= game.bench.length
    || targetIndex < 0 || targetIndex >= game.bench.length
  ) return game;
  const next = copy(game);
  const source = next.bench[sourceIndex];
  const target = next.bench[targetIndex];
  if (source?.kind !== 'production-cat' || target?.kind !== 'production-cat') return game;
  if (!stackWorkerInto(target, source)) return game;
  next.bench.splice(sourceIndex, 1);
  next.events.push({ type: 'worker-combine', id: target.id, level: target.level, copies: target.copies });
  next.message = target.level > source.level
    ? `${WORKER_INFO[target.role].name} reached level ${target.level} on the Cat Workbench!`
    : `${WORKER_INFO[target.role].name} stacked on the Cat Workbench.`;
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
  const cat = collection?.find((unit) => unit.id === catId) ?? null;
  return cat?.kind === 'production-cat' ? null : cat;
}

function equippedItems(cat) {
  return ['weapon', 'armour']
    .filter((kind) => cat.equipment?.[kind])
    .map((kind) => ({ kind, tier: cat.equipment[kind].tier ?? 1, quantity: 1 }));
}

export function catSaleQuote(game, sourceType, catId) {
  const cat = catForSale(game, sourceType, catId);
  const value = catSellValue(cat);
  if (game.phase !== 'prep' || !cat) {
    return { canSell: false, value, reason: 'Cats can only be sold during prep.' };
  }
  const preview = copy(game);
  for (const item of equippedItems(cat)) {
    if (addInventoryStackTo(preview, item) < 0) {
      return { canSell: false, value, reason: 'House Storage needs room for equipped items.' };
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
  next.message = `${CAT_COAT_INFO[normalizeCoat(cat.coat)].name} adopted for ${quote.value} gold${returnedItems.length ? '; equipment returned to House Storage' : ''}.`;
  return next;
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
  const allowedPhase = game.phase === 'prep' || game.phase === 'tactics' || (game.phase === 'combat' && paused);
  const stack = game.inventory[inventoryIndex];
  if (!allowedPhase || !stack || (stack.kind !== 'weapon' && stack.kind !== 'armour')) return game;
  const listName = targetType === 'bench' ? 'bench' : targetType === 'cat' ? 'cats' : null;
  const target = listName ? game[listName].find((cat) => cat.id === targetId) : null;
  if (!target || target.kind === 'production-cat') return game;
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
  const canFeed = game.phase === 'prep' || game.phase === 'tactics';
  if (!canFeed || stack?.kind !== 'food' || !target || target.hp <= 0 || target.hp >= target.maxHp) return game;
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

function resolveDogDuel(next, caster, row, col, random) {
  const selectedSquare = livingDogs(next.dogs)
    .filter((dog) => dog.row === row && dog.col === col);
  if (!selectedSquare.length) return false;

  let fighters = selectedSquare.slice(0, 2);
  if (fighters.length === 1) {
    const adjacentSquares = plusCells(row, col)
      .filter((cell) => cell.row !== row || cell.col !== col)
      .map((cell) => ({
        ...cell,
        dogs: livingDogs(next.dogs).filter((dog) => dog.row === cell.row && dog.col === cell.col),
      }))
      .filter((cell) => cell.dogs.length);
    if (!adjacentSquares.length) return false;
    const roll = typeof random === 'function' ? random() : Math.random();
    const squareIndex = Math.min(adjacentSquares.length - 1, Math.floor(roll * adjacentSquares.length));
    fighters.push(adjacentSquares[squareIndex].dogs.at(-1));
  }

  const [first, second] = fighters;
  const firstDamage = Math.max(1, first.attack + (first.attackBoost ?? 0));
  const secondDamage = Math.max(1, second.attack + (second.attackBoost ?? 0));
  const firstHpBefore = first.hp;
  const secondHpBefore = second.hp;
  first.hp = Math.max(0, first.hp - secondDamage);
  second.hp = Math.max(0, second.hp - firstDamage);
  first.attackBoost = 0;
  second.attackBoost = 0;

  next.events.push(
    { type: 'dog-duel-cast', from: caster.id, targets: [first.id, second.id] },
    {
      type: 'dog-duel', style: 'bite', from: first.id, to: second.id,
      fromRow: first.row, fromCol: first.col, toRow: second.row, col: second.col,
      damage: firstDamage, hpBefore: secondHpBefore, hpAfter: second.hp, maxHp: second.maxHp,
      miss: false, duelIndex: 0,
    },
    {
      type: 'dog-duel', style: 'bite', from: second.id, to: first.id,
      fromRow: second.row, fromCol: second.col, toRow: first.row, col: first.col,
      damage: secondDamage, hpBefore: firstHpBefore, hpAfter: first.hp, maxHp: first.maxHp,
      miss: false, duelIndex: 1,
    },
  );
  next.dogs = next.dogs.filter((dog) => dog.hp > 0);
  return true;
}

export function canTeleportDogTo(game, dogId, row, col) {
  const dog = game.dogs.find((unit) => unit.id === dogId && unit.hp > 0);
  if (!dog || !Number.isInteger(row) || !Number.isInteger(col)
    || row < 0 || row >= ROWS || col < 0 || col >= COLS) return false;
  const distance = Math.abs(row - dog.row) + Math.abs(col - dog.col);
  return distance >= 1 && distance <= 2
    && !game.cats.some((cat) => cat.hp > 0 && cat.row === row && cat.col === col)
    && !game.decoys.some((decoy) => decoyIsActive(decoy) && decoy.row === row && decoy.col === col)
    && dogCountAt(game.dogs, row, col, dog.id) < DOG_CELL_CAPACITY;
}

export function useActiveAbility(game, casterId, target = {}) {
  if (game.phase !== 'tactics') return game;
  const source = game.cats.find((cat) => cat.id === casterId);
  const active = source?.activeAbility ?? CAT_COAT_INFO[normalizeCoat(source?.coat)].activeAbility;
  if (!source || !active || source.activeUsed) return game;
  const next = copy(game);
  const caster = next.cats.find((cat) => cat.id === casterId);
  let used = false;

  if (active === 'freeze') {
    const dog = next.dogs.find((unit) => unit.id === target.dogId && unit.hp > 0 && !unit.frozenActions);
    if (dog) {
      const actionsLeftThisRound = Math.max(0, ACTIONS_PER_ROUND - game.section);
      dog.frozenActions = actionsLeftThisRound + ACTIONS_PER_ROUND;
      dog.frozenRoundsRemaining = 2;
      dog.shatterDamage = caster.level === 1 ? 0 : caster.level === 2 ? 2 : 4;
      next.events.push({ type: 'freeze-cast', from: caster.id, to: dog.id, row: dog.row, col: dog.col });
      used = true;
    }
  } else if (active === 'teleport') {
    const ally = next.cats.find((cat) => cat.id === target.targetCatId);
    const enemy = next.dogs.find((dog) => dog.id === target.targetDogId && dog.hp > 0);
    const allyDestinationIsLegal = Number.isInteger(target.row) && Number.isInteger(target.col)
      && target.row >= CAT_ZONE_START && target.row < ROWS && target.col >= 0 && target.col < COLS
      && !next.cats.some((cat) => cat.id !== ally?.id && cat.row === target.row && cat.col === target.col)
      && !next.dogs.some((dog) => dog.hp > 0 && dog.row === target.row && dog.col === target.col)
      && !next.decoys.some((decoy) => decoyIsActive(decoy) && decoy.row === target.row && decoy.col === target.col);
    if (ally && allyDestinationIsLegal) {
      const fromRow = ally.row; const fromCol = ally.col;
      ally.row = target.row; ally.col = target.col;
      if (!ally.tacticsMoved) ally.tacticsOrigin = { row: ally.row, col: ally.col };
      if (caster.level >= 2) ally.guard = Math.max(ally.guard ?? 0, 2);
      if (caster.level >= 3) ally.nextAttackBonus = Math.max(ally.nextAttackBonus ?? 0, 2);
      next.events.push({ type: 'teleport', unitType: 'cat', from: caster.id, to: ally.id, fromRow, fromCol, row: ally.row, col: ally.col });
      used = true;
    } else if (enemy && canTeleportDogTo(next, enemy.id, target.row, target.col)) {
      const fromRow = enemy.row; const fromCol = enemy.col;
      enemy.row = target.row; enemy.col = target.col;
      next.events.push({
        type: 'teleport', unitType: 'dog', from: caster.id, to: enemy.id,
        fromRow, fromCol, row: enemy.row, col: enemy.col,
      });
      used = true;
    }
  } else if (active === 'decoy') {
    const existingDecoy = next.decoys.find((decoy) => decoy.row === target.row && decoy.col === target.col);
    const legal = Number.isInteger(target.row) && Number.isInteger(target.col)
      && target.row >= CAT_ZONE_START && target.row < ROWS && target.col >= 0 && target.col < COLS
      && !next.cats.some((cat) => cat.row === target.row && cat.col === target.col);
    if (legal) {
      const blocks = Math.max(1, Math.min(3, caster.level ?? 1)) + 1;
      if (existingDecoy) {
        const previousBlocks = existingDecoy.blocks ?? 0;
        const previousMaxBlocks = existingDecoy.maxBlocks ?? previousBlocks;
        existingDecoy.blocks = previousBlocks + blocks;
        existingDecoy.maxBlocks = previousMaxBlocks + blocks;
      } else {
        next.decoys.push({
          id: id('decoy'), kind: 'phantom-cat', row: target.row, col: target.col,
          blocks, maxBlocks: blocks,
        });
      }
      next.events.push({ type: 'decoy-cast', from: caster.id, row: target.row, col: target.col });
      used = true;
    }
  } else if (active === 'storm') {
    if (Number.isInteger(target.col) && target.col >= 0 && target.col < COLS && next.dogs.some((dog) => dog.col === target.col && dog.hp > 0)) {
      const damage = [0, 2, 4, 6][caster.level] ?? 2;
      next.dogs.filter((dog) => dog.col === target.col && dog.hp > 0)
        .forEach((dog) => pushDamageEvent(next, 'spell', caster, dog, { damage, style: 'lightning' }));
      next.dogs = next.dogs.filter((dog) => dog.hp > 0);
      used = true;
    }
  } else if (active === 'bomb-cross') {
    const legal = Number.isInteger(target.row) && Number.isInteger(target.col)
      && target.row >= 0 && target.row < ROWS && target.col >= 0 && target.col < COLS;
    if (legal) {
      const footprint = plusCells(target.row, target.col);
      const victims = next.dogs.filter((dog) => dog.hp > 0
        && footprint.some((cell) => cell.row === dog.row && cell.col === dog.col));
      if (victims.length) {
        const centerDamage = Math.max(1, caster.attack);
        const splashDamage = Math.max(1, caster.attack / 2);
        victims.forEach((dog, index) => {
          const isCenter = dog.row === target.row && dog.col === target.col;
          pushDamageEvent(next, 'spell', caster, dog, {
            damage: isCenter ? centerDamage : splashDamage,
            style: index === 0 ? 'bomb-cross' : 'bomb-cross-secondary',
            aimRow: target.row,
            aimCol: target.col,
          });
        });
        next.dogs = next.dogs.filter((dog) => dog.hp > 0);
        used = true;
      }
    }
  } else if (active === 'duel') {
    if (Number.isInteger(target.row) && Number.isInteger(target.col)) {
      used = resolveDogDuel(next, caster, target.row, target.col, game.random);
    }
  }

  if (!used) return game;
  caster.activeUsed = true;
  const castName = active === 'bomb-cross' ? 'PLUS BOMB' : active === 'duel' ? 'DOG DUEL' : active.toUpperCase();
  next.message = `${CAT_COAT_INFO[normalizeCoat(caster.coat)].name} cast ${castName}!`;
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
  next.message = `${CAT_COAT_INFO[normalizeCoat(slot.coat)].name} added to the Cat Workbench.`;
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
      while (next.bench.filter((cat) => cat.kind !== 'production-cat' && cat.level === level && normalizeCoat(cat.coat) === coat).length >= 3) {
        const selected = next.bench
          .filter((cat) => cat.kind !== 'production-cat' && cat.level === level && normalizeCoat(cat.coat) === coat)
          .slice(0, 3);
        const selectedIds = new Set(selected.map((cat) => cat.id));
        next.bench = next.bench.filter((cat) => !selectedIds.has(cat.id));
        const combined = createCat(level + 1, coat);
        combined.hasEnteredBattle = selected.some((cat) => cat.hasEnteredBattle);
        next.bench.push(combined);
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
  if (game.phase !== 'prep') return game;
  const next = copy(game);
  const sourceList = sourceType === 'bench' ? next.bench : next.cats;
  const targetList = targetType === 'bench' ? next.bench : next.cats;
  const source = sourceList.find((cat) => cat.id === sourceId);
  const target = targetList.find((cat) => cat.id === targetId);
  if (!source || !target || source.id === target.id || source.kind === 'production-cat' || target.kind === 'production-cat') return game;
  // Stacks only form within the same coat — each color keeps its own ability line.
  if (source.level !== target.level || normalizeCoat(source.coat) !== normalizeCoat(target.coat)) return game;
  // First merge creates a two-copy stack; the third promotes it.
  target.copies = (target.copies ?? 1) + (source.copies ?? 1);
  target.hasEnteredBattle = Boolean(target.hasEnteredBattle || source.hasEnteredBattle);
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
  if (game.cats.length >= MAX_FIELD_CATS) return game;
  if (game.cats.some((cat) => cat.row === row && cat.col === col)) return game;
  const source = game.bench[benchIndex];
  if (!source || source.kind === 'production-cat') return game;
  if (source.hasEnteredBattle && source.prepOrigin) {
    const distance = Math.abs(row - source.prepOrigin.row) + Math.abs(col - source.prepOrigin.col);
    if (source.prepMoved || distance > catMoveLimit(source)) return game;
  }
  const next = copy(game);
  const [cat] = next.bench.splice(benchIndex, 1);
  if (cat.hasEnteredBattle && cat.prepOrigin) cat.prepMoved = true;
  else {
    cat.prepOrigin = { row, col };
    cat.prepMoved = false;
  }
  next.cats.push({ ...cat, row, col });
  return next;
}

export function moveCat(game, catId, row, col) {
  if (game.phase !== 'prep' || row < CAT_ZONE_START || row >= ROWS || col < 0 || col >= COLS) return game;
  if (game.cats.some((cat) => cat.row === row && cat.col === col && cat.id !== catId)) return game;
  const source = game.cats.find((unit) => unit.id === catId);
  if (!source || (source.hasEnteredBattle && source.prepMoved)) return game;
  const origin = source.prepOrigin ?? { row: source.row, col: source.col };
  const distance = Math.abs(row - origin.row) + Math.abs(col - origin.col);
  if (source.hasEnteredBattle && distance > catMoveLimit(source)) return game;
  const next = copy(game);
  const cat = next.cats.find((unit) => unit.id === catId);
  cat.prepOrigin = source.hasEnteredBattle ? origin : { row, col };
  cat.prepMoved = Boolean(source.hasEnteredBattle);
  cat.row = row;
  cat.col = col;
  return next;
}

export function moveCatInTactics(game, catId, row, col) {
  if (game.phase !== 'tactics' || row < CAT_ZONE_START || row >= ROWS || col < 0 || col >= COLS) return game;
  const source = game.cats.find((cat) => cat.id === catId);
  if (!source || source.tacticsMoved) return game;
  const blocked = game.cats.some((cat) => cat.id !== catId && cat.row === row && cat.col === col)
    || game.decoys.some((decoy) => decoy.row === row && decoy.col === col)
    || game.dogs.some((dog) => dog.hp > 0 && dog.row === row && dog.col === col);
  if (blocked) return game;
  const origin = source.tacticsOrigin ?? { row: source.row, col: source.col };
  const distance = Math.abs(row - origin.row) + Math.abs(col - origin.col);
  if (distance < 1 || distance > catMoveLimit(source)) return game;

  const next = copy(game);
  const cat = next.cats.find((unit) => unit.id === catId);
  const fromRow = cat.row;
  const fromCol = cat.col;
  cat.tacticsOrigin ??= origin;
  cat.tacticsMoved = true;
  cat.row = row;
  cat.col = col;
  next.events.push({ type: 'tactics-move', id: cat.id, fromRow, fromCol, row, col });
  next.message = `${CAT_COAT_INFO[normalizeCoat(cat.coat)].name} repositioned for the next exchange.`;
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

export function availableDogRolesForRound(round = 1) {
  const safeRound = Math.max(1, Number(round) || 1);
  return Object.values(DOG_ROLE)
    .filter((role) => DOG_ROLE_INFO[role].unlockRound <= safeRound);
}

export function waveCountForRound(round = 1) {
  const counts = [2, 3, 3, 4, 4, 5, 5, 6, 6, 7];
  const safeRound = Math.max(1, Math.floor(Number(round) || 1));
  return counts[Math.min(safeRound - 1, counts.length - 1)];
}

export function minimumDogTierForRound(round = 1) {
  const safeRound = Math.max(1, Math.floor(Number(round) || 1));
  if (safeRound >= 9) return 3;
  if (safeRound >= 5) return 2;
  return 1;
}

export function featuredDogRolesForRound(round = 1) {
  const featured = {
    6: [DOG_ROLE.FRISBEE, DOG_ROLE.LOBBER],
    7: [DOG_ROLE.FRISBEE],
    8: [DOG_ROLE.LOBBER, DOG_ROLE.MEDIC],
    9: [DOG_ROLE.FRISBEE, DOG_ROLE.LOBBER, DOG_ROLE.MEDIC],
    10: [DOG_ROLE.LOBBER, DOG_ROLE.MEDIC, DOG_ROLE.GROWLER],
  };
  return featured[Math.max(1, Math.floor(Number(round) || 1))] ?? [];
}

export function generateWave(round, random = Math.random, extraDogs = 0) {
  const count = waveCountForRound(round) + Math.max(0, Math.floor(Number(extraDogs) || 0));
  const minTier = minimumDogTierForRound(round);
  const maxTier = shopTierForRound(round);
  const availableRoles = availableDogRolesForRound(round);
  let available = [];
  const dogs = [];
  for (let i = 0; i < count; i += 1) {
    if (!available.length) available = Array.from({ length: COLS }, (_, col) => col);
    const pick = Math.floor(random() * available.length);
    const col = available.splice(pick, 1)[0];
    const tierSpan = Math.max(1, maxTier - minTier + 1);
    const tier = minTier + Math.min(tierSpan - 1, Math.floor(random() * tierSpan));
    const role = availableRoles[Math.min(availableRoles.length - 1, Math.floor(random() * availableRoles.length))];
    dogs.push(createDog(tier, 0, col, role));
  }
  // Always introduce the newly unlocked stat tier on odd unlock rounds.
  if (round % 2 === 1 && !dogs.some((dog) => dog.tier === maxTier)) {
    const replaced = dogs[dogs.length - 1];
    dogs[dogs.length - 1] = createDog(maxTier, 0, replaced.col, replaced.role);
  }
  const debutRoles = Object.values(DOG_ROLE)
    .filter((role) => DOG_ROLE_INFO[role].unlockRound === round && role !== DOG_ROLE.SCRUFFY);
  const requiredRoles = [...new Set([...debutRoles, ...featuredDogRolesForRound(round)])];
  for (const requiredRole of requiredRoles) {
    if (!dogs.length || dogs.some((dog) => dog.role === requiredRole)) continue;
    const replaceIndex = dogs.findIndex((dog) => !requiredRoles.includes(dog.role));
    const fallbackIndex = replaceIndex >= 0
      ? replaceIndex
      : dogs.findIndex((dog, index) => dogs.findIndex((other) => other.role === dog.role) !== index);
    const safeIndex = fallbackIndex >= 0 ? fallbackIndex : dogs.length - 1;
    const replaced = dogs[safeIndex];
    dogs[safeIndex] = createDog(replaced.tier, 0, replaced.col, requiredRole);
  }
  return dogs;
}

export function startRound(game) {
  if (game.phase !== 'prep') return game;
  const next = copy(game);
  next.phase = 'combat';
  next.section = 0;
  next.tacticsMoveUsed = false;
  next.cats.forEach((cat) => {
    cat.hasEnteredBattle = true;
    cat.activeUsed = false;
    cat.guard = 0;
    cat.nextAttackBonus = 0;
    cat.nextAttackPenalty = 0;
  });
  const queuedWave = next.nextWave?.length ? next.nextWave : generateWave(next.round, game.random);
  next.dogs.push(...queuedWave.map((dog) => ({ ...dog })));
  next.dogs.forEach((dog) => {
    dog.howlUsed = false;
    dog.jumped = false;
    dog.healUsed = false;
    dog.fearUsed = false;
    dog.attackBoost = 0;
  });
  next.nextWave = [];
  next.message = `Round ${next.round}: defend the yard!`;
  next.events = [{ type: 'wave', round: next.round }];
  return next;
}

export function openTacticsWindow(game) {
  if (game.phase !== 'combat') return game;
  const next = copy(game);
  next.phase = 'tactics';
  next.cats.forEach((cat) => {
    cat.tacticsOrigin = { row: cat.row, col: cat.col };
    cat.tacticsMoved = false;
  });
  next.message = 'TACTICS: move each cat once, use supplies or abilities, then continue.';
  return next;
}

export function continueCombat(game) {
  if (game.phase !== 'tactics') return game;
  const next = copy(game);
  next.phase = 'combat';
  next.message = `Round ${next.round}: combat continues!`;
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
 * Column-priority targeting:
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

/**
 * Hissiletoe targeting:
 * 1) lowest dog row first (highest row index = closest to the cats)
 * 2) within that row, nearest column to Hissiletoe
 * 3) equal row + column distance → random among them
 */
export function closestDogByRowPriority(cat, dogs, random = Math.random) {
  const candidates = livingDogs(dogs);
  if (!candidates.length) return null;

  let bestRow = -Infinity;
  for (const dog of candidates) {
    bestRow = Math.max(bestRow, dog.row);
  }

  const lowestRow = candidates.filter((dog) => dog.row === bestRow);
  let bestColDist = Infinity;
  for (const dog of lowestRow) {
    bestColDist = Math.min(bestColDist, Math.abs(dog.col - cat.col));
  }

  const ties = lowestRow.filter((dog) => Math.abs(dog.col - cat.col) === bestColDist);
  if (ties.length === 1) return ties[0];
  return ties[Math.floor(random() * ties.length)];
}

function closestHomingDog(cat, dogs, random = Math.random) {
  return normalizeCoat(cat.coat) === CAT_COAT.WHITE
    ? closestDogByRowPriority(cat, dogs, random)
    : closestDogByColumnPriority(cat, dogs, random);
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

function panicSidestep(next, dog, attacker) {
  if (dog.role !== DOG_ROLE.SKITTISH || dog.hp <= 0) return;
  const fromCol = dog.col;
  const candidates = [-1, 1]
    .map((offset) => fromCol + offset)
    .filter((col) => col >= 0 && col < COLS)
    .filter((col) => dogCountAt(next.dogs, dog.row, col, dog.id) < DOG_CELL_CAPACITY)
    .filter((col) => !next.cats.some((cat) => cat.hp > 0 && cat.row === dog.row && cat.col === col))
    .filter((col) => !next.decoys.some((decoy) => decoyIsActive(decoy) && decoy.row === dog.row && decoy.col === col));
  if (!candidates.length) return;

  const greatestDistance = Math.max(...candidates.map((col) => Math.abs(col - attacker.col)));
  const safest = candidates.filter((col) => Math.abs(col - attacker.col) === greatestDistance);
  const random = typeof next.random === 'function' ? next.random : Math.random;
  const toCol = safest[Math.min(safest.length - 1, Math.floor(random() * safest.length))];
  dog.col = toCol;
  next.events.push({
    type: 'panic-sidestep', ability: 'panic-shuffle', id: dog.id,
    fromRow: dog.row, fromCol, toRow: dog.row, row: dog.row, col: toCol,
    path: [{ row: dog.row, col: fromCol }, { row: dog.row, col: toCol }],
  });
}

function pushDamageEvent(next, type, from, to, extra = {}) {
  let damage = typeof extra.damage === 'number' ? extra.damage : from.attack;
  if (damage > 0 && to.role === DOG_ROLE.JUMPER) {
    damage += 1;
    extra = { ...extra, lightGearDamage: 1 };
  }
  if (to.shatterDamage) {
    damage += to.shatterDamage;
    extra = { ...extra, shatterDamage: to.shatterDamage };
    to.shatterDamage = 0;
  }
  if (damage <= 0) return;
  const hpBefore = to.hp;
  to.hp = Math.max(0, to.hp - damage);
  next.events.push({
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
  panicSidestep(next, to, from);
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
  const attack = extra.damage ?? (dog.attack + (dog.attackBoost ?? 0));
  if (target.kind === 'phantom-cat') {
    const blocksBefore = target.blocks ?? 0;
    target.blocks = Math.max(0, blocksBefore - 1);
    dog.attackBoost = 0;
    next.events.push({
      type,
      from: dog.id,
      to: target.id,
      col: target.col,
      fromCol: dog.col,
      fromRow: dog.row,
      toRow: target.row,
      blocked: attack,
      blocksBefore,
      blocksAfter: target.blocks,
      maxBlocks: target.maxBlocks,
      decoyBlock: true,
      ...extra,
      damage: 0,
    });
    return;
  }
  const hpBefore = target.hp;
  const armour = target.equipment?.armour;
  const armourBlocked = armour?.block ?? 0;
  const guardBlocked = target.guard ?? 0;
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

function decoyIsActive(decoy) {
  return (decoy?.blocks ?? 0) > 0;
}

function defenderIsActive(target) {
  return target?.kind === 'phantom-cat' ? decoyIsActive(target) : (target?.hp ?? 0) > 0;
}

function dogCountAt(dogs, row, col, exceptId = null) {
  return dogs.filter((dog) => dog.hp > 0
    && dog.id !== exceptId
    && dog.row === row
    && dog.col === col).length;
}

function defenderAhead(next, dog) {
  return next.cats.find((cat) => cat.hp > 0 && cat.col === dog.col && cat.row === dog.row + 1)
    ?? next.decoys.find((decoy) => decoyIsActive(decoy) && decoy.col === dog.col && decoy.row === dog.row + 1)
    ?? null;
}

function pushDogMove(next, dog, fromRow, fromCol, path = []) {
  if (dog.row === fromRow && dog.col === fromCol) return;
  next.events.push({
    type: 'move', id: dog.id, fromRow, fromCol, toRow: dog.row, row: dog.row, col: dog.col,
    path: [{ row: fromRow, col: fromCol }, ...path],
  });
}

function meetDefender(next, dog, target, fromRow, fromCol, path = []) {
  const landingRow = dog.row + 2;
  const landingBlocked = landingRow >= ROWS
    || dogCountAt(next.dogs, landingRow, dog.col, dog.id) >= DOG_CELL_CAPACITY
    || next.cats.some((cat) => cat.hp > 0 && cat.col === dog.col && cat.row === landingRow)
    || next.decoys.some((decoy) => decoyIsActive(decoy) && decoy.col === dog.col && decoy.row === landingRow);
  if (dog.role === DOG_ROLE.JUMPER && !dog.jumped && !landingBlocked) {
    dog.row = landingRow;
    dog.jumped = true;
    next.events.push({
      type: 'dog-jump', id: dog.id, fromRow, fromCol, toRow: dog.row,
      row: dog.row, col: dog.col, over: target.id,
      path: [{ row: fromRow, col: fromCol }, ...path, { row: dog.row, col: dog.col }],
    });
    return;
  }

  pushDogMove(next, dog, fromRow, fromCol, path);
  applyDogDamage(next, dog, target);
}

const DOG_DIRECTIONS = Object.freeze({
  down: Object.freeze({ row: 1, col: 0 }),
  right: Object.freeze({ row: 0, col: 1 }),
  left: Object.freeze({ row: 0, col: -1 }),
});

function defenderAheadFrom(next, row, col) {
  return next.cats.some((cat) => cat.hp > 0 && cat.row === row + 1 && cat.col === col)
    || next.decoys.some((decoy) => decoyIsActive(decoy) && decoy.row === row + 1 && decoy.col === col);
}

function dogCellBlocked(next, dog, row, col) {
  if (row < 0 || row > ROWS || col < 0 || col >= COLS) return true;
  if (row === ROWS) return false;
  return dogCountAt(next.dogs, row, col, dog.id) >= DOG_CELL_CAPACITY
    || next.cats.some((cat) => cat.hp > 0 && cat.row === row && cat.col === col)
    || next.decoys.some((decoy) => decoyIsActive(decoy) && decoy.row === row && decoy.col === col);
}

function dogDirectionOptions(next, dog, position, lastDirection, horizontalDirection) {
  if (lastDirection === 'left' || lastDirection === 'right') {
    const down = DOG_DIRECTIONS.down;
    const downBlocked = dogCellBlocked(next, dog, position.row + down.row, position.col + down.col);
    return downBlocked ? [horizontalDirection] : ['down'];
  }
  return horizontalDirection ? ['down', horizontalDirection] : ['down', 'right', 'left'];
}

function chooseDogRoute(next, dog, distance) {
  function search(position, stepsLeft, lastDirection = null, horizontalDirection = null, path = []) {
    if (stepsLeft === 0 || position.row >= ROWS) return { path, complete: true };
    if (defenderAheadFrom(next, position.row, position.col)) return { path, complete: true };

    const candidates = dogDirectionOptions(
      next, dog, position, lastDirection, horizontalDirection,
    ).flatMap((direction) => {
      const delta = DOG_DIRECTIONS[direction];
      if (!delta) return [];
      const target = { row: position.row + delta.row, col: position.col + delta.col };
      if (dogCellBlocked(next, dog, target.row, target.col)) return [];
      return [search(
        target,
        stepsLeft - 1,
        direction,
        direction === 'left' || direction === 'right' ? direction : horizontalDirection,
        [...path, target],
      )];
    });

    return candidates.find((candidate) => candidate.complete)
      ?? candidates.sort((left, right) => right.path.length - left.path.length)[0]
      ?? { path, complete: false };
  }

  return search({ row: dog.row, col: dog.col }, distance);
}

function advanceDog(next, dog) {
  const fromRow = dog.row;
  const fromCol = dog.col;
  const immediateDefender = defenderAhead(next, dog);
  if (immediateDefender) {
    meetDefender(next, dog, immediateDefender, fromRow, fromCol);
    return;
  }

  const route = chooseDogRoute(next, dog, dogMoveDistance(dog));
  if (dog.tangled && route.path.length) {
    dog.tangled = false;
    next.events.push({ type: 'tangle-skip', id: dog.id, row: dog.row, col: dog.col });
    return;
  }

  const travelled = [];
  for (const step of route.path) {
    const target = defenderAhead(next, dog);
    if (target) {
      meetDefender(next, dog, target, fromRow, fromCol, travelled);
      return;
    }
    dog.row = step.row;
    dog.col = step.col;
    travelled.push(step);
  }

  const reachedDefender = defenderAhead(next, dog);
  if (reachedDefender) {
    meetDefender(next, dog, reachedDefender, fromRow, fromCol, travelled);
    return;
  }
  pushDogMove(next, dog, fromRow, fromCol, travelled);
}

export function resolveSection(game) {
  if (game.phase === 'gameover' || game.phase === 'victory') return game;
  const next = copy(game);
  next.section += 1;

  // Cats always act. If nothing is in range they still shoot/swing (miss animations).
  // Purrcy = high column damage, Hissiletoe = medium homing, Clawdius = low front melee.
  for (const cat of next.cats) {
    if (cat.nextAttackBonus || cat.nextAttackPenalty) {
      cat.attackBeforeActiveBonus = cat.attack;
      cat.attack = Math.max(1, cat.attack + (cat.nextAttackBonus ?? 0) - (cat.nextAttackPenalty ?? 0));
      cat.nextAttackBonus = 0;
      cat.nextAttackPenalty = 0;
    }
    const ability = cat.ability ?? catStatsFor(cat.level, cat.coat).ability;
    if (ability === 'melee') {
      const target = dogInMeleeFront(cat, next.dogs);
      if (target) {
        pushDamageEvent(next, 'cat-melee', cat, target, {
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
        pushDamageEvent(next, 'shot', cat, target, {
          fromCol: cat.col,
          col: target.col,
          style: 'tangle',
        });
        if (target.hp > 0 && !target.tangledOnce) {
          target.tangled = true;
          target.tangledOnce = true;
        }
      } else {
        pushMissEvent(next.events, 'shot', cat, { fromCol: cat.col, col: cat.col, toRow: 0, style: 'tangle' });
      }
      continue;
    }

    if (ability === 'bomb' || ability === 'splash') {
      const target = nearestDogInColumn(cat, next.dogs);
      if (target) {
        pushDamageEvent(next, 'shot', cat, target, {
          fromCol: cat.col,
          col: target.col,
          style: 'bomb',
        });
      } else {
        pushMissEvent(next.events, 'shot', cat, { fromCol: cat.col, col: cat.col, toRow: 0, style: 'bomb' });
      }
      continue;
    }

    if (ability === 'piercing') {
      const targets = livingDogs(next.dogs)
        .filter((dog) => dog.col === cat.col && dog.row < cat.row)
        .sort((a, b) => b.row - a.row)
        .slice(0, 3);
      if (targets.length) {
        targets.forEach((target, index) => pushDamageEvent(next, 'shot', cat, target, {
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
      const target = closestHomingDog(cat, next.dogs, game.random);
      if (target) {
        pushDamageEvent(next, 'shot', cat, target, {
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
        pushDamageEvent(next, 'shot', cat, target, shared);
      } else {
        pushMissEvent(next.events, 'shot', cat, {
          ...shared,
          toRow: 0,
        });
      }
    });
  }
  next.cats.forEach((cat) => {
    if (typeof cat.attackBeforeActiveBonus === 'number') {
      cat.attack = cat.attackBeforeActiveBonus;
      delete cat.attackBeforeActiveBonus;
    }
  });
  next.dogs = next.dogs.filter((dog) => dog.hp > 0);

  // Ready medics patch the pack before faster movement can carry patients out of range.
  // All other dogs keep front-to-back order so followers may advance into opened cells.
  const actingDogs = [...next.dogs].sort((a, b) => {
    const aMedic = a.role === DOG_ROLE.MEDIC && !a.healUsed ? 1 : 0;
    const bMedic = b.role === DOG_ROLE.MEDIC && !b.healUsed ? 1 : 0;
    return bMedic - aMedic || b.row - a.row;
  });
  for (const dog of actingDogs) {
    if (dog.frozenActions > 0) {
      dog.frozenActions -= 1;
      dog.frozenRoundsRemaining = Math.ceil(dog.frozenActions / ACTIONS_PER_ROUND);
      next.events.push({
        type: 'freeze-skip', id: dog.id, row: dog.row, col: dog.col,
        remainingActions: dog.frozenActions, remainingRounds: dog.frozenRoundsRemaining,
      });
      continue;
    }
    if (dog.role === DOG_ROLE.HOWLER && !dog.howlUsed) {
      const allies = next.dogs.filter((other) => other.id !== dog.id
        && other.hp > 0
        && Math.abs(other.col - dog.col) <= 1
        && Math.abs(other.row - dog.row) <= 2);
      if (allies.length) {
        const bonus = dog.howlBonus ?? dogStatsFor(dog.tier, dog.role).howlBonus;
        allies.forEach((ally) => { ally.attackBoost = Math.max(ally.attackBoost ?? 0, bonus); });
        dog.howlUsed = true;
        next.events.push({
          type: 'howl', id: dog.id, row: dog.row, col: dog.col,
          targets: allies.map((ally) => ally.id), bonus,
        });
        continue;
      }
    }
    if (dog.role === DOG_ROLE.MEDIC && !dog.healUsed) {
      const patient = next.dogs
        .filter((other) => other.id !== dog.id
          && other.hp > 0
          && other.hp < other.maxHp
          && Math.abs(other.col - dog.col) <= 1
          && Math.abs(other.row - dog.row) <= 2)
        .sort((left, right) => (right.maxHp - right.hp) - (left.maxHp - left.hp)
          || Math.abs(left.row - dog.row) - Math.abs(right.row - dog.row))[0];
      if (patient) {
        const healPower = dog.healPower ?? dogStatsFor(dog.tier, dog.role).healPower;
        const hpBefore = patient.hp;
        patient.hp = Math.min(patient.maxHp, patient.hp + healPower);
        dog.healUsed = true;
        next.events.push({
          type: 'dog-heal', id: dog.id, from: dog.id, to: patient.id,
          row: patient.row, col: patient.col, fromRow: dog.row, fromCol: dog.col,
          amount: patient.hp - hpBefore, hpBefore, hpAfter: patient.hp, maxHp: patient.maxHp,
        });
        continue;
      }
    }
    if (dog.role === DOG_ROLE.GROWLER && !dog.fearUsed) {
      const frightened = next.cats
        .filter((cat) => cat.hp > 0
          && Math.abs(cat.col - dog.col) <= 1
          && cat.row - dog.row >= 1
          && cat.row - dog.row <= 4)
        .sort((left, right) => right.attack - left.attack
          || (left.row - dog.row) - (right.row - dog.row))[0];
      if (frightened) {
        const fearPower = dog.fearPower ?? dogStatsFor(dog.tier, dog.role).fearPower;
        frightened.nextAttackPenalty = Math.max(frightened.nextAttackPenalty ?? 0, fearPower);
        dog.fearUsed = true;
        next.events.push({
          type: 'dog-fear', id: dog.id, from: dog.id, to: frightened.id,
          row: frightened.row, col: frightened.col, fromRow: dog.row, fromCol: dog.col,
          amount: fearPower,
        });
        continue;
      }
    }
    if (dog.role === DOG_ROLE.FRISBEE) {
      const rangedTarget = [...next.cats, ...next.decoys]
        .filter((target) => defenderIsActive(target)
          && Math.abs(target.col - dog.col) <= 1
          && target.row - dog.row >= 2
          && target.row - dog.row <= 4)
        .sort((left, right) => (left.row - dog.row) - (right.row - dog.row)
          || Math.abs(left.col - dog.col) - Math.abs(right.col - dog.col))[0];
      if (rangedTarget) {
        const rangedDamage = Math.max(1, Math.ceil((dog.attack + (dog.attackBoost ?? 0)) * 0.7));
        applyDogDamage(next, dog, rangedTarget, 'dog-shot', { style: 'frisbee', damage: rangedDamage });
        continue;
      }
    }
    if (dog.role === DOG_ROLE.TENNIS) {
      const rangedTarget = [...next.cats, ...next.decoys]
        .filter((target) => defenderIsActive(target)
          && target.col === dog.col
          && target.row - dog.row >= 2
          && target.row - dog.row <= 3)
        .sort((left, right) => left.row - right.row)[0];
      if (rangedTarget) {
        const rangedDamage = Math.max(1, Math.ceil((dog.attack + (dog.attackBoost ?? 0)) * 0.6));
        applyDogDamage(next, dog, rangedTarget, 'dog-shot', { style: 'tennis', damage: rangedDamage });
        continue;
      }
    }
    if (dog.role === DOG_ROLE.LOBBER) {
      const rangedTarget = [...next.cats, ...next.decoys]
        .filter((target) => defenderIsActive(target)
          && target.col === dog.col
          && target.row - dog.row >= 2
          && target.row - dog.row <= 5)
        .sort((left, right) => left.row - right.row)[0];
      if (rangedTarget) {
        const bombDamage = Math.max(1, Math.floor((dog.attack + (dog.attackBoost ?? 0)) * 0.6));
        applyDogDamage(next, dog, rangedTarget, 'dog-shot', { style: 'bone-bomb', damage: bombDamage });
        const splashTargets = [...next.cats, ...next.decoys]
          .filter((target) => target.id !== rangedTarget.id
            && defenderIsActive(target)
            && target.row === rangedTarget.row
            && Math.abs(target.col - rangedTarget.col) === 1);
        splashTargets.forEach((target) => applyDogDamage(next, dog, target, 'dog-shot', {
          style: 'bone-bomb-secondary', damage: bombDamage,
        }));
        continue;
      }
    }
    advanceDog(next, dog);
  }
  next.cats = next.cats.filter((cat) => cat.hp > 0);
  next.decoys = next.decoys.filter(decoyIsActive);

  const breachedCols = [...new Set(next.dogs.filter((dog) => dog.row >= ROWS).map((dog) => dog.col))];
  for (const col of breachedCols) {
    next.lives = Math.max(0, next.lives - 1);
    next.dogs = next.dogs.filter((dog) => dog.col !== col);
    next.events.push({ type: 'breach', col });
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
  next.decoys.forEach((decoy) => {
    decoy.blocks = Math.max(0, (decoy.blocks ?? 0) - 1);
  });
  next.decoys = next.decoys.filter(decoyIsActive);
  next.gold = 10;
  next.shop = makeShop(game.random, game.shop, next.round);
  next.nextWave = generateWave(next.round, game.random);
  const kept = next.shop.filter((slot) => slot.saved).length;
  next.message = kept
    ? `Round ${next.round} prep: 10 fresh gold! ${kept} saved pet${kept === 1 ? '' : 's'} held over.`
    : next.dogs.length === 0
      ? `Wave cleared! Round ${next.round} prep: 10 fresh gold!`
      : `Round ${next.round} prep: 10 fresh gold!`;
  // Preserve surviving cats' health while resetting round-scoped effects.
  next.cats.forEach((cat) => {
    cat.prepOrigin = { row: cat.row, col: cat.col };
    cat.prepMoved = false;
    cat.guard = 0;
    cat.nextAttackBonus = 0;
  });
  next.workers.forEach((worker) => {
    if (!worker) return;
    const productionRounds = WORKER_INFO[worker.role]?.productionRounds ?? 1;
    worker.productionProgress = (worker.productionProgress ?? 0) + 1;
    if (worker.productionProgress < productionRounds) return;
    worker.productionProgress = 0;
    worker.pendingOutput = outputForWorker(worker.role, worker.level);
    next.events.push({
      type: 'production-ready', workerId: worker.id,
      output: worker.pendingOutput ? { ...worker.pendingOutput } : null,
    });
  });
  return next;
}
