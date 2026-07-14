import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CAT_DEATH, DOG_DEATH, DEATH_TIMING,
  deathSpecFor, deathTiming, deathDurationMs,
} from '../src/death-animation.js';
import { CAT_COAT_INFO, DOG_ROLE } from '../src/game-engine.js';

const ALL_COATS = Object.keys(CAT_COAT_INFO).map(Number);
const ALL_ROLES = Object.values(DOG_ROLE);

test('every cat in the game has its own death', () => {
  for (const coat of ALL_COATS) {
    assert.ok(CAT_DEATH[coat], `${CAT_COAT_INFO[coat].name} (coat ${coat}) has no death animation`);
  }
  assert.equal(Object.keys(CAT_DEATH).length, ALL_COATS.length, 'a coat was added without a death');
});

test('every dog in the game has its own death', () => {
  for (const role of ALL_ROLES) {
    assert.ok(DOG_DEATH[role], `dog role "${role}" has no death animation`);
  }
  assert.equal(Object.keys(DOG_DEATH).length, ALL_ROLES.length, 'a role was added without a death');
});

// The point of the whole feature: whatever spin it takes to get there, the unit ends up
// on its back. Sprites are drawn standing with their feet at the bottom of the tile, so a
// half turn puts all four paws in the air. Anything that is not a half turn (mod 360)
// would leave the unit face-down or standing up, which is not a KO.
test('every unit lands belly-up, paws in the air', () => {
  for (const [key, spec] of [...Object.entries(CAT_DEATH), ...Object.entries(DOG_DEATH)]) {
    const resting = ((spec.spin % 360) + 360) % 360;
    assert.equal(resting, 180, `${key} rests at ${resting}° — it must be belly-up (180°)`);
  }
});

test('the resting tilt is a lean, not a faceplant', () => {
  for (const [key, spec] of [...Object.entries(CAT_DEATH), ...Object.entries(DOG_DEATH)]) {
    assert.ok(Math.abs(spec.tilt) <= 25, `${key} tilts ${spec.tilt}° — past 25° it stops reading as on-its-back`);
  }
});

// "in different funny ways" — if they all flopped identically the feature would be
// pointless, so the table has to actually vary.
test('no two units die the same way', () => {
  const gags = [...Object.values(CAT_DEATH), ...Object.values(DOG_DEATH)].map((spec) => spec.gag);
  assert.equal(new Set(gags).size, gags.length, 'two units share a signature gag');
});

test('the flops themselves vary, not just the props', () => {
  const specs = [...Object.values(CAT_DEATH), ...Object.values(DOG_DEATH)];
  const poses = new Set(specs.map((spec) => `${spec.spin}:${spec.tilt}`));
  assert.ok(poses.size >= specs.length * 0.75, 'too many units share the same flip and resting pose');
  assert.ok(new Set(specs.map((spec) => spec.spin)).size >= 4, 'needs a mix of topples and cartwheels');
});

test('every spec is complete', () => {
  for (const [key, spec] of [...Object.entries(CAT_DEATH), ...Object.entries(DOG_DEATH)]) {
    for (const field of ['spin', 'tilt', 'hop', 'bounces', 'gag']) {
      assert.ok(spec[field] !== undefined, `${key} is missing "${field}"`);
    }
    assert.ok(spec.hop >= 0, `${key} has a negative hop`);
    assert.ok(spec.bounces >= 0 && spec.bounces <= 4, `${key} bounces ${spec.bounces} times`);
  }
});

test('deathSpecFor finds cats by coat and dogs by role', () => {
  assert.equal(deathSpecFor('cat', 4), CAT_DEATH[4]);          // Bombay Boom
  assert.equal(deathSpecFor('dog', 'lobber'), DOG_DEATH.lobber); // Bone Jovi
});

test('deathSpecFor never returns nothing, even for junk', () => {
  assert.ok(deathSpecFor('cat', 999));
  assert.ok(deathSpecFor('dog', 'poodle'));
  assert.ok(deathSpecFor('cat', undefined));
  assert.ok(deathSpecFor('gerbil', 1));
});

test('the speed toggle scales the whole death', () => {
  const full = deathTiming(1);
  const fast = deathTiming(2);
  for (const key of Object.keys(DEATH_TIMING)) {
    assert.equal(fast[key], Math.round(DEATH_TIMING[key] / 2), `${key} did not halve at 2x`);
  }
  assert.ok(deathDurationMs(2) < deathDurationMs(1));
});

test('a death is one beat, not a cutscene', () => {
  // Deaths in a phase play concurrently, so this is the cost of a whole wipe, not each dog.
  assert.ok(deathDurationMs(1) <= 1000, `a death takes ${deathDurationMs(1)}ms — too slow for combat`);
  assert.ok(deathDurationMs(1) >= 500, 'too fast to read the pose');
});
