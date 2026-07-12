import {
  ROWS, COLS, CAT_ZONE_START, MAX_WAVES, REALTIME,
  CAT_COAT_INFO, DOG_STATS, DOG_ROLE_INFO, catStatsFor, normalizeCoat, catTooltipInfo, dogTooltipInfo,
  WORKER_INFO, createGame, advance, refreshShop, toggleSaveShopSlot,
  mergeUnitOnto, useActiveAbility,
  shopTierForRound, purchaseShopFighterToBoard,
  purchaseShopFighterOnto, purchaseShopWorker, moveWorker, mergeWorkerOnto,
  collectWorkerOutput, mergeInventoryItems, equipInventoryItem, useFood,
  catSaleQuote, sellCat,
} from './game-engine.js';
import { drawBackyard, drawCat, drawDog, drawWorker, drawStation, drawItem } from './pixel-art.js';
import { shopPetAvailability, hpTone, productionLegendRows, glossaryTabs, dogPreviewQueue, productionCollectionDestination, shopCardSummary, workerTooltipInfo } from './ui-state.js';
import { combatTiming, cellCenter, homingShotKeyframes } from './combat-animation.js';
import { unlockAudio, playCatDrop, playHit, playCollection, isSoundEnabled, setSoundEnabled, loadSoundEnabled } from './sound.js';
import { DRAG_FEEDBACK, DROP_IMPACT, getDropAction } from './drag-drop.js';
import { UPGRADE_TIMING, describeUpgrade } from './upgrade-animation.js';
import { BLUE_SCRATCH_FLURRY } from './melee-animation.js';

let game = createGame();
let dragState = null;
let suppressNextPetClick = false;
let dragHoverElement = null;
let pendingUpgrade = null;
let activeTargeting = null;
let glossaryTab = 'battle';
let manualPaused = false;
let glossaryPaused = false;
let blurPaused = document.hidden;
let pausedAnimations = [];
let resultShown = false;
const collectingStations = new Set();

/** Combat speed: 1× or 2×, persisted; reduced-motion users default to the shorter show. */
const SPEED_SETTING_KEY = 'cvd-combat-speed';
const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
let combatSpeed = loadCombatSpeed();
let timing = combatTiming(combatSpeed);

function loadCombatSpeed() {
  try {
    const raw = window.localStorage?.getItem(SPEED_SETTING_KEY);
    if (raw === '2') return 2;
    if (raw === '1') return 1;
  } catch {
    // Private mode / quota — fall through to the default.
  }
  return prefersReducedMotion ? 2 : 1;
}

function setCombatSpeed(speed) {
  combatSpeed = speed;
  timing = combatTiming(speed);
  try {
    window.localStorage?.setItem(SPEED_SETTING_KEY, String(speed));
  } catch {
    // Keep in-memory only.
  }
}

const $ = (selector) => document.querySelector(selector);
const shopEl = $('#shop');
const productionEl = $('#production-grid');
const dogPreviewEl = $('#dog-preview-grid');
const inventoryEl = $('#inventory');
const gridEl = $('#grid');
const unitsEl = $('#units');
const effectsEl = $('#effects');
const modalEl = $('#result-modal');
const settingsModalEl = $('#settings-modal');
const glossaryModalEl = $('#glossary-modal');
const soundToggleEl = $('#setting-sound');

let tooltipEl = document.querySelector('.unit-tooltip');
if (!tooltipEl) {
  tooltipEl = document.createElement('div');
  tooltipEl.className = 'unit-tooltip';
  tooltipEl.hidden = true;
  tooltipEl.setAttribute('role', 'tooltip');
  document.body.append(tooltipEl);
}

const TOOLTIP_HOVER_DELAY_MS = 450;
let tooltipTimer = null;
let tooltipPointer = { x: 0, y: 0 };

function clearTooltipTimer() {
  if (tooltipTimer != null) {
    window.clearTimeout(tooltipTimer);
    tooltipTimer = null;
  }
}

function hideUnitTooltip() {
  clearTooltipTimer();
  tooltipEl.hidden = true;
  tooltipEl.classList.remove('is-visible', 'kind-cat', 'kind-dog');
}

function showUnitTooltip(anchor, info, clientX, clientY) {
  if (!info) return;
  tooltipEl.className = `unit-tooltip kind-${info.kind} is-visible`;
  tooltipEl.hidden = false;
  tooltipEl.innerHTML = `
    <strong>${info.title}</strong>
    <span class="tooltip-stats">${info.stats}</span>
    <p class="tooltip-attack"><b>${info.detailLabel ?? 'Attack'}</b> ${info.attack}</p>
    <small class="tooltip-note">${info.note}</small>
  `;
  const pad = 12;
  const rect = tooltipEl.getBoundingClientRect();
  let left = (clientX ?? 0) + 14;
  let top = (clientY ?? 0) + 16;
  if (anchor && (clientX == null || clientY == null)) {
    const a = anchor.getBoundingClientRect();
    left = a.left + a.width / 2 - rect.width / 2;
    top = a.top - rect.height - 10;
  }
  left = Math.max(pad, Math.min(left, window.innerWidth - rect.width - pad));
  top = Math.max(pad, Math.min(top, window.innerHeight - rect.height - pad));
  tooltipEl.style.left = `${left}px`;
  tooltipEl.style.top = `${top}px`;
}

function bindTooltip(anchor, infoFactory) {
  const resolveInfo = () => (typeof infoFactory === 'function' ? infoFactory() : infoFactory);

  const scheduleShow = (event) => {
    clearTooltipTimer();
    tooltipPointer = { x: event.clientX, y: event.clientY };
    tooltipTimer = window.setTimeout(() => {
      tooltipTimer = null;
      // Only open if the pointer is still over this anchor.
      if (!anchor.matches(':hover') && document.activeElement !== anchor) return;
      showUnitTooltip(anchor, resolveInfo(), tooltipPointer.x, tooltipPointer.y);
    }, TOOLTIP_HOVER_DELAY_MS);
  };

  const move = (event) => {
    tooltipPointer = { x: event.clientX, y: event.clientY };
    if (tooltipEl.hidden) return;
    showUnitTooltip(anchor, resolveInfo(), event.clientX, event.clientY);
  };

  anchor.addEventListener('mouseenter', scheduleShow);
  anchor.addEventListener('mousemove', move);
  anchor.addEventListener('mouseleave', hideUnitTooltip);
  // Keyboard focus keeps a short delay so it matches hover behavior.
  anchor.addEventListener('focus', () => {
    clearTooltipTimer();
    tooltipTimer = window.setTimeout(() => {
      tooltipTimer = null;
      if (document.activeElement !== anchor) return;
      showUnitTooltip(anchor, resolveInfo());
    }, TOOLTIP_HOVER_DELAY_MS);
  });
  anchor.addEventListener('blur', hideUnitTooltip);
}

function unitCanvas(type, unit) {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  if (type === 'cat') drawCat(canvas, unit.level, unit.coat);
  else if (type === 'dog') drawDog(canvas, unit.tier, unit.role);
  else if (type === 'worker') drawWorker(canvas, unit.role, unit.level);
  else if (type === 'station') drawStation(canvas, unit.role);
  else if (type === 'item') drawItem(canvas, unit.kind, unit.tier ?? 1);
  return canvas;
}

function catLabel(cat) {
  return CAT_COAT_INFO[normalizeCoat(cat.coat)]?.shortName ?? 'Cat';
}

// ---------------------------------------------------------------------------
// Game clock: one requestAnimationFrame loop drives the whole battle.
// ---------------------------------------------------------------------------

function uiPaused() {
  return manualPaused || glossaryPaused || blurPaused;
}

function slowMoActive() {
  return Boolean(activeTargeting) || Boolean(dragState?.started);
}

function clockRate() {
  return combatSpeed * (slowMoActive() ? REALTIME.slowMoFactor : 1);
}

let lastFrameTs = null;

function frame(ts) {
  const dt = lastFrameTs == null ? 0 : Math.min(200, ts - lastFrameTs);
  lastFrameTs = ts;

  if (dt > 0 && !uiPaused() && game.phase === 'battle') {
    const advanced = advance(game, dt * clockRate());
    if (advanced !== game) {
      game = advanced;
      if (game.events.length) handleEvents(game.events);
    }
  }

  // Aiming with a dead caster would soft-lock slow-mo — release it.
  if (activeTargeting && !game.cats.some((cat) => cat.id === activeTargeting.casterId)) {
    activeTargeting = null;
    syncSlowMo();
  }

  syncUnits();
  updateClockUi();
  maybeShowResult();
  requestAnimationFrame(frame);
}

function syncSlowMo() {
  document.body.classList.toggle('slow-mo', slowMoActive() && game.phase === 'battle');
}

function maybeShowResult() {
  if (resultShown || (game.phase !== 'victory' && game.phase !== 'gameover')) return;
  resultShown = true;
  activeTargeting = null;
  syncSlowMo();
  renderSidePanels();
  window.setTimeout(showResult, 700);
}

// ---------------------------------------------------------------------------
// Units layer: one persistent element per living unit, moved via left/top.
// ---------------------------------------------------------------------------

const unitEls = new Map();
const dyingIds = new Set();
/** unit id → {count, expiresAt}: while held, syncUnits leaves hp/removal to the hit animation. */
const animLocks = new Map();

function lockUnit(id, forMs) {
  const entry = animLocks.get(id) ?? { count: 0, expiresAt: 0 };
  entry.count += 1;
  entry.expiresAt = Math.max(entry.expiresAt, performance.now() + forMs + 400);
  animLocks.set(id, entry);
}

function unlockUnit(id) {
  const entry = animLocks.get(id);
  if (!entry) return;
  entry.count -= 1;
  if (entry.count <= 0) animLocks.delete(id);
}

