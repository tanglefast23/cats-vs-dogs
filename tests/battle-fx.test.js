import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ATTACK_FX, ATTACK_DOG_FX, CAT_ATTACK_SIGNATURES, DOG_REACTION_FX, HURT_FX,
  ENGINE_ATTACK_STYLES, attackDogFx, attackSignature, blastCells, blastFootprint,
  contactVector, isKill, attackGroupKey, damageNumberFx, damageTier, fanOffset,
} from '../src/battle-fx.js';
import { yarnThrowKeyframes } from '../src/combat-animation.js';
import { COLS, DOG_ROLE } from '../src/game-engine.js';

// The bug this whole system exists to prevent: an ability ships, the engine stamps a new
// style on its events, and the renderer silently falls back to a generic ball. That is
// exactly how Bombay Boom's explosion went missing. Every style the engine can emit must
// resolve to real graphics.
test('every attack style the engine emits has graphics', () => {
  for (const style of ENGINE_ATTACK_STYLES) {
    const fx = ATTACK_FX[style];
    assert.ok(fx, `no ATTACK_FX entry for engine style "${style}"`);
    assert.ok(fx.impact, `"${style}" has no impact kind`);
    assert.ok(HURT_FX[fx.impact], `"${style}" impact "${fx.impact}" has no HURT_FX entry`);
  }
});

test('a bare dog bite (no style on the event) still resolves', () => {
  // game-engine.js applyDogDamage(next, dog, target) passes no style at all.
  const signature = attackSignature({ type: 'melee' }, { role: 'scruffy' });
  assert.equal(signature, 'bite');
  assert.ok(ATTACK_FX.bite);
});

test('the six homing cats each get their own projectile skin', () => {
  const skins = new Map([
    [2, 'homing'], // Hissiletoe keeps the classic
    [6, 'frost'],  // Frosty Paws
    [7, 'rift'],   // Purrtal
    [8, 'mirage'], // Faux Paw
    [9, 'spark'],  // Thunderpaws
    [10, 'note'],  // Meowstro
  ]);
  const seen = new Set();
  for (const [coat, expected] of skins) {
    const signature = attackSignature({ type: 'shot', style: 'homing' }, { coat });
    assert.equal(signature, expected, `coat ${coat} should map to "${expected}"`);
    assert.ok(ATTACK_FX[signature], `no graphics for "${signature}"`);
    seen.add(ATTACK_FX[signature].projectile);
  }
  assert.equal(seen.size, skins.size, 'the six homing cats must not share a projectile');
});

test('an unknown caster falls back without throwing', () => {
  assert.ok(ATTACK_FX[attackSignature({ type: 'shot', style: 'homing' }, null)]);
  assert.ok(ATTACK_FX[attackSignature({ type: 'shot' }, null)]);
});

test('every cat attack has a reaction combo for every dog role', () => {
  const dogOnlySignatures = new Set(['bite', 'tennis', 'frisbee', 'bone-bomb', 'bone-bomb-secondary']);
  const expectedCatSignatures = Object.keys(ATTACK_FX).filter((signature) => !dogOnlySignatures.has(signature));
  assert.deepEqual(
    new Set(CAT_ATTACK_SIGNATURES),
    new Set(expectedCatSignatures),
    'every cat attack must enter the attack + dog animation matrix',
  );
  for (const signature of CAT_ATTACK_SIGNATURES) {
    for (const role of Object.values(DOG_ROLE)) {
      const combo = ATTACK_DOG_FX[signature]?.[role];
      assert.ok(combo, `missing ${signature} + ${role} animation combo`);
      assert.equal(combo.impact, ATTACK_FX[signature].impact);
      assert.equal(combo.reaction, DOG_REACTION_FX[role].reaction);
      assert.ok(combo.bind, `${signature} + ${role} has no yarn-bind choreography`);
    }
  }
});

test('all nine dog roles perform their own hit reaction', () => {
  const reactions = Object.values(DOG_ROLE).map((role) => attackDogFx('column', role).reaction);
  assert.equal(new Set(reactions).size, Object.values(DOG_ROLE).length);
  assert.deepEqual(attackDogFx('unknown', 'unknown'), attackDogFx('homing', DOG_ROLE.SCRUFFY));
});

test('Knotty throws a yarn ball in an arc instead of reusing the homing path', () => {
  assert.equal(ATTACK_FX.tangle.path, 'yarn-throw');
  const start = { xPercent: 50, yPercent: 90 };
  const end = { xPercent: 20, yPercent: 20 };
  const frames = yarnThrowKeyframes(start, end);
  assert.equal(frames[0].left, '50%');
  assert.equal(frames[0].top, '90%');
  assert.equal(frames.at(-1).left, '20%');
  assert.ok(Math.abs(Number(frames.at(-1).top.replace('%', '')) - 20) < 1e-9);
  const straightMidY = (start.yPercent + end.yPercent) / 2;
  assert.ok(Number(frames[Math.floor(frames.length / 2)].top.replace('%', '')) < straightMidY);
});

