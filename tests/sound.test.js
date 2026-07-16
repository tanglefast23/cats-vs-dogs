import test from 'node:test';
import assert from 'node:assert/strict';

import { IMPACT_SOUNDS, playImpact, playArmourBlock } from '../src/sound.js';
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