function unitLocked(id) {
  const entry = animLocks.get(id);
  if (!entry) return false;
  if (performance.now() > entry.expiresAt) {
    animLocks.delete(id);
    return false;
  }
  return true;
}

function catMarkup(cat) {
  const unit = document.createElement('div');
  unit.className = 'unit';
  unit.dataset.unitId = cat.id;
  unit.append(unitCanvas('cat', cat));
  unit.insertAdjacentHTML('beforeend', `
    <span class="unit-badge">L${cat.level}</span>
    <span class="copy-pips"></span>
    <span class="hp-wrap"><span class="hp-bar hp-full" style="width:100%"></span></span>`);
  return unit;
}

function dogMarkup(dog) {
  const unit = document.createElement('div');
  unit.className = 'unit';
  unit.dataset.unitId = dog.id;
  unit.append(unitCanvas('dog', dog));
  unit.insertAdjacentHTML('beforeend', `
    <span class="unit-badge">T${dog.tier}</span>
    <span class="hp-wrap"><span class="hp-bar hp-full" style="width:100%"></span></span>`);
  return unit;
}

function decoyMarkup(decoy) {
  const unit = document.createElement('div');
  unit.className = 'unit';
  unit.dataset.unitId = decoy.id;
  const visual = unitCanvas('cat', { level: 1, coat: 8 });
  visual.classList.add('decoy-unit');
  unit.append(visual);
  unit.insertAdjacentHTML('beforeend', `
    <span class="hp-wrap"><span class="hp-bar hp-full" style="width:100%"></span></span>`);
  return unit;
}

function liveCat(id) {
  return game.cats.find((cat) => cat.id === id) ?? null;
}

function liveDog(id) {
  return game.dogs.find((dog) => dog.id === id) ?? null;
}

function buildUnitElement(entity, type) {
  const el = document.createElement('div');
  el.className = `rt-unit rt-${type}`;
  el.dataset.unitId = entity.id;
  el.dataset.type = type;

  if (type === 'cat') {
    el.append(catMarkup(entity));
    el.insertAdjacentHTML('beforeend', '<span class="cd-ring"></span>');
    if (entity.activeAbility) el.insertAdjacentHTML('beforeend', '<span class="ability-badge"></span>');
    bindTooltip(el, () => {
      const cat = liveCat(entity.id);
      return cat ? catTooltipInfo(cat) : null;
    });
    bindPetDrag(el, 'cat', () => liveCat(entity.id));
    el.addEventListener('click', () => onCatUnitClick(entity.id));
  } else if (type === 'dog') {
    el.append(dogMarkup(entity));
    bindTooltip(el, () => {
      const dog = liveDog(entity.id);
      return dog ? dogTooltipInfo(dog) : null;
    });
    el.addEventListener('click', () => onDogUnitClick(entity.id));
  } else {
    el.append(decoyMarkup(entity));
  }
  // The frame loop touches these sixty times a second — resolve them once.
  el.refs = {
    hpBar: el.querySelector('.hp-bar'),
    badge: el.querySelector('.unit-badge'),
    pips: el.querySelector('.copy-pips'),
    ring: el.querySelector('.cd-ring'),
    abilityBadge: el.querySelector('.ability-badge'),
    canvas: el.querySelector('canvas'),
  };
  return el;
}

function updateUnitElement(el, entity, type) {
  const refs = el.refs ?? {};
  if (!unitLocked(entity.id) && refs.hpBar) {
    refs.hpBar.style.width = `${Math.max(0, (entity.hp / entity.maxHp) * 100)}%`;
    refs.hpBar.className = `hp-bar hp-${hpTone(entity.hp, entity.maxHp)}`;
  }

  if (type === 'cat') {
    const signature = `${entity.level}|${normalizeCoat(entity.coat)}`;
    if (el.dataset.signature !== signature) {
      el.dataset.signature = signature;
      if (refs.canvas) drawCat(refs.canvas, entity.level, entity.coat);
      if (refs.badge) refs.badge.textContent = `L${entity.level}`;
    }
    const copies = entity.copies ?? 1;
    if (refs.pips && Number(el.dataset.copies ?? 0) !== copies) {
      el.dataset.copies = String(copies);
      refs.pips.innerHTML = Array.from({ length: copies }, () => '<i></i>').join('');
    }
    if (refs.ring) {
      const progress = 1 - Math.min(1, Math.max(0, (entity.nextAttackAt - game.clockMs) / REALTIME.catAttackMs));
      refs.ring.style.setProperty('--p', progress.toFixed(3));
    }
    if (refs.abilityBadge) {
      const ready = game.clockMs >= (entity.abilityReadyAt ?? 0);
      refs.abilityBadge.classList.toggle('is-ready', ready);
      if ((refs.abilityBadge.textContent === '✦') !== ready) refs.abilityBadge.textContent = ready ? '✦' : '';
      if (!ready) {
        const progress = 1 - Math.min(1, Math.max(0, (entity.abilityReadyAt - game.clockMs) / REALTIME.abilityCooldownMs));
        refs.abilityBadge.style.setProperty('--p', progress.toFixed(3));
      }
      el.classList.toggle('has-ready-ability', ready);
    }
    el.classList.toggle('is-caster', activeTargeting?.casterId === entity.id);
    el.classList.toggle('ability-target', Boolean(activeTargeting) && isAbilityTargetCat(entity));
  } else if (type === 'dog') {
    el.classList.toggle('is-frozen', (entity.frozenActions ?? 0) > 0);
    el.classList.toggle('is-tangled', Boolean(entity.tangled));
    el.classList.toggle('ability-target', Boolean(activeTargeting) && isAbilityTargetDog());
  }
}

function isAbilityTargetDog() {
  return activeTargeting?.mode === 'freeze' || activeTargeting?.mode === 'storm';
}

function isAbilityTargetCat(cat) {
  if (!activeTargeting) return false;
  if (activeTargeting.mode === 'encore') return cat.id !== activeTargeting.casterId;
  if (activeTargeting.mode === 'teleport') return !activeTargeting.targetCatId;
  return false;
}

function removeUnitElement(id, el) {
  unitEls.delete(id);
  dyingIds.add(id);
  el.classList.add('rt-dying');
  window.setTimeout(() => {
    el.remove();
    dyingIds.delete(id);
  }, 360);
}

function syncUnits() {
  const seen = new Set();
  const place = (entity, type) => {
    seen.add(entity.id);
    let el = unitEls.get(entity.id);
    if (!el) {
      el = buildUnitElement(entity, type);
      unitEls.set(entity.id, el);
      unitsEl.append(el);
    }
    const position = cellCenter(entity.row, entity.col);
    el.style.left = `${position.xPercent}%`;
    el.style.top = `${position.yPercent}%`;
    updateUnitElement(el, entity, type);
  };

  game.cats.forEach((cat) => place(cat, 'cat'));
  game.dogs.forEach((dog) => place(dog, 'dog'));
  (game.decoys ?? []).forEach((decoy) => place(decoy, 'decoy'));

  for (const [id, el] of [...unitEls]) {
    if (!seen.has(id) && !unitLocked(id)) removeUnitElement(id, el);
  }
}

function clearUnits() {
  unitEls.forEach((el) => el.remove());
  unitEls.clear();
  dyingIds.clear();
  animLocks.clear();
  effectsEl.innerHTML = '';
}

// ---------------------------------------------------------------------------
// Per-frame HUD: gold counter, wave countdown, pause chip.
// ---------------------------------------------------------------------------

let workerRingSlots = [];
let lastGoldShown = null;
let lastWaveText = null;

function updateClockUi() {
  const gold = Math.floor(game.gold);
  if (gold !== lastGoldShown) {
    lastGoldShown = gold;
    $('#gold').textContent = gold;
  }

  const countdown = $('#wave-countdown');
  if (countdown) {
    if (game.phase === 'battle' && game.waveDueAt != null) {
      const remaining = Math.max(0, game.waveDueAt - game.clockMs);
      const text = `WAVE ${Math.min(MAX_WAVES, game.waveNumber + 1)} IN ${Math.ceil(remaining / 1000)}s`;
      if (text !== lastWaveText) {
        lastWaveText = text;
        countdown.textContent = text;
      }
      countdown.hidden = false;
      countdown.classList.toggle('is-soon', remaining < 5000);
    } else {
      countdown.hidden = true;
      lastWaveText = null;
    }
  }

  workerRingSlots.forEach(({ ring, index }) => {
    const worker = game.workers[index];
    if (!worker || worker.pendingOutput || worker.outputReadyAt == null) return;
    const progress = 1 - Math.min(1, Math.max(0, (worker.outputReadyAt - game.clockMs) / REALTIME.workerProduceMs));
    ring.style.setProperty('--p', progress.toFixed(3));
  });
}

// ---------------------------------------------------------------------------
// Event animations: everything schedules and returns — nothing blocks the clock.
// ---------------------------------------------------------------------------

function findUnitInner(id) {
  return unitEls.get(id)?.querySelector('.unit') ?? null;
}

function effectAt(className, row, col, text = '') {
  const position = cellCenter(row, col);
  const effect = document.createElement('i');
  effect.className = className;
  effect.style.left = `${position.xPercent}%`;
  effect.style.top = `${position.yPercent}%`;
  effect.textContent = text;
  effectsEl.append(effect);
  return effect;
}