// Secondary damage is a victim of one blast, never its own projectile.
test('bomb secondaries are absorbed into the parent blast, not fired separately', () => {
  for (const [secondary, parent] of [['bomb-cross-secondary', 'bomb-cross'], ['bone-bomb-secondary', 'bone-bomb']]) {
    assert.equal(ATTACK_FX[secondary].projectile, null, `${secondary} must not fire a projectile`);
    assert.equal(ATTACK_FX[secondary].absorbedBy, parent);
    assert.ok(ATTACK_FX[parent].blast, `${parent} must draw a blast`);
  }
});

test('area attacks group with their secondaries into one attack', () => {
  const primary = { type: 'spell', from: 'cat1', style: 'bomb-cross', col: 2, toRow: 4 };
  const secondary = { type: 'spell', from: 'cat1', style: 'bomb-cross-secondary', col: 3, toRow: 4 };
  assert.equal(attackGroupKey(primary, { coat: 4 }), attackGroupKey(secondary, { coat: 4 }));
});

test('two different cats firing the same style stay separate attacks', () => {
  const a = { type: 'spell', from: 'cat1', style: 'bomb-cross', col: 2, toRow: 4 };
  const b = { type: 'spell', from: 'cat2', style: 'bomb-cross', col: 2, toRow: 4 };
  assert.notEqual(attackGroupKey(a, { coat: 4 }), attackGroupKey(b, { coat: 4 }));
});

test('Bombay regular and special blast footprints match their damage areas', () => {
  assert.deepEqual(blastFootprint('single-cell', 5, 2), [{ row: 5, col: 2 }]);
  assert.deepEqual(blastFootprint('plus', 5, 2), [
    { row: 5, col: 2 },
    { row: 4, col: 2 },
    { row: 6, col: 2 },
    { row: 5, col: 1 },
    { row: 5, col: 3 },
  ]);
});

// blastCells must mirror the engine's own splash rule exactly, or fire lands on squares
// that took no damage (or worse, a damaged dog stands in a square with no fire on it).
// Engine rule: dog.row === impactRow && Math.abs(dog.col - impactCol) === 1, plus target.
test('blastCells matches the engine splash footprint mid-board', () => {
  assert.deepEqual(blastCells(4, 2), [
    { row: 4, col: 1 }, { row: 4, col: 2 }, { row: 4, col: 3 },
  ]);
});

test('blastCells clips at both board edges', () => {
  assert.deepEqual(blastCells(0, 0), [{ row: 0, col: 0 }, { row: 0, col: 1 }]);
  assert.deepEqual(blastCells(3, COLS - 1), [
    { row: 3, col: COLS - 2 }, { row: 3, col: COLS - 1 },
  ]);
});

test('blastCells never leaves the board', () => {
  for (let col = 0; col < COLS; col += 1) {
    for (const cell of blastCells(5, col)) {
      assert.ok(cell.col >= 0 && cell.col < COLS, `col ${cell.col} off board`);
    }
  }
});

// The hurt reaction has to "match the contact" — the victim recoils away from whatever
// hit it, so the spark lands on the side facing the attacker.
test('contactVector points from the attacker to the victim', () => {
  // A dog at row 5 biting a cat at row 6: the cat is knocked further down the board.
  const down = contactVector(5, 2, 6, 2);
  assert.ok(down.dy > 0 && Math.abs(down.dx) < 1e-9);

  // A cat at row 10 shooting a dog at row 4: the dog is knocked back up the board.
  const up = contactVector(10, 2, 4, 2);
  assert.ok(up.dy < 0 && Math.abs(up.dx) < 1e-9);

  // A diagonal hit pushes on both axes.
  const diagonal = contactVector(8, 1, 6, 3);
  assert.ok(diagonal.dx > 0 && diagonal.dy < 0);
});

test('contactVector is a unit vector, and a self-hit does not divide by zero', () => {
  const v = contactVector(9, 0, 4, 4);
  assert.ok(Math.abs(Math.hypot(v.dx, v.dy) - 1) < 1e-9);

  const same = contactVector(3, 3, 3, 3);
  assert.ok(Number.isFinite(same.dx) && Number.isFinite(same.dy));
});

// The floating number scales with the blow: chip damage whispers, big hits shout,
// and the killing blow always gets the huge treatment even when the number is small.
test('damage numbers grow with the damage, and a kill always goes huge', () => {
  assert.equal(damageTier({ to: 'dog1', damage: 1, hpBefore: 9, hpAfter: 8 }), 'small');
  assert.equal(damageTier({ to: 'dog1', damage: 4, hpBefore: 9, hpAfter: 5 }), 'big');
  assert.equal(damageTier({ to: 'dog1', damage: 8, hpBefore: 19, hpAfter: 11 }), 'huge');
  assert.equal(damageTier({ to: 'dog1', damage: 2, hpBefore: 2, hpAfter: 0 }), 'huge', 'the killing blow shouts');
  assert.equal(damageTier({ to: 'decoy1', decoyBlock: true, blocksBefore: 2, blocksAfter: 1 }), 'big');
});

