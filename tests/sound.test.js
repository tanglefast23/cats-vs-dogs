import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  IMPACT_SOUNDS, LEVEL_MUSIC_DURATION_SECONDS, LEVEL_MUSIC_URL, playImpact, playArmourBlock, SFX_GAIN,
  playMerge, playCatDeath, playDogDeath, playWaveStart,
  playRoundComplete, playVictory, playDefeat, playHeal, playHowl,
  playAppleCrunch, playCoinSpend, playItemUse,
} from '../src/sound.js';
import { HURT_FX } from '../src/battle-fx.js';

// The same contract the graphics have: every impact the renderer can show must land
// with its own sound, or a new attack ships silent without anyone noticing.
test('every hurt impact the graphics can show has its own sound', () => {
  for (const impact of Object.keys(HURT_FX)) {
    assert.equal(
      typeof IMPACT_SOUNDS[impact], 'function',
      `impact "${impact}" has no sound recipe`,
    );
  }
});

// Sounds run inside Node during tests, where there is no window and no AudioContext.
// Every recipe must fall through its guards without throwing.
test('impact and armour-block sounds are safe without an audio context', () => {
  for (const impact of Object.keys(IMPACT_SOUNDS)) {
    assert.doesNotThrow(() => playImpact(impact), `"${impact}" threw without a window`);
  }
  assert.doesNotThrow(() => playImpact('unknown-kind', { heavy: true }));
  assert.doesNotThrow(() => playArmourBlock());
  assert.doesNotThrow(() => playArmourBlock({ broken: true }));
});

// Effects sit on a master gain so the whole layer is clearly audible over the music.
test('synthesized SFX carry at least a 2x master gain', () => {
  assert.ok(SFX_GAIN >= 2, `SFX_GAIN is ${SFX_GAIN}, expected >= 2`);
});

// Every game event with a sound: merges, deaths, wave start, round end, results,
// heals, howls, and eating an apple must all be callable and safe without a window/AudioContext.
test('event sounds exist and are safe without an audio context', () => {
  const eventSounds = {
    playMerge, playCatDeath, playDogDeath, playWaveStart,
    playRoundComplete, playVictory, playDefeat, playHeal, playHowl, playAppleCrunch, playCoinSpend,
  };
  for (const [name, play] of Object.entries(eventSounds)) {
    assert.equal(typeof play, 'function', `${name} is not exported as a function`);
    assert.doesNotThrow(() => play(), `${name} threw without a window`);
  }
  assert.doesNotThrow(() => playMerge({ levelUp: true }));
  assert.doesNotThrow(() => playItemUse('food'));
});

test('eating an apple layers a sharp crack over two crunchy chew beats', async () => {
  const events = [];
  const audioParam = {
    setValueAtTime() {},
    exponentialRampToValueAtTime() {},
  };
  class FakeAudioContext {
    state = 'running';
    currentTime = 0;
    sampleRate = 1000;
    destination = {};

    createOscillator() {
      events.push('oscillator');
      return { frequency: audioParam, connect() {}, start() {}, stop() {} };
    }

    createGain() {
      return { gain: audioParam, connect() {} };
    }

    createBuffer(_channels, length) {
      return { getChannelData: () => new Float32Array(length) };
    }

    createBufferSource() {
      return { connect() {}, start() {}, stop() {} };
    }

    createBiquadFilter() {
      const filter = { frequency: { value: 0 }, connect() {} };
      Object.defineProperty(filter, 'type', {
        set(value) { events.push(`filter:${value}`); },
      });
      return filter;
    }
  }

  const previousWindow = globalThis.window;
  globalThis.window = {
    AudioContext: FakeAudioContext,
    navigator: { webdriver: false },
    setTimeout(callback) { callback(); },
    addEventListener() {},
    removeEventListener() {},
    document: { addEventListener() {}, removeEventListener() {} },
  };
  try {
    const freshSound = await import(`../src/sound.js?apple-crunch=${Date.now()}`);
    freshSound.playItemUse('food');
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }

  assert.equal(events.filter((event) => event === 'filter:highpass').length, 4);
  assert.equal(events.filter((event) => event === 'filter:lowpass').length, 2);
  assert.equal(events.filter((event) => event === 'oscillator').length, 3);
});

test('the browser ships the compact 30-second Backyard Bounce variation', () => {
  const mp3 = readFileSync(new URL('../src/assets/audio/backyard-bounce-loop.mp3', import.meta.url));
  const hasId3Header = mp3.toString('ascii', 0, 3) === 'ID3';
  const hasMpegFrameSync = mp3[0] === 0xff && (mp3[1] & 0xe0) === 0xe0;

  assert.match(LEVEL_MUSIC_URL, /backyard-bounce-loop\.mp3$/);
  assert.equal(LEVEL_MUSIC_DURATION_SECONDS, 30);
  assert.ok(hasId3Header || hasMpegFrameSync, 'compressed music is not a valid MP3 stream');
  assert.ok(mp3.length < 300_000, `Backyard Bounce loop is not web-optimized (${mp3.length} bytes)`);
});

test('level music streams and loops the Backyard Bounce variation', async () => {
  let player = null;
  class FakeAudio {
    constructor(src) {
      this.src = src;
      player = this;
    }

    play() { return Promise.resolve(); }
    pause() {}
  }

  const previousWindow = globalThis.window;
  globalThis.window = {
    Audio: FakeAudio,
    navigator: { webdriver: false },
    addEventListener() {},
    removeEventListener() {},
    document: {
      hidden: false,
      visibilityState: 'visible',
      addEventListener() {},
      removeEventListener() {},
    },
  };
  try {
    const freshSound = await import(`../src/sound.js?level-music-loop=${Date.now()}`);
    assert.equal(freshSound.startLevelMusic(), true);
    assert.match(player.src, /backyard-bounce-loop\.mp3$/);
    assert.equal(player.loop, true);
    assert.equal(player.preload, 'metadata');
    freshSound.stopLevelMusic();
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
