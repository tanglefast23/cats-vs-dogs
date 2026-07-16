import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  IMPACT_SOUNDS, LEVEL_MUSIC_DURATION_SECONDS, playImpact, playArmourBlock, SFX_GAIN,
  playMerge, playCatDeath, playDogDeath, playWaveStart,
  playRoundComplete, playVictory, playDefeat, playHeal, playHowl,
} from '../src/sound.js';
import { HURT_FX } from '../src/battle-fx.js';

function readMusicWav() {
  const wav = readFileSync(new URL('../src/assets/audio/backyard-bounce.wav', import.meta.url));
  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.toString('ascii', 8, 12), 'WAVE');

  let offset = 12;
  let dataOffset = -1;
  let dataSize = 0;
  while (offset + 8 <= wav.length) {
    const chunkId = wav.toString('ascii', offset, offset + 4);
    const chunkSize = wav.readUInt32LE(offset + 4);
    if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataSize = chunkSize;
      break;
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }

  assert.ok(dataOffset > 0, 'music WAV has no data chunk');
  return {
    wav,
    dataOffset,
    dataSize,
    channels: wav.readUInt16LE(22),
    sampleRate: wav.readUInt32LE(24),
    byteRate: wav.readUInt32LE(28),
    bitsPerSample: wav.readUInt16LE(34),
  };
}

function windowRms(wav, offset, sampleCount) {
  let squaredTotal = 0;
  for (let index = 0; index < sampleCount; index += 1) {
    const sample = wav.readInt16LE(offset + index * 2);
    squaredTotal += sample * sample;
  }
  return Math.sqrt(squaredTotal / sampleCount);
}

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
// heals, and howls must all be callable and safe without a window/AudioContext.
test('event sounds exist and are safe without an audio context', () => {
  const eventSounds = {
    playMerge, playCatDeath, playDogDeath, playWaveStart,
    playRoundComplete, playVictory, playDefeat, playHeal, playHowl,
  };
  for (const [name, play] of Object.entries(eventSounds)) {
    assert.equal(typeof play, 'function', `${name} is not exported as a function`);
    assert.doesNotThrow(() => play(), `${name} threw without a window`);
  }
  assert.doesNotThrow(() => playMerge({ levelUp: true }));
});

test('level music is a three-minute arrangement with a balanced loop seam', () => {
  const music = readMusicWav();
  assert.equal(music.channels, 1);
  assert.equal(music.bitsPerSample, 16);
  assert.equal(music.dataSize / music.byteRate, LEVEL_MUSIC_DURATION_SECONDS);

  const seamWindowSamples = Math.round(music.sampleRate * 0.1);
  const headRms = windowRms(music.wav, music.dataOffset, seamWindowSamples);
  const tailOffset = music.dataOffset + music.dataSize - seamWindowSamples * 2;
  const tailRms = windowRms(music.wav, tailOffset, seamWindowSamples);
  const seamBalance = Math.max(headRms, tailRms) / Math.max(1, Math.min(headRms, tailRms));
  assert.ok(seamBalance < 2, `loop seam changes volume too sharply (${seamBalance.toFixed(2)}x)`);

  const firstSample = music.wav.readInt16LE(music.dataOffset);
  const lastSample = music.wav.readInt16LE(music.dataOffset + music.dataSize - 2);
  assert.ok(Math.abs(firstSample - lastSample) < 2500, 'loop seam has an audible sample jump');
});
