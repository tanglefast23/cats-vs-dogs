import test from 'node:test';
import assert from 'node:assert/strict';

import {
  IMPACT_SOUNDS, playImpact, playArmourBlock, SFX_GAIN,
  playMerge, playCatDeath, playDogDeath, playWaveStart,
  playRoundComplete, playVictory, playDefeat, playHeal, playHowl,
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
