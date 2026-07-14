import { COLS, ROWS } from './game-engine.js';

export const COMBAT_TIMING = Object.freeze({
  projectileMs: 820,
  // Orange tabby burst pellets now travel at half their prior speed so each pellet reads.
  burstProjectileMs: 1040,
  // White-cat homing shot is only modestly slower so its sine-seek stays fluid.
  homingMs: 1650,
  shotStaggerMs: 130,
  // Rapid successive pellets within one orange-cat volley.
  burstStaggerMs: 90,
  impactMs: 340,
  hpPauseMs: 300,
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
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const x = start.xPercent + (end.xPercent - start.xPercent) * t;
    const flat = start.yPercent + (end.yPercent - start.yPercent) * t;
    // Up the board is negative, so subtracting the hump lifts the bomb.
    const y = flat - Math.sin(Math.PI * t) * arcPercent;
    // Grows slightly as it comes down at the board — it is coming toward the viewer.
    const scale = 0.78 + Math.sin(Math.PI * t) * 0.3 + t * 0.16;
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
