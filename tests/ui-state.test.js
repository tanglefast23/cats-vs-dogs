import test from 'node:test';
import assert from 'node:assert/strict';

import { selectionAfterPurchase, shopPetAvailability, hpTone, productionLegendRows, glossaryTabs } from '../src/ui-state.js';
import { WORKER_INFO } from '../src/production-rules.js';
import {
  CAT_EQUIPMENT, CAT_ARCHETYPE_MARKERS, DOG_TIER_MARKERS, DOG_ROLE_MARKERS,
  WORKER_ART_MARKERS, ITEM_ART_MARKERS,
} from '../src/pixel-art.js';
import { COMBAT_TIMING, combatTiming, homingShotKeyframes } from '../src/combat-animation.js';
import { DRAG_FEEDBACK, DROP_IMPACT, getDropAction } from '../src/drag-drop.js';
import { UPGRADE_TIMING, describeUpgrade } from '../src/upgrade-animation.js';
import { BLUE_SCRATCH_FLURRY } from '../src/melee-animation.js';

test('zero-gold shop cats stay interactive and readable while purchase is rejected', () => {
  const availability = shopPetAvailability({
    sold: false,
    gold: 0,
    benchLength: 0,
    benchSize: 6,
    phase: 'prep',
    playing: false,
  });

  assert.deepEqual(availability, {
    interactive: true,
    canBuy: false,
    reason: 'gold',
  });
});

test('sold shop cats are disabled because they are genuinely unavailable', () => {
  const availability = shopPetAvailability({
    sold: true,
    gold: 10,
    benchLength: 0,
    benchSize: 6,
    phase: 'prep',
    playing: false,
  });

  assert.deepEqual(availability, {
    interactive: false,
    canBuy: false,
    reason: 'sold',
  });
});

test('hp bars read green above half, amber to a quarter, red below', () => {
  assert.equal(hpTone(6, 6), 'full');
  assert.equal(hpTone(4, 7), 'full');
  assert.equal(hpTone(3, 6), 'mid');
  assert.equal(hpTone(3, 7), 'mid');
  assert.equal(hpTone(2, 8), 'low');
  assert.equal(hpTone(0, 6), 'low');
  assert.equal(hpTone(5, 0), 'low');
});

test('a successful shop purchase clears selection instead of silently selecting the new cat', () => {
  const priorSelection = { type: 'cat', id: 'cat-on-board' };

  const selection = selectionAfterPurchase(priorSelection, true);

  assert.equal(selection, null);
});

test('failed shop purchases preserve the current explicit selection', () => {
  const priorSelection = { type: 'cat', id: 'cat-on-board' };

  const selection = selectionAfterPurchase(priorSelection, false);

  assert.deepEqual(selection, priorSelection);
});

test('combat timing leaves enough time to read travel, impact, and HP loss', () => {
  assert.ok(COMBAT_TIMING.projectileMs >= 700);
  assert.ok(COMBAT_TIMING.impactMs >= 300);
  assert.ok(COMBAT_TIMING.hpPauseMs >= 250);
});

test('2x combat speed halves every timing without touching the tuned constants', () => {
  assert.deepEqual(combatTiming(1), { ...COMBAT_TIMING });
  const fast = combatTiming(2);
  assert.equal(fast.projectileMs, Math.round(COMBAT_TIMING.projectileMs / 2));
  assert.equal(fast.homingMs, Math.round(COMBAT_TIMING.homingMs / 2));
  assert.equal(fast.impactMs, Math.round(COMBAT_TIMING.impactMs / 2));
  assert.equal(COMBAT_TIMING.projectileMs, 820, 'source table stays untouched');
  assert.equal(combatTiming(0).projectileMs, COMBAT_TIMING.projectileMs, 'invalid speed falls back to 1x');
});