function applyHitVisual(event, { heavy = false } = {}) {
  if (event.miss || !event.to) return;
  playHit({ heavy });
  const burst = effectAt('impact-burst', event.toRow, event.col);
  const tone = event.type === 'melee' || event.type === 'dog-shot' ? '' : ' to-dog';
  const damage = effectAt(`damage-number${tone}`, event.toRow, event.col, `-${event.damage}`);
  const inner = findUnitInner(event.to);
  if (inner) {
    inner.classList.remove('hurt');
    void inner.offsetWidth;
    inner.classList.add('hurt');
    const hpBar = inner.querySelector('.hp-bar');
    if (hpBar) {
      hpBar.style.width = `${Math.max(0, (event.hpAfter / event.maxHp) * 100)}%`;
      hpBar.className = `hp-bar hp-${hpTone(event.hpAfter, event.maxHp)}`;
    }
    window.setTimeout(() => inner.classList.remove('hurt'), timing.impactMs);
  }
  window.setTimeout(() => burst.remove(), timing.impactMs);
  window.setTimeout(() => damage.remove(), timing.impactMs + timing.hpPauseMs);
}

/** Impact resolution shared by every damaging animation. */
function resolveHit(event, options = {}) {
  applyHitVisual(event, options);
  unlockUnit(event.to);
  if (event.hpAfter <= 0) {
    const el = unitEls.get(event.to);
    if (el) removeUnitElement(event.to, el);
  }
}

function scheduleShot(event, index = 0) {
  const isBurst = Boolean(event.burst);
  const isHoming = event.style === 'homing' || event.style === 'medic';
  const stagger = isBurst
    ? (event.pelletIndex ?? 0) * timing.burstStaggerMs + index * 8
    : index * timing.shotStaggerMs;
  const flightMs = isHoming ? timing.homingMs : isBurst ? timing.burstProjectileMs : timing.projectileMs;

  if (!event.miss && event.to) lockUnit(event.to, stagger + flightMs);

  window.setTimeout(() => {
    const fromCol = event.fromCol ?? event.col;
    const start = cellCenter(event.fromRow, fromCol);
    const end = cellCenter(event.toRow, event.col);
    const projectileStyle = event.style ? `${event.style}-projectile` : '';
    const projectile = effectAt(
      `projectile-effect ${isHoming ? 'homing-projectile' : ''} ${isBurst ? 'burst-projectile' : ''} ${projectileStyle}`.trim(),
      event.fromRow,
      fromCol,
    );
    const flight = projectile.animate(
      isHoming
        ? homingShotKeyframes(start, end)
        : [
          { left: `${start.xPercent}%`, top: `${start.yPercent}%`, transform: 'translate(-50%, -50%) scale(.7) rotate(0deg)' },
          { left: `${end.xPercent}%`, top: `${end.yPercent}%`, transform: `translate(-50%, -50%) scale(${isBurst ? 0.95 : 1.15}) rotate(360deg)` },
        ],
      { duration: flightMs, easing: 'linear', fill: 'forwards' },
    );
    flight.finished.catch(() => {}).then(() => {
      projectile.remove();
      if (event.miss || !event.to) {
        const fizzle = effectAt('impact-burst miss-fizzle', event.toRow, event.col);
        window.setTimeout(() => fizzle.remove(), timing.impactMs);
        return;
      }
      resolveHit(event);
    });
  }, stagger);
}

function scheduleMelee(event, direction = 'down') {
  const attacker = findUnitInner(event.from);
  const className = direction === 'up' ? 'melee-lunge-up' : 'melee-lunge';
  attacker?.classList.add(className);
  if (!event.miss && event.to) lockUnit(event.to, timing.meleeMs);
  window.setTimeout(() => {
    if (!event.miss && event.to) resolveHit(event, { heavy: true });
  }, Math.floor(timing.meleeMs / 2));
  window.setTimeout(() => attacker?.classList.remove(className), timing.meleeMs);
}

function scheduleCatScratch(event) {
  const attacker = findUnitInner(event.from);
  const flurry = document.createElement('span');
  flurry.className = BLUE_SCRATCH_FLURRY.effectClass;
  for (const side of ['left', 'right']) {
    const paw = document.createElement('i');
    paw.className = `scratch-paw scratch-paw-${side}`;
    flurry.append(paw);
  }
  for (let index = 0; index < BLUE_SCRATCH_FLURRY.swipes; index += 1) {
    const claw = document.createElement('i');
    claw.className = `scratch-claw scratch-claw-${index + 1}`;
    flurry.append(claw);
  }
  attacker?.classList.add(BLUE_SCRATCH_FLURRY.attackerClass);
  attacker?.append(flurry);

  const hitAt = Math.round(BLUE_SCRATCH_FLURRY.hitAtMs / combatSpeed);
  const total = Math.round(BLUE_SCRATCH_FLURRY.durationMs / combatSpeed);
  if (!event.miss && event.to) lockUnit(event.to, hitAt);
  window.setTimeout(() => {
    if (!event.miss && event.to) resolveHit(event, { heavy: true });
  }, hitAt);
  window.setTimeout(() => {
    flurry.remove();
    attacker?.classList.remove(BLUE_SCRATCH_FLURRY.attackerClass);
  }, total);
}

function scheduleDogJump(event) {
  const inner = findUnitInner(event.id);
  if (!inner) return;
  inner.animate([
    { transform: 'translateY(-30%) scale(1)' },
    { transform: 'translateY(-12%) scale(1.16) rotate(-8deg)', offset: 0.46 },
    { transform: 'translateY(0) scale(1) rotate(0deg)' },
  ], { duration: Math.round(timing.movePauseMs * 1.45), easing: 'steps(6)' });
}

function scheduleHowl(event) {
  const inner = findUnitInner(event.id);
  const pulse = effectAt('howl-effect', event.row, event.col, `HOWL! +${event.bonus}`);
  inner?.classList.add('dog-howling');
  event.targets?.forEach((id) => findUnitInner(id)?.classList.add('pack-buffed'));
  window.setTimeout(() => {
    inner?.classList.remove('dog-howling');
    event.targets?.forEach((id) => findUnitInner(id)?.classList.remove('pack-buffed'));
    pulse.remove();
  }, Math.round(timing.meleeMs * 2.5));
}

function scheduleHeal(event) {
  const inner = findUnitInner(event.to);
  const heal = effectAt('heal-number', event.row, event.col, `+${event.amount} ♥`);
  inner?.classList.add('healed');
  const hpBar = inner?.querySelector('.hp-bar');
  if (hpBar) {
    hpBar.style.width = `${Math.max(0, (event.hpAfter / event.maxHp) * 100)}%`;
    hpBar.className = `hp-bar hp-${hpTone(event.hpAfter, event.maxHp)}`;
  }
  window.setTimeout(() => {
    heal.remove();
    inner?.classList.remove('healed');
  }, Math.round(680 / combatSpeed));
}

function scheduleSuperCat(event) {
  const runner = document.createElement('div');
  runner.className = 'super-effect';
  runner.style.left = `${event.col * (100 / COLS)}%`;
  const canvas = document.createElement('canvas');
  drawCat(canvas, 3, 0, true);
  runner.append(canvas);
  effectsEl.append(runner);
  window.setTimeout(() => runner.remove(), Math.round(720 / combatSpeed));
}

function scheduleFloatingCue(event, text, className = 'heal-number') {
  const cue = effectAt(className, event.row, event.col, text);
  window.setTimeout(() => cue.remove(), Math.round(650 / combatSpeed));
}

/** Drop-in banner naming the wave that just walked through the gate. */
function announceWave(waveNumber) {
  const banner = $('#wave-banner');
  if (!banner) return;
  const fresh = game.dogs.filter((dog) => dog.row === 0);
  const roleCounts = fresh.reduce((counts, dog) => {
    counts[dog.role] = (counts[dog.role] ?? 0) + 1;
    return counts;
  }, {});
  const parts = Object.entries(roleCounts).map(([role, count]) => {
    const name = DOG_ROLE_INFO[role]?.name ?? 'Dog';
    return `${count > 1 ? `${count}× ` : ''}${name.toUpperCase()}`;
  });
  banner.innerHTML = `WAVE ${waveNumber} · ${parts.join(' + ') || 'INCOMING'}`;
  banner.hidden = false;
  window.setTimeout(() => { banner.hidden = true; }, Math.round(1300 / combatSpeed));
}

function handleEvents(events) {
  let panelsDirty = false;
  let shotIndex = 0;
  for (const event of events) {
    switch (event.type) {
      case 'shot':
        scheduleShot(event, shotIndex);
        shotIndex += event.burst ? 0 : 1;
        break;
      case 'spell':
        resolveHit(event);
        scheduleFloatingCue(event, '⚡', 'damage-number to-dog');
        break;
      case 'cat-melee':
        scheduleCatScratch(event);
        break;
      case 'melee':
        scheduleMelee(event, 'down');
        break;
      case 'dog-shot':
        scheduleShot(event, shotIndex);
        shotIndex += 1;
        break;
      case 'dog-jump':
        scheduleDogJump(event);
        break;
      case 'howl':
        scheduleHowl(event);
        break;
      case 'freeze-cast':
        scheduleFloatingCue({ row: event.row, col: event.col }, '❄');
        break;
      case 'freeze-skip':
        scheduleFloatingCue(event, '❄ FROZEN');
        break;
      case 'tangle-skip':
        scheduleFloatingCue(event, '✱ TANGLED');
        break;
      case 'teleport':
        scheduleFloatingCue({ row: event.fromRow, col: event.fromCol }, '✧');
        scheduleFloatingCue({ row: event.row, col: event.col }, '✧');
        break;
      case 'decoy-cast':
        scheduleFloatingCue(event, '✦');
        break;
      case 'item-heal':
        scheduleHeal(event);
        panelsDirty = true;
        break;
      case 'super-cat':
        scheduleSuperCat(event);
        break;
      case 'wave':
        announceWave(event.wave);
        panelsDirty = true;
        break;
      case 'worker-output-ready':
      case 'collect-output':
      case 'sell-cat':
      case 'sell-worker':
      case 'combine':
      case 'worker-combine':
      case 'equip':
      case 'item-merge':
      case 'encore':
      case 'level-clear':
        panelsDirty = true;
        break;
      default:
        break;
    }
  }
  if (panelsDirty) renderSidePanels();
}

