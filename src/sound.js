// Tiny synthesized SFX via Web Audio — no external assets required.
import { DROP_IMPACT } from './drag-drop.js';

export const SOUND_SETTING_KEY = 'cvd-sound-enabled';
export const SOUND_VOLUME_SETTING_KEY = 'cvd-sound-volume';
export const MUSIC_VOLUME_SETTING_KEY = 'cvd-music-volume';
export const MUSIC_OWNER_KEY = 'cvd-music-owner';
// Stream the full three-minute arrangement so phase changes never sound like
// they restart the song. HTMLAudio loops it only after the whole track plays.
export const LEVEL_MUSIC_URL = new URL('./assets/audio/backyard-bounce-loop.mp3', import.meta.url).href;
export const LEVEL_MUSIC_DURATION_SECONDS = 180;
export const DEFAULT_VOLUME = 50;
export const SOUND_OUTPUT_CAP = 0.8;
export const MUSIC_OUTPUT_CAP = 0.4;
export const LEVEL_MUSIC_VOLUME = MUSIC_OUTPUT_CAP;
export const UI_CLICK_VOLUME = 0.024;
/** Master gain applied to every synthesized SFX (music is untouched) — recipes keep
 * their relative balance while the whole effects layer sits louder in the mix. */
export const SFX_GAIN = 2;

let audioCtx = null;
let unlocked = false;
let soundVolume = DEFAULT_VOLUME;
let musicVolume = DEFAULT_VOLUME;
let soundEnabled = soundVolume > 0;
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

function normalizeVolume(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_VOLUME;
  return Math.min(100, Math.max(0, Math.round(numeric)));
}

function soundOutputGain(recipeVolume) {
  // SFX_GAIN doubles every recipe at the DEFAULT slider position — the loudness the
  // 2x-louder request settled on — and the slider scales around that. SOUND_OUTPUT_CAP
  // stays as the absolute ceiling so cranked sliders can't clip.
  return Math.min(SOUND_OUTPUT_CAP, Math.max(0.0001, recipeVolume * SFX_GAIN * (soundVolume / DEFAULT_VOLUME)));
}

function musicOutputGain() {
  return MUSIC_OUTPUT_CAP * (musicVolume / 100);
}

// Only the tab-level visibility signal — embedded webviews (e.g. app preview panes)
// report hasFocus() false and even visibilityState "hidden" while fully on screen,
// so focus must never gate audio.
function isPageHidden() {
  const doc = getWindow()?.document;
  return Boolean(doc && (doc.visibilityState === 'hidden' || doc.hidden === true));
}

function canUseSoundOutput() {
  return soundEnabled && !isAutomatedBrowser();
}

function canUseMusicOutput() {
  return musicVolume > 0 && !isAutomatedBrowser();
}

function pauseLevelMusic() {
  if (levelMusic) levelMusic.pause();
}

function claimMusicOwnership() {
  if (!canUseMusicOutput()) return false;
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
  if (event.newValue === null && levelMusicRequested && canUseMusicOutput()) {
    startLevelMusic();
  }
}