test('Blue Brawler uses a readable alternating-paw scratch flurry', () => {
  assert.equal(BLUE_SCRATCH_FLURRY.swipes, 5);
  assert.equal(BLUE_SCRATCH_FLURRY.alternatingPaws, true);
  assert.ok(BLUE_SCRATCH_FLURRY.durationMs >= 700);
  assert.ok(BLUE_SCRATCH_FLURRY.hitAtMs > BLUE_SCRATCH_FLURRY.durationMs / 2);
  assert.ok(BLUE_SCRATCH_FLURRY.hitAtMs < BLUE_SCRATCH_FLURRY.durationMs);
});

test('dragging a bench cat to an empty cat-territory cell produces a place action', () => {
  const action = getDropAction({
    source: { type: 'bench', id: 'cat-1', level: 1 },
    target: { kind: 'cell', row: 10, col: 2, occupied: null },
    catZoneStart: 9,
    rows: 14,
    cols: 6,
  });

  assert.deepEqual(action, { type: 'place', row: 10, col: 2 });
});

test('dragging a board cat to another empty cat cell produces a move action', () => {
  const action = getDropAction({
    source: { type: 'cat', id: 'cat-1', level: 1 },
    target: { kind: 'cell', row: 12, col: 5, occupied: null },
    catZoneStart: 9,
    rows: 14,
    cols: 6,
  });

  assert.deepEqual(action, { type: 'move', row: 12, col: 5 });
});

test('drag highlights respect between-round melee and ranged movement limits', () => {
  const target = { kind: 'cell', row: 10, col: 3, occupied: false };
  const common = { target, catZoneStart: 10, rows: 14, cols: 6, phase: 'prep' };
  assert.equal(getDropAction({
    ...common,
    source: { type: 'cat', id: 1, ability: 'melee', prepOrigin: { row: 10, col: 1 }, prepMoved: false },
  }).type, 'invalid');
  assert.equal(getDropAction({
    ...common,
    source: { type: 'cat', id: 2, ability: 'homing', prepOrigin: { row: 10, col: 1 }, prepMoved: false },
  }).type, 'move');
  assert.equal(getDropAction({
    ...common,
    source: { type: 'cat', id: 3, ability: 'homing', prepOrigin: { row: 10, col: 2 }, prepMoved: true },
  }).type, 'invalid');
});

test('dropping onto a matching cat produces a merge action', () => {
  const action = getDropAction({
    source: { type: 'bench', id: 'cat-1', level: 2 },
    target: { kind: 'cell', row: 11, col: 3, occupied: { id: 'cat-2', level: 2 } },
    catZoneStart: 9,
    rows: 14,
    cols: 6,
  });

  assert.deepEqual(action, { type: 'merge', targetType: 'cat', targetId: 'cat-2' });
});

test('dropping outside cat territory is rejected and uses a visible return animation', () => {
  const action = getDropAction({
    source: { type: 'bench', id: 'cat-1', level: 1 },
    target: { kind: 'cell', row: 4, col: 2, occupied: null },
    catZoneStart: 9,
    rows: 14,
    cols: 6,
  });

  assert.deepEqual(action, { type: 'invalid' });
  assert.ok(DRAG_FEEDBACK.returnMs >= 200);
  assert.ok(DRAG_FEEDBACK.liftScale > 1);
  assert.ok(DRAG_FEEDBACK.dropMs >= 220);
});

test('shop fighters buy only when dragged to a legal battlefield or bench destination', () => {
  const source = { type: 'shop-fighter', shopIndex: 0, id: 'shop-1', level: 1, coat: 0 };
  assert.deepEqual(getDropAction({
    source,
    target: { kind: 'cell', row: 12, col: 2, occupied: null },
    catZoneStart: 10,
    rows: 14,
    cols: 6,
  }), { type: 'purchase-place', row: 12, col: 2 });
  assert.deepEqual(getDropAction({
    source,
    target: { kind: 'bench', index: 3, occupied: null },
    catZoneStart: 10,
    rows: 14,
    cols: 6,
  }), { type: 'purchase-bench', index: 3 });
  assert.deepEqual(getDropAction({
    source,
    target: { kind: 'cell', row: 12, col: 2, occupied: { id: 'cat-2', level: 1, coat: 0 } },
    catZoneStart: 10,
    rows: 14,
    cols: 6,
  }), { type: 'purchase-merge', targetType: 'cat', targetId: 'cat-2' });
});

