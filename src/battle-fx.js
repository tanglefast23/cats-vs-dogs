import { COLS, DOG_ROLE, plusCells } from './game-engine.js';

/**
 * The graphics registry for every attack in the game, and for the mark each attack
 * leaves on whatever it hits.
 *
 * The engine speaks in damage events — one per victim. Graphics have to speak in
 * attacks — one bomb, one blast, several victims. Rendering an event per projectile is
 * what can turn Bombay Boom's plus explosion into several stray bombs. So the
 * renderer groups events into attacks (attackGroupKey), looks the attack up here, and
 * draws it once.
 */

/** Every style the engine can stamp on a damage event. Guarded by a test. */
export const ENGINE_ATTACK_STYLES = Object.freeze([
  // Cats
  'column', 'melee', 'homing', 'tangle', 'bomb', 'bomb-cross', 'bomb-cross-secondary',
  'piercing', 'lightning',
  // The five homing cats that split off their own skins
  'frost', 'rift', 'mirage', 'spark', 'note',
  // Dogs
  'bite', 'tennis', 'frisbee', 'bone-bomb', 'bone-bomb-secondary',
]);

/** Cat attacks that can land on a dog. Kept explicit so tests cover the full matrix. */
export const CAT_ATTACK_SIGNATURES = Object.freeze([
  'column', 'melee', 'homing', 'frost', 'rift', 'mirage', 'spark', 'note', 'tangle',
  'bomb', 'bomb-cross', 'bomb-cross-secondary', 'piercing', 'lightning',
]);

/**
 * Six cats all attack with `style: 'homing'`, so the style alone cannot tell them apart.
 * Their coat can. Hissiletoe keeps the original projectile; the five specialists each
 * get a skin that matches the sprite they were drawn with.
 */
const HOMING_SKIN_BY_COAT = Object.freeze({
  2: 'homing', // Hissiletoe — the balanced generalist
  6: 'frost',  // Frosty Paws — frost staff
  7: 'rift',   // Purrtal — portal rings
  8: 'mirage', // Faux Paw — the showman
  9: 'spark',  // Thunderpaws — static
  10: 'note',  // Meowstro — the conductor
});

/**
 * How each attack is drawn, and what it does to whoever it lands on.
 *
 * projectile — the flying thing, or null when the attack has no travelling object.
 * path       — straight | lob | homing | beam | melee | strike.
 * muzzle     — a flash left at the attacker, or null.
 * impact     — the key into HURT_FX: how the victim reacts.
 * blast      — set only on area attacks. Names the footprint rule, and tells the
 *              renderer to draw ONE explosion instead of one projectile per victim.
 * absorbedBy — set on secondary damage. These victims are caught in the parent's blast,
 *              so they must never fire a projectile of their own. This one field is the
 *              whole bomb fix.
 * recoil     — how the attacking cat visibly absorbs the force of launching the attack.
 * heavy      — bigger shake, deeper sound.
 */