// ---------------------------------------------------------------------------
// Drag and drop (live at all times unless paused).
// ---------------------------------------------------------------------------

function dragSource(type, cat) {
  if (type === 'shop-worker') return { type, id: cat.id, shopIndex: cat.shopIndex, level: cat.level ?? 1, role: cat.role };
  if (type === 'shop-fighter') return { type, id: cat.id, shopIndex: cat.shopIndex, level: cat.level ?? 1, coat: normalizeCoat(cat.coat) };
  if (type === 'worker') return { type, id: cat.id, workerIndex: cat.workerIndex, level: cat.level, role: cat.role };
  if (type === 'item') return { type, inventoryIndex: cat.inventoryIndex, itemKind: cat.kind, tier: cat.tier ?? 1 };
  const sale = catSaleQuote(game, type, cat.id);
  return {
    type,
    id: cat.id,
    level: cat.level,
    coat: normalizeCoat(cat.coat),
    ability: cat.ability,
    sellable: sale.canSell,
    sellValue: sale.value,
    sellReason: sale.reason,
  };
}

function cellDescriptorAt(row, col) {
  const occupied = game.cats.find((cat) => cat.row === row && cat.col === col);
  if (dragState?.source.type === 'item' && occupied) {
    return { kind: 'fighter', id: occupied.id, hp: occupied.hp, maxHp: occupied.maxHp };
  }
  return {
    kind: 'cell', row, col,
    occupied: occupied ? { id: occupied.id, level: occupied.level, coat: normalizeCoat(occupied.coat) } : null,
  };
}

function targetFromElement(element) {
  const adoptionBox = element?.closest?.('.adoption-box');
  if (adoptionBox) return { element: adoptionBox, descriptor: { kind: 'sell' } };
  const workerSlot = element?.closest?.('.worker-slot');
  if (workerSlot) {
    const index = Number(workerSlot.dataset.workerIndex);
    const occupied = game.workers[index];
    return {
      element: workerSlot,
      descriptor: {
        kind: 'worker-slot', index,
        occupied: occupied ? { id: occupied.id, level: occupied.level, role: occupied.role } : null,
      },
    };
  }
  // Persistent unit elements sit above the grid — map them back to their square.
  const unitEl = element?.closest?.('.rt-unit');
  if (unitEl) {
    const cat = game.cats.find((unit) => unit.id === unitEl.dataset.unitId);
    if (cat) return { element: unitEl, descriptor: cellDescriptorAt(cat.row, cat.col) };
    const dog = game.dogs.find((unit) => unit.id === unitEl.dataset.unitId);
    if (dog) return { element: unitEl, descriptor: cellDescriptorAt(dog.row, dog.col) };
    return { element: null, descriptor: null };
  }
  const cell = element?.closest?.('.cell');
  if (cell) {
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    return { element: cell, descriptor: cellDescriptorAt(row, col) };
  }
  return { element: null, descriptor: null };
}

function dropAction(source, descriptor) {
  return getDropAction({
    source,
    target: descriptor,
    catZoneStart: CAT_ZONE_START,
    rows: ROWS,
    cols: COLS,
  });
}

function clearDragHighlights() {
  document.querySelectorAll('.drag-valid, .drag-over, .drag-invalid-hover, .drag-origin')
    .forEach((element) => element.classList.remove('drag-valid', 'drag-over', 'drag-invalid-hover', 'drag-origin'));
  dragHoverElement = null;
}

function makeDragGhost(cat, sourceRect, source) {
  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  ghost.style.width = `${Math.max(64, sourceRect.width)}px`;
  ghost.style.height = `${Math.max(64, sourceRect.height)}px`;
  const visualType = source.type === 'worker' || source.type === 'shop-worker'
    ? 'worker'
    : source.type === 'item' ? 'item' : 'cat';
  ghost.append(unitCanvas(visualType, cat));
  const label = visualType === 'worker'
    ? WORKER_INFO[cat.role].shortName
    : visualType === 'item' ? cat.kind.toUpperCase() : catLabel(cat);
  ghost.insertAdjacentHTML('beforeend', `<b>${visualType === 'item' ? `T${cat.tier ?? 1}` : `L${cat.level}`}</b><small>${label}</small>`);
  document.body.append(ghost);

  const shadow = document.createElement('div');
  shadow.className = 'drag-floor-shadow';
  document.body.append(shadow);
  return { ghost, shadow };
}

function positionDragVisual(x, y) {
  if (!dragState?.ghost) return;
  dragState.ghost.style.left = `${x}px`;
  dragState.ghost.style.top = `${y}px`;
  dragState.shadow.style.left = `${x}px`;
  dragState.shadow.style.top = `${y + 32}px`;
}

function showValidDropTargets(source) {
  document.querySelectorAll('.cell, .worker-slot, .adoption-box').forEach((element) => {
    const { descriptor } = targetFromElement(element);
    if (dropAction(source, descriptor).type !== 'invalid') element.classList.add('drag-valid');
  });
}

function startDragVisual(event) {
  if (!dragState || dragState.started) return;
  dragState.started = true;
  suppressNextPetClick = true;
  hideUnitTooltip();
  syncSlowMo();
  dragState.sourceElement.classList.add('drag-origin');
  const visuals = makeDragGhost(dragState.cat, dragState.sourceRect, dragState.source);
  dragState.ghost = visuals.ghost;
  dragState.shadow = visuals.shadow;
  document.body.classList.add('pet-dragging');
  if (dragState.source.type === 'cat') {
    document.body.classList.add('cat-sell-dragging');
    const adoptionBox = $('#adoption-box');
    adoptionBox?.classList.toggle('sale-blocked', !dragState.source.sellable);
    $('#adoption-box-value').textContent = `+${dragState.source.sellValue}`;
    $('#adoption-box-hint').textContent = dragState.source.sellable
      ? `Release to adopt · +${dragState.source.sellValue} gold`
      : dragState.source.sellReason;
  }
  positionDragVisual(event.clientX, event.clientY);
  showValidDropTargets(dragState.source);
  requestAnimationFrame(() => dragState?.ghost?.classList.add('is-lifted'));
}

function updateDragHover(clientX, clientY) {
  if (!dragState?.started) return;
  const hit = document.elementFromPoint(clientX, clientY);
  const target = targetFromElement(hit);
  const action = dropAction(dragState.source, target.descriptor);
  if (dragHoverElement !== target.element) {
    dragHoverElement?.classList.remove('drag-over', 'drag-invalid-hover');
    dragHoverElement = target.element;
  }
  dragState.ghost.classList.toggle('can-drop', action.type !== 'invalid');
  dragState.ghost.classList.toggle('cannot-drop', action.type === 'invalid');
  if (target.element) target.element.classList.add(action.type === 'invalid' ? 'drag-invalid-hover' : 'drag-over');
}

function bindPetDrag(anchor, type, catOrFactory) {
  anchor.classList.add('pet-draggable');
  anchor.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || uiPaused() || dragState || game.phase !== 'battle') return;
    const cat = typeof catOrFactory === 'function' ? catOrFactory() : catOrFactory;
    if (!cat) return;
    const rect = anchor.getBoundingClientRect();
    dragState = {
      pointerId: event.pointerId,
      source: dragSource(type, cat),
      cat,
      sourceElement: anchor,
      sourceRect: rect,
      startX: event.clientX,
      startY: event.clientY,
      started: false,
      ghost: null,
      shadow: null,
    };
  });
}

function onDragMove(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY);
  if (!dragState.started && distance >= DRAG_FEEDBACK.thresholdPx) startDragVisual(event);
  if (!dragState.started) return;
  event.preventDefault();
  positionDragVisual(event.clientX, event.clientY);
  updateDragHover(event.clientX, event.clientY);
}

async function animateGhostTo(rect, valid) {
  if (!dragState?.ghost || !rect) return;
  const animation = dragState.ghost.animate([
    { left: dragState.ghost.style.left, top: dragState.ghost.style.top, transform: `translate(-50%, -50%) scale(${DRAG_FEEDBACK.hoverScale}) rotate(-2deg)` },
    { left: `${rect.left + rect.width / 2}px`, top: `${rect.top + rect.height / 2}px`, transform: `translate(-50%, -50%) scale(${valid ? DROP_IMPACT.ghostSettleScale : 0.68}) rotate(0deg)`, opacity: valid ? 1 : .3 },
  ], {
    duration: valid ? DRAG_FEEDBACK.dropMs : DRAG_FEEDBACK.returnMs,
    easing: valid ? 'cubic-bezier(.2,.85,.25,1.1)' : 'cubic-bezier(.4,0,.2,1)',
    fill: 'forwards',
  });
  await animation.finished.catch(() => {});
}

function catFromState(state, targetId) {
  return state.cats.find((cat) => cat.id === targetId) ?? state.bench.find((cat) => cat.id === targetId);
}

function queueUpgradeReveal(beforeState, afterState, targetId) {
  const before = catFromState(beforeState, targetId);
  const after = catFromState(afterState, targetId);
  const reveal = describeUpgrade(before, after);
  if (!reveal) return null;
  pendingUpgrade = { ...reveal, targetId };
  return reveal;
}