test('damage numbers read gold on dogs and red on cats', () => {
  const onDog = damageNumberFx({ type: 'shot', to: 'dog1', damage: 3, hpBefore: 9, hpAfter: 6 });
  assert.equal(onDog.text, '-3');
  assert.ok(onDog.classes.includes('to-dog'));
  for (const dogAttack of ['melee', 'dog-shot']) {
    const onCat = damageNumberFx({ type: dogAttack, to: 'cat1', damage: 3, hpBefore: 9, hpAfter: 6 });
    assert.ok(!onCat.classes.includes('to-dog'), `${dogAttack} hits a cat, so its number must stay red`);
  }
});

test('a decoy block says BLOCK! and never wears an armour chip', () => {
  const fx = damageNumberFx({
    type: 'melee', to: 'decoy1', decoyBlock: true, blocked: 5, blocksBefore: 2, blocksAfter: 1, damage: 0,
  });
  assert.equal(fx.text, 'BLOCK!');
  assert.ok(fx.classes.includes('block-number'));
  assert.equal(fx.blocked, null);
});

// The armour chip is the engine's own arithmetic worn on screen: applyDogDamage reports
// how much the armour soaked (`blocked`) and whether the hit spent its last use.
test('armour that soaks damage pins a protection chip beside the number', () => {
  const base = { type: 'melee', to: 'cat1', damage: 3, hpBefore: 9, hpAfter: 6 };
  assert.equal(damageNumberFx(base).blocked, null, 'no armour, no chip');
  assert.deepEqual(
    damageNumberFx({ ...base, blocked: 2, armourBroken: false }).blocked,
    { amount: 2, broken: false },
  );
  assert.deepEqual(
    damageNumberFx({ ...base, blocked: 4, armourBroken: true }).blocked,
    { amount: 4, broken: true },
  );
});

// Purrcy's three pellets land on the same square within a second of each other. Each
// number takes its own seat — centre, left, right — so -1 -1 -1 reads as three hits.
test('quick hits on one square fan out instead of stacking', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(fanOffset), [0, -32, 32, -64, 64]);

  const event = { type: 'shot', to: 'dog1', damage: 2, hpBefore: 9, hpAfter: 7 };
  const seats = [0, 1, 2].map((slot) => damageNumberFx(event, Math.random, slot));
  const positions = seats.map((fx) => fx.fanX);
  assert.equal(new Set(positions).size, 3, 'three quick hits must take three distinct seats');
  // Fanned numbers keep drifting outward on their own side, opening the fan as it rises.
  for (const fx of seats.slice(1)) {
    assert.equal(Math.sign(fx.driftX), Math.sign(fx.fanX), 'drift continues on the fan side');
  }
});

test('drift and tilt are bounded and follow the injected random', () => {
  const event = { type: 'shot', to: 'dog1', damage: 2, hpBefore: 9, hpAfter: 7 };
  assert.deepEqual(
    [damageNumberFx(event, () => 0).driftX, damageNumberFx(event, () => 0).tiltDeg],
    [-4, -9],
  );
  assert.deepEqual(
    [damageNumberFx(event, () => 0.5).driftX, damageNumberFx(event, () => 0.5).tiltDeg],
    [9, 0],
  );
  for (let i = 0; i < 40; i += 1) {
    const fx = damageNumberFx(event);
    assert.ok(Math.abs(fx.driftX) >= 4 && Math.abs(fx.driftX) <= 14, 'drift is visible but stays near its tile');
    assert.ok(Math.abs(fx.tiltDeg) <= 9, 'tilt stays readable');
  }
});

// A death is just an event that took a unit to zero. No engine change needed to spot it.
test('isKill spots the killing blow and nothing else', () => {
  // Real damage events always name their victim; only a miss has to: null.
  assert.equal(isKill({ to: 'dog3', hpBefore: 3, hpAfter: 0 }), true);
  assert.equal(isKill({ to: 'dog3', hpBefore: 9, hpAfter: 4 }), false);
  assert.equal(isKill({ to: 'dog3', hpBefore: 0, hpAfter: 0 }), false, 'already dead is not a fresh kill');
  assert.equal(isKill({ miss: true, hpBefore: 4, hpAfter: 0, to: null }), false, 'a miss kills nobody');
  assert.equal(isKill({ to: 'decoy1', blocksBefore: 1, blocksAfter: 0 }), true, 'last decoy block destroys it');
  assert.equal(isKill({ to: 'decoy1', blocksBefore: 3, blocksAfter: 2 }), false, 'unused blocks keep it alive');
  assert.equal(isKill({}), false);
});