function onAudioVisibilityChange() {
  if (isPageHidden()) {
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

function bindAudioLifecycleListeners() {
  const win = getWindow();
  win?.addEventListener?.('storage', onMusicOwnershipChange);
  win?.addEventListener?.('pagehide', onPageHide);
  win?.document?.addEventListener?.('visibilitychange', onAudioVisibilityChange);
}

function unbindAudioLifecycleListeners() {
  const win = getWindow();
  win?.removeEventListener?.('storage', onMusicOwnershipChange);
  win?.removeEventListener?.('pagehide', onPageHide);
  win?.document?.removeEventListener?.('visibilitychange', onAudioVisibilityChange);
}

export function loadVolumeSettings() {
  const storage = getStorage();
  if (!storage) return { sound: soundVolume, music: musicVolume };

  let fallback = DEFAULT_VOLUME;
  try {
    const legacy = storage.getItem(SOUND_SETTING_KEY);
    if (legacy === '0' || legacy === 'false') fallback = 0;
    const storedSound = storage.getItem(SOUND_VOLUME_SETTING_KEY);
    const storedMusic = storage.getItem(MUSIC_VOLUME_SETTING_KEY);
    soundVolume = storedSound === null ? fallback : normalizeVolume(storedSound);
    musicVolume = storedMusic === null ? fallback : normalizeVolume(storedMusic);
  } catch {
    // Private mode / quota — retain the in-memory values.
  }

  soundEnabled = soundVolume > 0;
  if (levelMusic) levelMusic.volume = musicOutputGain();
  return { sound: soundVolume, music: musicVolume };
}

export function getSoundVolume() {
  return soundVolume;
}

export function getMusicVolume() {
  return musicVolume;
}

function storeVolume(key, value) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(key, String(value));
  } catch {
    // Private mode / quota — keep the in-memory value.
  }
}

export function setSoundVolume(value) {
  soundVolume = normalizeVolume(value);
  soundEnabled = soundVolume > 0;
  storeVolume(SOUND_VOLUME_SETTING_KEY, soundVolume);
  if (soundEnabled) unlockAudio();
  return soundVolume;
}

export function setMusicVolume(value) {
  const wasMuted = musicVolume === 0;
  musicVolume = normalizeVolume(value);
  storeVolume(MUSIC_VOLUME_SETTING_KEY, musicVolume);
  if (levelMusic) levelMusic.volume = musicOutputGain();

  if (musicVolume === 0) {
    releaseMusicOwnership();
    pauseLevelMusic();
  } else if (wasMuted && levelMusicRequested) {
    startLevelMusic();
  }
  return musicVolume;
}

// Compatibility for older callers and the former shared checkbox setting.
export function loadSoundEnabled() {
  loadVolumeSettings();
  return isSoundEnabled();
}

export function isSoundEnabled() {
  return soundVolume > 0 || musicVolume > 0;
}

export function setSoundEnabled(enabled) {
  const nextVolume = enabled ? DEFAULT_VOLUME : 0;
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(SOUND_SETTING_KEY, enabled ? '1' : '0');
    } catch {
      // Private mode / quota — keep in-memory only.
    }
  }
  setSoundVolume(nextVolume);
  setMusicVolume(nextVolume);
  return isSoundEnabled();
}

function musicPlayer() {
  const win = getWindow();
  if (levelMusic) return levelMusic;
  if (typeof win?.Audio !== 'function') return null;
  levelMusic = new win.Audio(LEVEL_MUSIC_URL);
  levelMusic.loop = true;
  levelMusic.preload = 'metadata';
  levelMusic.volume = musicOutputGain();
  return levelMusic;
}