function playPendingUpgrade() {
  if (!pendingUpgrade) return;
  const reveal = pendingUpgrade;
  pendingUpgrade = null;
  const anchor = unitEls.get(reveal.targetId);
  if (!anchor) return;

  const rect = anchor.getBoundingClientRect();
  const overlay = document.createElement('div');
  overlay.className = `upgrade-reveal upgrade-${reveal.intensity}`;
  overlay.style.left = `${rect.left + rect.width / 2}px`;
  overlay.style.top = `${rect.top + rect.height / 2}px`;
  overlay.style.width = `${Math.max(58, rect.width)}px`;
  overlay.style.height = `${Math.max(58, rect.height)}px`;

  const radiance = document.createElement('span');
  radiance.className = 'upgrade-radiance';
  const smoke = document.createElement('span');
  smoke.className = 'upgrade-smoke';
  const vectors = [[-32,-18],[-12,-35],[14,-36],[34,-15],[-36,12],[-15,28],[16,30],[38,10]];
  vectors.forEach(([x, y], index) => {
    const puff = document.createElement('i');
    puff.style.setProperty('--smoke-x', `${x}px`);
    puff.style.setProperty('--smoke-y', `${y}px`);
    puff.style.setProperty('--smoke-delay', `${index * 24}ms`);
    smoke.append(puff);
  });
  const badge = document.createElement('b');
  badge.className = 'upgrade-callout';
  badge.textContent = reveal.label;
  const note = document.createElement('em');
  note.textContent = reveal.kind === 'level-up' ? 'NEW LOOK!' : 'STACKED!';
  overlay.append(radiance, smoke, badge, note);
  document.body.append(overlay);

  anchor.classList.add('upgrade-transforming', `upgrade-${reveal.intensity}`);
  if (reveal.kind === 'level-up') $('#board')?.classList.add('upgrade-board-pulse');
  requestAnimationFrame(() => {
    overlay.classList.add('is-revealing');
    window.setTimeout(() => anchor.classList.add('upgrade-revealed'), UPGRADE_TIMING.revealDelayMs);
  });

  window.setTimeout(() => {
    anchor.classList.remove('upgrade-transforming', 'upgrade-revealed', `upgrade-${reveal.intensity}`);
    $('#board')?.classList.remove('upgrade-board-pulse');
    overlay.remove();
  }, UPGRADE_TIMING.totalMs);
}

function applyDropAction(action, source) {
  const before = game;
  if (action.type === 'purchase-place') {
    game = purchaseShopFighterToBoard(game, source.shopIndex, action.row, action.col);
  } else if (action.type === 'purchase-merge') {
    game = purchaseShopFighterOnto(game, source.shopIndex, action.targetType, action.targetId);
    if (game !== before) queueUpgradeReveal(before, game, action.targetId);
  } else if (action.type === 'purchase-worker') {
    game = purchaseShopWorker(game, source.shopIndex, action.index);
  } else if (action.type === 'move-worker') {
    game = moveWorker(game, source.workerIndex, action.index);
  } else if (action.type === 'merge-worker') {
    game = mergeWorkerOnto(game, source.workerIndex, action.index);
  } else if (action.type === 'use-food') {
    game = useFood(game, source.inventoryIndex, action.targetId);
  } else if (action.type === 'equip') {
    game = equipInventoryItem(game, source.inventoryIndex, 'cat', action.targetId);
  } else if (action.type === 'merge') {
    game = mergeUnitOnto(game, source.type, source.id, action.targetType, action.targetId);
    if (game !== before) queueUpgradeReveal(before, game, action.targetId);
  } else if (action.type === 'sell') {
    game = sellCat(game, source.type, source.id);
  }
  if (game !== before && game.events.length) handleEvents(game.events);
  return game !== before;
}

function showDropWeight(action, descriptor) {
  if (descriptor?.kind !== 'cell') return;
  const cell = document.querySelector(`.cell[data-row="${descriptor.row}"][data-col="${descriptor.col}"]`);
  cell?.classList.add('cat-landed');
  $('#board')?.classList.add('board-drop-thump');
  const ring = effectAt('cat-drop-ring', descriptor.row, descriptor.col);
  const dust = effectAt('cat-drop-dust', descriptor.row, descriptor.col, '✦');
  window.setTimeout(() => {
    cell?.classList.remove('cat-landed');
    $('#board')?.classList.remove('board-drop-thump');
    ring.remove();
    dust.remove();
  }, 520);
}

function showAdoptionFeedback(cat, value) {
  const box = $('#adoption-box');
  if (!box) return;
  const pet = document.createElement('span');
  pet.className = 'adoption-pet';
  pet.append(unitCanvas('cat', cat));
  const coin = document.createElement('b');
  coin.className = 'adoption-coin';
  coin.textContent = `● +${value}`;
  box.append(pet, coin);
  box.classList.add('adoption-success');
  $('#gold')?.classList.add('gold-gained');
  window.setTimeout(() => {
    pet.remove();
    coin.remove();
    box.classList.remove('adoption-success');
    $('#gold')?.classList.remove('gold-gained');
  }, 760);
}

function cleanupDragVisual(state) {
  state.ghost?.remove();
  state.shadow?.remove();
  document.body.classList.remove('pet-dragging');
  document.body.classList.remove('cat-sell-dragging');
  $('#adoption-box')?.classList.remove('sale-blocked');
  clearDragHighlights();
}

async function finishDrag(event, cancelled = false) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const state = dragState;
  if (!state.started) {
    dragState = null;
    return;
  }
  event.preventDefault();
  const hit = cancelled ? null : document.elementFromPoint(event.clientX, event.clientY);
  const target = targetFromElement(hit);
  const action = cancelled ? { type: 'invalid' } : dropAction(state.source, target.descriptor);
  const valid = action.type !== 'invalid';
  const destinationRect = valid && target.element ? target.element.getBoundingClientRect() : state.sourceRect;
  await animateGhostTo(destinationRect, valid);
  dragState = null;
  syncSlowMo();
  cleanupDragVisual(state);
  // The drag-ending click usually lands on a shared ancestor, so no cell handler
  // consumes the suppress flag — clear it once the click phase has passed.
  window.setTimeout(() => { suppressNextPetClick = false; }, 0);

  if (!valid) {
    game.message = action.reason === 'placement-permanent'
      ? 'Placed cats hold their ground — sell them or let Purrtal teleport them.'
      : target.descriptor?.kind === 'sell' && state.source.sellReason
        ? state.source.sellReason
        : 'That is not a valid drop. Cats defend the four glowing rows and merge with the same color + level.';
    renderSidePanels();
    return;
  }

  const changed = applyDropAction(action, state.source);
  if (changed) {
    game.message = action.type === 'sell'
      ? game.message
      : action.type === 'merge' || action.type === 'purchase-merge'
        ? pendingUpgrade?.kind === 'level-up'
          ? `${pendingUpgrade.label} New gear unlocked!`
          : 'Matching cats stacked — one step closer to evolving!'
        : action.type === 'use-food' || action.type === 'equip'
          ? game.message
          : 'Cat deployed!';
    playCatDrop();
  }
  renderSidePanels();
  syncUnits();
  if (changed && action.type === 'sell') showAdoptionFeedback(state.cat, action.value);
  else if (changed && (action.type === 'purchase-place' || action.type === 'purchase-worker')) showDropWeight(action, target.descriptor);
  playPendingUpgrade();
}

// ---------------------------------------------------------------------------
// Active abilities: tap a READY cat, then tap its target. Slow-mo while aiming.
// ---------------------------------------------------------------------------

const ACTIVE_COPY = {
  freeze: ['FREEZE', 'Tap a dog to skip its next action.'],
  teleport: ['PORTAL', 'Tap an ally, then any empty cat square.'],
  decoy: ['DECOY', 'Tap an empty cat square for a phantom blocker.'],
  storm: ['STORM', 'Tap any dog to strike its whole column.'],
  encore: ['ENCORE', 'Tap another cat for an immediate attack.'],
};

function cancelTargeting(message = null) {
  if (!activeTargeting) return;
  activeTargeting = null;
  if (message) game.message = message;
  syncSlowMo();
  renderMessage();
  updateCellTargetHighlights();
}

function castAbility(payload) {
  const before = game;
  game = useActiveAbility(game, activeTargeting.casterId, payload);
  if (game === before) {
    game.message = ACTIVE_COPY[activeTargeting.mode]?.[1] ?? 'That is not a valid target.';
    renderMessage();
    return false;
  }
  activeTargeting = null;
  syncSlowMo();
  if (game.events.length) handleEvents(game.events);
  $('#board')?.classList.add('ability-cast');
  window.setTimeout(() => $('#board')?.classList.remove('ability-cast'), 420);
  renderSidePanels();
  syncUnits();
  return true;
}

function onCatUnitClick(catId) {
  if (suppressNextPetClick) {
    suppressNextPetClick = false;
    return;
  }
  if (uiPaused() || game.phase !== 'battle') return;
  const cat = liveCat(catId);
  if (!cat) return;

  if (activeTargeting) {
    if (activeTargeting.casterId === catId) {
      cancelTargeting('Ability aiming cancelled.');
      return;
    }
    if (activeTargeting.mode === 'encore') {
      castAbility({ targetCatId: catId });
      return;
    }
    if (activeTargeting.mode === 'teleport' && !activeTargeting.targetCatId) {
      activeTargeting = { ...activeTargeting, targetCatId: catId };
      game.message = 'Now tap any empty cat-territory square.';
      renderMessage();
      updateCellTargetHighlights();
      return;
    }
    return;
  }

  if (cat.activeAbility && game.clockMs >= (cat.abilityReadyAt ?? 0)) {
    const copy = ACTIVE_COPY[cat.activeAbility] ?? ['CAST', 'Tap a target.'];
    activeTargeting = { casterId: catId, mode: cat.activeAbility, targetCatId: null };
    game.message = `${copy[0]} ready — ${copy[1]} Tap the caster again to cancel.`;
    syncSlowMo();
    renderMessage();
    updateCellTargetHighlights();
  }
}