test('shop workers and owned workers route only to production slots', () => {
  const shopWorker = { type: 'shop-worker', shopIndex: 1, id: 'shop-2', level: 1, role: 'cook' };
  assert.deepEqual(getDropAction({
    source: shopWorker,
    target: { kind: 'worker-slot', index: 4, occupied: null },
    catZoneStart: 10,
    rows: 14,
    cols: 6,
  }), { type: 'purchase-worker', index: 4 });
  assert.deepEqual(getDropAction({
    source: shopWorker,
    target: { kind: 'cell', row: 12, col: 2, occupied: null },
    catZoneStart: 10,
    rows: 14,
    cols: 6,
  }), { type: 'invalid' });

  const owned = { type: 'worker', workerIndex: 0, id: 'worker-1', level: 1, role: 'cook' };
  assert.deepEqual(getDropAction({
    source: owned,
    target: { kind: 'worker-slot', index: 5, occupied: null },
    catZoneStart: 10,
    rows: 14,
    cols: 6,
  }), { type: 'move-worker', index: 5 });
  assert.deepEqual(getDropAction({
    source: owned,
    target: { kind: 'cell', row: 12, col: 2, occupied: null },
    catZoneStart: 10,
    rows: 14,
    cols: 6,
  }), { type: 'invalid' });
});

test('food and equipment target cats only during a tactics window', () => {
  const target = { kind: 'fighter', id: 'cat-1', hp: 3, maxHp: 6 };
  assert.deepEqual(getDropAction({
    source: { type: 'item', inventoryIndex: 0, itemKind: 'food' },
    target, catZoneStart: 10, rows: 14, cols: 6, phase: 'combat', paused: false,
  }), { type: 'invalid' });
  assert.deepEqual(getDropAction({
    source: { type: 'item', inventoryIndex: 0, itemKind: 'food' },
    target, catZoneStart: 10, rows: 14, cols: 6, phase: 'tactics', paused: false,
  }), { type: 'use-food', targetId: 'cat-1' });
  assert.deepEqual(getDropAction({
    source: { type: 'item', inventoryIndex: 1, itemKind: 'weapon' },
    target, catZoneStart: 10, rows: 14, cols: 6, phase: 'combat', paused: false,
  }), { type: 'invalid' });
  assert.deepEqual(getDropAction({
    source: { type: 'item', inventoryIndex: 1, itemKind: 'weapon' },
    target, catZoneStart: 10, rows: 14, cols: 6, phase: 'tactics', paused: false,
  }), { type: 'equip', targetId: 'cat-1' });
});

test('successful placement feedback keeps only forty percent of its former impact', () => {
  assert.equal(DROP_IMPACT.intensity, 0.4);
  assert.equal(DROP_IMPACT.boardShakePx, 1.2);
  assert.equal(DROP_IMPACT.landingLiftPercent, 11.2);
  assert.equal(DROP_IMPACT.ghostSettleScale, 0.928);
  assert.equal(DROP_IMPACT.ringEndScale, 1.68);
});

test('a two-copy merge gets a polished stack reveal without claiming a level-up', () => {
  const reveal = describeUpgrade(
    { level: 1, copies: 1 },
    { level: 1, copies: 2 },
  );

  assert.deepEqual(reveal, {
    kind: 'stack',
    level: 1,
    label: '2 / 3',
    intensity: 'standard',
  });
});