export const ATTACK_FX = Object.freeze({
  // ---- Cats ----------------------------------------------------------------
  // Purrcy Pew-Pew: three rapid pellets that split his damage.
  column: {
    projectile: 'pellet', path: 'straight', muzzle: 'gunsmoke', impact: 'spark', recoil: 'rapid', heavy: false,
  },
  // Clawdius: the claw flurry, already choreographed in melee-animation.js.
  melee: {
    projectile: null, path: 'melee', muzzle: null, impact: 'rake', heavy: true,
  },
  // Hissiletoe and the five specialists below it.
  homing: {
    projectile: 'homing', path: 'homing', muzzle: null, impact: 'thump', recoil: 'standard', heavy: false,
  },
  frost: {
    projectile: 'frost-shard', path: 'homing', muzzle: 'frost-puff', impact: 'frost', recoil: 'standard', heavy: false,
  },
  rift: {
    projectile: 'rift-mote', path: 'homing', muzzle: 'rift-ring', impact: 'warp', recoil: 'standard', heavy: false,
  },
  mirage: {
    projectile: 'mirage-card', path: 'homing', muzzle: 'card-fan', impact: 'slice', recoil: 'standard', heavy: false,
  },
  spark: {
    projectile: 'static-spark', path: 'homing', muzzle: 'static-pop', impact: 'zap', recoil: 'standard', heavy: false,
  },
  note: {
    projectile: 'music-note', path: 'homing', muzzle: null, impact: 'chime', recoil: 'standard', heavy: false,
  },
  // Knotty Kitty: yarn that trails a string and leaves the dog tethered.
  tangle: {
    projectile: 'yarn', path: 'yarn-throw', muzzle: null, impact: 'wrap', tether: true, recoil: 'toss', heavy: false,
  },
  // Bombay Boom's regular attack: one lobbed bomb, one target square.
  bomb: {
    projectile: 'bomb', path: 'lob', muzzle: 'fuse-spark',
    impact: 'scorch', blast: 'single-cell', recoil: 'heavy', heavy: true,
  },
  // His once-per-battle plus bomb: centre + four orthogonal neighbours.
  'bomb-cross': {
    projectile: 'bomb', path: 'lob', muzzle: 'fuse-spark',
    impact: 'scorch', blast: 'plus', recoil: 'heavy', heavy: true,
  },
  // Every dog after the first is caught in the same plus blast — never a new bomb.
  'bomb-cross-secondary': {
    projectile: null, path: null, muzzle: null,
    impact: 'scorch', absorbedBy: 'bomb-cross', heavy: false,
  },
  // Laserpaw: one beam through up to three dogs, not three separate shots.
  piercing: {
    projectile: null, path: 'beam', muzzle: 'prism-charge', impact: 'burn', recoil: 'laser', heavy: true,
  },
  // Thunderpaws' storm keeps its existing bespoke choreography; this entry exists so the
  // victims still get a matching hurt reaction.
  lightning: {
    projectile: null, path: 'strike', muzzle: null, impact: 'zap', heavy: true,
  },

  // ---- Dogs ----------------------------------------------------------------
  // The plain bite. The engine sends these with no style at all.
  bite: {
    projectile: null, path: 'melee', muzzle: null, impact: 'chomp', heavy: true,
  },
  tennis: {
    projectile: 'tennis', path: 'straight', muzzle: 'racket-swing', impact: 'dent', heavy: false,
  },
  frisbee: {
    projectile: 'frisbee', path: 'straight', muzzle: null, impact: 'slice', heavy: false,
  },
  // Bone Jovi's mortar — the same explosion machinery as Bombay Boom, aimed at cats.
  'bone-bomb': {
    projectile: 'bone-bomb', path: 'lob', muzzle: 'mortar-smoke',
    impact: 'thud', blast: 'row-neighbours', heavy: true,
  },
  'bone-bomb-secondary': {
    projectile: null, path: null, muzzle: null,
    impact: 'thud', absorbedBy: 'bone-bomb', heavy: false,
  },
});

/**
 * Launch force for each ranged-cat animation, measured in fractions of one unit width.
 * The direction is calculated per attack; these values only decide the weight. Laserpaw
 * moves furthest because the beam keeps pressing against him after the initial blast.
 */
export const ATTACK_RECOIL_FX = Object.freeze({
  rapid: Object.freeze({ distance: 0.09, backblast: 'small' }),
  standard: Object.freeze({ distance: 0.13, backblast: 'small' }),
  toss: Object.freeze({ distance: 0.16, backblast: 'soft' }),
  heavy: Object.freeze({ distance: 0.20, backblast: 'heavy' }),
  laser: Object.freeze({ distance: 0.25, backblast: 'laser' }),
});

/**
 * How a victim reacts, matched to whatever hit it. Every unit flashes red; what differs
 * is the decal left at the contact point, how hard it is thrown, and how it shakes.
 *
 * mark   — the decal drawn on the edge of the victim facing the attacker.
 * recoil — how far it is knocked back along the attacker→victim vector, in unit widths.
 * shake  — soft | hard | rattle.
 */