function onDogUnitClick(dogId) {
  if (suppressNextPetClick) {
    suppressNextPetClick = false;
    return;
  }
  if (uiPaused() || !activeTargeting) return;
  const dog = liveDog(dogId);
  if (!dog) return;
  if (activeTargeting.mode === 'freeze') castAbility({ dogId });
  else if (activeTargeting.mode === 'storm') castAbility({ col: dog.col });
}

function onCellClick(row, col) {
  if (suppressNextPetClick) {
    suppressNextPetClick = false;
    return;
  }
  if (uiPaused() || !activeTargeting || game.phase !== 'battle') return;
  const occupied = game.cats.some((cat) => cat.row === row && cat.col === col)
    || (game.decoys ?? []).some((decoy) => decoy.row === row && decoy.col === col);
  if (activeTargeting.mode === 'decoy' && row >= CAT_ZONE_START && !occupied) {
    castAbility({ row, col });
  } else if (activeTargeting.mode === 'teleport' && activeTargeting.targetCatId && row >= CAT_ZONE_START && !occupied) {
    castAbility({ targetCatId: activeTargeting.targetCatId, row, col });
  }
}

// ---------------------------------------------------------------------------
// Static board grid: drop targets, targeting highlights, and empty-square taps.
// ---------------------------------------------------------------------------

function buildBoardGrid() {
  gridEl.innerHTML = '';
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const cell = document.createElement('button');
      cell.className = `cell ${row >= CAT_ZONE_START ? 'cat-zone' : ''} ${row === CAT_ZONE_START ? 'middle' : ''}`;
      cell.dataset.row = row;
      cell.dataset.col = col;
      const zone = row >= CAT_ZONE_START ? 'cat territory' : 'dog yard';
      cell.setAttribute('aria-label', `${zone}, row ${row + 1} column ${col + 1}`);
      cell.addEventListener('click', () => onCellClick(row, col));
      gridEl.append(cell);
    }
  }
}

/** Cat-zone squares glow while an area ability is waiting for a square. */
function updateCellTargetHighlights() {
  const active = activeTargeting
    && (activeTargeting.mode === 'decoy' || (activeTargeting.mode === 'teleport' && activeTargeting.targetCatId));
  gridEl.querySelectorAll('.cell').forEach((cell) => {
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    const occupied = game.cats.some((cat) => cat.row === row && cat.col === col)
      || (game.decoys ?? []).some((decoy) => decoy.row === row && decoy.col === col);
    cell.classList.toggle('ability-target', Boolean(active) && row >= CAT_ZONE_START && !occupied);
  });
}

// ---------------------------------------------------------------------------
// Side panels (shop, production, storage, preview, HUD text, legends).
// ---------------------------------------------------------------------------

function showShopPurchaseDenied(button, reason) {
  const goldChip = $('#gold')?.closest('.hud-chip');
  button.classList.remove('purchase-denied');
  goldChip?.classList.remove('gold-denied');
  void button.offsetWidth;
  button.classList.add('purchase-denied');
  if (reason === 'gold') goldChip?.classList.add('gold-denied');

  game.message = reason === 'gold'
    ? `Not enough gold — this pet costs 3 and you have ${game.gold}.`
    : 'This pet is paused right now.';
  renderMessage();

  window.setTimeout(() => {
    button.classList.remove('purchase-denied');
    goldChip?.classList.remove('gold-denied');
  }, 560);
}

function renderShop() {
  shopEl.innerHTML = '';
  shopEl.dataset.count = String(game.shop.length);
  game.shop.forEach((slot, index) => {
    const isWorker = slot.category === 'worker';
    const info = isWorker ? WORKER_INFO[slot.role] : CAT_COAT_INFO[normalizeCoat(slot.coat)];
    const summary = shopCardSummary(slot, info);
    const availability = shopPetAvailability({ sold: slot.sold, gold: game.gold, paused: uiPaused() });
    const wrap = document.createElement('div');
    wrap.className = `shop-slot ${slot.saved ? 'saved' : ''} ${slot.sold ? 'sold' : ''} ${availability.reason === 'gold' ? 'unaffordable' : ''} ${isWorker ? 'worker-offer' : 'fighter-offer'}`;

    const button = document.createElement('button');
    button.className = 'shop-card';
    button.disabled = !availability.interactive;
    button.setAttribute('aria-disabled', availability.canBuy ? 'false' : 'true');
    button.append(unitCanvas(isWorker ? 'worker' : 'cat', slot));
    button.insertAdjacentHTML('beforeend', `
      <span class="shop-tier">${summary.badge}</span>
      <strong>${summary.name}</strong>
      <span class="price">● ${summary.cost}</span>`);
    button.addEventListener('click', () => {
      if (!availability.canBuy) {
        showShopPurchaseDenied(button, availability.reason);
        return;
      }
      game.message = isWorker
        ? `Drag ${info.name} into the Production Yard.`
        : `Drag ${info.name} onto the battlefield or a matching fighter.`;
      renderMessage();
    });
    bindPetDrag(button, isWorker ? 'shop-worker' : 'shop-fighter', { ...slot, shopIndex: index });
    bindTooltip(button, () => isWorker ? workerTooltipInfo(slot, info) : catTooltipInfo(slot));

    const save = document.createElement('button');
    save.type = 'button';
    save.className = `shop-save ${slot.saved ? 'is-saved' : ''}`;
    save.textContent = slot.saved ? 'Saved' : 'Save';
    save.title = slot.saved
      ? 'Unsave this pet so it can refresh'
      : 'Save this pet through refresh and the next wave';
    save.setAttribute('aria-pressed', slot.saved ? 'true' : 'false');
    save.disabled = slot.sold || uiPaused();
    save.addEventListener('click', (event) => {
      event.stopPropagation();
      game = toggleSaveShopSlot(game, index);
      renderSidePanels();
    });

    wrap.append(button, save);
    shopEl.append(wrap);
  });
}

const COLLECTION_TIMING = Object.freeze({ sourceMs: 280, flightMs: 430, cueMs: 900 });

function collectionTargetElement(destination) {
  if (destination?.type === 'gold') return $('#gold')?.closest('.hud-chip') ?? null;
  if (destination?.type === 'storage') return inventoryEl?.querySelector(`[data-inventory-index="${destination.index}"]`) ?? null;
  return null;
}

function flyCollectedOutput(output, sourceRect, targetRect) {
  if (!sourceRect || !targetRect) return;
  const flyer = document.createElement('div');
  flyer.className = `collection-flyer ${output.kind === 'coins' ? 'coin-flyer' : ''}`;
  flyer.append(unitCanvas('item', output));
  document.body.append(flyer);
  const startX = sourceRect.left + sourceRect.width / 2;
  const startY = sourceRect.top + sourceRect.height / 2;
  const endX = targetRect.left + targetRect.width / 2;
  const endY = targetRect.top + targetRect.height / 2;
  flyer.style.left = `${startX}px`;
  flyer.style.top = `${startY}px`;
  const animation = flyer.animate([
    { transform: 'translate(-50%, -50%) scale(1) rotate(0deg)', opacity: 1, offset: 0 },
    { transform: `translate(calc(-50% + ${(endX - startX) * .48}px), calc(-50% + ${(endY - startY) * .35 - 38}px)) scale(1.28) rotate(180deg)`, opacity: 1, offset: .48 },
    { transform: `translate(calc(-50% + ${endX - startX}px), calc(-50% + ${endY - startY}px)) scale(.58) rotate(360deg)`, opacity: .25, offset: 1 },
  ], { duration: COLLECTION_TIMING.flightMs, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'forwards' });
  void animation.finished.catch(() => {}).then(() => flyer.remove());
}

function showCollectionArrival(destination, quantity) {
  const target = collectionTargetElement(destination);
  if (!target) return;
  target.classList.remove('collection-arrival');
  void target.offsetWidth;
  target.classList.add('collection-arrival');
  const cue = document.createElement('span');
  cue.className = 'collection-gain';
  cue.textContent = `+${quantity}`;
  target.append(cue);
  window.setTimeout(() => {
    cue.remove();
    target.classList.remove('collection-arrival');
  }, COLLECTION_TIMING.cueMs);
}

function collectProductionOutput(index, station, outputHost) {
  if (collectingStations.has(index) || uiPaused()) return;
  const output = game.workers[index]?.pendingOutput;
  const destination = productionCollectionDestination(game.inventory, output);
  const before = game;
  game = collectWorkerOutput(game, index);
  if (game === before || !destination) {
    game.message = 'Storage is full — use or merge an item first.';
    station.classList.add('collection-blocked');
    window.setTimeout(() => station.classList.remove('collection-blocked'), 380);
    renderHud();
    return;
  }

  collectingStations.add(index);
  unlockAudio();
  playCollection(output.kind);
  station.disabled = true;
  station.classList.add('is-collecting');
  const sourceRect = outputHost.getBoundingClientRect();
  const targetRect = collectionTargetElement(destination)?.getBoundingClientRect() ?? null;
  window.setTimeout(() => flyCollectedOutput(output, sourceRect, targetRect), COLLECTION_TIMING.sourceMs - 70);
  window.setTimeout(() => {
    collectingStations.delete(index);
    renderSidePanels();
    showCollectionArrival(destination, output.quantity);
  }, COLLECTION_TIMING.sourceMs + COLLECTION_TIMING.flightMs);
}

