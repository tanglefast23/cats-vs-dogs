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
});

export function cellCenter(row, col) {
  return {
    xPercent: ((col + 0.5) / COLS) * 100,
    yPercent: ((row + 0.5) / ROWS) * 100,
  };
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
