import { COLS, ROWS } from './game-engine.js';

export const COMBAT_TIMING = Object.freeze({
  projectileMs: 820,
  // Orange tabby burst pellets now travel at half their prior speed so each pellet reads.
  burstProjectileMs: 1040,
  // White-cat homing shot is only modestly slower so its sine-seek stays fluid.
  homingMs: 1650,
  // Knotty's yarn is visibly thrown: slower than a pellet, quicker than a guided shot.
  yarnThrowMs: 1100,
  shotStaggerMs: 130,
  // Rapid successive pellets within one orange-cat volley.
  burstStaggerMs: 90,
  impactMs: 340,
  hpPauseMs: 300,
  // A floating damage number: pop in with overshoot, drift upward, fade out.
  damageNumberMs: 950,
  meleeMs: 430,
  movePauseMs: 260,
  stormChargeMs: 380,
  stormFlashLeadMs: 130,
  stormAftermathMs: 620,
  // A lobbed bomb hangs in the air — you should have time to see where it will land.
  lobMs: 900,
  // The explosion itself: fireball, shockwave, and the scorch it leaves behind.
  blastMs: 520,
  // Laserpaw's beam snaps on, holds while it bores through the line, then cuts out.
  beamChargeMs: 240,
  beamHoldMs: 380,
  // Gap between a beam reaching each successive dog it pierces.
  pierceStaggerMs: 90,
});

export const TANGLE_BIND_TIMING = Object.freeze({
  holdExtensionMs: 5000,
  fadeMs: 2000,
});

/** Scaled copy of COMBAT_TIMING for the speed toggle; the tuned table itself never changes. */
export function combatTiming(speed = 1) {
  const factor = speed > 0 ? speed : 1;
  return Object.fromEntries(
    Object.entries(COMBAT_TIMING).map(([key, ms]) => [key, Math.round(ms / factor)]),
  );
}

export function cellCenter(row, col) {
  return {
    xPercent: ((col + 0.5) / COLS) * 100,
    yPercent: ((row + 0.5) / ROWS) * 100,
  };
}

function projectileDistance(event) {
  const fromCol = event.fromCol ?? event.col;
  return Math.hypot(
    (event.toRow - event.fromRow) / ROWS,
    (event.col - fromCol) / COLS,
  );
}

/**
 * Launch timing that keeps leftover burst pellets from overtaking pellets that hit.
 *
 * A miss sails to the far edge of the board. Giving that longer path the same duration
 * as a shorter hit makes it move faster and cross the victim before the killing pellet
 * arrives. Delay only the leftover misses by the minimum needed for every earlier hit to
 * land first; their normal flight duration and rapid spacing stay unchanged.
 */
export function burstProjectileDelay(event, volley, baseDurationMs, staggerMs) {
  const eventIndex = volley.indexOf(event);
  const naturalDelay = (event?.pelletIndex ?? Math.max(0, eventIndex)) * staggerMs;
  if (!event?.burst || !event.miss || eventIndex <= 0) return naturalDelay;

  const priorHits = volley
    .slice(0, eventIndex)
    .map((candidate, index) => ({ candidate, index, distance: projectileDistance(candidate) }))
    .filter(({ candidate, distance }) => candidate.burst && !candidate.miss && candidate.to && distance > 0);
  if (!priorHits.length) return naturalDelay;

  const missDistance = projectileDistance(event);
  if (missDistance <= 0) return naturalDelay;

  const firstMissIndex = volley.findIndex((candidate) => candidate.burst && candidate.miss);
  const firstMissNaturalDelay = (volley[firstMissIndex]?.pelletIndex ?? firstMissIndex) * staggerMs;
  const firstMissDelay = priorHits.reduce((delay, { candidate, index, distance }) => {
    const hitDelay = (candidate.pelletIndex ?? index) * staggerMs;
    const missTimeToHitRow = baseDurationMs * Math.min(1, distance / missDistance);
    // One full pellet beat leaves visible clearance for the impact frame itself; a
    // one-millisecond mathematical lead can still render in the previous browser frame.
    return Math.max(delay, hitDelay + baseDurationMs - missTimeToHitRow + staggerMs);
  }, firstMissNaturalDelay);
  const earlierMisses = volley
    .slice(firstMissIndex, eventIndex)
    .filter((candidate) => candidate.burst && candidate.miss)
    .length;
  return Math.ceil(Math.max(naturalDelay, firstMissDelay + earlierMisses * staggerMs));
}

