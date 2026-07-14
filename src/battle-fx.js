import { COLS } from './game-engine.js';

/**
 * The graphics registry for every attack in the game, and for the mark each attack
 * leaves on whatever it hits.
 *
 * The engine speaks in damage events — one per victim. Graphics have to speak in
 * attacks — one bomb, one blast, several victims. Rendering an event per projectile is
 * what turned Bombay Boom's explosion into a few pellets squirting sideways. So the
 * renderer groups events into attacks (attackGroupKey), looks the attack up here, and
 * draws it once.
 */

/** Every style the engine can stamp on a damage event. Guarded by a test. */
export const ENGINE_ATTACK_STYLES = Object.freeze([
  // Cats
  'column', 'melee', 'homing', 'tangle', 'splash', 'splash-secondary',
  'piercing', 'encore', 'lightning',
  // The five homing cats that split off their own skins
  'frost', 'rift', 'mirage', 'spark', 'note',
  // Dogs
  'bite', 'tennis', 'frisbee', 'bone-bomb', 'bone-bomb-secondary',
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
 * heavy      — bigger shake, deeper sound.
 */
export const ATTACK_FX = Object.freeze({
  // ---- Cats ----------------------------------------------------------------
  // Purrcy Pew-Pew: three rapid pellets that split his damage.
  column: {
    projectile: 'pellet', path: 'straight', muzzle: 'gunsmoke', impact: 'spark', heavy: false,
  },
  // Clawdius: the claw flurry, already choreographed in melee-animation.js.
  melee: {
    projectile: null, path: 'melee', muzzle: null, impact: 'rake', heavy: true,
  },
  // Hissiletoe and the five specialists below it.
  homing: {
    projectile: 'homing', path: 'homing', muzzle: null, impact: 'thump', heavy: false,
  },
  frost: {
    projectile: 'frost-shard', path: 'homing', muzzle: 'frost-puff', impact: 'frost', heavy: false,
  },
  rift: {
    projectile: 'rift-mote', path: 'homing', muzzle: 'rift-ring', impact: 'warp', heavy: false,
  },
  mirage: {
    projectile: 'mirage-card', path: 'homing', muzzle: 'card-fan', impact: 'slice', heavy: false,
  },
  spark: {
    projectile: 'static-spark', path: 'homing', muzzle: 'static-pop', impact: 'zap', heavy: false,
  },
  note: {
    projectile: 'music-note', path: 'homing', muzzle: null, impact: 'chime', heavy: false,
  },
  // Knotty Kitty: yarn that trails a string and leaves the dog tethered.
  tangle: {
    projectile: 'yarn', path: 'homing', muzzle: null, impact: 'wrap', tether: true, heavy: false,
  },
  // Bombay Boom: a lobbed bomb that explodes across three squares.
  splash: {
    projectile: 'bomb', path: 'lob', muzzle: 'fuse-spark',
    impact: 'scorch', blast: 'row-neighbours', heavy: true,
  },
  // Dogs beside the target. Caught in the blast above — never their own projectile.
  'splash-secondary': {
    projectile: null, path: null, muzzle: null,
    impact: 'scorch', absorbedBy: 'splash', heavy: false,
  },
  // Laserpaw: one beam through up to three dogs, not three separate shots.
  piercing: {
    projectile: null, path: 'beam', muzzle: 'prism-charge', impact: 'burn', heavy: true,
  },
  // Meowstro's commanded attack.
  encore: {
    projectile: 'music-note', path: 'homing', muzzle: 'baton-flourish', impact: 'chime', heavy: false,
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
 * parent (splash-secondary → splash), which is what stops the sideways-pellets bug.
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

/** Unit vector from the attacker to the victim: which way the victim gets thrown. */
export function contactVector(fromRow, fromCol, toRow, toCol) {
  const dx = toCol - fromCol;
  const dy = toRow - fromRow;
  const length = Math.hypot(dx, dy);
  if (!length) return { dx: 0, dy: 1 };
  return { dx: dx / length, dy: dy / length };
}

/** A death is simply the blow that took a living unit to zero. */
export function isKill(event) {
  if (!event || event.miss || !event.to) return false;
  return event.hpAfter === 0 && event.hpBefore > 0;
}
