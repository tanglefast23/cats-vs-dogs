import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  SPLASH_POP_CATS, SPLASH_POP_DOGS, VOICE_CHANCE, VOICE_MIN_GAP_MS, createVoiceGate, initSplash,
} from '../src/splash.js';
import { CAT_BODY_BUILDS, DOG_BODY_BUILDS } from '../src/pixel-art.js';
import { playMeow, playWoof } from '../src/sound.js';

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');

// Every head that pops over the fence must be a pet the player can actually
// meet in battle, drawn with a coat/role the art module knows.
test('every peekaboo pop references real roster art', () => {
  for (const [coat, level] of SPLASH_POP_CATS) {
    assert.ok(CAT_BODY_BUILDS[coat], `cat coat ${coat} has no body art`);
    assert.ok(level >= 1 && level <= 3, `cat level ${level} out of range`);
  }
  for (const [role, tier] of SPLASH_POP_DOGS) {
    assert.ok(DOG_BODY_BUILDS[role], `dog role "${role}" has no body art`);
    assert.ok(tier >= 1 && tier <= 4, `dog tier ${tier} out of range`);
  }
});

// Bombay Boom is drawn prowling along the bottom of his tile, so he can never
// clear the fence line — keeping him out is deliberate, not an oversight.
test('the pop pool leaves out the low-prowling saboteur silhouette', () => {
  assert.ok(!SPLASH_POP_CATS.some(([coat]) => coat === 4));
});

// Same contract as every other SFX: recipes run in Node where there is no
// window or AudioContext and must fall through their guards silently.
test('meow and woof are safe without an audio context', () => {
  assert.doesNotThrow(() => playMeow());
  assert.doesNotThrow(() => playWoof());
});

test('the voice gate enforces the quiet gap and the chance roll', () => {
  let clock = 0;
  const always = () => 0; // random() below any positive chance → roll passes
  const gate = createVoiceGate({ random: always, now: () => clock });

  assert.equal(gate(), true, 'first eligible pop should speak');
  assert.equal(gate(), false, 'a voice inside the quiet gap must stay silent');
  clock += VOICE_MIN_GAP_MS;
  assert.equal(gate(), true, 'after the gap the next pop may speak again');

  const never = () => 0.999; // random() above the chance → roll fails
  const muted = createVoiceGate({ random: never, now: () => clock });
  assert.equal(muted(), false, 'losing the chance roll stays silent');
  assert.equal(muted(1), true, 'a certain chance (side peekers) always speaks');
  assert.ok(VOICE_CHANCE > 0 && VOICE_CHANCE < 1, 'pops should speak sometimes, not always');
});

test('initSplash is a no-op without its root element', () => {
  assert.equal(initSplash({}), null);
  assert.equal(initSplash(), null);
});

test('index.html ships the start screen with its three actions', () => {
  assert.match(html, /id="splash-screen"[\s\S]*id="splash-campaign"[\s\S]*id="splash-tutorial"[\s\S]*id="splash-settings"/);
  assert.match(app, /initSplash\(\{[\s\S]*onTutorial: startTutorial,[\s\S]*openSettings\(\);/);
});

// The splash must cover the game, yet let Settings (35) and the glossary (45)
// it can open stack above it.
test('the splash layers under the settings and glossary modals', () => {
  const zIndexFor = (selector) => {
    const start = css.indexOf(`${selector} {`);
    assert.notEqual(start, -1, `missing ${selector} rule`);
    const rule = css.slice(start, css.indexOf('}', start));
    const value = rule.match(/z-index:\s*(\d+)/)?.[1];
    assert.ok(value, `missing z-index for ${selector}`);
    return Number(value);
  };
  assert.ok(zIndexFor('.splash-screen') < zIndexFor('.settings-modal'));
  assert.ok(zIndexFor('.splash-screen') < zIndexFor('.glossary-modal'));
});