export const HURT_FX = Object.freeze({
  chomp: { mark: 'chomp', recoil: 0.30, shake: 'hard' },   // teeth
  rake: { mark: 'rake', recoil: 0.18, shake: 'rattle' },   // claws
  spark: { mark: 'spark', recoil: 0.10, shake: 'soft' },   // pellet
  thump: { mark: 'thump', recoil: 0.16, shake: 'soft' },
  scorch: { mark: 'scorch', recoil: 0.34, shake: 'hard' }, // explosion
  thud: { mark: 'thud', recoil: 0.32, shake: 'hard' },     // bone mortar
  burn: { mark: 'burn', recoil: 0.08, shake: 'rattle' },   // beam bores through
  frost: { mark: 'frost', recoil: 0.12, shake: 'soft' },
  zap: { mark: 'zap', recoil: 0.14, shake: 'rattle' },
  wrap: { mark: 'wrap', recoil: 0.08, shake: 'soft' },     // yarn
  dent: { mark: 'dent', recoil: 0.22, shake: 'soft' },     // tennis ball
  slice: { mark: 'slice', recoil: 0.20, shake: 'soft' },   // frisbee / cards
  warp: { mark: 'warp', recoil: 0.12, shake: 'soft' },
  chime: { mark: 'chime', recoil: 0.12, shake: 'soft' },
});

/**
 * The part of a hit reaction that belongs to the dog, not the attack.
 *
 * HURT_FX says what a pellet, claw, bomb, or yarn impact does. This table says how each
 * dog performs that hit: Chomps braces, Barkour springs, Sir Flinches recoils, and so on.
 * `bind` is the yarn choreography fitted to that dog's silhouette.
 */
export const DOG_REACTION_FX = Object.freeze({
  [DOG_ROLE.SCRUFFY]: Object.freeze({ reaction: 'brace', bind: 'barrel' }),
  [DOG_ROLE.FRISBEE]: Object.freeze({ reaction: 'spin', bind: 'wing' }),
  [DOG_ROLE.TENNIS]: Object.freeze({ reaction: 'duck', bind: 'visor' }),
  [DOG_ROLE.HOWLER]: Object.freeze({ reaction: 'yelp', bind: 'howl' }),
  [DOG_ROLE.LOBBER]: Object.freeze({ reaction: 'rattle', bind: 'cannon' }),
  [DOG_ROLE.JUMPER]: Object.freeze({ reaction: 'bounce', bind: 'spring' }),
  [DOG_ROLE.SKITTISH]: Object.freeze({ reaction: 'flinch', bind: 'cocoon' }),
  [DOG_ROLE.MEDIC]: Object.freeze({ reaction: 'stumble', bind: 'medic' }),
  [DOG_ROLE.GROWLER]: Object.freeze({ reaction: 'snarl', bind: 'collar' }),
});

/**
 * Complete attack × dog contract. Every cat attack is paired with every dog role.
 * The attack contributes its contact flavour; the dog contributes its own performance.
 */
export const ATTACK_DOG_FX = Object.freeze(Object.fromEntries(
  CAT_ATTACK_SIGNATURES.map((signature) => [
    signature,
    Object.freeze(Object.fromEntries(
      Object.values(DOG_ROLE).map((role) => [
        role,
        Object.freeze({ impact: ATTACK_FX[signature].impact, ...DOG_REACTION_FX[role] }),
      ]),
    )),
  ]),
));

/** Resolve one attack hitting one dog, with safe fallbacks for old saves or unknown data. */
export function attackDogFx(signature, role) {
  const safeSignature = ATTACK_DOG_FX[signature] ? signature : 'homing';
  const safeRole = DOG_REACTION_FX[role] ? role : DOG_ROLE.SCRUFFY;
  return ATTACK_DOG_FX[safeSignature][safeRole];
}

/** The graphics key for one damage event, refining the six shared homing cats by coat. */
export function attackSignature(event, caster = null) {
  const style = event?.style;
  if (style === 'homing') {
    return HOMING_SKIN_BY_COAT[caster?.coat] ?? 'homing';
  }
  // The plain dog bite carries no style — the engine calls applyDogDamage with no extras.
  if (!style) return event?.type === 'melee' ? 'bite' : 'homing';
  return ATTACK_FX[style] ? style : 'homing';
}

/**
 * Events that belong to the same attack share this key, so the renderer draws one bomb
 * and one blast rather than one projectile per victim. Secondary damage folds into its
 * parent (bomb-cross-secondary → bomb-cross), which keeps the special to one bomb.
 */
export function attackGroupKey(event, caster = null) {
  const signature = attackSignature(event, caster);
  const family = ATTACK_FX[signature]?.absorbedBy ?? signature;
  return `${event.from ?? 'none'}:${family}`;
}

/**
 * The squares an explosion covers: the square it landed on, plus the squares either side
 * of it in the same row. This mirrors the engine's own splash targeting
 * (same row, one column away), so the fire lands on exactly the units that took damage —
 * never on an empty square, never missing a damaged one.
 */
