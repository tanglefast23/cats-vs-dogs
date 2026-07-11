// Tiny synthesized SFX via Web Audio — no external assets required.
import { DROP_IMPACT } from './drag-drop.js';

export const SOUND_SETTING_KEY = 'cvd-sound-enabled';

let audioCtx = null;
let unlocked = false;
let soundEnabled = true;

function getWindow() {
  return typeof globalThis !== 'undefined' && globalThis.window ? globalThis.window : null;
}

function getStorage() {
  const win = getWindow();
  try {
    return win?.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadSoundEnabled() {
  const storage = getStorage();
  if (!storage) return soundEnabled;
  const raw = storage.getItem(SOUND_SETTING_KEY);
  if (raw === null) return true;
  soundEnabled = raw !== '0' && raw !== 'false';
  return soundEnabled;
}

export function isSoundEnabled() {
  return soundEnabled;
}

export function setSoundEnabled(enabled) {
  soundEnabled = Boolean(enabled);
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(SOUND_SETTING_KEY, soundEnabled ? '1' : '0');
    } catch {
      // Private mode / quota — keep in-memory only.
    }
  }
  if (soundEnabled) unlockAudio();
  return soundEnabled;
}

function context() {
  const win = getWindow();
  if (!win) return null;
  const AC = win.AudioContext || win.webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  return audioCtx;
}

/** Call from a user gesture so browsers allow sound. */
export function unlockAudio() {
  const ctx = context();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    void ctx.resume().then(() => { unlocked = true; }).catch(() => {});
  } else {
    unlocked = true;
  }
}

function tone({
  frequency = 440,
  duration = 0.12,
  type = 'square',
  volume = 0.08,
  slideTo = null,
  attack = 0.005,
  decay = 0.08,
} = {}) {
  if (!soundEnabled) return;
  const ctx = context();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, now);
  if (slideTo != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
  }

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(attack + 0.01, duration - decay));

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function noiseBurst({ duration = 0.08, volume = 0.05, filterFreq = 1200 } = {}) {
  if (!soundEnabled) return;
  const ctx = context();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});

  const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;
  const gain = ctx.createGain();
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start(now);
  source.stop(now + duration + 0.02);
}

function later(ms, fn) {
  const win = getWindow();
  if (!win) return;
  win.setTimeout(fn, ms);
}

/** Soft “plop” when a cat is placed or moved onto the board. */
export function playCatDrop() {
  if (!soundEnabled) return;
  tone({ frequency: 320, slideTo: 180, duration: 0.11, type: 'triangle', volume: 0.07 * DROP_IMPACT.soundGain, attack: 0.004, decay: 0.06 });
  later(25, () => {
    if (!soundEnabled) return;
    tone({ frequency: 220, slideTo: 140, duration: 0.08, type: 'sine', volume: 0.045 * DROP_IMPACT.soundGain });
  });
  noiseBurst({ duration: 0.05, volume: 0.03 * DROP_IMPACT.soundGain, filterFreq: 700 });
}

/** Sharp hit when a shot or melee lands. */
export function playHit({ heavy = false } = {}) {
  if (!soundEnabled) return;
  if (heavy) {
    tone({ frequency: 180, slideTo: 70, duration: 0.12, type: 'square', volume: 0.06 });
    noiseBurst({ duration: 0.09, volume: 0.055, filterFreq: 900 });
    return;
  }
  tone({ frequency: 680, slideTo: 240, duration: 0.09, type: 'square', volume: 0.055, attack: 0.002, decay: 0.05 });
  noiseBurst({ duration: 0.05, volume: 0.04, filterFreq: 1800 });
}

export function isAudioUnlocked() {
  return unlocked && Boolean(audioCtx) && audioCtx.state === 'running';
}

// Initialize from storage once this module loads in the browser.
loadSoundEnabled();