/** Percentage geometry for an effect that must cover exactly one battlefield column. */
export function stormColumnPosition(col, cols = COLS) {
  const widthPercent = 100 / cols;
  return {
    leftPercent: col * widthPercent,
    centerPercent: (col + 0.5) * widthPercent,
    widthPercent,
  };
}

/**
 * The arc of a thrown bomb — Bombay Boom's satchel charge and Bone Jovi's mortar shell.
 * A bomb is lobbed, not fired: it rises, hangs, and drops onto the square, tumbling all
 * the way. The lift is a sine hump, so it is zero at the throw and zero again on landing.
 */
export function lobShotKeyframes(start, end, { steps = 26, arcPercent = 13, spin = 540 } = {}) {
  const frames = [];
  // Most bombs travel within one vertical lane. A pure vertical height hump changes the
  // timing but still draws a straight line, so bow the flight sideways toward board
  // centre as well. It starts and ends exactly on the units, but reads as a real curve.
  const curveDirection = start.xPercent > 50 ? -1 : 1;
  const sidePercent = arcPercent * 0.5;
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const hump = Math.sin(Math.PI * t);
    const x = start.xPercent + (end.xPercent - start.xPercent) * t
      + hump * sidePercent * curveDirection;
    const flat = start.yPercent + (end.yPercent - start.yPercent) * t;
    // Up the board is negative, so subtracting the hump lifts the bomb.
    const y = flat - hump * arcPercent;
    // Grows slightly as it comes down at the board — it is coming toward the viewer.
    const scale = 0.78 + hump * 0.3 + t * 0.16;
    frames.push({
      left: `${x}%`,
      top: `${y}%`,
      transform: `translate(-50%, -50%) rotate(${t * spin}deg) scale(${scale})`,
    });
  }
  return frames;
}

/**
 * Mild sine-wave path that still homes toward the target.
 * Progress eases in (slow seek early), lateral wave damps near impact.
 */
export function homingShotKeyframes(start, end, {
  steps = 30,
  waves = 2.2,
  amplitude = 4.8,
} = {}) {
  const frames = [];
  const dx = end.xPercent - start.xPercent;
  const dy = end.yPercent - start.yPercent;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;

  for (let step = 0; step <= steps; step += 1) {
    const u = step / steps;
    // Slow early seek, then commit into the dog.
    const t = u * u * (3 - 2 * u);
    // Sine side-to-side, strongest mid-flight, quiet at launch and hit.
    const envelope = Math.sin(Math.PI * u);
    const wave = Math.sin(u * Math.PI * 2 * waves) * amplitude * envelope;
    const x = start.xPercent + dx * t + nx * wave;
    const y = start.yPercent + dy * t + ny * wave;

    // Face roughly along the path tangent for a guided-missile feel.
    const nextU = Math.min(1, (step + 1) / steps);
    const nextT = nextU * nextU * (3 - 2 * nextU);
    const nextEnvelope = Math.sin(Math.PI * nextU);
    const nextWave = Math.sin(nextU * Math.PI * 2 * waves) * amplitude * nextEnvelope;
    const nextX = start.xPercent + dx * nextT + nx * nextWave;
    const nextY = start.yPercent + dy * nextT + ny * nextWave;
    const angle = (Math.atan2(nextY - y, nextX - x) * 180) / Math.PI + 90;
    const scale = 0.78 + t * 0.34;

    frames.push({
      left: `${x}%`,
      top: `${y}%`,
      transform: `translate(-50%, -50%) scale(${scale}) rotate(${angle}deg)`,
    });
  }
  return frames;
}

/**
 * Knotty Kitty throws a real ball of yarn rather than firing another guided missile.
 * The ball follows one clean parabolic toss with a tiny sideways hand-thrown wobble;
 * the yarn texture itself spins in CSS so the loose strand can keep trailing behind it.
 */
export function yarnThrowKeyframes(start, end, {
  steps = 26,
  arcPercent = 8,
  wobblePercent = 1.15,
} = {}) {
  const frames = [];
  const dx = end.xPercent - start.xPercent;
  const dy = end.yPercent - start.yPercent;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;

  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const lift = Math.sin(Math.PI * t) * arcPercent;
    const wobble = Math.sin(Math.PI * t * 3) * Math.sin(Math.PI * t) * wobblePercent;
    const x = start.xPercent + dx * t + nx * wobble;
    const y = start.yPercent + dy * t + ny * wobble - lift;
    const scale = 0.72 + Math.sin(Math.PI * t) * 0.36 + t * 0.16;

    frames.push({
      left: `${x}%`,
      top: `${y}%`,
      transform: `translate(-50%, -50%) scale(${scale})`,
    });
  }
  return frames;
}