function productionStation(worker, index) {
  const station = document.createElement('button');
  station.type = 'button';
  station.className = `production-cell station-cell ${worker ? 'active' : 'empty'}`;
  station.dataset.stationIndex = String(index);
  if (!worker) {
    station.innerHTML = '<span class="empty-plus">·</span><small>STATION</small>';
    station.disabled = true;
    return station;
  }
  const info = WORKER_INFO[worker.role];
  station.append(unitCanvas('station', worker));
  station.insertAdjacentHTML('beforeend', `<small>${info.station.toUpperCase()}</small>`);
  if (worker.pendingOutput) {
    station.classList.add('has-output');
    const outputHost = document.createElement('span');
    outputHost.className = `station-output output-${worker.pendingOutput.kind}`;
    outputHost.append(unitCanvas('item', worker.pendingOutput));
    outputHost.insertAdjacentHTML('beforeend', '<i class="output-sparkle sparkle-a">✦</i><i class="output-sparkle sparkle-b">✦</i><i class="output-sparkle sparkle-c">✦</i><em>CLICK!</em>');
    const output = document.createElement('b');
    output.className = 'output-count';
    output.textContent = `×${worker.pendingOutput.quantity}`;
    outputHost.append(output);
    station.append(outputHost);
    station.title = `Collect ${worker.pendingOutput.quantity} ${worker.pendingOutput.kind}`;
    station.disabled = uiPaused();
    station.addEventListener('click', () => collectProductionOutput(index, station, outputHost));
  } else {
    station.disabled = true;
    station.title = `${info.name} is making the next batch`;
  }
  return station;
}

function productionWorkerSlot(index) {
  const worker = game.workers[index];
  const slot = document.createElement('button');
  slot.type = 'button';
  slot.className = `production-cell worker-slot ${worker ? 'filled' : 'empty'} ${worker?.pendingOutput ? 'is-napping' : ''}`;
  slot.dataset.workerIndex = String(index);
  if (!worker) {
    slot.innerHTML = '<span class="empty-plus">+</span><small>WORKER</small>';
    return slot;
  }
  const info = WORKER_INFO[worker.role];
  slot.append(unitCanvas('worker', worker));
  slot.insertAdjacentHTML('beforeend', `<b>L${worker.level}</b><small>${info.shortName}</small><span class="copy-pips">${Array.from({ length: worker.copies ?? 1 }, () => '<i></i>').join('')}</span>`);
  if (!worker.pendingOutput && worker.outputReadyAt != null) {
    slot.insertAdjacentHTML('beforeend', '<span class="cd-ring"></span>');
  }
  bindPetDrag(slot, 'worker', { ...worker, workerIndex: index });
  bindTooltip(slot, () => {
    const current = game.workers[index];
    return current ? workerTooltipInfo(current, WORKER_INFO[current.role]) : null;
  });
  return slot;
}

function renderProduction() {
  if (!productionEl || !inventoryEl) return;
  productionEl.innerHTML = '';
  [0, 1, 2].forEach((index) => productionEl.append(productionStation(game.workers[index], index)));
  [0, 1, 2].forEach((index) => productionEl.append(productionWorkerSlot(index)));
  [3, 4, 5].forEach((index) => productionEl.append(productionWorkerSlot(index)));
  [3, 4, 5].forEach((index) => productionEl.append(productionStation(game.workers[index], index)));

  workerRingSlots = [...productionEl.querySelectorAll('.worker-slot .cd-ring')]
    .map((ring) => ({ ring, index: Number(ring.closest('.worker-slot').dataset.workerIndex) }));

  inventoryEl.innerHTML = '';
  game.inventory.forEach((item, index) => {
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = `inventory-slot ${item ? 'filled' : 'empty'}`;
    slot.dataset.inventoryIndex = String(index);
    if (!item) {
      slot.innerHTML = '<span class="empty-plus">·</span>';
      slot.disabled = true;
    } else {
      slot.append(unitCanvas('item', item));
      slot.insertAdjacentHTML('beforeend', `<b>×${item.quantity}</b><small>${item.kind}${item.tier ? ` T${item.tier}` : ''}</small>`);
      bindPetDrag(slot, 'item', { ...item, inventoryIndex: index });
      if ((item.kind === 'weapon' || item.kind === 'armour') && item.tier < 3 && item.quantity >= 3) {
        slot.classList.add('can-merge');
        slot.title = 'Click to merge 3 into the next tier, or drag onto a fighter';
        slot.addEventListener('click', () => {
          if (suppressNextPetClick) return;
          game = mergeInventoryItems(game, index);
          renderSidePanels();
        });
      } else {
        slot.title = item.kind === 'food' ? 'Drag onto a damaged battlefield cat' : 'Drag onto a battlefield cat to equip';
      }
    }
    inventoryEl.append(slot);
  });
}

function renderDogPreview() {
  if (!dogPreviewEl) return;
  dogPreviewEl.innerHTML = '';
  const queuedDogs = dogPreviewQueue(game.nextWave);
  const firstVisibleSlot = 3; // The Scout Report sign occupies the first grid row.
  for (let index = 0; index < 30; index += 1) {
    const cell = document.createElement('div');
    cell.className = 'dog-preview-cell';
    const dog = queuedDogs[index - firstVisibleSlot];
    if (dog) {
      cell.classList.add('incoming');
      cell.append(unitCanvas('dog', dog));
      cell.insertAdjacentHTML('beforeend', `<b>T${dog.tier}</b>`);
      bindTooltip(cell, () => dogTooltipInfo(dog));
    }
    dogPreviewEl.append(cell);
  }
  const label = $('#preview-round');
  if (label) {
    label.textContent = game.nextWave?.length
      ? `WAVE ${Math.min(MAX_WAVES, game.waveNumber + 1)}`
      : 'ALL OUT';
  }
}

function renderMessage() {
  $('#message').textContent = game.message;
}

function renderHud() {
  lastGoldShown = Math.floor(game.gold);
  $('#gold').textContent = lastGoldShown;
  $('#lives').textContent = game.lives;
  $('#wave').textContent = `${Math.max(1, Math.min(MAX_WAVES, game.waveNumber || 1))}/${MAX_WAVES}`;
  $('#inventory-count').textContent = `${game.inventory.filter(Boolean).length}/${game.inventory.length}`;
  renderMessage();
  const speedChip = $('#speed-toggle');
  if (speedChip) {
    speedChip.classList.toggle('is-fast', combatSpeed === 2);
    speedChip.setAttribute('aria-pressed', combatSpeed === 2 ? 'true' : 'false');
    $('#speed-label').textContent = `${combatSpeed}×`;
  }
  $('#refresh').disabled = uiPaused() || game.gold < 1 || game.phase !== 'battle';
  if (!document.body.classList.contains('cat-sell-dragging')) {
    $('#adoption-box-value').textContent = '+1';
    $('#adoption-box-hint').textContent = 'Drag an owned cat here';
  }
  $('#shop-panel').style.opacity = uiPaused() ? '.62' : '1';
}

function renderProductionLegend() {
  const host = $('#production-legend');
  if (!host) return;
  host.innerHTML = '';
  productionLegendRows(WORKER_INFO).forEach((entry) => {
    const info = WORKER_INFO[entry.role];
    const row = document.createElement('div');
    row.className = 'legend-row production-legend-row';
    row.title = `${info.blurb}. Produces every ${REALTIME.workerProduceMs / 1000} seconds, then naps until collected.`;
    const canvas = document.createElement('canvas');
    drawWorker(canvas, entry.role, 1);
    const name = document.createElement('b');
    name.textContent = entry.name;
    const role = document.createElement('span');
    role.textContent = entry.description;
    row.append(canvas, name, role);
    host.append(row);
  });
}

/** Legend row per coat: sprite, name, five-word role, and the unlock wave when locked. */
const COAT_ROLE_WORDS = {
  0: 'bursts down its own lane',
  1: 'blocks & bites · extra HP',
  2: 'homing shot, nearest lane',
  3: 'yarn tangles the next dog move',
  4: 'bomb + splash beside target',
  5: 'beam pierces 3 in its lane',
  6: 'tap when ready · freeze a dog',
  7: 'tap when ready · teleport an ally',
  8: 'tap when ready · summon a decoy',
  9: 'tap when ready · storm a column',
  10: 'tap when ready · grant an encore',
};

function renderLegend() {
  const host = $('#coat-legend');
  if (!host) return;
  host.innerHTML = '';
  const unlockedTier = shopTierForRound(Math.max(1, game.waveNumber || 1));
  Object.entries(CAT_COAT_INFO).forEach(([coatKey, info]) => {
    const coat = Number(coatKey);
    const locked = info.shopTier > unlockedTier;
    const row = document.createElement('div');
    row.className = `legend-row ${locked ? 'locked' : ''}`;
    row.title = info.attackDetail;
    const canvas = document.createElement('canvas');
    drawCat(canvas, 1, coat);
    const name = document.createElement('b');
    name.textContent = info.shortName.toUpperCase();
    row.append(canvas, name);
    if (info.shopTier > 1) {
      const chip = document.createElement('small');
      chip.className = 'unlock-chip';
      chip.textContent = `W${info.shopTier * 2 - 1}`;
      row.append(chip);
    }
    const role = document.createElement('span');
    role.textContent = COAT_ROLE_WORDS[coat] ?? info.blurb;
    row.append(role);
    host.append(row);
  });
}

function renderSidePanels() {
  hideUnitTooltip();
  renderShop();
  renderProduction();
  renderDogPreview();
  renderHud();
  renderProductionLegend();
  renderLegend();
  updateCellTargetHighlights();
}

// ---------------------------------------------------------------------------
// Pause, result, glossary, settings, and shell wiring.
// ---------------------------------------------------------------------------

function syncPauseState() {
  const paused = uiPaused();
  const pauseButton = $('#pause-toggle');
  pauseButton?.classList.toggle('is-paused', paused);
  pauseButton?.setAttribute('aria-pressed', String(paused));
  if ($('#pause-label')) $('#pause-label').textContent = paused ? '▶' : 'Ⅱ';
  if (paused && pausedAnimations.length === 0) {
    pausedAnimations = document.getAnimations().filter((animation) => animation.playState === 'running');
    pausedAnimations.forEach((animation) => animation.pause());
  } else if (!paused) {
    pausedAnimations.forEach((animation) => animation.play());
    pausedAnimations = [];
  }
  renderSidePanels();
}

