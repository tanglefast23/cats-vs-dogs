// Tiny synthesized SFX via Web Audio — no external assets required.
import { DROP_IMPACT } from './drag-drop.js';

export const SOUND_SETTING_KEY = 'cvd-sound-enabled';
export const MUSIC_OWNER_KEY = 'cvd-music-owner';
export const LEVEL_MUSIC_URL = new URL('./assets/audio/backyard-bounce.wav', import.meta.url).href;
export const LEVEL_MUSIC_VOLUME = 0.18;
export const UI_CLICK_VOLUME = 0.024;

let audioCtx = null;
let unlocked = false;
let soundEnabled = true;
let levelMusic = null;
let levelMusicRequested = false;
let ownsMusic = false;

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

function createMusicOwnerId() {
  const win = getWindow();
  try {
    const id = win?.crypto?.randomUUID?.();
    if (id) return id;
  } catch {
    // A random per-page fallback is enough to distinguish competing tabs.
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const musicOwnerId = createMusicOwnerId();

function isAutomatedBrowser() {
  return getWindow()?.navigator?.webdriver === true;
}

function isPageVisible() {
  const doc = getWindow()?.document;
  if (!doc) return true;
  if (doc.visibilityState === 'hidden' || doc.hidden === true) return false;
  return typeof doc.hasFocus !== 'function' || doc.hasFocus();
}

function canUseAudioOutput() {
  return soundEnabled && !isAutomatedBrowser() && isPageVisible();
}

function pauseLevelMusic() {
  if (levelMusic) levelMusic.pause();
}

function claimMusicOwnership() {
  if (!canUseAudioOutput()) return false;
  const storage = getStorage();
  if (!storage) {
    ownsMusic = true;
    return true;
  }
  try {
    storage.setItem(MUSIC_OWNER_KEY, musicOwnerId);
    ownsMusic = storage.getItem(MUSIC_OWNER_KEY) === musicOwnerId;
  } catch {
    // Private mode / quota — page visibility still prevents hidden audio.
    ownsMusic = true;
  }
  return ownsMusic;
}

function releaseMusicOwnership() {
  if (!ownsMusic) return;
  ownsMusic = false;
  const storage = getStorage();
  if (!storage) return;
  try {
    if (storage.getItem(MUSIC_OWNER_KEY) === musicOwnerId) {
      storage.removeItem(MUSIC_OWNER_KEY);
    }
  } catch {
    // Ownership is already released in memory.
  }
}

function onMusicOwnershipChange(event) {
  if (event?.key !== MUSIC_OWNER_KEY || event.newValue === musicOwnerId) return;
  ownsMusic = false;
  pauseLevelMusic();
  if (event.newValue === null && levelMusicRequested && canUseAudioOutput()) {
    startLevelMusic();
  }
}

function onAudioVisibilityChange() {
  if (!isPageVisible()) {
    releaseMusicOwnership();
    pauseLevelMusic();
    return;
  }
  if (levelMusicRequested) startLevelMusic();
}

function onPageHide() {
  releaseMusicOwnership();
  pauseLevelMusic();
}

function bindAudioFocusListeners() {
  const win = getWindow();
  win?.addEventListener?.('storage', onMusicOwnershipChange);
  win?.addEventListener?.('focus', onAudioVisibilityChange);
  win?.addEventListener?.('blur', onPageHide);
  win?.addEventListener?.('pagehide', onPageHide);
  win?.document?.addEventListener?.('visibilitychange', onAudioVisibilityChange);
}

function unbindAudioFocusListeners() {
  const win = getWindow();
  win?.removeEventListener?.('storage', onMusicOwnershipChange);
  win?.removeEventListener?.('focus', onAudioVisibilityChange);
  win?.removeEventListener?.('blur', onPageHide);
  win?.removeEventListener?.('pagehide', onPageHide);
  win?.document?.removeEventListener?.('visibilitychange', onAudioVisibilityChange);
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
  if (soundEnabled) {
    unlockAudio();
    if (levelMusicRequested) startLevelMusic();
  } else {
    releaseMusicOwnership();
    pauseLevelMusic();
  }
  return soundEnabled;
}

function musicPlayer() {
  const win = getWindow();
  if (levelMusic) return levelMusic;
  if (typeof win?.Audio !== 'function') return null;
  levelMusic = new win.Audio(LEVEL_MUSIC_URL);
  levelMusic.loop = true;
  levelMusic.preload = 'auto';
  levelMusic.volume = LEVEL_MUSIC_VOLUME;
  return levelMusic;
}

/** Start the original Level 1 loop after a user gesture permits playback. */
export function startLevelMusic() {
  levelMusicRequested = true;
  if (!claimMusicOwnership()) return false;
  const player = musicPlayer();
  if (!player) {
    releaseMusicOwnership();
    return false;
  }
  const playback = player.play();
  if (playback?.catch) void playback.catch(() => {});
  return true;
}

/** Stop the level loop at victory/game over and rewind it for the next run. */
export function stopLevelMusic() {
  levelMusicRequested = false;
  releaseMusicOwnership();
  if (!levelMusic) return;
  pauseLevelMusic();
  try {
    levelMusic.currentTime = 0;
  } catch {
    // Some browsers reject seeks before metadata is loaded; pausing is enough.
  }
}

function context() {
  const win = getWindow();
  if (!win || !canUseAudioOutput()) return null;
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

/** Short, restrained UI tick. Quieter than placement, collection, and combat SFX. */
export function playUiClick() {
  if (!soundEnabled) return;
  tone({ frequency: 620, slideTo: 430, duration: 0.055, type: 'square', volume: UI_CLICK_VOLUME, attack: 0.001, decay: 0.034 });
  tone({ frequency: 1180, duration: 0.022, type: 'sine', volume: UI_CLICK_VOLUME * 0.42, attack: 0.001, decay: 0.014 });
}

/** Crisp two-stage mechanical click for an accepted shop refresh. */
export function playRefreshClick() {
  if (!soundEnabled) return;
  tone({ frequency: 480, slideTo: 240, duration: 0.055, type: 'square', volume: 0.04, attack: 0.001, decay: 0.032 });
  noiseBurst({ duration: 0.028, volume: 0.022, filterFreq: 2300 });
  later(38, () => {
    if (!soundEnabled) return;
    tone({ frequency: 820, slideTo: 1040, duration: 0.045, type: 'triangle', volume: 0.026, attack: 0.001, decay: 0.025 });
  });
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

/** Bright two-stage pickup chime for production output collection. */
export function playCollection(kind = 'item') {
  if (!soundEnabled) return;
  const coin = kind === 'coins';
  tone({ frequency: coin ? 740 : 520, slideTo: coin ? 1040 : 720, duration: 0.11, type: 'square', volume: 0.055, attack: 0.002, decay: 0.045 });
  later(85, () => {
    if (!soundEnabled) return;
    tone({ frequency: coin ? 1180 : 880, slideTo: coin ? 1540 : 1120, duration: 0.16, type: 'triangle', volume: 0.065, attack: 0.003, decay: 0.07 });
  });
  later(170, () => {
    if (!soundEnabled) return;
    tone({ frequency: coin ? 1580 : 1320, duration: 0.12, type: 'sine', volume: 0.045, attack: 0.002, decay: 0.06 });
  });
}

/** Crunchy bite when a cat eats a food treat. */
export function playFoodUse() {
  if (!soundEnabled) return;
  noiseBurst({ duration: 0.06, volume: 0.05, filterFreq: 2600 });
  tone({ frequency: 240, slideTo: 150, duration: 0.07, type: 'triangle', volume: 0.04 });
  later(150, () => {
    if (!soundEnabled) return;
    noiseBurst({ duration: 0.05, volume: 0.04, filterFreq: 2200 });
    tone({ frequency: 200, slideTo: 130, duration: 0.06, type: 'triangle', volume: 0.035 });
  });
  later(320, () => {
    if (!soundEnabled) return;
    tone({ frequency: 320, slideTo: 560, duration: 0.1, type: 'sine', volume: 0.04 });
  });
}

/** A couple of metallic swings, then a slam, when a cat equips a weapon. */
export function playWeaponUse() {
  if (!soundEnabled) return;
  const swing = (freq) => {
    tone({ frequency: freq, slideTo: freq * 2.4, duration: 0.06, type: 'square', volume: 0.03 });
    noiseBurst({ duration: 0.04, volume: 0.02, filterFreq: 5000 });
  };
  swing(620);
  later(160, () => { if (soundEnabled) swing(760); });
  later(340, () => {
    if (!soundEnabled) return;
    tone({ frequency: 940, slideTo: 300, duration: 0.12, type: 'square', volume: 0.06 });
    noiseBurst({ duration: 0.1, volume: 0.06, filterFreq: 2200 });
  });
}

/** Heavy thunk when a cat dons armour. */
export function playArmourUse() {
  if (!soundEnabled) return;
  tone({ frequency: 170, slideTo: 60, duration: 0.16, type: 'square', volume: 0.07 });
  noiseBurst({ duration: 0.12, volume: 0.06, filterFreq: 700 });
  later(90, () => {
    if (!soundEnabled) return;
    tone({ frequency: 95, slideTo: 55, duration: 0.14, type: 'sine', volume: 0.05 });
  });
}

/** Route a used production item to its sound. */
export function playItemUse(kind) {
  if (kind === 'weapon') playWeaponUse();
  else if (kind === 'armour') playArmourUse();
  else playFoodUse();
}

/** Happy little fanfare when dogs break through and celebrate. */
export function playCelebration() {
  if (!soundEnabled) return;
  const notes = [523, 659, 784, 1047]; // C-E-G-C major arpeggio
  notes.forEach((freq, i) => later(i * 95, () => {
    if (!soundEnabled) return;
    tone({ frequency: freq, duration: 0.16, type: 'triangle', volume: 0.06, attack: 0.003, decay: 0.08 });
  }));
  later(440, () => {
    if (!soundEnabled) return;
    tone({ frequency: 1047, slideTo: 1319, duration: 0.24, type: 'sine', volume: 0.05 });
  });
}

export function isAudioUnlocked() {
  return unlocked && Boolean(audioCtx) && audioCtx.state === 'running';
}

// Initialize from storage once this module loads in the browser.
loadSoundEnabled();
bindAudioFocusListeners();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    releaseMusicOwnership();
    pauseLevelMusic();
    unbindAudioFocusListeners();
  });
}