export function blastCells(row, col, cols = COLS) {
  const cells = [];
  for (let offset = -1; offset <= 1; offset += 1) {
    const target = col + offset;
    if (target >= 0 && target < cols) cells.push({ row, col: target });
  }
  return cells;
}

/** The visible fire footprint for each kind of lobbed blast. */
export function blastFootprint(kind, row, col) {
  if (kind === 'single-cell') return [{ row, col }];
  if (kind === 'plus') return plusCells(row, col);
  return blastCells(row, col);
}

/** Unit vector from the attacker to the victim: which way the victim gets thrown. */
export function contactVector(fromRow, fromCol, toRow, toCol) {
  const dx = toCol - fromCol;
  const dy = toRow - fromRow;
  const length = Math.hypot(dx, dy);
  if (!length) return { dx: 0, dy: 1 };
  return { dx: dx / length, dy: dy / length };
}

/** The attacking cat is pushed opposite the direction its projectile travels. */
export function attackRecoilFx(signature, fromRow, fromCol, toRow, toCol) {
  const kind = ATTACK_FX[signature]?.recoil;
  const profile = ATTACK_RECOIL_FX[kind];
  if (!profile) return null;
  const forward = contactVector(fromRow, fromCol, toRow, toCol);
  return {
    kind,
    distance: profile.distance,
    backblast: profile.backblast,
    forwardDx: forward.dx,
    forwardDy: forward.dy,
    dx: -forward.dx * profile.distance,
    dy: -forward.dy * profile.distance,
  };
}

/** A death is simply the blow that took a living unit to zero. */
export function isKill(event) {
  if (!event || event.miss || !event.to) return false;
  if (typeof event.blocksAfter === 'number') {
    return event.blocksAfter === 0 && event.blocksBefore > 0;
  }
  return event.hpAfter === 0 && event.hpBefore > 0;
}

/** How hard a floating number shouts: bigger hits earn bigger type, kills always shout. */
export function damageTier(event) {
  if (event.decoyBlock) return 'big';
  if (isKill(event) || event.damage >= 8) return 'huge';
  if (event.damage >= 4) return 'big';
  return 'small';
}

/**
 * Where the Nth quick hit on the same square sits: the first stays centred, later ones
 * fan out left, right, further left, further right — so Purrcy's -1 -1 -1 pellet volley
 * reads as three separate events side by side instead of one smudged stack.
 */
export function fanOffset(slot) {
  if (slot <= 0) return 0;
  const side = slot % 2 === 1 ? -1 : 1;
  return side * Math.ceil(slot / 2) * 32;
}

/**
 * The floating combat number for one damage event: what it says, how big it pops, where
 * it sits in the fan, and the armour chip pinned beside it when protection soaked part
 * of the blow.
 *
 * Every hit pops in with overshoot, lands slightly tilted, and drifts as it floats.
 * `slot` counts quick-succession hits on the same square; fanned numbers keep drifting
 * outward on their own side so the fan opens wider as it rises. Drift and tilt come
 * from the injected random so tests can pin them down. The engine already reports how
 * much armour or a catnip guard blocked (`blocked`) and whether the hit spent the
 * armour's last use (`armourBroken`); this just decides how that is worn on screen.
 */
export function damageNumberFx(event, random = Math.random, slot = 0) {
  const isBlock = Boolean(event.decoyBlock);
  // Dogs attack with `melee` bites and `dog-shot` throws; everything else is a cat attack.
  const hitsCat = event.type === 'melee' || event.type === 'dog-shot';
  const blocked = !isBlock && (event.blocked ?? 0) > 0
    ? { amount: event.blocked, broken: Boolean(event.armourBroken) }
    : null;
  const fanX = fanOffset(slot);
  const driftSide = fanX === 0 ? (random() < 0.5 ? -1 : 1) : Math.sign(fanX);
  return {
    text: isBlock ? 'BLOCK!' : `-${event.damage}`,
    classes: [
      hitsCat ? '' : 'to-dog',
      isBlock ? 'block-number' : '',
      `dmg-${damageTier(event)}`,
    ].filter(Boolean).join(' '),
    fanX,
    driftX: Math.round(driftSide * (4 + random() * 10)),
    tiltDeg: Math.round((random() * 2 - 1) * 9),
    blocked,
  };
}
