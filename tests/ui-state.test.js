import test from 'node:test';
import assert from 'node:assert/strict';

import { selectionAfterPurchase } from '../src/ui-state.js';
import { CAT_EQUIPMENT } from '../src/pixel-art.js';
import { COMBAT_TIMING, homingShotKeyframes } from '../src/combat-animation.js';

test('a successful shop purchase clears selection instead of silently selecting the new cat', () => {
  const priorSelection = { type: 'cat', id: 'cat-on-board' };

  const selection = selectionAfterPurchase(priorSelection, true);

  assert.equal(selection, null);
});

test('failed shop purchases preserve the current explicit selection', () => {
  const priorSelection = { type: 'cat', id: 'cat-on-board' };

  const selection = selectionAfterPurchase(priorSelection, false);

  assert.deepEqual(selection, priorSelection);
});

test('combat timing leaves enough time to read travel, impact, and HP loss', () => {
  assert.ok(COMBAT_TIMING.projectileMs >= 700);
  assert.ok(COMBAT_TIMING.impactMs >= 300);
  assert.ok(COMBAT_TIMING.hpPauseMs >= 250);
});

test('level two and three cats have progressively stronger visible equipment sets', () => {
  assert.ok(CAT_EQUIPMENT[2].length >= 3, 'Level 2 needs several obvious armor pieces');
  assert.ok(CAT_EQUIPMENT[3].length > CAT_EQUIPMENT[2].length, 'Level 3 needs more equipment than Level 2');
  assert.ok(CAT_EQUIPMENT[3].includes('power-cannon'));
  assert.ok(CAT_EQUIPMENT[3].includes('energy-wings'));
});

test('homing shot path uses a sine wave while ending on the target', () => {
  const start = { xPercent: 10, yPercent: 80 };
  const end = { xPercent: 70, yPercent: 20 };
  const frames = homingShotKeyframes(start, end, { steps: 20, waves: 2, amplitude: 5 });

  assert.ok(frames.length >= 12);
  const first = frames[0];
  const mid = frames[Math.floor(frames.length / 2)];
  const last = frames[frames.length - 1];

  assert.match(first.left, /^10(\.0+)?%$/);
  assert.match(first.top, /^80(\.0+)?%$/);
  assert.match(last.left, /^70(\.0+)?%$/);
  assert.match(last.top, /^20(\.0+)?%$/);

  // Some mid-flight frame should leave the straight line (sine offset).
  let maxOff = 0;
  for (const frame of frames.slice(1, -1)) {
    const x = Number(frame.left.replace('%', ''));
    const y = Number(frame.top.replace('%', ''));
    const u = frames.indexOf(frame) / (frames.length - 1);
    const t = u * u * (3 - 2 * u);
    const straightX = start.xPercent + (end.xPercent - start.xPercent) * t;
    const straightY = start.yPercent + (end.yPercent - start.yPercent) * t;
    maxOff = Math.max(maxOff, Math.hypot(x - straightX, y - straightY));
  }
  assert.ok(maxOff > 1.2, `expected a sine offset off the line, maxOff=${maxOff}`);
});

test('homing shots are slower than normal projectiles so the seek reads', () => {
  assert.ok(COMBAT_TIMING.homingMs > COMBAT_TIMING.projectileMs);
  assert.ok(COMBAT_TIMING.homingMs >= 1200);
});

test('sound helpers no-op safely without a browser audio context', async () => {
  const sound = await import('../src/sound.js');
  assert.equal(typeof sound.playCatDrop, 'function');
  assert.equal(typeof sound.playHit, 'function');
  assert.doesNotThrow(() => sound.playCatDrop());
  assert.doesNotThrow(() => sound.playHit());
  assert.doesNotThrow(() => sound.playHit({ heavy: true }));
  assert.doesNotThrow(() => sound.unlockAudio());
});

test('sound setting can be toggled and remembered', async () => {
  const memory = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => (memory.has(key) ? memory.get(key) : null),
      setItem: (key, value) => { memory.set(key, String(value)); },
    },
    AudioContext: undefined,
    webkitAudioContext: undefined,
    setTimeout: () => 0,
  };

  const sound = await import(`../src/sound.js?settings=${Date.now()}`);
  sound.setSoundEnabled(false);
  assert.equal(sound.isSoundEnabled(), false);
  assert.equal(memory.get(sound.SOUND_SETTING_KEY), '0');
  assert.doesNotThrow(() => sound.playCatDrop());
  assert.doesNotThrow(() => sound.playHit());

  sound.setSoundEnabled(true);
  assert.equal(sound.isSoundEnabled(), true);
  assert.equal(memory.get(sound.SOUND_SETTING_KEY), '1');
  assert.equal(sound.loadSoundEnabled(), true);

  delete globalThis.window;
});