test('level two and level three promotions receive stronger reveal classifications', () => {
  assert.deepEqual(
    describeUpgrade({ level: 1, copies: 2 }, { level: 2, copies: 1 }),
    { kind: 'level-up', level: 2, label: 'LEVEL 2!', intensity: 'level-up' },
  );
  assert.deepEqual(
    describeUpgrade({ level: 2, copies: 2 }, { level: 3, copies: 1 }),
    { kind: 'level-up', level: 3, label: 'LEVEL 3!', intensity: 'ultimate' },
  );
  assert.ok(UPGRADE_TIMING.smokeMs >= 600);
  assert.ok(UPGRADE_TIMING.totalMs >= UPGRADE_TIMING.smokeMs);
});

test('level two and three cats have progressively stronger visible equipment sets', () => {
  assert.ok(CAT_EQUIPMENT[2].length >= 3, 'Level 2 needs several obvious armor pieces');
  assert.ok(CAT_EQUIPMENT[3].length > CAT_EQUIPMENT[2].length, 'Level 3 needs more equipment than Level 2');
  assert.ok(CAT_EQUIPMENT[3].includes('power-cannon'));
  assert.ok(CAT_EQUIPMENT[3].includes('energy-wings'));
});

test('production legend lists every worker with a concise economy role', () => {
  assert.deepEqual(productionLegendRows(WORKER_INFO), [
    { role: 'cook', name: 'COOK', description: 'cooks healing food' },
    { role: 'trader', name: 'TRADER', description: 'earns bonus coins' },
    { role: 'weaponsmith', name: 'SMITH', description: 'forges attack weapons' },
    { role: 'armourer', name: 'ARMOURER', description: 'makes bite-blocking armour' },
  ]);
});

test('Cat & Dog Glossary exposes the three requested roster tabs', () => {
  assert.deepEqual(glossaryTabs('production'), [
    { id: 'battle', label: 'Battle Cats', active: false },
    { id: 'production', label: 'Production Cats', active: true },
    { id: 'dogs', label: 'Dogs', active: false },
  ]);
});

test('production workers and items expose distinct readable art markers', () => {
  assert.deepEqual(Object.keys(WORKER_ART_MARKERS).sort(), ['armourer', 'cook', 'trader', 'weaponsmith']);
  assert.ok(WORKER_ART_MARKERS.cook.includes('straw-hat'));
  assert.ok(WORKER_ART_MARKERS.trader.includes('coin-purse'));
  assert.ok(WORKER_ART_MARKERS.weaponsmith.includes('hammer'));
  assert.ok(WORKER_ART_MARKERS.armourer.includes('goggles'));
  assert.deepEqual(Object.keys(ITEM_ART_MARKERS).sort(), ['armour', 'coins', 'food', 'weapon']);
});

test('unlockable fighters have distinct accessories and dog tier gear', () => {
  assert.deepEqual(CAT_ARCHETYPE_MARKERS[3], ['calico-patches', 'yarn-ball']);
  assert.deepEqual(CAT_ARCHETYPE_MARKERS[4], ['black-coat', 'bomb-pack']);
  assert.deepEqual(CAT_ARCHETYPE_MARKERS[5], ['prism-coat', 'crystal-crown']);
  assert.deepEqual(CAT_ARCHETYPE_MARKERS[6], ['ice-coat', 'frost-staff']);
  assert.deepEqual(CAT_ARCHETYPE_MARKERS[7], ['rift-cloak', 'portal-rings']);
  assert.deepEqual(CAT_ARCHETYPE_MARKERS[8], ['mirage-mask', 'phantom-double']);
  assert.deepEqual(CAT_ARCHETYPE_MARKERS[9], ['storm-coat', 'lightning-rod']);
  assert.deepEqual(CAT_ARCHETYPE_MARKERS[10], ['maestro-coat', 'conductor-baton']);
  assert.deepEqual(DOG_TIER_MARKERS[4], ['alpha-armor', 'crown']);
  assert.deepEqual(DOG_ROLE_MARKERS.tennis, ['visor', 'tennis-ball']);
  assert.deepEqual(DOG_ROLE_MARKERS.howler, ['sound-cone', 'purple-bandana']);
  assert.deepEqual(DOG_ROLE_MARKERS.jumper, ['spring-boots', 'red-cape']);
});