/** Start the level soundtrack after a user gesture permits playback. */
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
  if (!win || !canUseSoundOutput()) return null;
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
  gain.gain.exponentialRampToValueAtTime(soundOutputGain(volume), now + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(attack + 0.01, duration - decay));

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function noiseBurst({ duration = 0.08, volume = 0.05, filterFreq = 1200, filterType = 'lowpass' } = {}) {
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
  filter.type = filterType;
  filter.frequency.value = filterFreq;
  const gain = ctx.createGain();
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(soundOutputGain(volume), now);
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

/** Quick downward coin clink whenever gold is successfully spent. */
export function playCoinSpend() {
  if (!soundEnabled) return;
  tone({ frequency: 1180, slideTo: 760, duration: 0.07, type: 'square', volume: 0.035, attack: 0.001, decay: 0.04 });
  later(42, () => {
    if (!soundEnabled) return;
    tone({ frequency: 820, slideTo: 520, duration: 0.09, type: 'triangle', volume: 0.032, attack: 0.001, decay: 0.05 });
  });
  noiseBurst({ duration: 0.025, volume: 0.015, filterFreq: 4200, filterType: 'highpass' });
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

/** Small pitch wobble so repeated hits never sound machine-stamped. */
function jitter(frequency) {
  return frequency * (0.93 + Math.random() * 0.14);
}

/**
 * One voice per impact kind in battle-fx's HURT_FX table, so what you hear matches what
 * hit you: teeth crunch, claws rake, frost rings, bombs boom, music-notes chime.
 * Guarded by a test — every impact the graphics can show must have a sound.
 */
export const IMPACT_SOUNDS = Object.freeze({
  // Teeth sink in: two low crunches.
  chomp: () => {
    tone({ frequency: jitter(210), slideTo: 80, duration: 0.11, type: 'square', volume: 0.06 });
    noiseBurst({ duration: 0.07, volume: 0.05, filterFreq: 950 });
    later(70, () => {
      if (!soundEnabled) return;
      tone({ frequency: jitter(150), slideTo: 60, duration: 0.09, type: 'square', volume: 0.05 });
      noiseBurst({ duration: 0.06, volume: 0.04, filterFreq: 700 });
    });
  },
  // Three fast claw swipes, each a shade lower.
  rake: () => {
    [0, 55, 110].forEach((delay, swipe) => later(delay, () => {
      if (!soundEnabled) return;
      noiseBurst({ duration: 0.045, volume: 0.042, filterFreq: 3400 - swipe * 500 });
      tone({ frequency: jitter(820 - swipe * 120), slideTo: 380, duration: 0.05, type: 'sawtooth', volume: 0.02 });
    }));
  },
  // A pellet pew.
  spark: () => {
    tone({ frequency: jitter(920), slideTo: 420, duration: 0.07, type: 'square', volume: 0.05, attack: 0.002, decay: 0.04 });
    noiseBurst({ duration: 0.035, volume: 0.03, filterFreq: 2400 });
  },
  // The plain body blow.
  thump: () => {
    tone({ frequency: jitter(460), slideTo: 190, duration: 0.09, type: 'square', volume: 0.055 });
    noiseBurst({ duration: 0.05, volume: 0.04, filterFreq: 1500 });
  },
  // Bombay Boom's fireball.
  scorch: () => {
    tone({ frequency: jitter(120), slideTo: 42, duration: 0.22, type: 'square', volume: 0.075 });
    noiseBurst({ duration: 0.16, volume: 0.07, filterFreq: 750 });
    later(60, () => { if (soundEnabled) noiseBurst({ duration: 0.12, volume: 0.045, filterFreq: 420 }); });
  },
  // Bone Jovi's mortar shell landing.
  thud: () => {
    tone({ frequency: jitter(150), slideTo: 55, duration: 0.16, type: 'square', volume: 0.07 });
    noiseBurst({ duration: 0.11, volume: 0.06, filterFreq: 600 });
  },
  // Laserpaw's beam boring through.
  burn: () => {
    tone({ frequency: jitter(680), slideTo: 260, duration: 0.14, type: 'sawtooth', volume: 0.035 });
    noiseBurst({ duration: 0.13, volume: 0.035, filterFreq: 4200 });
  },
  // An icy crystalline ring.
  frost: () => {
    tone({ frequency: jitter(1180), slideTo: 1560, duration: 0.1, type: 'sine', volume: 0.045, attack: 0.002, decay: 0.06 });
    noiseBurst({ duration: 0.04, volume: 0.02, filterFreq: 5200 });
    later(60, () => { if (soundEnabled) tone({ frequency: jitter(1680), duration: 0.09, type: 'triangle', volume: 0.03 }); });
  },
  // Static crack.
  zap: () => {
    tone({ frequency: jitter(1150), slideTo: 240, duration: 0.07, type: 'sawtooth', volume: 0.05, attack: 0.001, decay: 0.03 });
    noiseBurst({ duration: 0.05, volume: 0.045, filterFreq: 3600 });
    later(45, () => { if (soundEnabled) tone({ frequency: jitter(760), slideTo: 180, duration: 0.05, type: 'square', volume: 0.03 }); });
  },
  // Yarn cinching soft and snug.
  wrap: () => {
    tone({ frequency: jitter(340), slideTo: 210, duration: 0.09, type: 'triangle', volume: 0.04 });
    noiseBurst({ duration: 0.05, volume: 0.02, filterFreq: 900 });
  },
  // The hollow pok of a tennis ball.
  dent: () => {
    tone({ frequency: jitter(540), slideTo: 250, duration: 0.06, type: 'triangle', volume: 0.06, attack: 0.001, decay: 0.035 });
    noiseBurst({ duration: 0.03, volume: 0.025, filterFreq: 1300 });
  },
  // Frisbee or card whoosh, then the snick as it lands.
  slice: () => {
    noiseBurst({ duration: 0.06, volume: 0.04, filterFreq: 4800 });
    tone({ frequency: jitter(760), slideTo: 1180, duration: 0.06, type: 'square', volume: 0.028 });
    later(50, () => { if (soundEnabled) tone({ frequency: jitter(980), slideTo: 460, duration: 0.05, type: 'square', volume: 0.035 }); });
  },
  // A portal blip, up then folded back down.
  warp: () => {
    tone({ frequency: jitter(480), slideTo: 940, duration: 0.11, type: 'sine', volume: 0.045 });
    later(70, () => { if (soundEnabled) tone({ frequency: jitter(700), slideTo: 350, duration: 0.09, type: 'sine', volume: 0.03 }); });
  },
  // Meowstro's note lands as a small chord.
  chime: () => {
    tone({ frequency: jitter(880), duration: 0.12, type: 'triangle', volume: 0.05, attack: 0.002, decay: 0.07 });
    later(70, () => { if (soundEnabled) tone({ frequency: jitter(1320), duration: 0.1, type: 'sine', volume: 0.035 }); });
  },
});

/** The sound of one hit landing, matched to the attack's impact kind. */
export function playImpact(kind, { heavy = false } = {}) {
  if (!soundEnabled) return;
  const play = IMPACT_SOUNDS[kind];
  if (play) play();
  else playHit({ heavy });
}

/** Metallic ting when armour soaks part of a hit; a sad clatter follows when it breaks. */
export function playArmourBlock({ broken = false } = {}) {
  if (!soundEnabled) return;
  tone({ frequency: jitter(1240), slideTo: 880, duration: 0.09, type: 'triangle', volume: 0.05, attack: 0.001, decay: 0.05 });
  noiseBurst({ duration: 0.03, volume: 0.02, filterFreq: 5600 });
  if (!broken) return;
  later(90, () => {
    if (!soundEnabled) return;
    tone({ frequency: 620, slideTo: 140, duration: 0.16, type: 'square', volume: 0.05 });
    noiseBurst({ duration: 0.12, volume: 0.05, filterFreq: 1700 });
  });
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

/** Crisp apple-skin snap followed by two juicy chewing crunches. */
export function playAppleCrunch() {
  if (!soundEnabled) return;
  noiseBurst({ duration: 0.055, volume: 0.075, filterFreq: 3200, filterType: 'highpass' });
  noiseBurst({ duration: 0.1, volume: 0.065, filterFreq: 1700 });
  tone({ frequency: 290, slideTo: 105, duration: 0.1, type: 'square', volume: 0.055, attack: 0.001, decay: 0.06 });
  later(55, () => {
    if (!soundEnabled) return;
    noiseBurst({ duration: 0.045, volume: 0.06, filterFreq: 2700, filterType: 'highpass' });
  });
  later(150, () => {
    if (!soundEnabled) return;
    noiseBurst({ duration: 0.07, volume: 0.06, filterFreq: 2400, filterType: 'highpass' });
    noiseBurst({ duration: 0.09, volume: 0.05, filterFreq: 1200 });
    tone({ frequency: 210, slideTo: 115, duration: 0.08, type: 'triangle', volume: 0.045 });
  });
  later(285, () => {
    if (!soundEnabled) return;
    noiseBurst({ duration: 0.055, volume: 0.05, filterFreq: 2100, filterType: 'highpass' });
    tone({ frequency: 180, slideTo: 95, duration: 0.07, type: 'triangle', volume: 0.04 });
  });
}

// Compatibility for callers that still use the generic production-item name.
export const playFoodUse = playAppleCrunch;

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
  else playAppleCrunch();
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

/** Two quick rising notes when matching cats stack; a run up the octave plus a sparkle when they evolve. */
export function playMerge({ levelUp = false } = {}) {
  if (!soundEnabled) return;
  if (!levelUp) {
    tone({ frequency: 520, slideTo: 760, duration: 0.09, type: 'triangle', volume: 0.05, attack: 0.002, decay: 0.05 });
    later(70, () => {
      if (!soundEnabled) return;
      tone({ frequency: 780, slideTo: 1080, duration: 0.11, type: 'sine', volume: 0.045, attack: 0.002, decay: 0.06 });
    });
    return;
  }
  const run = [392, 523, 659, 784, 1047]; // G–C–E–G–C sprint up the octave
  run.forEach((freq, i) => later(i * 70, () => {
    if (!soundEnabled) return;
    tone({ frequency: freq, duration: 0.13, type: 'triangle', volume: 0.055, attack: 0.002, decay: 0.06 });
  }));
  later(run.length * 70 + 20, () => {
    if (!soundEnabled) return;
    tone({ frequency: 1568, duration: 0.22, type: 'sine', volume: 0.045, attack: 0.002, decay: 0.12 });
    noiseBurst({ duration: 0.08, volume: 0.02, filterFreq: 6400 });
  });
}

/** A small, wilting meow when a cat goes down. */
export function playCatDeath() {
  if (!soundEnabled) return;
  tone({ frequency: jitter(640), slideTo: 400, duration: 0.16, type: 'triangle', volume: 0.055, attack: 0.012, decay: 0.09 });
  later(130, () => {
    if (!soundEnabled) return;
    tone({ frequency: jitter(430), slideTo: 200, duration: 0.24, type: 'sine', volume: 0.05, attack: 0.01, decay: 0.15 });
  });
}

/** A startled yelp — sharp up, whining down — when a dog is knocked out. */
export function playDogDeath() {
  if (!soundEnabled) return;
  tone({ frequency: jitter(500), slideTo: 980, duration: 0.07, type: 'sawtooth', volume: 0.04, attack: 0.004, decay: 0.03 });
  later(65, () => {
    if (!soundEnabled) return;
    tone({ frequency: jitter(920), slideTo: 250, duration: 0.2, type: 'triangle', volume: 0.055, attack: 0.004, decay: 0.12 });
  });
}

/** Two low paw-thumps and a rising horn as the next wave walks in. */
export function playWaveStart() {
  if (!soundEnabled) return;
  tone({ frequency: 130, slideTo: 70, duration: 0.11, type: 'square', volume: 0.05 });
  noiseBurst({ duration: 0.07, volume: 0.035, filterFreq: 500 });
  later(150, () => {
    if (!soundEnabled) return;
    tone({ frequency: 130, slideTo: 70, duration: 0.11, type: 'square', volume: 0.055 });
    noiseBurst({ duration: 0.07, volume: 0.04, filterFreq: 500 });
  });
  later(330, () => {
    if (!soundEnabled) return;
    tone({ frequency: 220, slideTo: 330, duration: 0.24, type: 'square', volume: 0.035, attack: 0.01, decay: 0.14 });
  });
}

/** Bright three-note flourish when a battle round is cleared and prep returns. */
export function playRoundComplete() {
  if (!soundEnabled) return;
  const notes = [523, 659, 784];
  notes.forEach((freq, i) => later(i * 90, () => {
    if (!soundEnabled) return;
    tone({ frequency: freq, duration: 0.14, type: 'triangle', volume: 0.055, attack: 0.003, decay: 0.07 });
  }));
  later(300, () => {
    if (!soundEnabled) return;
    tone({ frequency: 1047, slideTo: 1319, duration: 0.18, type: 'sine', volume: 0.045, attack: 0.002, decay: 0.1 });
  });
}

/** The full victory fanfare when the level is won. */
export function playVictory() {
  if (!soundEnabled) return;
  const call = [523, 659, 784, 1047, 784, 1047];
  call.forEach((freq, i) => later(i * 110, () => {
    if (!soundEnabled) return;
    tone({ frequency: freq, duration: 0.18, type: 'triangle', volume: 0.06, attack: 0.003, decay: 0.09 });
  }));
  later(call.length * 110 + 40, () => {
    if (!soundEnabled) return;
    [1047, 1319, 1568].forEach((freq) => tone({ frequency: freq, duration: 0.42, type: 'sine', volume: 0.035, attack: 0.01, decay: 0.3 }));
    noiseBurst({ duration: 0.1, volume: 0.022, filterFreq: 6000 });
  });
}

/** Three sagging notes when the dogs win the yard. */
export function playDefeat() {
  if (!soundEnabled) return;
  const slump = [392, 330, 262];
  slump.forEach((freq, i) => later(i * 200, () => {
    if (!soundEnabled) return;
    tone({ frequency: freq, slideTo: freq * 0.92, duration: 0.26, type: 'triangle', volume: 0.055, attack: 0.008, decay: 0.14 });
  }));
  later(640, () => {
    if (!soundEnabled) return;
    tone({ frequency: 196, slideTo: 130, duration: 0.5, type: 'square', volume: 0.04, attack: 0.01, decay: 0.3 });
  });
}

/** A soft, glinting chime when healing lands. */
export function playHeal() {
  if (!soundEnabled) return;
  tone({ frequency: jitter(760), slideTo: 1140, duration: 0.12, type: 'sine', volume: 0.035, attack: 0.004, decay: 0.08 });
  later(90, () => {
    if (!soundEnabled) return;
    tone({ frequency: jitter(1180), duration: 0.1, type: 'triangle', volume: 0.025, attack: 0.003, decay: 0.06 });
  });
}

/** The pack leader's low rallying howl. */
export function playHowl() {
  if (!soundEnabled) return;
  tone({ frequency: 180, slideTo: 300, duration: 0.28, type: 'square', volume: 0.03, attack: 0.03, decay: 0.16 });
  later(220, () => {
    if (!soundEnabled) return;
    tone({ frequency: 290, slideTo: 170, duration: 0.34, type: 'square', volume: 0.028, attack: 0.02, decay: 0.2 });
  });
}

/** A bright, curious "me-ow" — pitch climbs, then curls back down. */
export function playMeow() {
  if (!soundEnabled) return;
  tone({ frequency: jitter(520), slideTo: 920, duration: 0.12, type: 'triangle', volume: 0.045, attack: 0.015, decay: 0.05 });
  later(105, () => {
    if (!soundEnabled) return;
    tone({ frequency: jitter(880), slideTo: 430, duration: 0.2, type: 'triangle', volume: 0.05, attack: 0.008, decay: 0.12 });
  });
}

/** A friendly double woof: two short low barks with a breathy edge. */
export function playWoof() {
  if (!soundEnabled) return;
  const bark = (frequency) => {
    tone({ frequency: jitter(frequency), slideTo: frequency * 0.45, duration: 0.09, type: 'square', volume: 0.05, attack: 0.004, decay: 0.05 });
    noiseBurst({ duration: 0.05, volume: 0.028, filterFreq: 1100 });
  };
  bark(300);
  later(145, () => { if (soundEnabled) bark(255); });
}

export function isAudioUnlocked() {
  return unlocked && Boolean(audioCtx) && audioCtx.state === 'running';
}

// Initialize from storage once this module loads in the browser.
loadVolumeSettings();
bindAudioLifecycleListeners();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    releaseMusicOwnership();
    pauseLevelMusic();
    unbindAudioLifecycleListeners();
  });
}