function showResult() {
  const won = game.phase === 'victory';
  $('#result-kicker').textContent = won ? 'LEVEL 1 COMPLETE' : 'OUT OF LIVES';
  $('#result-title').textContent = won ? 'Backyard Defended!' : 'The Dogs Broke Through';
  $('#result-copy').textContent = won ? 'The porch is safe—for now.' : 'Rebuild your cat squad and try again.';
  drawCat($('#result-cat'), won ? 3 : 1, won ? 0 : 1, won);
  modalEl.hidden = false;
}

function glossaryCard({ kind, key, name, kicker, stats, description, note }) {
  const card = document.createElement('article');
  card.className = `glossary-entry ${kind}`;
  const canvas = document.createElement('canvas');
  if (kind === 'battle') drawCat(canvas, 1, key);
  else if (kind === 'production') drawWorker(canvas, key, 1);
  else drawDog(canvas, 1, key);
  const copy = document.createElement('div');
  copy.innerHTML = `<small>${kicker}</small><h3>${name}</h3><b>${stats}</b><p>${description}</p>${note ? `<em>${note}</em>` : ''}`;
  card.append(canvas, copy);
  return card;
}

function renderGlossary() {
  const tabs = $('#glossary-tabs');
  const grid = $('#glossary-grid');
  if (!tabs || !grid) return;
  tabs.innerHTML = '';
  glossaryTabs(glossaryTab).forEach((tab) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = tab.active ? 'active' : '';
    button.textContent = tab.label;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(tab.active));
    button.addEventListener('click', () => {
      glossaryTab = tab.id;
      renderGlossary();
    });
    tabs.append(button);
  });
  grid.innerHTML = '';
  if (glossaryTab === 'battle') {
    Object.entries(CAT_COAT_INFO).forEach(([coatKey, info]) => {
      const coat = Number(coatKey);
      const stats = catStatsFor(1, coat);
      const wave = info.shopTier * 2 - 1;
      grid.append(glossaryCard({
        kind: 'battle', key: coat, name: info.name,
        kicker: `BATTLE CAT · ${wave === 1 ? 'STARTER' : `UNLOCKS WAVE ${wave}`}`,
        stats: `♥ ${stats.hp} · ↑ ${stats.attack} every ${REALTIME.catAttackMs / 1000}s`,
        description: info.attackDetail,
        note: 'Match 3 of the same cat and level to evolve.',
      }));
    });
  } else if (glossaryTab === 'production') {
    Object.entries(WORKER_INFO).forEach(([role, info]) => {
      const outputs = [1, 2, 3].map((level) => {
        const output = info.output[level];
        return `L${level}: ${output.quantity} ${output.kind}`;
      }).join(' · ');
      grid.append(glossaryCard({
        kind: 'production', key: role, name: info.name,
        kicker: `PRODUCTION CAT · ${info.station.toUpperCase()}`,
        stats: outputs,
        description: `${info.blurb}. Produces every ${REALTIME.workerProduceMs / 1000} seconds, then naps until you collect.`,
        note: 'Lives in the House. Match 3 of the same role and level to evolve.',
      }));
    });
  } else {
    Object.entries(DOG_ROLE_INFO).forEach(([role, info]) => {
      const stats = DOG_STATS[1];
      const roleStat = role === 'tennis'
        ? `BALL ${Math.ceil(stats.attack * 0.6)}`
        : role === 'howler'
          ? 'HOWL +2'
          : role === 'jumper' ? 'JUMP 1×' : `BITE ${stats.attack}`;
      grid.append(glossaryCard({
        kind: 'dogs', key: role, name: info.name,
        kicker: `DOG ROLE · ${info.unlockRound === 1 ? 'STARTER' : `UNLOCKS WAVE ${info.unlockRound}`}`,
        stats: `♥ ${stats.hp} · ${roleStat}${role === 'scruffy' ? '' : ` · BITE ${stats.attack}`}`,
        description: info.attackDetail,
        note: `${info.blurb} Higher tiers increase HP and attack without changing this role.`,
      }));
    });
  }
}

function openGlossary() {
  hideUnitTooltip();
  glossaryTab = 'battle';
  glossaryPaused = true;
  renderGlossary();
  if (glossaryModalEl) glossaryModalEl.hidden = false;
  syncPauseState();
  $('#glossary-close')?.focus();
}

function closeGlossary() {
  if (!glossaryModalEl || glossaryModalEl.hidden) return;
  glossaryModalEl.hidden = true;
  glossaryPaused = false;
  syncPauseState();
  $('#glossary-open')?.focus();
}

function syncSettingsUi() {
  if (soundToggleEl) soundToggleEl.checked = isSoundEnabled();
}

function openSettings() {
  hideUnitTooltip();
  syncSettingsUi();
  if (settingsModalEl) settingsModalEl.hidden = false;
}

function closeSettings() {
  if (settingsModalEl) settingsModalEl.hidden = true;
}

function resetGame() {
  game = createGame();
  dragState = null;
  activeTargeting = null;
  pendingUpgrade = null;
  manualPaused = false;
  glossaryPaused = false;
  resultShown = false;
  collectingStations.clear();
  clearUnits();
  syncSlowMo();
  if (glossaryModalEl) glossaryModalEl.hidden = true;
  modalEl.hidden = true;
  syncPauseState();
  renderSidePanels();
}

function armAudioOnce() {
  unlockAudio();
  window.removeEventListener('pointerdown', armAudioOnce);
  window.removeEventListener('keydown', armAudioOnce);
}
window.addEventListener('pointerdown', armAudioOnce);
window.addEventListener('keydown', armAudioOnce);
window.addEventListener('pointermove', onDragMove, { passive: false });
window.addEventListener('pointerup', (event) => { void finishDrag(event); });
window.addEventListener('pointercancel', (event) => { void finishDrag(event, true); });

$('#refresh').addEventListener('click', () => {
  game = refreshShop(game);
  renderSidePanels();
});

// Two-tap restart: a single stray click must not wipe a seven-wave run.
const restartButton = $('#restart');
let restartTimer = null;
function disarmRestart() {
  if (restartTimer) {
    window.clearTimeout(restartTimer);
    restartTimer = null;
  }
  restartButton?.classList.remove('confirming');
  if (restartButton) {
    restartButton.textContent = '↻';
    restartButton.setAttribute('aria-label', 'Restart game');
  }
}
restartButton?.addEventListener('click', () => {
  if (!restartButton.classList.contains('confirming')) {
    restartButton.classList.add('confirming');
    restartButton.textContent = '?';
    restartButton.setAttribute('aria-label', 'Tap again to confirm restart');
    game.message = 'Restart the run? Tap ↻ again to confirm.';
    renderHud();
    restartTimer = window.setTimeout(disarmRestart, 3000);
    return;
  }
  disarmRestart();
  resetGame();
});
$('#play-again').addEventListener('click', resetGame);
$('#speed-toggle')?.addEventListener('click', () => {
  setCombatSpeed(combatSpeed === 1 ? 2 : 1);
  game.message = combatSpeed === 2 ? 'Combat speed 2× — the whole yard moves faster.' : 'Combat speed 1×.';
  renderHud();
});
$('#pause-toggle')?.addEventListener('click', () => {
  manualPaused = !manualPaused;
  game.message = manualPaused ? 'Game paused.' : 'Game resumed.';
  syncPauseState();
});
$('#glossary-open')?.addEventListener('click', openGlossary);
$('#glossary-close')?.addEventListener('click', closeGlossary);
glossaryModalEl?.addEventListener('click', (event) => {
  if (event.target === glossaryModalEl) closeGlossary();
});
$('#settings')?.addEventListener('click', () => { unlockAudio(); openSettings(); });
$('#settings-close')?.addEventListener('click', closeSettings);
settingsModalEl?.addEventListener('click', (event) => {
  if (event.target === settingsModalEl) closeSettings();
});
soundToggleEl?.addEventListener('change', () => {
  unlockAudio();
  setSoundEnabled(soundToggleEl.checked);
  game.message = soundToggleEl.checked ? 'Sound effects on.' : 'Sound effects muted.';
  renderHud();
});
window.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (activeTargeting) cancelTargeting('Ability aiming cancelled.');
  else if (glossaryModalEl && !glossaryModalEl.hidden) closeGlossary();
  else if (settingsModalEl && !settingsModalEl.hidden) closeSettings();
});

// A real-time game must not fight in a hidden tab — auto-pause on blur.
window.addEventListener('blur', () => {
  blurPaused = true;
  syncPauseState();
});
window.addEventListener('focus', () => {
  blurPaused = false;
  lastFrameTs = null;
  syncPauseState();
});
document.addEventListener('visibilitychange', () => {
  blurPaused = document.hidden;
  if (!document.hidden) lastFrameTs = null;
  syncPauseState();
});

// QA hook: drives the clock where requestAnimationFrame is unavailable
// (hidden automation panes). Not part of gameplay.
window.__cvd = {
  get state() { return game; },
  tick(ms) {
    const advanced = advance(game, ms);
    if (advanced !== game) {
      game = advanced;
      if (game.events.length) handleEvents(game.events);
    }
    syncUnits();
    updateClockUi();
    renderSidePanels();
    maybeShowResult();
  },
  apply(mutate) {
    const next = mutate(game);
    if (next) game = next;
    syncUnits();
    renderSidePanels();
  },
  wake() {
    blurPaused = false;
    syncPauseState();
  },
};

loadSoundEnabled();
syncSettingsUi();
drawBackyard($('#yard-art'));
buildBoardGrid();
renderSidePanels();
requestAnimationFrame(frame);