test('homing shot path uses a sine wave while ending on the target', () => {
  const start = { xPercent: 10, yPercent: 80 };
  const end = { xPercent: 70, yPercent: 20 };
  const frames = homingShotKeyframes(start, end, { steps: 20, waves: 2, amplitude: 5 });

  assert.ok(frames.length >= 12);
  const first = frames[0];
  const mid = frames[Math.floor(frames.length / 2)];
  const last = frames[frames.length - 1];

  assert.match(first.left, /^10(\.0+)?%$/);
  assert.match(first.top, /^80(\.0+)?%$/);
  assert.match(last.left, /^70(\.0+)?%$/);
  assert.match(last.top, /^20(\.0+)?%$/);

  // Some mid-flight frame should leave the straight line (sine offset).
  let maxOff = 0;
  for (const frame of frames.slice(1, -1)) {
    const x = Number(frame.left.replace('%', ''));
    const y = Number(frame.top.replace('%', ''));
    const u = frames.indexOf(frame) / (frames.length - 1);
    const t = u * u * (3 - 2 * u);
    const straightX = start.xPercent + (end.xPercent - start.xPercent) * t;
    const straightY = start.yPercent + (end.yPercent - start.yPercent) * t;
    maxOff = Math.max(maxOff, Math.hypot(x - straightX, y - straightY));
  }
  assert.ok(maxOff > 1.2, `expected a sine offset off the line, maxOff=${maxOff}`);
});

test('orange burst bullets use exactly double their prior travel time', () => {
  assert.equal(COMBAT_TIMING.burstProjectileMs, 1040);
});

test('white homing shots are modestly slower without doubling their travel time', () => {
  assert.equal(COMBAT_TIMING.homingMs, 1650);
  assert.ok(COMBAT_TIMING.homingMs < COMBAT_TIMING.burstProjectileMs * 2);
});

test('homing shots are slower than normal projectiles so the seek reads', () => {
  assert.ok(COMBAT_TIMING.homingMs > COMBAT_TIMING.projectileMs);
  assert.ok(COMBAT_TIMING.homingMs >= 1200);
});

test('sound helpers no-op safely without a browser audio context', async () => {
  const sound = await import('../src/sound.js');
  assert.equal(typeof sound.playCatDrop, 'function');
  assert.equal(typeof sound.playHit, 'function');
  assert.doesNotThrow(() => sound.playCatDrop());
  assert.doesNotThrow(() => sound.playHit());
  assert.doesNotThrow(() => sound.playHit({ heavy: true }));
  assert.doesNotThrow(() => sound.unlockAudio());
});

test('sound setting can be toggled and remembered', async () => {
  const memory = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => (memory.has(key) ? memory.get(key) : null),
      setItem: (key, value) => { memory.set(key, String(value)); },
    },
    AudioContext: undefined,
    webkitAudioContext: undefined,
    setTimeout: () => 0,
  };

  const sound = await import(`../src/sound.js?settings=${Date.now()}`);
  sound.setSoundEnabled(false);
  assert.equal(sound.isSoundEnabled(), false);
  assert.equal(memory.get(sound.SOUND_SETTING_KEY), '0');
  assert.doesNotThrow(() => sound.playCatDrop());
  assert.doesNotThrow(() => sound.playHit());

  sound.setSoundEnabled(true);
  assert.equal(sound.isSoundEnabled(), true);
  assert.equal(memory.get(sound.SOUND_SETTING_KEY), '1');
  assert.equal(sound.loadSoundEnabled(), true);

  delete globalThis.window;
});
