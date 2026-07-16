import {
  ROWS, COLS, CAT_ZONE_START, BENCH_SIZE, PRODUCTION_CAPACITY, MAX_FIELD_CATS, MAX_ROUNDS, ACTIONS_PER_ROUND,
  CAT_COAT_INFO, DOG_ROLE_INFO, catStatsFor, dogStatsFor, normalizeCoat, catTooltipInfo, dogTooltipInfo,
  WORKER_INFO, createGame, refreshShop, toggleSaveShopSlot, placeCat, moveCat, moveCatInTactics,
  returnCatToBench, mergeUnitOnto, startRound, resolveSection, finishRound,
  openTacticsWindow, continueCombat, useActiveAbility, canTeleportDogTo,
  plusCells,
  purchaseShopFighterToBench, purchaseShopFighterToBoard,
  purchaseShopFighterOnto, purchaseShopWorker, purchaseShopWorkerToBench,
  moveWorker, mergeWorkerOnto, moveBenchWorkerToHouse, returnWorkerToBench, mergeBenchWorkerOnto,
  collectWorkerOutput, mergeInventoryItems, equipInventoryItem, useFood,
  catSaleQuote, sellCat,
} from './game-engine.js';
import { drawBackyard, drawCat, drawDog, drawWorker, drawStation, drawItem, headAnchor } from './pixel-art.js';
import { selectionAfterPurchase, catSelectionAdvice, shopOfferHasOwnedMatch, shopOfferMatchingFieldCatIds, shopPetAvailability, hpTone, equippedItemMarkers, catStatusMarkers, dogStatusMarkers, productionLegendRows, glossaryTabs, glossaryEntriesByUnlockRound, dogPreviewQueue, stormTargetDogIds, productionCollectionDestination, productionProgressStatus, productionWorkVisual, shopCardSummary, workerTooltipInfo } from './ui-state.js';
import { combatTiming, cellCenter, homingShotKeyframes, lobShotKeyframes, stormColumnPosition, yarnThrowKeyframes } from './combat-animation.js';
import { unlockAudio, playUiClick, playRefreshClick, playCatDrop, playImpact, playArmourBlock, playCollection, playItemUse, playCelebration, playMerge, playCatDeath, playDogDeath, playWaveStart, playRoundComplete, playVictory, playDefeat, playHeal, playHowl, isSoundEnabled, setSoundEnabled, loadSoundEnabled, startLevelMusic, stopLevelMusic } from './sound.js';
import { FIELD_CAP_MESSAGE, DRAG_FEEDBACK, DROP_IMPACT, getDropAction, isBattlefieldDropAction } from './drag-drop.js';
import { CAT_PLANNING_MOVE_SPENT_MESSAGE, catMovementPath, catMoveLimitMessage } from './movement-rules.js';
import { UPGRADE_TIMING, describeUpgrade } from './upgrade-animation.js';
import { BLUE_SCRATCH_FLURRY } from './melee-animation.js';
import {
  ATTACK_FX, HURT_FX, attackDogFx, attackSignature, attackGroupKey, blastFootprint,
  contactVector, isKill, damageNumberFx,
} from './battle-fx.js';
import { deathSpecFor, deathTiming } from './death-animation.js';
import {
  CORE_STEPS, TIPS, confirmTutorialSkip, tutorialMergeTaskForDrop,
  refreshTutorialShop, tutorialShop, tutorialWave,
} from './tutorial.js';

let game = createGame();
let selected = null;
let playing = false;
let dragState = null;
let suppressNextPetClick = false;
let dragHoverElement = null;
let pendingUpgrade = null;
let activeTargeting = null;
let glossaryTab = 'battle';
let manualPaused = false;
let glossaryPaused = false;
let pausedAnimations = [];
let resumeWaiters = [];
const collectingStations = new Set();
let tutorialActive = false;
let tutorialStepIndex = 0;
const tutorialSeenTips = new Set();
let tutorialCurrentTip = null;
const tutorialCompletedMergeTasks = new Set();
const dragHintAnimations = new Map();
let tutorialStartNudged = false;
let tutorialMoveFocusCleared = false;
let gameSessionId = 0;

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
const workbenchEl = $('#workbench');
const gridEl = $('#grid');
const effectsEl = $('#effects');
const modalEl = $('#result-modal');
const settingsModalEl = $('#settings-modal');
const glossaryModalEl = $('#glossary-modal');
const soundToggleEl = $('#setting-sound');
const tutorialOverlayEl = $('#tutorial-overlay');
const tutorialSpotlightEl = $('#tutorial-spotlight');
const tutorialMutedRegionEl = $('#tutorial-muted-region');
const tutorialBubbleEl = $('#tutorial-bubble');
const tutorialTextEl = $('#tutorial-text');
const tutorialNextEl = $('#tutorial-next');
const tutorialFocusHighlightsEl = $('#tutorial-focus-highlights');
const tutorialDragHintsEl = $('#tutorial-drag-hints');

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
let moveLimitTooltipTimer = null;

function hideMoveLimitTooltip() {
  window.clearTimeout(moveLimitTooltipTimer);
  moveLimitTooltipTimer = null;
  const tip = document.querySelector('.move-limit-tooltip');
  if (!tip) return;
  tip.hidden = true;
  tip.classList.remove('is-visible');
}

function movementRestrictionMessage(action, cat) {
  if (action.reason === 'prep-moved') return CAT_PLANNING_MOVE_SPENT_MESSAGE;
  if (action.reason === 'move-distance') return catMoveLimitMessage(cat);
  return null;
}

function showMoveLimitTooltip(clientX, clientY, message) {
  let tip = document.querySelector('.move-limit-tooltip');
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'move-limit-tooltip';
    tip.setAttribute('role', 'tooltip');
    document.body.append(tip);
  }
  window.clearTimeout(moveLimitTooltipTimer);
  tip.textContent = message;
  tip.hidden = false;
  tip.classList.remove('is-visible');
  void tip.offsetWidth;
  tip.classList.add('is-visible');
  const rect = tip.getBoundingClientRect();
  const pad = 12;
  tip.style.left = `${Math.max(pad, Math.min(clientX + 14, window.innerWidth - rect.width - pad))}px`;
  tip.style.top = `${Math.max(pad, Math.min(clientY + 16, window.innerHeight - rect.height - pad))}px`;
  moveLimitTooltipTimer = window.setTimeout(() => {
    tip.hidden = true;
    tip.classList.remove('is-visible');
    moveLimitTooltipTimer = null;
  }, 2800);
}

function clearTooltipTimer() {
  if (tooltipTimer != null) {
    window.clearTimeout(tooltipTimer);
    tooltipTimer = null;
  }
}

function hideUnitTooltip() {
  clearTooltipTimer();
  tooltipEl.hidden = true;
  tooltipEl.classList.remove('is-visible', 'is-grouped', 'kind-cat', 'kind-dog');
}

function tooltipCardMarkup(info, index) {
  const effects = info.effects ?? [];
  const effectsMarkup = effects.length
    ? `<section class="tooltip-effects">
        <span class="tooltip-effects-title">STATUS &amp; EQUIPMENT</span>
        ${effects.map((effect) => `<div class="tooltip-effect effect-${effect.kind}">
          <span class="tooltip-effect-name">${effect.label}</span>
          <b class="tooltip-effect-value">${effect.value}</b>
          <small>${effect.detail}</small>
        </div>`).join('')}
      </section>`
    : '';
  return `
    <section class="unit-tooltip-card">
      ${info.preview ? `<span class="tooltip-unit-art" data-tooltip-preview="${index}" aria-hidden="true"></span>` : ''}
      <div class="tooltip-title">
        ${info.category ? `<b class="tooltip-category">${info.category}</b>` : ''}
        <strong>${info.title}</strong>
      </div>
      <span class="tooltip-stats">${info.stats}</span>
      <p class="tooltip-attack"><b>${info.detailLabel ?? 'Attack'}</b> ${info.attack}</p>
      ${effectsMarkup}
      <small class="tooltip-note">${info.note}</small>
    </section>
  `;
}

function showUnitTooltip(anchor, info, clientX, clientY) {
  if (!info) return;
  const tooltipInfos = Array.isArray(info) ? info.filter(Boolean) : [info];
  if (!tooltipInfos.length) return;
  const grouped = tooltipInfos.length > 1;
  tooltipEl.className = `unit-tooltip kind-${tooltipInfos[0].kind} is-visible${grouped ? ' is-grouped' : ''}`;
  tooltipEl.hidden = false;
  tooltipEl.innerHTML = tooltipInfos.map((tooltipInfo, index) => tooltipCardMarkup(tooltipInfo, index)).join('');
  tooltipInfos.forEach((tooltipInfo, index) => {
    if (!tooltipInfo.preview) return;
    const preview = tooltipEl.querySelector(`[data-tooltip-preview="${index}"]`);
    preview.append(unitCanvas('dog', tooltipInfo.preview));
  });
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
  const bombIsAiming = () => activeTargeting?.mode === 'bomb-cross';

  const scheduleShow = (event) => {
    clearTooltipTimer();
    if (bombIsAiming()) {
      hideUnitTooltip();
      return;
    }
    tooltipPointer = { x: event.clientX, y: event.clientY };
    tooltipTimer = window.setTimeout(() => {
      tooltipTimer = null;
      // Only open if the pointer is still over this anchor.
      if (bombIsAiming() || (!anchor.matches(':hover') && document.activeElement !== anchor)) return;
      showUnitTooltip(anchor, resolveInfo(), tooltipPointer.x, tooltipPointer.y);
    }, TOOLTIP_HOVER_DELAY_MS);
  };

  const move = (event) => {
    if (bombIsAiming()) {
      hideUnitTooltip();
      return;
    }
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
      if (bombIsAiming() || document.activeElement !== anchor) return;
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

function selectedMatches(type, id) {
  return selected?.type === type && selected?.id === id;
}

function ownedCat(type, id) {
  const collection = type === 'cat' ? game.cats : type === 'bench' ? game.bench : [];
  return collection.find((cat) => cat.id === id) ?? null;
}

function catLabel(cat) {
  return CAT_COAT_INFO[normalizeCoat(cat.coat)]?.shortName ?? 'Cat';
}

function showShopPurchaseDenied(button, reason) {
  const goldChip = $('#gold')?.closest('.hud-chip');
  button.classList.remove('purchase-denied');
  goldChip?.classList.remove('gold-denied');
  void button.offsetWidth;
  button.classList.add('purchase-denied');
  if (reason === 'gold') goldChip?.classList.add('gold-denied');

  game.message = reason === 'gold'
    ? `Not enough gold — this cat costs 3 and you have ${game.gold}.`
    : 'The Cat Workbench is full — deploy or merge a cat before adopting another.';
  $('#message').textContent = game.message;

  window.setTimeout(() => {
    button.classList.remove('purchase-denied');
    goldChip?.classList.remove('gold-denied');
  }, 560);
}

function clearShopMatchTargets() {
  document.querySelectorAll('.shop-match-target')
    .forEach((unit) => unit.classList.remove('shop-match-target'));
}

function showShopMatchTargets(slot) {
  clearShopMatchTargets();
  shopOfferMatchingFieldCatIds(slot, game.cats).forEach((id) => {
    findUnitElement(id)?.classList.add('shop-match-target');
  });
}

function renderShop() {
  shopEl.innerHTML = '';
  shopEl.dataset.count = String(game.shop.length);
  const ownedCats = [...game.cats, ...game.workers.filter(Boolean), ...game.bench];
  game.shop.forEach((slot, index) => {
    const isWorker = slot.category === 'worker';
    const info = isWorker ? WORKER_INFO[slot.role] : CAT_COAT_INFO[normalizeCoat(slot.coat)];
    const summary = shopCardSummary(slot, info);
    const hasOwnedMatch = shopOfferHasOwnedMatch(slot, ownedCats);
    const interactive = !slot.sold && game.phase === 'prep' && !playing;
    const canBuy = interactive && game.gold >= 3;
    const reason = slot.sold ? 'sold' : game.gold < 3 ? 'gold' : 'ready';
    const wrap = document.createElement('div');
    wrap.className = `shop-slot ${slot.saved ? 'saved' : ''} ${slot.sold ? 'sold' : ''} ${reason === 'gold' ? 'unaffordable' : ''} ${hasOwnedMatch ? 'has-owned-match' : ''} ${isWorker ? 'worker-offer' : 'fighter-offer'}`;

    const button = document.createElement('button');
    button.className = 'shop-card';
    button.dataset.shopIndex = String(index);
    button.disabled = !interactive;
    button.setAttribute('aria-disabled', canBuy ? 'false' : 'true');
    button.append(unitCanvas(isWorker ? 'worker' : 'cat', slot));
    button.insertAdjacentHTML('beforeend', `
      <span class="shop-tier">${summary.badge}</span>
      <strong>${summary.name}</strong>
      <span class="price">● ${summary.cost}</span>`);
    if (hasOwnedMatch) {
      button.title = 'Matching cat owned — drag this shop cat onto it to stack.';
      button.setAttribute('aria-label', `Level ${slot.level ?? 1} ${info.name}. Matching cat owned; drag onto it to stack.`);
    }
    if (shopOfferMatchingFieldCatIds(slot, game.cats).length) {
      button.addEventListener('pointerenter', () => showShopMatchTargets(slot));
      button.addEventListener('pointerleave', () => {
        if (dragState?.sourceElement !== button || !dragState.started) clearShopMatchTargets();
      });
      button.addEventListener('focus', () => showShopMatchTargets(slot));
      button.addEventListener('blur', () => {
        if (dragState?.sourceElement !== button || !dragState.started) clearShopMatchTargets();
      });
    }
    button.addEventListener('click', () => {
      if (!canBuy) {
        showShopPurchaseDenied(button, reason);
        return;
      }
      game.message = isWorker
        ? `Drag ${info.name} into either House slot or onto the Cat Workbench.`
        : `Drag ${info.name} onto the battlefield or the Cat Workbench.`;
      $('#message').textContent = game.message;
    });
    if (interactive) bindPetDrag(button, isWorker ? 'shop-worker' : 'shop-fighter', { ...slot, shopIndex: index });
    bindTooltip(button, () => isWorker ? workerTooltipInfo(slot, info) : catTooltipInfo(slot));

    const save = document.createElement('button');
    save.type = 'button';
    save.className = `shop-save ${slot.saved ? 'is-saved' : ''}`;
    save.textContent = slot.saved ? 'Saved' : 'Save';
    save.title = slot.saved
      ? 'Unsave this pet so it can refresh'
      : 'Save this pet through refresh and the next round';
    save.setAttribute('aria-pressed', slot.saved ? 'true' : 'false');
    save.disabled = slot.sold || game.phase !== 'prep' || playing;
    save.addEventListener('click', (event) => {
      // stopPropagation keeps the buy-card click out, but also skips the global
      // button click sound — play it here so Save isn't the one silent button.
      event.stopPropagation();
      playUiClick();
      game = toggleSaveShopSlot(game, index);
      render();
    });

    wrap.append(button, save);
    shopEl.append(wrap);
  });
}

function appendUnitStatusOverlays(unit, statuses) {
  if (!statuses.length) return;
  unit.classList.add('has-status-overlays');
  const overlays = document.createElement('span');
  overlays.className = 'unit-status-overlays';
  overlays.setAttribute('aria-hidden', 'true');
  let cornerSlot = 0;
  statuses.forEach((status) => {
    const marker = document.createElement('span');
    marker.className = `unit-status unit-status-${status.kind}`;
    marker.title = status.label;
    if (['attack-up', 'attack-down', 'frozen'].includes(status.kind)) {
      marker.style.setProperty('--status-slot', String(cornerSlot));
      cornerSlot += 1;
    }
    const glyph = document.createElement('i');
    glyph.className = 'unit-status-glyph';
    const value = document.createElement('b');
    value.textContent = status.value;
    marker.append(glyph, value);
    overlays.append(marker);
  });
  unit.append(overlays);
}

function catMarkup(cat) {
  const unit = document.createElement('div');
  unit.className = 'unit';
  unit.dataset.unitId = cat.id;
  unit.append(unitCanvas('cat', cat));
  const equipment = equippedItemMarkers(cat);
  if (equipment.length) {
    unit.classList.add('has-equipment');
    const markers = document.createElement('span');
    markers.className = 'equipment-markers';
    markers.setAttribute('aria-hidden', 'true');
    equipment.forEach((item) => {
      const marker = document.createElement('span');
      marker.className = `equipment-marker equipment-${item.kind}`;
      marker.append(unitCanvas('item', item));
      const value = document.createElement('b');
      value.textContent = item.kind === 'weapon' ? `+${item.value}` : String(item.value);
      marker.append(value);
      if (item.kind === 'armour') {
        const uses = document.createElement('span');
        uses.className = 'equipment-uses';
        uses.textContent = `×${item.uses}`;
        marker.append(uses);
      }
      markers.append(marker);
    });
    unit.append(markers);
  }
  appendUnitStatusOverlays(unit, catStatusMarkers(cat));
  const copies = cat.copies ?? 1;
  unit.insertAdjacentHTML('beforeend', `
    <span class="unit-badge">L${cat.level}</span>
    <span class="copy-pips">${Array.from({ length: copies }, () => '<i></i>').join('')}</span>
    <span class="hp-wrap"><span class="hp-bar hp-${hpTone(cat.hp, cat.maxHp)}" style="width:${Math.max(0, cat.hp / cat.maxHp * 100)}%"></span></span>`);
  return unit;
}

function dogMarkup(dog, stackIndex = 0, stackSize = 1) {
  const unit = document.createElement('div');
  unit.className = 'unit dog-unit';
  unit.dataset.unitId = dog.id;
  if (stackSize > 1) {
    unit.classList.add('dog-stacked', stackIndex === 0 ? 'dog-stack-back' : 'dog-stack-front');
    unit.dataset.stackIndex = String(stackIndex);
  }
  unit.append(unitCanvas('dog', dog));
  if (dog.frozenActions > 0) {
    unit.classList.add('dog-frozen');
    const ice = document.createElement('span');
    ice.className = 'freeze-shell';
    ice.setAttribute('aria-hidden', 'true');
    ice.innerHTML = '<i class="ice-shard ice-shard-left"></i><i class="ice-shard ice-shard-right"></i><i class="ice-shard ice-shard-top"></i>';
    unit.append(ice);
  }
  appendUnitStatusOverlays(unit, dogStatusMarkers(dog));
  unit.insertAdjacentHTML('beforeend', `
    <span class="unit-badge">T${dog.tier}</span>
    <span class="hp-wrap"><span class="hp-bar hp-${hpTone(dog.hp, dog.maxHp)}" style="width:${Math.max(0, dog.hp / dog.maxHp * 100)}%"></span></span>`);
  return unit;
}

function dogStackTooltipInfo(dogs) {
  if (dogs.length <= 1) return dogTooltipInfo(dogs[0]);
  return dogs.map((dog) => ({
    ...dogTooltipInfo(dog),
    preview: dog,
  }));
}

function decoyTooltipInfo(decoy) {
  const blocks = decoy.blocks ?? 0;
  return {
    kind: 'cat',
    title: 'PHANTOM DECOY',
    stats: `${blocks}/${decoy.maxBlocks ?? blocks} ATTACK BLOCKS`,
    detailLabel: 'Defence',
    attack: 'Blocks one damaging dog attack of any kind, regardless of its damage.',
    note: 'New phantoms can add to this square. The combined total loses 1 block each later round.',
  };
}

function catFromState(state, type, id) {
  const list = type === 'bench' ? state.bench : state.cats;
  return list.find((cat) => cat.id === id);
}

function queueUpgradeReveal(beforeState, afterState, targetType, targetId) {
  const before = catFromState(beforeState, targetType, targetId);
  const after = catFromState(afterState, targetType, targetId);
  const reveal = describeUpgrade(before, after);
  if (!reveal) return null;
  pendingUpgrade = { ...reveal, targetType, targetId };
  return reveal;
}

function upgradeAnchor(targetType, targetId) {
  if (targetType === 'bench') {
    return document.querySelector(`.bench-slot[data-unit-id="${targetId}"]`);
  }
  return document.querySelector(`.unit[data-unit-id="${targetId}"]`)?.closest('.cell');
}

function playPendingUpgrade() {
  if (!pendingUpgrade) return;
  const reveal = pendingUpgrade;
  pendingUpgrade = null;
  playMerge({ levelUp: reveal.kind === 'level-up' });
  const anchor = upgradeAnchor(reveal.targetType, reveal.targetId);
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

function recordTutorialMergeTask(action, source) {
  if (!tutorialActive || game.round !== 2 || game.phase !== 'prep') return;
  const task = tutorialMergeTaskForDrop(action, source);
  if (task) tutorialCompletedMergeTasks.add(task);
}

function tryMerge(targetType, targetId) {
  if (!selected || (selected.type !== 'bench' && selected.type !== 'cat')) return false;
  const sourceType = selected.type;
  const source = sourceType === 'bench'
    ? game.bench.find((cat) => cat.id === selected.id)
    : game.cats.find((cat) => cat.id === selected.id);
  const before = game;
  game = mergeUnitOnto(game, selected.type, selected.id, targetType, targetId);
  if (game === before) return false;
  recordTutorialMergeTask({ type: 'merge', targetType }, { ...source, type: sourceType });
  const reveal = queueUpgradeReveal(before, game, targetType, targetId);
  selected = null;
  game.message = reveal?.kind === 'level-up'
    ? `${reveal.label} New gear unlocked!`
    : 'Same-color cats stacked! Add one more matching color + level to evolve.';
  return true;
}

function showCatSelectionAdvice(cat) {
  const info = CAT_COAT_INFO[normalizeCoat(cat.coat)];
  game.message = catSelectionAdvice(cat, info, game.phase);
  $('#message').textContent = game.message;
}

function selectCat(type, cat) {
  if (type === 'cat') clearTutorialMoveFocus();
  selected = { type, id: cat.id };
  showCatSelectionAdvice(cat);
}

function dragSource(type, cat) {
  if (type === 'shop-worker') return { type, id: cat.id, shopIndex: cat.shopIndex, level: cat.level ?? 1, role: cat.role };
  if (type === 'shop-fighter') return { type, id: cat.id, shopIndex: cat.shopIndex, level: cat.level ?? 1, coat: normalizeCoat(cat.coat) };
  if (type === 'worker') return { type, id: cat.id, workerIndex: cat.workerIndex, level: cat.level, role: cat.role };
  if (type === 'bench-worker') return { type, id: cat.id, benchIndex: cat.benchIndex, level: cat.level, role: cat.role };
  if (type === 'item') return { type, inventoryIndex: cat.inventoryIndex, itemKind: cat.kind, tier: cat.tier ?? 1 };
  const sale = catSaleQuote(game, type, cat.id);
  return {
    type,
    id: cat.id,
    level: cat.level,
    coat: normalizeCoat(cat.coat),
    ability: cat.ability,
    row: cat.row,
    col: cat.col,
    prepOrigin: cat.prepOrigin,
    prepMoved: cat.prepMoved,
    hasEnteredBattle: cat.hasEnteredBattle,
    tacticsOrigin: cat.tacticsOrigin,
    tacticsMoved: cat.tacticsMoved,
    sellable: sale.canSell,
    sellValue: sale.value,
    sellReason: sale.reason,
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
        occupied: occupied ? { id: occupied.id, unitType: 'worker', level: occupied.level, role: occupied.role } : null,
      },
    };
  }
  const cell = element?.closest?.('.cell');
  if (cell) {
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    const occupied = game.cats.find((cat) => cat.row === row && cat.col === col);
    if (dragState?.source.type === 'item' && occupied) {
      return { element: cell, descriptor: { kind: 'fighter', id: occupied.id, hp: occupied.hp, maxHp: occupied.maxHp } };
    }
    return {
      element: cell,
      descriptor: {
        kind: 'cell', row, col,
        occupied: occupied
          ? { id: occupied.id, level: occupied.level, coat: normalizeCoat(occupied.coat) }
          : game.dogs.find((dog) => dog.hp > 0 && dog.row === row && dog.col === col)
            ?? game.decoys.find((decoy) => decoy.blocks > 0 && decoy.row === row && decoy.col === col)
            ?? null,
      },
    };
  }
  const bench = element?.closest?.('.bench-slot');
  if (bench) {
    const index = Number(bench.dataset.benchIndex);
    const occupied = game.bench[index];
    return {
      element: bench,
      descriptor: {
        kind: 'bench', index,
        occupied: occupied ? {
          id: occupied.id,
          unitType: occupied.kind === 'production-cat' ? 'worker' : 'fighter',
          level: occupied.level,
          ...(occupied.kind === 'production-cat'
            ? { role: occupied.role }
            : { coat: normalizeCoat(occupied.coat) }),
        } : null,
      },
    };
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
    phase: game.phase,
    paused: false,
    fieldCount: game.cats.length,
    fieldCap: MAX_FIELD_CATS,
  });
}

function clearDragHighlights() {
  document.querySelectorAll('.drag-valid, .drag-over, .drag-invalid-hover, .drag-origin, .move-path-valid, .move-path-invalid')
    .forEach((element) => element.classList.remove(
      'drag-valid', 'drag-over', 'drag-invalid-hover', 'drag-origin', 'move-path-valid', 'move-path-invalid',
    ));
  dragHoverElement = null;
  clearShopMatchTargets();
}

function showMovementPath(source, descriptor) {
  document.querySelectorAll('.move-path-valid, .move-path-invalid').forEach((element) => {
    element.classList.remove('move-path-valid', 'move-path-invalid');
  });
  catMovementPath(source, descriptor, game.phase).forEach(({ row, col, withinLimit }) => {
    const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
    cell?.classList.add(withinLimit ? 'move-path-valid' : 'move-path-invalid');
  });
}

function makeDragGhost(cat, sourceRect, source) {
  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  ghost.style.width = `${Math.max(64, sourceRect.width)}px`;
  ghost.style.height = `${Math.max(64, sourceRect.height)}px`;
  const visualType = source.type === 'worker' || source.type === 'shop-worker' || source.type === 'bench-worker'
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
  document.querySelectorAll('.cell, .worker-slot, .bench-slot, .adoption-box').forEach((element) => {
    const { descriptor } = targetFromElement(element);
    if (dropAction(source, descriptor).type !== 'invalid') element.classList.add('drag-valid');
  });
}

function startDragVisual(event) {
  if (!dragState || dragState.started) return;
  dragState.started = true;
  if (dragState.source.type === 'cat') clearTutorialMoveFocus();
  suppressNextPetClick = true;
  hideUnitTooltip();
  if (dragState.source.type === 'cat' || dragState.source.type === 'bench') {
    showCatSelectionAdvice(dragState.cat);
  }
  dragState.sourceElement.classList.add('drag-origin');
  const visuals = makeDragGhost(dragState.cat, dragState.sourceRect, dragState.source);
  dragState.ghost = visuals.ghost;
  dragState.shadow = visuals.shadow;
  document.body.classList.add('pet-dragging');
  if (dragState.source.type === 'cat' || dragState.source.type === 'bench') {
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
  if (dragState.source.type === 'shop-fighter') showShopMatchTargets(dragState.cat);
  requestAnimationFrame(() => dragState?.ghost?.classList.add('is-lifted'));
}

function updateDragHover(clientX, clientY) {
  if (!dragState?.started) return;
  const hit = document.elementFromPoint(clientX, clientY);
  const target = targetFromElement(hit);
  const action = dropAction(dragState.source, target.descriptor);
  const hoverChanged = dragHoverElement !== target.element;
  if (hoverChanged) {
    dragHoverElement?.classList.remove('drag-over', 'drag-invalid-hover');
    dragHoverElement = target.element;
  }
  showMovementPath(dragState.source, target.descriptor);
  dragState.ghost.classList.toggle('can-drop', action.type !== 'invalid');
  dragState.ghost.classList.toggle('cannot-drop', action.type === 'invalid');
  if (target.element) target.element.classList.add(action.type === 'invalid' ? 'drag-invalid-hover' : 'drag-over');
  const movementMessage = movementRestrictionMessage(action, dragState.source);
  if (movementMessage) {
    if (hoverChanged) showMoveLimitTooltip(clientX, clientY, movementMessage);
  } else hideMoveLimitTooltip();
}

function bindPetDrag(anchor, type, cat) {
  const phaseAllowsDrag = game.phase === 'prep'
    || ((type === 'item' || type === 'cat') && game.phase === 'tactics');
  if (!phaseAllowsDrag) return;
  anchor.classList.add('pet-draggable');
  anchor.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !phaseAllowsDrag || playing || dragState) return;
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

function applyDropAction(action, source) {
  const before = game;
  if (action.type === 'purchase-place') {
    game = purchaseShopFighterToBoard(game, source.shopIndex, action.row, action.col);
  } else if (action.type === 'purchase-bench') {
    game = purchaseShopFighterToBench(game, source.shopIndex, action.index);
  } else if (action.type === 'purchase-merge') {
    game = purchaseShopFighterOnto(game, source.shopIndex, action.targetType, action.targetId);
    if (game !== before) queueUpgradeReveal(before, game, action.targetType, action.targetId);
  } else if (action.type === 'purchase-worker') {
    game = purchaseShopWorker(game, source.shopIndex, action.index);
  } else if (action.type === 'purchase-worker-bench') {
    game = purchaseShopWorkerToBench(game, source.shopIndex, action.index);
  } else if (action.type === 'move-worker') {
    game = moveWorker(game, source.workerIndex, action.index);
  } else if (action.type === 'merge-worker') {
    game = mergeWorkerOnto(game, source.workerIndex, action.index);
  } else if (action.type === 'place-worker') {
    game = moveBenchWorkerToHouse(game, source.benchIndex, action.index);
  } else if (action.type === 'return-worker') {
    game = returnWorkerToBench(game, source.workerIndex, action.index);
  } else if (action.type === 'merge-bench-worker') {
    game = mergeBenchWorkerOnto(game, source.benchIndex, action.index);
  } else if (action.type === 'use-food') {
    game = useFood(game, source.inventoryIndex, action.targetId);
  } else if (action.type === 'equip') {
    game = equipInventoryItem(game, source.inventoryIndex, 'cat', action.targetId, false);
  } else if (action.type === 'place') {
    const benchIndex = game.bench.findIndex((cat) => cat.id === source.id);
    game = placeCat(game, benchIndex, action.row, action.col);
  } else if (action.type === 'move') {
    game = moveCat(game, source.id, action.row, action.col);
  } else if (action.type === 'tactics-move') {
    game = moveCatInTactics(game, source.id, action.row, action.col);
  } else if (action.type === 'merge') {
    game = mergeUnitOnto(game, source.type, source.id, action.targetType, action.targetId);
    if (game !== before) queueUpgradeReveal(before, game, action.targetType, action.targetId);
  } else if (action.type === 'return') {
    game = returnCatToBench(game, source.id);
  } else if (action.type === 'sell') {
    game = sellCat(game, source.type, source.id);
  }
  return game !== before;
}

// Per-item flourish when a production item is used on a cat.
function itemUseKeyframes(kind) {
  if (kind === 'armour') {
    return { frames: [
      { offset: 0,    opacity: 0, transform: 'translateY(-34px) scale(0.9)' },
      { offset: 0.22, opacity: 1, transform: 'translateY(-34px) scale(1.18)' },
      { offset: 0.46, opacity: 1, transform: 'translateY(-30px) scale(1.30)' },
      { offset: 0.60, opacity: 1, transform: 'translateY(2px) scale(1.0)' },   // slam down
      { offset: 0.70, opacity: 1, transform: 'translateY(4px) scale(0.9)' },   // impact squash
      { offset: 0.85, opacity: 0.8, transform: 'translateY(0) scale(1.06)' },
      { offset: 1,    opacity: 0, transform: 'translateY(0) scale(1.14)' },    // merge into the cat
    ], opts: { duration: 780, easing: 'cubic-bezier(.3,.1,.3,1.4)' } };
  }
  if (kind === 'weapon') {
    return { frames: [
      { offset: 0,    opacity: 0, transform: 'translate(8px,-12px) rotate(-48deg) scale(0.85)' },
      { offset: 0.12, opacity: 1, transform: 'translate(8px,-12px) rotate(-48deg) scale(1)' },
      { offset: 0.28, opacity: 1, transform: 'translate(6px,-10px) rotate(38deg)' },   // swing
      { offset: 0.44, opacity: 1, transform: 'translate(6px,-10px) rotate(-30deg)' },  // swing
      { offset: 0.60, opacity: 1, transform: 'translate(6px,-10px) rotate(30deg)' },   // swing
      { offset: 0.74, opacity: 1, transform: 'translate(0,4px) rotate(0deg) scale(1.12)' }, // slam into paw
      { offset: 0.86, opacity: 1, transform: 'translate(0,4px) rotate(0deg) scale(0.98)' },
      { offset: 1,    opacity: 0, transform: 'translate(0,2px) rotate(0deg) scale(0.85)' },
    ], opts: { duration: 820, easing: 'ease-in-out' } };
  }
  // food: chomps that eat the treat away from the right, then a crumb poof.
  return { frames: [
    { offset: 0,    opacity: 0, transform: 'translateY(-6px) scale(0.6)',  clipPath: 'inset(0 0 0 0)' },
    { offset: 0.12, opacity: 1, transform: 'translateY(-6px) scale(1.1)',  clipPath: 'inset(0 0 0 0)' },
    { offset: 0.32, opacity: 1, transform: 'translateY(-4px) scale(0.9)',  clipPath: 'inset(0 34% 0 0)' },
    { offset: 0.48, opacity: 1, transform: 'translateY(-4px) scale(1.02)', clipPath: 'inset(0 34% 0 0)' },
    { offset: 0.64, opacity: 1, transform: 'translateY(-3px) scale(0.86)', clipPath: 'inset(0 66% 0 0)' },
    { offset: 0.82, opacity: 0.9, transform: 'translateY(-8px) scale(0.9)', clipPath: 'inset(0 84% 0 0)' },
    { offset: 1,    opacity: 0, transform: 'translateY(-18px) scale(0.8)', clipPath: 'inset(0 100% 0 0)' },
  ], opts: { duration: 900, easing: 'ease-in-out' } };
}

function playItemUseEffect(kind, targetId, tier) {
  playItemUse(kind);
  if (prefersReducedMotion) return;
  const catEl = findUnitElement(targetId);
  if (!catEl) return;
  const r = catEl.getBoundingClientRect();
  const wrap = document.createElement('div');
  wrap.className = 'item-use-fx';
  wrap.style.left = `${r.left + r.width / 2}px`;
  wrap.style.top = `${r.top + r.height / 2}px`;
  const inner = document.createElement('div');
  inner.className = 'item-use-fx-inner';
  inner.append(unitCanvas('item', { kind, tier }));
  wrap.append(inner);
  document.body.append(wrap);
  const { frames, opts } = itemUseKeyframes(kind);
  const animation = inner.animate(frames, opts);
  animation.finished.then(() => wrap.remove()).catch(() => wrap.remove());
}

function showDropWeight(action, descriptor) {
  if (action.type === 'equip') {
    const cell = upgradeAnchor('cat', action.targetId);
    cell?.classList.add('cat-landed');
    window.setTimeout(() => cell?.classList.remove('cat-landed'), 520);
    return;
  }
  if (descriptor?.kind === 'cell') {
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
  } else {
    const filled = [...document.querySelectorAll('.bench-slot.filled')].at(-1);
    filled?.classList.add('bench-landed');
    window.setTimeout(() => filled?.classList.remove('bench-landed'), 420);
  }
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
  hideMoveLimitTooltip();
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
  cleanupDragVisual(state);
  // The drag-ending click usually lands on a shared ancestor, so no cell/bench handler
  // consumes the suppress flag — clear it once the click phase has passed.
  window.setTimeout(() => { suppressNextPetClick = false; }, 0);

  if (!valid) {
    const movementMessage = movementRestrictionMessage(action, state.source);
    const fieldCapReached = action.reason === 'field-cap';
    const productionCat = state.source.type === 'shop-worker'
      || state.source.type === 'worker' || state.source.type === 'bench-worker';
    game.message = fieldCapReached
      ? FIELD_CAP_MESSAGE
      : movementMessage
      ? movementMessage
      : productionCat
      ? 'Production cats can only use the two House slots or matching cats on the Cat Workbench.'
      : target.descriptor?.kind === 'sell' && state.source.sellReason
      ? state.source.sellReason
      : 'That is not a valid drop. Cats can only use the lower yard and merge with the same color + level.';
    render();
    if (movementMessage) showMoveLimitTooltip(event.clientX, event.clientY, movementMessage);
    return;
  }

  const changed = applyDropAction(action, state.source);
  selected = null;
  if (changed) {
    recordTutorialMergeTask(action, state.source);
    completeTutorialTipForAction(action.type);
    const workerAction = action.type.includes('worker');
    game.message = action.type === 'sell' || action.type === 'tactics-move' || workerAction
      ? game.message
      : action.type === 'equip'
        ? `T${state.source.tier ?? 1} ${state.source.itemKind} equipped!`
      : action.type === 'merge'
      ? pendingUpgrade?.kind === 'level-up'
        ? `${pendingUpgrade.label} New gear unlocked!`
        : 'Matching cats stacked — one step closer to evolving!'
      : action.type === 'return'
        ? 'Cat reserved safely on the Cat Workbench.'
        : action.type === 'purchase-bench'
        ? 'Cat reserved on the Cat Workbench.'
        : 'Cat deployed!';
    if (isBattlefieldDropAction(action)) playCatDrop();
    if (action.type === 'merge-worker' || action.type === 'merge-bench-worker') playMerge();
  }
  render();
  if (changed && (action.type === 'use-food' || action.type === 'equip')) {
    playItemUseEffect(action.type === 'use-food' ? 'food' : state.source.itemKind,
      action.targetId, state.source.tier ?? 1);
  }
  if (changed && action.type === 'sell') {
    playCollection('coins');
    showAdoptionFeedback(state.cat, action.value);
  }
  else if (changed && action.type !== 'merge') showDropWeight(action, target.descriptor);
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
  if (collectingStations.has(index)) return;
  const output = game.workers[index]?.pendingOutput;
  const destination = productionCollectionDestination(game.inventory, output);
  const before = game;
  game = collectWorkerOutput(game, index);
  if (game === before || !destination) {
    game.message = 'House Storage is full — use or merge an item first.';
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
    render();
    showCollectionArrival(destination, output.quantity);
  }, COLLECTION_TIMING.sourceMs + COLLECTION_TIMING.flightMs);
}

function productionStation(worker, index) {
  const station = document.createElement('button');
  station.type = 'button';
  station.className = `production-cell station-cell ${worker ? 'active' : 'empty'}`;
  station.dataset.stationIndex = String(index);
  station.style.gridColumn = String(index + 2);
  station.style.gridRow = '1';
  if (!worker) {
    station.innerHTML = '<span class="empty-plus">·</span><small>STATION</small>';
    station.disabled = true;
    return station;
  }
  const info = WORKER_INFO[worker.role];
  station.classList.add(`station-${worker.role}`);
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
    station.disabled = game.phase !== 'prep' || playing;
    station.addEventListener('click', () => collectProductionOutput(index, station, outputHost));
  } else {
    station.disabled = true;
    const productionRounds = info.productionRounds ?? 1;
    const remaining = Math.max(1, productionRounds - (worker.productionProgress ?? 0));
    station.title = `${info.name} produces after ${remaining === 1 ? 'the next battle' : `${remaining} more battles`}`;
    if (productionRounds > 1) {
      const progress = productionProgressStatus(worker, info);
      station.setAttribute('aria-label', `${info.name} ${info.station}, ${progress.label.toLowerCase()} until completion`);
      const progressHost = document.createElement('span');
      progressHost.className = 'station-progress';
      progressHost.innerHTML = `
        <b>${progress.label}</b>
        <span class="station-progress-track"><i style="width:${progress.percent}%"></i></span>
      `;
      station.append(progressHost);
    }
    const workVisual = productionWorkVisual(worker.role);
    if (workVisual && game.phase === 'prep' && !playing) {
      station.classList.add('is-working', `work-${workVisual}`);
      const workActionMarkup = {
        coin: '<i class="trade-coin">●</i><i class="trade-spark trade-spark-one">✦</i><i class="trade-spark trade-spark-two">✦</i>',
        hammer: '<i class="forge-hammer"></i><i class="forge-spark spark-one"></i><i class="forge-spark spark-two"></i><i class="forge-spark spark-three"></i>',
        polish: '<i class="polish-cloth"></i><i class="armour-glint glint-one">✦</i><i class="armour-glint glint-two">✦</i>',
      }[workVisual];
      if (workActionMarkup) {
        const workAction = document.createElement('span');
        workAction.className = `work-action work-${workVisual}`;
        workAction.setAttribute('aria-hidden', 'true');
        workAction.innerHTML = workActionMarkup;
        station.append(workAction);
      }
    }
  }
  return station;
}

function productionWorkerSlot(index) {
  const worker = game.workers[index];
  const slot = document.createElement('button');
  slot.type = 'button';
  slot.className = `production-cell worker-slot ${worker ? 'filled' : 'empty'}`;
  slot.dataset.workerIndex = String(index);
  slot.style.gridColumn = String(index + 2);
  slot.style.gridRow = '2';
  if (!worker) {
    slot.innerHTML = '<span class="empty-plus">+</span><small>WORKER</small>';
    return slot;
  }
  const info = WORKER_INFO[worker.role];
  slot.append(unitCanvas('worker', worker));
  const workVisual = productionWorkVisual(worker.role);
  if (workVisual && game.phase === 'prep' && !worker.pendingOutput && !playing) {
    slot.classList.add('is-working', `worker-${workVisual}`);
  }
  slot.insertAdjacentHTML('beforeend', `<b>L${worker.level}</b><small>${info.shortName}</small><span class="copy-pips">${Array.from({ length: worker.copies ?? 1 }, () => '<i></i>').join('')}</span>`);
  bindPetDrag(slot, 'worker', { ...worker, workerIndex: index });
  bindTooltip(slot, () => workerTooltipInfo(worker, info));
  return slot;
}

function renderProduction() {
  if (!productionEl || !inventoryEl) return;
  productionEl.querySelectorAll(':scope > .production-cell').forEach((cell) => cell.remove());
  Array.from({ length: PRODUCTION_CAPACITY }, (_, index) => index)
    .forEach((index) => productionEl.append(productionStation(game.workers[index], index)));
  Array.from({ length: PRODUCTION_CAPACITY }, (_, index) => index)
    .forEach((index) => productionEl.append(productionWorkerSlot(index)));

  inventoryEl.innerHTML = '';
  game.inventory.forEach((item, index) => {
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = `inventory-slot ${item ? 'filled' : 'empty'}`;
    slot.dataset.inventoryIndex = String(index);
    if (!item) {
      slot.innerHTML = '<span class="empty-plus">+</span>';
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
          const before = game;
          game = mergeInventoryItems(game, index);
          if (game !== before) playMerge();
          render();
        });
      } else {
        slot.title = item.kind === 'food' ? 'Drag onto a damaged battlefield cat' : 'Drag onto a battlefield cat to equip';
      }
    }
    inventoryEl.append(slot);
  });
}

function renderWorkbench() {
  if (!workbenchEl) return;
  workbenchEl.innerHTML = '';
  for (let index = 0; index < BENCH_SIZE; index += 1) {
    const cat = game.bench[index];
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.className = `bench-slot ${cat ? 'filled' : 'empty'}`;
    slot.dataset.benchIndex = String(index);
    if (!cat) {
      slot.innerHTML = '<span class="empty-plus">+</span><small>RESERVE</small>';
      workbenchEl.append(slot);
      continue;
    }

    slot.dataset.unitId = cat.id;
    if (cat.kind === 'production-cat') {
      const info = WORKER_INFO[cat.role];
      slot.classList.add('worker-reserve');
      slot.append(unitCanvas('worker', cat));
      slot.insertAdjacentHTML('beforeend', `<b class="reserve-level">L${cat.level}</b><small>${info.shortName}</small><span class="copy-pips">${Array.from({ length: cat.copies ?? 1 }, () => '<i></i>').join('')}</span>`);
      bindPetDrag(slot, 'bench-worker', { ...cat, benchIndex: index });
      bindTooltip(slot, () => workerTooltipInfo(cat, info));
      slot.addEventListener('click', () => {
        if (suppressNextPetClick) return;
        game.message = `${info.name} is reserved. Drag into either Production House slot, or stack it with a matching production cat here.`;
        $('#message').textContent = game.message;
      });
    } else {
      slot.classList.add('fighter-reserve');
      if (selectedMatches('bench', cat.id)) slot.classList.add('selected');
      slot.append(catMarkup(cat));
      bindPetDrag(slot, 'bench', cat);
      bindTooltip(slot, () => catTooltipInfo(cat));
      slot.addEventListener('click', () => {
        if (suppressNextPetClick) return;
        if (selected && selected.id !== cat.id && tryMerge('bench', cat.id)) {
          render();
          return;
        }
        if (selectedMatches('bench', cat.id)) {
          selected = null;
          game.message = 'Cat deselected.';
        } else selectCat('bench', cat);
        render();
      });
    }
    workbenchEl.append(slot);
  }
}

function renderDogPreview() {
  if (!dogPreviewEl) return;
  dogPreviewEl.innerHTML = '';
  const queuedDogs = dogPreviewQueue(game.nextWave);
  const firstVisibleSlot = 3; // The Scout Report sign occupies the first grid row.
  for (let index = 0; index < 36; index += 1) {
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
  if (label) label.textContent = game.nextWave?.length ? `ROUND ${game.round}` : 'DEPLOYED';
}

const ACTIVE_COPY = {
  'bomb-cross': ['PLUS BOMB', 'Aim on the battlefield. The five blue squares show the plus-shaped blast.'],
  freeze: ['FREEZE', 'Choose a dog to freeze through this round and the next round.'],
  teleport: ['PORTAL', 'Choose one of your cats or a dog. Allies can go to any empty cat square; dogs can move up to 2 squares.'],
  decoy: ['DECOY', 'Choose an empty cat square or an existing phantom. Each cast adds Faux Paw\'s level + 1 blocks; the combined total loses 1 each later round.'],
  storm: ['STORM', 'Choose a dog column to strike.'],
  duel: ['DOG DUEL', 'Choose a square with two dogs, or one dog next to another dog.'],
};

function activeTargetingInstruction(targeting) {
  if (targeting?.mode === 'teleport' && targeting.targetCatId) {
    return 'Choose any empty cat-territory square for your cat.';
  }
  if (targeting?.mode === 'teleport' && targeting.targetDogId) {
    return 'Choose a square up to 2 steps away with room for one more dog.';
  }
  return ACTIVE_COPY[targeting?.mode]?.[1] ?? 'Choose a target.';
}

function clearBombTargetPreview() {
  gridEl.querySelectorAll('.bomb-footprint, .bomb-footprint-centre')
    .forEach((cell) => cell.classList.remove('bomb-footprint', 'bomb-footprint-centre'));
}

function showBombTargetPreview(row, col) {
  clearBombTargetPreview();
  if (activeTargeting?.mode !== 'bomb-cross') return;
  for (const cell of plusCells(row, col)) {
    const element = gridEl.querySelector(`.cell[data-row="${cell.row}"][data-col="${cell.col}"]`);
    element?.classList.add('bomb-footprint');
    if (cell.row === row && cell.col === col) element?.classList.add('bomb-footprint-centre');
  }
}

function clearStormTargetPreview() {
  gridEl.querySelectorAll('.storm-preview-column')
    .forEach((cell) => cell.classList.remove('storm-preview-column'));
  gridEl.querySelectorAll('.storm-preview-dog')
    .forEach((dog) => dog.classList.remove('storm-preview-dog'));
}

function showStormTargetPreview(col) {
  clearStormTargetPreview();
  if (activeTargeting?.mode !== 'storm') return;
  gridEl.querySelectorAll(`.cell[data-col="${col}"]`)
    .forEach((cell) => cell.classList.add('storm-preview-column'));
  const affectedDogIds = new Set(stormTargetDogIds(game.dogs, col));
  gridEl.querySelectorAll('.unit.dog-unit').forEach((dog) => {
    dog.classList.toggle('storm-preview-dog', affectedDogIds.has(dog.dataset.unitId));
  });
}

function clearAbilityTargetPreview() {
  clearBombTargetPreview();
  clearStormTargetPreview();
}

gridEl.addEventListener('pointerleave', clearAbilityTargetPreview);

function renderTacticsPanel() {
  const panel = $('#tactics-panel');
  const host = $('#active-abilities');
  if (!panel || !host) return;
  panel.hidden = game.phase !== 'tactics';
  host.innerHTML = '';
  if (panel.hidden) return;
  const activeCats = game.cats.filter((cat) => cat.activeAbility);
  host.classList.toggle('compact', activeCats.length >= 5);
  activeCats.forEach((cat) => {
    const copy = ACTIVE_COPY[cat.activeAbility] ?? ['CAST', 'Choose a target.'];
    const button = document.createElement('button');
    button.className = `active-ability ${cat.activeUsed ? 'used' : ''} ${activeTargeting?.casterId === cat.id ? 'targeting' : ''}`;
    button.disabled = cat.activeUsed || playing;
    button.innerHTML = `<b>${copy[0]}</b><span>${CAT_COAT_INFO[normalizeCoat(cat.coat)].shortName} · L${cat.level}</span>`;
    button.title = copy[1];
    button.addEventListener('click', () => {
      activeTargeting = {
        casterId: cat.id, mode: cat.activeAbility, targetCatId: null, targetDogId: null,
      };
      game.message = copy[1];
      render();
    });
    host.append(button);
  });
  if (!activeCats.length) host.innerHTML = '<p class="no-active-cats">No active-ability cats deployed.</p>';
  $('#tactics-help').textContent = activeTargeting
    ? activeTargetingInstruction(activeTargeting)
    : 'Move each cat once, drag supplies onto a cat, or cast one available ability.';
}

function tryActiveTarget(row, col, cat, dog) {
  if (playing || game.phase !== 'tactics' || !activeTargeting) return false;
  const targeting = activeTargeting;
  let payload = null;
  if (targeting.mode === 'bomb-cross') {
    const catchesDog = plusCells(row, col).some((cell) => game.dogs.some((unit) => (
      unit.hp > 0 && unit.row === cell.row && unit.col === cell.col
    )));
    if (catchesDog) payload = { row, col };
  } else if (targeting.mode === 'freeze' && dog) payload = { dogId: dog.id };
  else if (targeting.mode === 'storm' && stormTargetDogIds(game.dogs, col).length) payload = { col };
  else if (targeting.mode === 'decoy' && row >= CAT_ZONE_START && !cat) payload = { row, col };
  else if (targeting.mode === 'duel' && dog) payload = { row, col };
  else if (targeting.mode === 'teleport') {
    if (!targeting.targetCatId && !targeting.targetDogId && cat) {
      activeTargeting = { ...targeting, targetCatId: cat.id };
      game.message = activeTargetingInstruction(activeTargeting);
      render();
      return true;
    }
    if (!targeting.targetCatId && !targeting.targetDogId && dog) {
      activeTargeting = { ...targeting, targetDogId: dog.id };
      game.message = activeTargetingInstruction(activeTargeting);
      render();
      return true;
    }
    if (targeting.targetCatId && row >= CAT_ZONE_START && !cat && !dog) {
      payload = { targetCatId: targeting.targetCatId, row, col };
    }
    if (targeting.targetDogId && canTeleportDogTo(game, targeting.targetDogId, row, col)) {
      payload = { targetDogId: targeting.targetDogId, row, col };
    }
  }
  if (!payload) {
    game.message = activeTargetingInstruction(targeting);
    renderHud();
    return true;
  }
  const before = game;
  const nextGame = useActiveAbility(game, targeting.casterId, payload);
  if (nextGame !== before) {
    activeTargeting = null;
    clearAbilityTargetPreview();
    gridEl.querySelectorAll('.bomb-aim').forEach((cell) => cell.classList.remove('bomb-aim'));
    if (targeting.mode === 'bomb-cross') {
      void playBombAbility(nextGame);
      return true;
    }
    if (targeting.mode === 'storm') {
      void playStormAbility(nextGame);
      return true;
    }
    if (targeting.mode === 'duel') {
      void playDuelAbility(nextGame);
      return true;
    }
    game = nextGame;
    $('#board')?.classList.add('ability-cast');
    window.setTimeout(() => $('#board')?.classList.remove('ability-cast'), 420);
  }
  render();
  return true;
}

async function playBombAbility(nextGame) {
  playing = true;
  snapshotUnits(game);
  game = nextGame;
  renderHud();
  renderTacticsPanel();
  try {
    const blasts = nextGame.events.filter((event) => event.type === 'spell' && event.style?.startsWith('bomb-cross'));
    await Promise.all(groupAttacks(blasts).map((group, index) => animateAttack(group, index)));
    await playDeaths(blasts);
    for (const event of nextGame.events.filter((item) => item.type === 'panic-sidestep')) {
      await animateMove(event);
    }
  } finally {
    playing = false;
    render();
  }
}

async function playStormAbility(nextGame) {
  playing = true;
  snapshotUnits(game);
  game = nextGame;
  renderHud();
  renderTacticsPanel();
  try {
    await animateStorm(nextGame.events);
    await playDeaths(nextGame.events.filter((item) => item.type === 'spell'));
    for (const event of nextGame.events.filter((item) => item.type === 'panic-sidestep')) {
      await animateMove(event);
    }
  } finally {
    playing = false;
    render();
  }
}

/** Meowstro conducts two nearby dogs through one simultaneous exchange of attacks. */
async function playDuelAbility(nextGame) {
  playing = true;
  snapshotUnits(game);
  game = nextGame;
  renderHud();
  renderTacticsPanel();
  $('#board')?.classList.add('ability-cast');
  try {
    const attacks = nextGame.events.filter((event) => event.type === 'dog-duel');
    const conductor = nextGame.events.find((event) => event.type === 'dog-duel-cast');
    findUnitElement(conductor?.from)?.classList.add('duel-conducting');
    conductor?.targets?.forEach((id) => findUnitElement(id)?.classList.add('duel-performing'));
    await Promise.all(attacks.map(animateDogDuel));
    await playDeaths(attacks);
  } finally {
    $('#board')?.classList.remove('ability-cast');
    playing = false;
    render();
  }
}

function renderBoard() {
  gridEl.innerHTML = '';
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const cell = document.createElement('button');
      cell.className = `cell ${row >= CAT_ZONE_START ? 'cat-zone' : ''} ${row === CAT_ZONE_START ? 'middle' : ''}`;
      cell.dataset.row = row;
      cell.dataset.col = col;
      const cat = game.cats.find((unit) => unit.row === row && unit.col === col);
      const dogs = game.dogs.filter((unit) => unit.row === row && unit.col === col);
      const dog = dogs.at(-1) ?? null;
      const decoy = game.decoys?.find((unit) => unit.row === row && unit.col === col);
      const occupiedDescriptor = cat
        ? { id: cat.id, level: cat.level, coat: normalizeCoat(cat.coat) }
        : dog ?? decoy ?? null;
      const zone = row >= CAT_ZONE_START ? 'cat territory' : 'dog yard';
      const catInfo = cat ? catTooltipInfo(cat) : null;
      const catStatusLabel = catInfo?.effects?.length
        ? catInfo.effects.map((effect) => `${effect.label.toLowerCase()} ${effect.value}`).join(', ')
        : '';
      cell.setAttribute('aria-label', cat
        ? `Level ${cat.level} ${catLabel(cat)}, ${cat.hp} of ${cat.maxHp} HP${catStatusLabel ? `, ${catStatusLabel}` : ''}, row ${row + 1} column ${col + 1}`
        : dogs.length
          ? `${dogs.map((unit) => {
            const info = dogTooltipInfo(unit);
            const status = info.effects?.map((effect) => `${effect.label.toLowerCase()} ${effect.value}`).join(', ');
            return `${info.title}, ${unit.hp} of ${unit.maxHp} HP${status ? `, ${status}` : ''}`;
          }).join('; ')}${dogs.length > 1 ? ', stacked together' : ''}, row ${row + 1} column ${col + 1}`
          : decoy
            ? `Faux Paw phantom, ${decoy.blocks} attack block${decoy.blocks === 1 ? '' : 's'} remaining, row ${row + 1} column ${col + 1}`
            : `Empty ${zone}, row ${row + 1} column ${col + 1}`);
      if (cat) {
        cell.append(catMarkup(cat));
        if (selectedMatches('cat', cat.id)) cell.classList.add('selected');
        cell.classList.add('has-unit');
        bindPetDrag(cell, 'cat', cat);
        bindTooltip(cell, () => catTooltipInfo(cat));
      } else if (dogs.length) {
        dogs.forEach((unit, index) => cell.append(dogMarkup(unit, index, dogs.length)));
        cell.classList.add('has-unit', 'has-dog');
        if (dogs.length > 1) cell.classList.add('has-dog-stack');
        bindTooltip(cell, () => dogStackTooltipInfo(dogs));
      } else if (decoy) {
        // A real unit, not a loose canvas: the phantom blocker spends one block per hit
        // and needs an id so the effects layer can show the block and eventual shatter.
        const phantom = document.createElement('div');
        phantom.className = 'unit decoy-unit';
        phantom.dataset.unitId = decoy.id;
        phantom.append(unitCanvas('cat', { level: 1, coat: 8 }));
        const shield = document.createElement('span');
        shield.className = 'decoy-shield';
        shield.setAttribute('aria-hidden', 'true');
        const blockCount = document.createElement('span');
        blockCount.className = 'decoy-blocks';
        blockCount.textContent = String(decoy.blocks);
        shield.append(blockCount);
        phantom.append(shield);
        cell.append(phantom);
        cell.classList.add('has-unit', 'has-decoy');
        bindTooltip(cell, () => decoyTooltipInfo(decoy));
      }
      if (activeTargeting) {
        const bombAiming = activeTargeting.mode === 'bomb-cross';
        const stormAiming = activeTargeting.mode === 'storm';
        const dogsOnSquare = game.dogs.filter((unit) => unit.hp > 0 && unit.row === row && unit.col === col);
        const dogHasDuelOpponent = dogsOnSquare.length >= 2 || (
          dogsOnSquare.length === 1
          && game.dogs.some((unit) => unit.hp > 0 && Math.abs(unit.row - row) + Math.abs(unit.col - col) === 1)
        );
        const validActiveTarget = (activeTargeting.mode === 'freeze' && dog)
          || (activeTargeting.mode === 'decoy' && row >= CAT_ZONE_START && !cat)
          || (activeTargeting.mode === 'duel' && dogHasDuelOpponent)
          || (activeTargeting.mode === 'teleport' && !activeTargeting.targetCatId && !activeTargeting.targetDogId && (cat || dog))
          || (activeTargeting.mode === 'teleport' && activeTargeting.targetCatId && row >= CAT_ZONE_START && !cat && !dog && !decoy)
          || (activeTargeting.mode === 'teleport' && activeTargeting.targetDogId
            && canTeleportDogTo(game, activeTargeting.targetDogId, row, col));
        if (bombAiming) {
          cell.classList.add('bomb-aim');
          cell.addEventListener('pointerenter', () => showBombTargetPreview(row, col));
          cell.addEventListener('focus', () => showBombTargetPreview(row, col));
        } else if (stormAiming) {
          cell.classList.add('storm-aim');
          cell.addEventListener('pointerenter', () => showStormTargetPreview(col));
          cell.addEventListener('focus', () => showStormTargetPreview(col));
        } else if (validActiveTarget) cell.classList.add('ability-target');
      }
      // A click-selected cat lights the same targets, the same way, a drag would.
      if (!activeTargeting && selected && (game.phase === 'prep' || game.phase === 'tactics') && !playing) {
        const selectedUnit = selected.type === 'bench'
          ? game.bench.find((entry) => entry.id === selected.id)
          : selected.type === 'cat' ? game.cats.find((entry) => entry.id === selected.id) : null;
        if (selectedUnit) {
          const descriptor = {
            kind: 'cell', row, col,
            occupied: occupiedDescriptor,
          };
          if (dropAction({ ...selectedUnit, type: selected.type }, descriptor).type !== 'invalid') {
            cell.classList.add('drag-valid');
          }
        }
      }
      cell.addEventListener('click', (event) => {
        if (suppressNextPetClick) {
          suppressNextPetClick = false;
          return;
        }
        if (tryActiveTarget(row, col, cat, dog)) return;
        if ((game.phase !== 'prep' && game.phase !== 'tactics') || playing) return;
        if (cat) {
          if (game.phase === 'tactics' || !tryMerge('cat', cat.id)) selectCat('cat', cat);
        } else if (selected && row < CAT_ZONE_START) {
          // A silent no-op reads as a broken game — shake and say why instead.
          game.message = 'Cats stay in the four glowing rows at the bottom of the yard.';
          const board = $('#board');
          board?.classList.remove('board-shake');
          void board?.offsetWidth;
          board?.classList.add('board-shake');
          window.setTimeout(() => board?.classList.remove('board-shake'), 320);
        } else if (selected) {
          if (selected.type === 'bench') {
            const benchIndex = game.bench.findIndex((unit) => unit.id === selected.id);
            const before = game;
            game = placeCat(game, benchIndex, row, col);
            if (game !== before) {
              selected = null;
              playCatDrop();
            } else if (game.cats.length >= MAX_FIELD_CATS) {
              game.message = FIELD_CAP_MESSAGE;
            }
          } else if (selected.type === 'cat') {
            const movingCat = game.cats.find((unit) => unit.id === selected.id);
            const moveActionType = game.phase === 'tactics' ? 'tactics-move' : 'move';
            const attemptedAction = dropAction(
              movingCat ? { ...movingCat, type: 'cat' } : null,
              { kind: 'cell', row, col, occupied: occupiedDescriptor },
            );
            const before = game;
            game = game.phase === 'tactics'
              ? moveCatInTactics(game, selected.id, row, col)
              : moveCat(game, selected.id, row, col);
            if (game !== before) {
              completeTutorialTipForAction(moveActionType);
              selected = null;
              playCatDrop();
            } else {
              selected = null;
            }
            const movementMessage = movementRestrictionMessage(attemptedAction, movingCat);
            if (movementMessage) {
              game.message = movementMessage;
              window.setTimeout(() => showMoveLimitTooltip(event.clientX, event.clientY, movementMessage), 0);
            }
          }
        }
        render();
      });
      gridEl.append(cell);
    }
  }
}

function renderHud() {
  $('#gold').textContent = game.gold;
  $('#lives').textContent = game.lives;
  $('#round').textContent = `${game.round}/${MAX_ROUNDS}`;
  $('#squad-count').textContent = `${game.cats.length}/${MAX_FIELD_CATS}`;
  $('#bench-count').textContent = `${game.bench.length}/${BENCH_SIZE}`;
  $('#message').textContent = game.message;
  const speedChip = $('#speed-toggle');
  if (speedChip) {
    speedChip.classList.toggle('is-fast', combatSpeed === 2);
    speedChip.setAttribute('aria-pressed', combatSpeed === 2 ? 'true' : 'false');
    $('#speed-label').textContent = `${combatSpeed}×`;
  }
  $('#refresh').disabled = game.phase !== 'prep' || game.gold < 1 || playing;
  const selectedUnit = selected ? ownedCat(selected.type, selected.id) : null;
  const sale = selectedUnit ? catSaleQuote(game, selected.type, selected.id) : null;
  const adoptionBox = $('#adoption-box');
  if (adoptionBox) adoptionBox.hidden = game.phase !== 'prep';
  adoptionBox?.classList.toggle('has-selected-cat', Boolean(selectedUnit));
  if (!document.body.classList.contains('cat-sell-dragging')) {
    $('#adoption-box-value').textContent = `+${sale?.value ?? 1}`;
    $('#adoption-box-hint').textContent = sale
      ? sale.canSell ? `Selected cat · worth ${sale.value} gold` : sale.reason
      : 'Drag an owned cat here';
  }
  const canContinueTactics = game.phase === 'tactics';
  const doneButton = $('#done');
  if (!tutorialActive || game.round !== 1 || game.phase !== 'prep') {
    doneButton.classList.remove('tutorial-start-cue');
  }
  doneButton.hidden = game.phase === 'prep' && game.cats.length === 0;
  doneButton.disabled = playing || (!canContinueTactics && (game.phase !== 'prep' || game.cats.length === 0));
  $('#done-label').textContent = canContinueTactics
    ? 'CONTINUE FIGHT'
    : `START ROUND ${game.round}`;
  $('#shop-panel').style.opacity = game.phase === 'prep' ? '1' : '.62';
}

function findUnitElement(id) {
  return [...document.querySelectorAll('.unit')].find((unit) => unit.dataset.unitId === id);
}

/**
 * Who was on the board when this exchange started.
 *
 * The engine drops dead units from its state as it resolves, but the animation runs
 * afterwards — so by the time a dog needs to flip over, the engine has already forgotten
 * it existed. This snapshot is taken from the board as it was *before* the exchange, and
 * it is what lets the renderer still answer "which dog was that, and what did it look
 * like" while playing its death. It also identifies the attacker, which is how the six
 * cats that share `style: 'homing'` get told apart.
 */
let fxUnits = new Map();

function snapshotUnits(state) {
  fxUnits = new Map();
  for (const cat of state.cats ?? []) {
    fxUnits.set(cat.id, { kind: 'cat', key: normalizeCoat(cat.coat), coat: normalizeCoat(cat.coat) });
  }
  for (const dog of state.dogs ?? []) {
    fxUnits.set(dog.id, { kind: 'dog', key: dog.role, role: dog.role });
  }
  for (const decoy of state.decoys ?? []) {
    // The phantom blocker is drawn as Faux Paw, so it dies like one.
    fxUnits.set(decoy.id, { kind: 'cat', key: 8, coat: 8, decoy: true });
  }
}

const fxUnitFor = (id) => fxUnits.get(id) ?? null;

function effectAt(className, row, col, text = '') {
  const position = cellCenter(row, col);
  return effectAtPercent(className, position.xPercent, position.yPercent, text);
}

/** Effects that sit between cells — contact sparks, blast fronts — need raw coordinates. */
function effectAtPercent(className, xPercent, yPercent, text = '') {
  const effect = document.createElement('i');
  effect.className = className;
  effect.style.left = `${xPercent}%`;
  effect.style.top = `${yPercent}%`;
  effect.textContent = text;
  effectsEl.append(effect);
  return effect;
}

function clearDogReaction(target) {
  if (!target) return;
  for (const className of [...target.classList]) {
    if (className.startsWith('dog-reaction-')) target.classList.remove(className);
  }
}

/**
 * What it looks like to get hit.
 *
 * Every victim flashes red, but the rest of the reaction is matched to whatever landed on
 * it: it is thrown along the line from the attacker, the spark lands on the edge facing
 * the attacker rather than in the middle of the tile, and the decal left behind is the
 * one that source leaves — teeth for a bite, a dent for a tennis ball, a scorch for a
 * bomb, a burn for the beam.
 */
function showImpact(event, signature = null, { sound = true } = {}) {
  if (event.miss || !event.to) return;
  const key = signature ?? attackSignature(event, fxUnitFor(event.from));
  const fx = ATTACK_FX[key] ?? ATTACK_FX.homing;
  const hurt = HURT_FX[fx.impact] ?? HURT_FX.thump;
  const targetUnit = fxUnitFor(event.to);
  const dogFx = targetUnit?.kind === 'dog' ? attackDogFx(key, targetUnit.role) : null;
  const isDecoyBlock = Boolean(event.decoyBlock);
  if (sound) {
    if (isDecoyBlock) playArmourBlock();
    else playImpact(fx.impact, { heavy: Boolean(fx.heavy) });
  }
  // Armour rings even for blast victims whose boom already played: the soak is its own cue.
  if (!isDecoyBlock && (event.blocked ?? 0) > 0) {
    playArmourBlock({ broken: Boolean(event.armourBroken) });
  }

  const target = findUnitElement(event.to);
  // The blow comes from the attacker's tile; storm bolts and blasts come from above.
  const fromRow = event.fromRow ?? (event.toRow - 1);
  const fromCol = event.fromCol ?? event.col;
  const { dx, dy } = contactVector(fromRow, fromCol, event.toRow, event.col);

  // The contact point is on the victim's near edge — back along the line to the attacker.
  const centre = cellCenter(event.toRow, event.col);
  const reach = 0.34;
  const contactX = centre.xPercent - dx * (100 / COLS) * reach;
  const contactY = centre.yPercent - dy * (100 / ROWS) * reach;

  const burst = effectAtPercent(`impact-burst impact-${fx.impact}`, contactX, contactY);
  const mark = effectAtPercent(`hurt-mark mark-${hurt.mark}`, contactX, contactY);
  mark.style.setProperty('--mark-angle', `${(Math.atan2(dy, dx) * 180) / Math.PI}deg`);

  const numberFx = damageNumberFx(event);
  const damage = effectAt(`damage-number ${numberFx.classes}`, event.toRow, event.col, numberFx.text);
  damage.style.setProperty('--dmg-drift', `${numberFx.driftX}px`);
  damage.style.setProperty('--dmg-tilt', `${numberFx.tiltDeg}deg`);
  damage.style.setProperty('--dmg-ms', `${timing.damageNumberMs}ms`);
  if (numberFx.blocked) {
    // The armour sticker: shield plus how much it soaked, cracking off when it breaks.
    const chip = document.createElement('b');
    chip.className = `armour-chip${numberFx.blocked.broken ? ' armour-breaks' : ''}`;
    const icon = document.createElement('i');
    icon.textContent = '🛡️';
    chip.append(icon, String(numberFx.blocked.amount));
    damage.append(chip);
  }

  if (target) {
    target.classList.remove('hurt', 'shake-soft', 'shake-hard', 'shake-rattle', 'decoy-blocking');
    clearDogReaction(target);
    void target.offsetWidth;
    if (isDecoyBlock) {
      target.classList.add('decoy-blocking');
      const blockCount = target.querySelector('.decoy-blocks');
      if (blockCount) blockCount.textContent = String(event.blocksAfter);
    } else {
      // The recoil is a real direction, not a generic wobble: away from whatever hit it.
      target.style.setProperty('--hurt-dx', `${dx * hurt.recoil * 100}%`);
      target.style.setProperty('--hurt-dy', `${dy * hurt.recoil * 100}%`);
      target.classList.add('hurt', `shake-${hurt.shake}`);
      if (dogFx) target.classList.add(`dog-reaction-${dogFx.reaction}`);
      const hpBar = target.querySelector('.hp-bar');
      if (hpBar) {
        hpBar.style.width = `${Math.max(0, event.hpAfter / event.maxHp * 100)}%`;
        hpBar.className = `hp-bar hp-${hpTone(event.hpAfter, event.maxHp)}`;
      }
    }
  }
  window.setTimeout(() => { burst.remove(); mark.remove(); }, timing.impactMs);
  window.setTimeout(() => damage.remove(), timing.damageNumberMs);
  window.setTimeout(() => {
    target?.classList.remove('hurt', 'shake-soft', 'shake-hard', 'shake-rattle', 'decoy-blocking');
    clearDogReaction(target);
  }, timing.impactMs);
}

/**
 * One attack, not one damage event.
 *
 * The engine reports damage per victim, so an area attack arrives as several events. Draw
 * those one-by-one and a bomb comes out as a handful of pellets flying sideways — which
 * is exactly what Bombay Boom's explosion used to look like. So events are grouped back
 * into the attack that caused them, and the attack is drawn once: one bomb, one blast,
 * every victim caught in it.
 */
function groupAttacks(events) {
  const groups = new Map();
  for (const event of events) {
    const caster = fxUnitFor(event.from);
    const key = attackGroupKey(event, caster);
    if (!groups.has(key)) groups.set(key, { caster, events: [] });
    groups.get(key).events.push(event);
  }
  return [...groups.values()];
}

/** The event that actually threw the thing; secondaries are only its victims. */
function primaryOf(group) {
  return group.events.find((event) => {
    const fx = ATTACK_FX[attackSignature(event, group.caster)];
    return fx && !fx.absorbedBy;
  }) ?? group.events[0];
}

async function animateAttack(group, index) {
  const primary = primaryOf(group);
  const signature = attackSignature(primary, group.caster);
  const fx = ATTACK_FX[signature] ?? ATTACK_FX.homing;
  if (fx.path === 'lob') return animateLobbedBlast(group, primary, signature, fx, index);
  if (fx.path === 'beam') return animateBeam(group, primary, signature, fx, index);
  return animateProjectileVolley(group, signature, fx, index);
}

function showMuzzle(fx, row, col) {
  if (!fx.muzzle) return;
  const flash = effectAt(`muzzle-flash muzzle-${fx.muzzle}`, row, col);
  window.setTimeout(() => flash.remove(), timing.impactMs);
}

async function flyProjectile(event, signature, fx, { durationMs, arc = false }) {
  const fromCol = event.fromCol ?? event.col;
  const start = cellCenter(event.fromRow, fromCol);
  const end = cellCenter(event.toRow, event.col);
  const homing = fx.path === 'homing';
  const yarnThrow = fx.path === 'yarn-throw';
  const projectile = effectAt(
    `projectile-effect projectile-${fx.projectile} ${event.burst ? 'burst-projectile' : ''}`.trim(),
    event.fromRow,
    fromCol,
  );
  if (fx.tether) projectile.classList.add('has-tether');

  const keyframes = arc
    ? lobShotKeyframes(start, end)
      : yarnThrow
        ? yarnThrowKeyframes(start, end)
      : homing
        ? homingShotKeyframes(start, end)
        : [
          { left: `${start.xPercent}%`, top: `${start.yPercent}%`, transform: 'translate(-50%, -50%) scale(.7) rotate(0deg)' },
          { left: `${end.xPercent}%`, top: `${end.yPercent}%`, transform: `translate(-50%, -50%) scale(${event.burst ? 0.95 : 1.15}) rotate(360deg)` },
        ];
  const arcDots = arc ? keyframes.flatMap((frame, frameIndex) => {
    if (frameIndex === 0 || frameIndex === keyframes.length - 1 || frameIndex % 4 !== 0) return [];
    const dot = effectAtPercent(
      'bomb-arc-dot',
      Number(frame.left.replace('%', '')),
      Number(frame.top.replace('%', '')),
    );
    dot.style.setProperty('--arc-delay', `${Math.round(durationMs * frameIndex / (keyframes.length - 1))}ms`);
    dot.style.setProperty('--arc-dot-ms', `${Math.max(180, Math.round(timing.impactMs * 0.8))}ms`);
    return [dot];
  }) : [];

  const flight = projectile.animate(
    keyframes,
    { duration: durationMs, easing: 'linear', fill: 'forwards' },
  );
  await flight.finished.catch(() => {});
  projectile.remove();
  window.setTimeout(() => arcDots.forEach((dot) => dot.remove()), timing.impactMs);
}

/** Straight shots and homing shots, including Purrcy's three-pellet volley. */
async function animateProjectileVolley(group, signature, fx, index) {
  await Promise.all(group.events.map(async (event, pellet) => {
    const stagger = event.burst
      ? (event.pelletIndex ?? pellet) * timing.burstStaggerMs + index * 8
      : index * timing.shotStaggerMs;
    await wait(stagger);
    showMuzzle(fx, event.fromRow, event.fromCol ?? event.col);

    const durationMs = fx.path === 'homing'
      ? timing.homingMs
      : fx.path === 'yarn-throw' ? timing.yarnThrowMs
      : event.burst ? timing.burstProjectileMs : timing.projectileMs;
    await flyProjectile(event, signature, fx, { durationMs });

    if (event.miss || !event.to) {
      const fizzle = effectAt('impact-burst miss-fizzle', event.toRow, event.col);
      window.setTimeout(() => fizzle.remove(), timing.impactMs);
      await wait(Math.floor(timing.impactMs * 0.55));
      return;
    }
    showImpact(event, signature);
    if (fx.tether) showTether(event, signature);
    await wait(timing.impactMs + timing.hpPauseMs);
  }));
}

/** Knotty Kitty's yarn cinches onto the exact dog, including either dog in a stack. */
function showTether(event, signature = 'tangle') {
  const target = findUnitElement(event.to);
  const unit = fxUnitFor(event.to);
  if (!target || unit?.kind !== 'dog') return;

  const combo = attackDogFx(signature, unit.role);
  const wrap = document.createElement('span');
  wrap.className = `tangle-bind bind-${combo.bind}`;
  wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML = '<i></i><i></i><i></i><b></b>';
  target.append(wrap);
  target.classList.add('being-tied');

  window.setTimeout(() => {
    wrap.remove();
    target.classList.remove('being-tied');
  }, timing.impactMs + timing.hpPauseMs);
}

/**
 * Lobbed bombs visibly arc to their aim square, then paint their exact damage footprint:
 * one cell for Bombay's regular attack, a five-cell plus for his Tactics spell, or the
 * three side-by-side cells of Bone Jovi's mortar.
 */
async function animateLobbedBlast(group, primary, signature, fx, index) {
  await wait(index * timing.shotStaggerMs);
  showMuzzle(fx, primary.fromRow, primary.fromCol ?? primary.col);
  const aimRow = primary.aimRow ?? primary.toRow;
  const aimCol = primary.aimCol ?? primary.col;
  const aimedProjectile = { ...primary, toRow: aimRow, col: aimCol };

  if (primary.miss || !primary.to) {
    await flyProjectile(aimedProjectile, signature, fx, { durationMs: timing.lobMs, arc: true });
    const dud = effectAt('impact-burst miss-fizzle', aimRow, aimCol);
    window.setTimeout(() => dud.remove(), timing.impactMs);
    await wait(Math.floor(timing.impactMs * 0.55));
    return;
  }

  await flyProjectile(aimedProjectile, signature, fx, { durationMs: timing.lobMs, arc: true });

  const footprint = blastFootprint(fx.blast, aimRow, aimCol);
  const centre = cellCenter(aimRow, aimCol);
  const fireball = effectAtPercent('blast-fireball', centre.xPercent, centre.yPercent);
  const shockwave = effectAtPercent('blast-shockwave', centre.xPercent, centre.yPercent);
  const footprintCols = footprint.map((cell) => cell.col);
  const footprintRows = footprint.map((cell) => cell.row);
  const colSpan = Math.max(...footprintCols) - Math.min(...footprintCols) + 1;
  const rowSpan = Math.max(...footprintRows) - Math.min(...footprintRows) + 1;
  shockwave.style.setProperty('--blast-width', `${colSpan * (100 / COLS)}%`);
  shockwave.style.setProperty('--blast-height', `${rowSpan * (100 / ROWS)}%`);
  if (fx.blast === 'plus') shockwave.classList.add('blast-plus');

  const scorches = footprint.map(({ row, col }) => {
    const scorch = effectAt('blast-scorch', row, col);
    scorch.style.setProperty('--blast-ms', `${timing.blastMs}ms`);
    return scorch;
  });

  $('#board')?.classList.add('board-blast-shake');
  playImpact(fx.impact, { heavy: true });

  // Everything caught in the blast reacts from the aim square outward.
  group.events.forEach((event) => {
    if (event.miss || !event.to) return;
    const distance = Math.abs(event.col - aimCol) + Math.abs(event.toRow - aimRow);
    window.setTimeout(
      () => showImpact(event, attackSignature(event, group.caster), { sound: false }),
      distance * 70,
    );
  });

  await wait(timing.blastMs);
  $('#board')?.classList.remove('board-blast-shake');
  fireball.remove();
  shockwave.remove();
  scorches.forEach((scorch) => scorch.remove());
  await wait(timing.hpPauseMs);
}

/**
 * Laserpaw: a single beam from the cat through every dog it pierces, not one shot each.
 * It snaps on, burns through the line front-to-back, then cuts out.
 */
async function animateBeam(group, primary, signature, fx, index) {
  await wait(index * timing.shotStaggerMs);
  showMuzzle(fx, primary.fromRow, primary.fromCol ?? primary.col);

  const hits = group.events.filter((event) => !event.miss && event.to);
  const start = cellCenter(primary.fromRow, primary.fromCol ?? primary.col);
  // Reach the furthest dog pierced, or off the top of the board when nothing is there.
  const deepestRow = hits.length
    ? Math.min(...hits.map((event) => event.toRow))
    : 0;
  const end = cellCenter(deepestRow, primary.col);

  const beam = effectAtPercent('pierce-beam', start.xPercent, start.yPercent);
  const height = Math.abs(start.yPercent - end.yPercent) + (100 / ROWS) * 0.5;
  beam.style.setProperty('--beam-height', `${height}%`);
  beam.style.setProperty('--beam-charge-ms', `${timing.beamChargeMs}ms`);

  await wait(timing.beamChargeMs);
  beam.classList.add('is-firing');

  if (!hits.length) {
    const fizzle = effectAt('impact-burst miss-fizzle', 0, primary.col);
    window.setTimeout(() => fizzle.remove(), timing.impactMs);
    await wait(timing.beamHoldMs);
    beam.remove();
    return;
  }

  playImpact(fx.impact, { heavy: true });
  // Front dog burns through first, then the beam pushes deeper into the lane.
  [...hits]
    .sort((left, right) => right.toRow - left.toRow)
    .forEach((event, order) => {
      window.setTimeout(
        () => showImpact(event, signature, { sound: false }),
        order * timing.pierceStaggerMs,
      );
    });

  await wait(timing.beamHoldMs + hits.length * timing.pierceStaggerMs);
  beam.remove();
  await wait(timing.hpPauseMs);
}

/**
 * Everything killed during this half of the exchange goes down together.
 *
 * They all play at once, so a wipe costs one beat rather than one beat per body. The
 * board must not re-render until this resolves — re-rendering is what deletes the very
 * element being animated.
 */
async function playDeaths(events) {
  const fallen = new Map();
  for (const event of events) {
    if (isKill(event) && !fallen.has(event.to)) fallen.set(event.to, event);
  }
  if (!fallen.size) return;
  await Promise.all([...fallen].map(([id, event]) => playDeath(id, event)));
}

/**
 * One unit's death: it takes the hit, flips over, lands on its back with its paws in the
 * air, does its own bit of business, then flashes and fades out.
 *
 * The sprite is drawn standing with its feet at the bottom of the tile, so turning it a
 * half-turn is what puts it belly-up — and it keeps its own silhouette the whole way, so
 * a dachshund still dies looking like a dachshund. Which way it spins is decided by the
 * blow that killed it: you get knocked away from whatever hit you.
 */
async function playDeath(victimId, killingBlow) {
  const element = findUnitElement(victimId);
  const unit = fxUnitFor(victimId);
  if (!element || !unit) return;

  if (unit.kind === 'dog') playDogDeath();
  else playCatDeath();

  const spec = deathSpecFor(unit.kind, unit.key);
  const beats = deathTiming(combatSpeed);
  const fromRow = killingBlow.fromRow ?? (killingBlow.toRow - 1);
  const fromCol = killingBlow.fromCol ?? killingBlow.col;
  const { dx } = contactVector(fromRow, fromCol, killingBlow.toRow, killingBlow.col);

  // Spun away from the blow: hit from the left and you roll to the right.
  const spin = dx < -0.2 ? Math.abs(spec.spin) : dx > 0.2 ? -Math.abs(spec.spin) : spec.spin;
  const rest = (spin < 0 ? -180 : 180) + spec.tilt;
  const drift = dx * 16;

  element.classList.add('unit-dying', `gag-${spec.gag}`);
  if (spec.tongue) element.classList.add('ko-tongue');
  if (spec.float) element.classList.add('ko-float');
  element.append(koFace(unit));

  if (prefersReducedMotion) {
    // Skip the acrobatics. The flash and the fade carry the actual information — that
    // this unit is gone — so those are the parts that stay.
    element.classList.add('ko-strobe');
    await wait(beats.strobeMs);
    element.classList.add('ko-fade');
    await wait(beats.fadeMs);
    return;
  }

  const grounded = spec.float ? -spec.hop * 0.6 : 0;
  const settle = [];
  for (let bounce = 1; bounce <= spec.bounces; bounce += 1) {
    const height = (spec.hop * 0.22) / bounce;
    settle.push(
      { transform: `translate(${drift}%, ${grounded - height}%) rotate(${rest - 4 / bounce}deg) scale(1, .96)` },
      { transform: `translate(${drift}%, ${grounded}%) rotate(${rest}deg) scale(1.06, .9)` },
    );
  }

  const flop = element.animate([
    // Hitstop: the killing blow lands and everything holds for a frame.
    { transform: 'translate(0, 0) rotate(0deg) scale(1.14, .88)', offset: 0 },
    // Knocked off its feet and starting to turn over.
    { transform: `translate(${drift * 0.5}%, ${-spec.hop}%) rotate(${spin * 0.45}deg) scale(.94, 1.08)`, offset: 0.28 },
    // Comes down on its back.
    { transform: `translate(${drift}%, ${grounded}%) rotate(${spin}deg) scale(1.1, .88)`, offset: 0.62 },
    // Settles at its own resting angle.
    { transform: `translate(${drift}%, ${grounded}%) rotate(${rest}deg) scale(1, 1)`, offset: 0.74 },
    ...settle,
    { transform: `translate(${drift}%, ${grounded}%) rotate(${rest}deg) scale(1, 1)`, offset: 1 },
  ], {
    duration: beats.hitstopMs + beats.launchMs + beats.flopMs + beats.settleMs,
    easing: 'linear',
    fill: 'forwards',
    // Added to the unit's existing transform rather than replacing it. Dogs stack two to
    // a cell and carry a stack offset in CSS; overwriting it would make a stacked dog
    // jump across the tile the instant it died.
    composite: 'add',
  });
  await flop.finished.catch(() => {});

  // Lie there a moment so the pose actually reads, then flash and fade.
  await wait(beats.restMs);
  element.classList.add('ko-strobe');
  await wait(beats.strobeMs);
  element.classList.add('ko-fade');
  await wait(beats.fadeMs);
}

/** X-ed out eyes, placed on the unit's real face using the sprite's own head anchor. */
function koFace(unit) {
  const face = document.createElement('i');
  face.className = 'ko-face';
  const anchor = headAnchor(unit.kind, unit.key);
  face.style.left = `${anchor.x * 100}%`;
  face.style.top = `${anchor.y * 100}%`;
  face.innerHTML = '<b></b><b></b>';
  return face;
}

async function animateMelee(event, direction = 'down') {
  const attacker = findUnitElement(event.from);
  const className = direction === 'up' ? 'melee-lunge-up' : 'melee-lunge';
  attacker?.classList.add(className);
  await wait(Math.floor(timing.meleeMs / 2));
  if (!event.miss && event.to) {
    // The bare bite carries no style, so this resolves to the teeth reaction.
    showImpact(event);
    await wait(Math.ceil(timing.meleeMs / 2) + timing.hpPauseMs);
  } else {
    await wait(Math.ceil(timing.meleeMs / 2));
  }
  attacker?.classList.remove(className);
}

async function animateDogDuel(event) {
  const attacker = findUnitElement(event.from);
  const sameSquare = event.fromRow === event.toRow && event.fromCol === event.col;
  const x = sameSquare
    ? (event.duelIndex === 0 ? 24 : -24)
    : Math.sign(event.col - event.fromCol) * 42;
  const y = sameSquare ? 0 : Math.sign(event.toRow - event.fromRow) * 42;
  attacker?.style.setProperty('--duel-x', `${x}%`);
  attacker?.style.setProperty('--duel-y', `${y}%`);
  attacker?.classList.add('dog-dueling');
  await wait(Math.floor(timing.meleeMs / 2));
  showImpact(event, 'bite');
  await wait(Math.ceil(timing.meleeMs / 2) + timing.hpPauseMs);
  attacker?.classList.remove('dog-dueling');
  attacker?.style.removeProperty('--duel-x');
  attacker?.style.removeProperty('--duel-y');
}

async function animateCatScratch(event) {
  const attacker = findUnitElement(event.from);
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
  await wait(Math.round(BLUE_SCRATCH_FLURRY.hitAtMs / combatSpeed));
  if (!event.miss && event.to) showImpact(event, 'melee');
  await wait(Math.round((BLUE_SCRATCH_FLURRY.durationMs - BLUE_SCRATCH_FLURRY.hitAtMs) / combatSpeed));
  if (!event.miss && event.to) await wait(timing.hpPauseMs);
  flurry.remove();
  attacker?.classList.remove(BLUE_SCRATCH_FLURRY.attackerClass);
}

async function animateMove(event) {
  const dog = findUnitElement(event.id);
  if (!dog) return;
  const path = event.path?.length > 1
    ? event.path
    : [
      { row: event.fromRow ?? event.row - 1, col: event.fromCol ?? event.col },
      { row: event.toRow ?? event.row, col: event.col },
    ];
  const stepsMoved = Math.max(1, path.length - 1);
  const renderedCell = dog.closest('.cell');
  const origin = {
    row: Number(renderedCell?.dataset.row ?? path[0].row),
    col: Number(renderedCell?.dataset.col ?? path[0].col),
  };
  const stackOffset = dog.classList.contains('dog-stack-back')
    ? -10
    : dog.classList.contains('dog-stack-front') ? 8 : 0;
  const stackScale = dog.classList.contains('dog-stacked') ? 0.92 : 1;
  const movement = dog.animate(path.map((point, index) => ({
    transform: `translate(${(point.col - origin.col) * 100}%, calc(${(point.row - origin.row) * 100}% + ${stackOffset}%)) scale(${stackScale})`,
    offset: index / stepsMoved,
  })), {
    duration: Math.round(timing.movePauseMs * (0.65 + stepsMoved * 0.35)),
    easing: `steps(${Math.max(4, stepsMoved * 4)})`,
    fill: 'forwards',
  });
  await movement.finished.catch(() => {});
}

async function animateDogJump(event) {
  const dog = findUnitElement(event.id);
  if (!dog) return;
  const rowsMoved = Math.max(2, (event.toRow ?? event.row) - (event.fromRow ?? event.row - 2));
  const colsMoved = event.col - (event.fromCol ?? event.col);
  dog.classList.add('dog-jumping');
  const movement = dog.animate([
    { transform: 'translateY(0) scale(1)' },
    { transform: `translate(${colsMoved * 35}%, ${rowsMoved * 35}%) scale(1.16) rotate(-8deg)`, offset: 0.46 },
    { transform: `translate(${colsMoved * 100}%, ${rowsMoved * 100}%) scale(1) rotate(0deg)` },
  ], { duration: Math.round(timing.movePauseMs * 1.45), easing: 'steps(6)', fill: 'forwards' });
  await movement.finished.catch(() => {});
  dog.classList.remove('dog-jumping');
}

async function animateHowl(event) {
  playHowl();
  const dog = findUnitElement(event.id);
  const pulse = effectAt('howl-effect', event.row, event.col, `HOWL! +${event.bonus}`);
  dog?.classList.add('dog-howling');
  event.targets?.forEach((id) => findUnitElement(id)?.classList.add('pack-buffed'));
  await wait(Math.round(timing.meleeMs * 1.25));
  dog?.classList.remove('dog-howling');
  event.targets?.forEach((id) => findUnitElement(id)?.classList.remove('pack-buffed'));
  pulse.remove();
}

async function animateFear(event) {
  const dog = findUnitElement(event.id);
  const target = findUnitElement(event.to);
  const pulse = effectAt('fear-effect', event.row, event.col, `GRR! -${event.amount} ATK`);
  dog?.classList.add('dog-growling');
  target?.classList.add('frightened');
  await wait(Math.round(timing.meleeMs * 1.25));
  dog?.classList.remove('dog-growling');
  target?.classList.remove('frightened');
  pulse.remove();
}

async function animateFreezeSkip(event) {
  const dog = findUnitElement(event.id);
  if (!dog) return;
  const cue = effectAt('freeze-skip-cue', event.row, event.col, 'FROZEN!');
  dog.classList.add('freeze-skipping');
  await wait(Math.round(440 / combatSpeed));
  dog.classList.remove('freeze-skipping');
  if (event.remainingActions <= 0) {
    dog.classList.add('ice-thawing');
    await wait(Math.round(220 / combatSpeed));
  }
  cue.remove();
}

async function animateHeal(event) {
  playHeal();
  const target = findUnitElement(event.to);
  const heal = effectAt('heal-number', event.row, event.col, `+${event.amount} ♥`);
  target?.classList.add('healed');
  const hpBar = target?.querySelector('.hp-bar');
  if (hpBar) {
    hpBar.style.width = `${Math.max(0, event.hpAfter / event.maxHp * 100)}%`;
    hpBar.className = `hp-bar hp-${hpTone(event.hpAfter, event.maxHp)}`;
  }
  await wait(Math.round(680 / combatSpeed));
  heal.remove();
  target?.classList.remove('healed');
}

async function animateBreachParty(event) {
  // The dogs reached the yard — they throw a little party and trot off happy,
  // rather than getting wiped out. (It still costs the player a life.)
  const dancers = [...fxUnits]
    .filter(([id, unit]) => unit.kind === 'dog' && findUnitElement(id))
    .map(([id]) => id)
    .filter((id) => Number(findUnitElement(id)?.closest('.cell')?.dataset.col) === event.col);
  if (!dancers.length) return;

  playCelebration();
  await Promise.all(dancers.map((id) => {
    const el = findUnitElement(id);
    if (!el) return Promise.resolve();
    const cell = el.closest('.cell');
    partyBurst(Number(cell?.dataset.row ?? 0), Number(cell?.dataset.col ?? 0));
    const dance = el.animate([
      { transform: 'translateY(0) rotate(0deg)' },
      { transform: 'translateY(-10px) rotate(-16deg)' },
      { transform: 'translateY(0) rotate(0deg)' },
      { transform: 'translateY(-10px) rotate(16deg)' },
      { transform: 'translateY(0) rotate(0deg)' },
      { transform: 'translateY(-8px) rotate(-11deg)' },
      { transform: 'translateY(0) rotate(0deg)' },
    ], { duration: Math.round(1000 / combatSpeed), composite: 'add', easing: 'ease-in-out' });
    return dance.finished.catch(() => {});
  }));
  await wait(Math.round(220 / combatSpeed));
}

function partyBurst(row, col) {
  const emoji = document.createElement('div');
  emoji.className = 'breach-party';
  emoji.textContent = ['🎉', '💛', '♪', '★'][Math.floor(Math.random() * 4)];
  emoji.style.left = `${(col + 0.5) * (100 / COLS)}%`;
  emoji.style.top = `${(row + 0.2) * (100 / ROWS)}%`;
  effectsEl.append(emoji);
  const anim = emoji.animate([
    { transform: 'translate(-50%, -50%) scale(0.5)', opacity: 0 },
    { transform: 'translate(-50%, -150%) scale(1.1)', opacity: 1, offset: 0.35 },
    { transform: 'translate(-50%, -340%) scale(0.9)', opacity: 0 },
  ], { duration: Math.round(1100 / combatSpeed), easing: 'ease-out' });
  anim.finished.then(() => emoji.remove()).catch(() => emoji.remove());
}

async function animateStorm(events) {
  const strikes = events.filter((event) => event.type === 'spell' && event.style === 'lightning');
  if (!strikes.length) return;

  const board = $('#board');
  const caster = findUnitElement(strikes[0].from);
  const { leftPercent, widthPercent } = stormColumnPosition(strikes[0].col);
  const flashMs = Math.max(220, timing.stormFlashLeadMs + timing.impactMs);
  const skyFlash = document.createElement('div');
  skyFlash.className = 'storm-sky-flash';
  skyFlash.style.setProperty('--storm-flash-ms', `${flashMs}ms`);
  const strike = document.createElement('div');
  strike.className = 'storm-strike';
  strike.style.left = `${leftPercent}%`;
  strike.style.width = `${widthPercent}%`;
  strike.style.setProperty('--storm-charge-ms', `${timing.stormChargeMs}ms`);
  strike.style.setProperty('--storm-flash-ms', `${flashMs}ms`);
  strike.innerHTML = `
    <span class="storm-column-charge"></span>
    <span class="storm-cloud"></span>
    <span class="storm-bolt storm-bolt-main"></span>
    <span class="storm-bolt storm-bolt-fork storm-bolt-fork-left"></span>
    <span class="storm-bolt storm-bolt-fork storm-bolt-fork-right"></span>
    <span class="storm-ground-flare"></span>
  `;
  effectsEl.append(skyFlash, strike);

  const targetMarkers = strikes.map((event) => {
    const marker = effectAt('storm-target-marker', event.toRow, event.col);
    marker.style.setProperty('--storm-flash-ms', `${flashMs}ms`);
    marker.innerHTML = '<b></b><b></b><b></b><b></b>';
    return marker;
  });

  board?.style.setProperty('--storm-flash-ms', `${flashMs}ms`);
  board?.classList.add('storm-active');
  caster?.classList.add('storm-casting');
  setTurnTag('storm');

  try {
    await wait(timing.stormChargeMs);
    strike.classList.add('is-striking');
    skyFlash.classList.add('is-striking');
    board?.classList.add('storm-recoil');
    targetMarkers.forEach((marker) => marker.classList.add('is-striking'));
    await wait(timing.stormFlashLeadMs);
    playImpact(ATTACK_FX.lightning.impact, { heavy: true });
    strikes.forEach((event) => showImpact(event, 'lightning', { sound: false }));
    await wait(timing.stormAftermathMs);
  } finally {
    board?.classList.remove('storm-active', 'storm-recoil');
    board?.style.removeProperty('--storm-flash-ms');
    caster?.classList.remove('storm-casting');
    setTurnTag(null);
    effectsEl.innerHTML = '';
  }
}

/** Small pill over the board that names whose half of the exchange is animating. */
function setTurnTag(side) {
  const tag = $('#turn-tag');
  if (!tag) return;
  if (!side) {
    tag.hidden = true;
    return;
  }
  tag.textContent = side === 'cats' ? '▸ CATS ACT' : side === 'storm' ? '⚡ THUNDERPAWS' : '▸ DOGS ACT';
  tag.className = `turn-tag ${side}`;
  tag.hidden = false;
}

async function animateEvents(events) {
  effectsEl.innerHTML = '';
  const shots = events.filter((event) => event.type === 'shot');
  const catMelee = events.filter((event) => event.type === 'cat-melee');
  const melee = events.filter((event) => event.type === 'melee');
  const dogShots = events.filter((event) => event.type === 'dog-shot');
  const moves = events.filter((event) => event.type === 'move');
  const panicMoves = events.filter((event) => event.type === 'panic-sidestep');
  const jumps = events.filter((event) => event.type === 'dog-jump');
  const howls = events.filter((event) => event.type === 'howl');
  const heals = events.filter((event) => event.type === 'heal');
  const dogHeals = events.filter((event) => event.type === 'dog-heal');
  const fears = events.filter((event) => event.type === 'dog-fear');
  const freezeSkips = events.filter((event) => event.type === 'freeze-skip');
  const breaches = events.filter((event) => event.type === 'breach');

  // --- The cats act. Every dog they kill goes down before the dogs get their turn. ---
  if (shots.length || catMelee.length || panicMoves.length) setTurnTag('cats');
  await Promise.all([
    ...groupAttacks(shots).map((group, index) => animateAttack(group, index)),
    ...catMelee.map(animateCatScratch),
    ...heals.map(animateHeal),
  ]);
  await playDeaths([...shots, ...catMelee]);
  for (const event of panicMoves) await animateMove(event);

  // --- The dogs act. Every cat they kill goes down at the end of it. ---
  if (melee.length || dogShots.length || moves.length || jumps.length || howls.length || dogHeals.length || fears.length || freezeSkips.length) setTurnTag('dogs');
  await Promise.all([
    ...groupAttacks(dogShots).map((group, index) => animateAttack(group, index)),
    ...howls.map(animateHowl),
    ...dogHeals.map(animateHeal),
    ...fears.map(animateFear),
    ...freezeSkips.map(animateFreezeSkip),
  ]);
  await Promise.all([...moves.map(animateMove), ...jumps.map(animateDogJump)]);
  await Promise.all(melee.map((event) => animateMelee(event, 'down')));
  await playDeaths([...dogShots, ...melee]);

  // Dogs that reached the yard celebrate and trot off happy.
  for (const event of breaches) await animateBreachParty(event);

  setTurnTag(null);
  effectsEl.innerHTML = '';
}

function showResult() {
  const won = game.phase === 'victory';
  $('#result-kicker').textContent = won ? 'LEVEL 1 COMPLETE' : 'OUT OF LIVES';
  $('#result-title').textContent = won ? 'Backyard Defended!' : 'The Dogs Broke Through';
  $('#result-copy').textContent = won ? 'The porch is safe—for now.' : 'Rebuild your cat squad and try again.';
  drawCat($('#result-cat'), won ? 3 : 1, won ? 0 : 1, won);
  stopLevelMusic();
  if (won) playVictory();
  else playDefeat();
  modalEl.hidden = false;
}

function productionTimingDescription(info) {
  const rounds = info.productionRounds ?? 1;
  return rounds === 1
    ? 'Produces after each completed battle.'
    : `Produces every ${rounds} completed battles.`;
}

function renderProductionLegend() {
  const host = $('#production-legend');
  if (!host) return;
  host.innerHTML = '';
  productionLegendRows(WORKER_INFO).forEach((entry) => {
    const info = WORKER_INFO[entry.role];
    const row = document.createElement('div');
    row.className = 'legend-row production-legend-row';
    row.title = `${info.blurb}. ${productionTimingDescription(info)}`;
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

/** Legend row per coat: sprite, name, five-word role, and the unlock round when locked. */
const COAT_ROLE_WORDS = {
  0: 'highest damage · one lane only',
  1: 'extreme HP · tiny front melee',
  2: 'balanced stats · homing shot',
  3: 'one-time tangle · low damage',
  4: 'medium lane bomb · plus spell',
  5: 'pierces 3 · fragile & lane-locked',
  6: 'hard freeze · weak normal attack',
  7: 'best mobility · low attack',
  8: 'decaying blocks · fragile caster',
  9: 'huge spell · weakest normal attack',
  10: 'dog duel · tiny personal attack',
};

function renderLegend() {
  const host = $('#coat-legend');
  if (!host) return;
  host.innerHTML = '';
  Object.entries(CAT_COAT_INFO).forEach(([coatKey, info]) => {
    const coat = Number(coatKey);
    const locked = info.unlockRound > game.round;
    const row = document.createElement('div');
    row.className = `legend-row ${locked ? 'locked' : ''}`;
    row.title = info.attackDetail;
    const canvas = document.createElement('canvas');
    drawCat(canvas, 1, coat);
    const name = document.createElement('b');
    name.textContent = info.shortName.toUpperCase();
    row.append(canvas, name);
    if (info.unlockRound > 1) {
      const chip = document.createElement('small');
      chip.className = 'unlock-chip';
      chip.textContent = `R${info.unlockRound}`;
      row.append(chip);
    }
    const role = document.createElement('span');
    role.textContent = COAT_ROLE_WORDS[coat] ?? info.blurb;
    row.append(role);
    host.append(row);
  });
}

function isGamePaused() {
  return manualPaused || glossaryPaused;
}

function syncPauseState() {
  const paused = isGamePaused();
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
    resumeWaiters.splice(0).forEach((resolve) => resolve());
  }
}

function waitForResume() {
  return isGamePaused() ? new Promise((resolve) => resumeWaiters.push(resolve)) : Promise.resolve();
}

function glossaryCard({ kind, key, name, category, kicker, stats, description, note }) {
  const card = document.createElement('article');
  card.className = `glossary-entry ${kind}`;
  const canvas = document.createElement('canvas');
  if (kind === 'battle') drawCat(canvas, 1, key);
  else if (kind === 'production') drawWorker(canvas, key, 1);
  else drawDog(canvas, 1, key);
  const copy = document.createElement('div');
  copy.innerHTML = `<small>${kicker}</small><h3>${category ? `<span class="glossary-tier">${category}</span>` : ''}${name}</h3><b>${stats}</b><p>${description}</p>${note ? `<em>${note}</em>` : ''}`;
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
    glossaryEntriesByUnlockRound(CAT_COAT_INFO).forEach(([coatKey, info]) => {
      const coat = Number(coatKey);
      const stats = catStatsFor(1, coat);
      const round = info.unlockRound;
      grid.append(glossaryCard({
        kind: 'battle', key: coat, name: info.name,
        category: `T${info.shopTier}`,
        kicker: `BATTLE CAT · ${round === 1 ? 'STARTER' : `UNLOCKS ROUND ${round}`}`,
        stats: `♥ ${stats.hp} · ↑ ${stats.attack}`,
        description: info.attackDetail,
        note: `Strength: ${info.strength}. Weakness: ${info.weakness}.`,
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
        category: 'WORK',
        kicker: `PRODUCTION CAT · ${info.station.toUpperCase()}`,
        stats: outputs,
        description: `${info.blurb}. ${productionTimingDescription(info)}`,
        note: 'Lives in the House. Match 3 of the same role and level to evolve.',
      }));
    });
  } else {
    Object.entries(DOG_ROLE_INFO).forEach(([role, info]) => {
      const displayTier = info.minimumTier ?? 1;
      const stats = dogStatsFor(displayTier, role);
      const roleStat = {
        frisbee: `DISC ${Math.ceil(stats.attack * 0.7)}`,
        tennis: `BALL ${Math.ceil(stats.attack * 0.6)}`,
        howler: `HOWL +${stats.howlBonus}`,
        lobber: `BOMB ${Math.max(1, Math.floor(stats.attack * 0.6))} SPLASH`,
        jumper: 'MOVE 3 · JUMP 1×',
        skittish: 'PANIC STEP',
        medic: `HEAL ${stats.healPower}`,
        growler: `FRIGHTEN -${stats.fearPower}`,
      }[role] ?? `BITE ${stats.attack}`;
      grid.append(glossaryCard({
        kind: 'dogs', key: role, name: info.name,
        kicker: `DOG ROLE · ${info.unlockRound === 1 ? 'STARTER' : `UNLOCKS ROUND ${info.unlockRound}`}${displayTier > 1 ? ` · T${displayTier}+` : ''}`,
        stats: `♥ ${stats.hp} · ${roleStat}${role === 'scruffy' ? '' : ` · BITE ${stats.attack}`}`,
        description: info.attackDetail,
        note: `Strength: ${info.strength}. Weakness: ${info.weakness}.`,
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

// --- Tutorial overlay: spotlight a target element + show a coach bubble. ---
// dim: darken the rest of the screen (only for informational steps). showSpotlight:
// draw the ring on `selector` (off for drag steps, which light source+target instead).
const TUTORIAL_SPOTLIGHT_PAD = 8;
const TUTORIAL_OUTLINE_REACH = 8;
const TUTORIAL_BUBBLE_CLEARANCE = 10;

function positionTutorialOverlay(selector, showContinue, opts = {}) {
  const { dim = true, showSpotlight = true, mutedRegion = null, anchorSelectors = [] } = opts;
  const target = selector ? document.querySelector(selector) : null;
  const pad = TUTORIAL_SPOTLIGHT_PAD;
  if (target && showSpotlight) {
    const r = target.getBoundingClientRect();
    tutorialSpotlightEl.style.display = 'block';
    tutorialSpotlightEl.classList.toggle('no-dim', !dim);
    tutorialSpotlightEl.style.left = `${r.left - pad}px`;
    tutorialSpotlightEl.style.top = `${r.top - pad}px`;
    tutorialSpotlightEl.style.width = `${r.width + pad * 2}px`;
    tutorialSpotlightEl.style.height = `${r.height + pad * 2}px`;
  } else {
    tutorialSpotlightEl.style.display = 'none';
  }
  const mutedTarget = mutedRegion ? document.querySelector(mutedRegion) : null;
  if (mutedTarget) {
    const r = mutedTarget.getBoundingClientRect();
    tutorialMutedRegionEl.hidden = false;
    tutorialMutedRegionEl.style.left = `${r.left}px`;
    tutorialMutedRegionEl.style.top = `${r.top}px`;
    tutorialMutedRegionEl.style.width = `${r.width}px`;
    tutorialMutedRegionEl.style.height = `${r.height}px`;
  } else {
    tutorialMutedRegionEl.hidden = true;
  }
  // Bubble can anchor to the combined footprint of several nearby targets.
  const anchorRects = anchorSelectors
    .map((anchorSelector) => document.querySelector(anchorSelector)?.getBoundingClientRect())
    .filter(Boolean);
  const anchorRect = anchorRects.length
    ? {
        left: Math.min(...anchorRects.map((r) => r.left)),
        top: Math.min(...anchorRects.map((r) => r.top)),
        right: Math.max(...anchorRects.map((r) => r.right)),
        bottom: Math.max(...anchorRects.map((r) => r.bottom)),
      }
    : target?.getBoundingClientRect();
  if (anchorRect) {
    const r = {
      left: anchorRect.left, top: anchorRect.top,
      right: anchorRect.right, bottom: anchorRect.bottom,
      width: anchorRect.right - anchorRect.left,
      height: anchorRect.bottom - anchorRect.top,
    };
    const bubbleH = tutorialBubbleEl.offsetHeight || 140;
    const bubbleW = tutorialBubbleEl.offsetWidth || 300;
    const viewportPad = 12;
    // Target padding + the visible ring + 10px of clear space requested around it.
    const targetGap = TUTORIAL_SPOTLIGHT_PAD + TUTORIAL_OUTLINE_REACH + TUTORIAL_BUBBLE_CLEARANCE;
    const rawLeft = anchorRects.length ? r.left + r.width / 2 - bubbleW / 2 : r.left;
    const verticalLeft = Math.min(Math.max(viewportPad, rawLeft), window.innerWidth - bubbleW - viewportPad);
    const horizontalTop = Math.min(
      Math.max(viewportPad, r.top + r.height / 2 - bubbleH / 2),
      window.innerHeight - bubbleH - viewportPad,
    );
    const placements = [
      { fits: r.bottom + targetGap + bubbleH <= window.innerHeight - viewportPad,
        top: r.bottom + targetGap, left: verticalLeft },
      { fits: r.top - targetGap - bubbleH >= viewportPad,
        top: r.top - bubbleH - targetGap, left: verticalLeft },
      { fits: r.right + targetGap + bubbleW <= window.innerWidth - viewportPad,
        top: horizontalTop, left: r.right + targetGap },
      { fits: r.left - targetGap - bubbleW >= viewportPad,
        top: horizontalTop, left: r.left - bubbleW - targetGap },
    ];
    const placement = placements.find(({ fits }) => fits) ?? {
      // Very small viewports may have no outside fit. Keep the bubble at least
      // 10px inside the ring rather than letting its edge touch the outline.
      top: viewportPad,
      left: Math.min(
        Math.max(viewportPad, r.left + Math.max(0, TUTORIAL_BUBBLE_CLEARANCE - TUTORIAL_SPOTLIGHT_PAD)),
        window.innerWidth - bubbleW - viewportPad,
      ),
    };
    tutorialBubbleEl.style.top = `${placement.top}px`;
    tutorialBubbleEl.style.left = `${placement.left}px`;
    tutorialBubbleEl.style.transform = 'none';
  } else {
    tutorialBubbleEl.style.top = '50%';
    tutorialBubbleEl.style.left = '50%';
    tutorialBubbleEl.style.transform = 'translate(-50%, -50%)';
  }
  tutorialNextEl.hidden = !showContinue;
}

function showTutorialBubble(text, selector, showContinue, opts) {
  tutorialTextEl.textContent = text;
  tutorialOverlayEl.hidden = false;
  positionTutorialOverlay(selector, showContinue, opts);
}

function setTutorialStartCue(active) {
  $('#done')?.classList.toggle('tutorial-start-cue', active);
  tutorialSpotlightEl?.classList.toggle('tutorial-start-cue', active);
}

function hideTutorialOverlay() {
  setTutorialStartCue(false);
  tutorialOverlayEl.hidden = true;
  hideTutorialFocus();
  hideDragHint();
}

function showTutorialFocus(selectors) {
  tutorialFocusHighlightsEl.replaceChildren();
  selectors.forEach((selector) => {
    const target = document.querySelector(selector);
    if (!target) return;
    const r = target.getBoundingClientRect();
    const pad = 4;
    const highlight = document.createElement('div');
    highlight.className = 'tutorial-focus-highlight';
    Object.assign(highlight.style, {
      left: `${r.left - pad}px`, top: `${r.top - pad}px`,
      width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px`,
    });
    tutorialFocusHighlightsEl.append(highlight);
  });
}

function hideTutorialFocus() {
  tutorialFocusHighlightsEl.replaceChildren();
}

function clearTutorialMoveFocus() {
  if (!tutorialActive || tutorialCurrentTip?.id !== 'tip-move') return;
  tutorialMoveFocusCleared = true;
  hideTutorialFocus();
}

function completeTutorialTipForAction(actionType) {
  const tip = tutorialCurrentTip;
  if (!tutorialActive || !tip?.completeOnActions?.includes(actionType)) return;
  tutorialSeenTips.add(tip.id);
  tutorialCurrentTip = null;
  tutorialMoveFocusCleared = true;
  hideTutorialFocus();
}

// Highlight every unfinished drop and loop one ghost gesture per task. The
// Round 2 merge lesson uses two cues at once; other lessons pass one cue.
function dragHintElements(id) {
  let root = [...tutorialDragHintsEl.children].find((child) => child.dataset.hintId === id);
  if (!root) {
    root = document.createElement('div');
    root.className = 'tutorial-drag-hint';
    root.dataset.hintId = id;
    const source = document.createElement('div');
    source.className = 'tutorial-source-highlight';
    const target = document.createElement('div');
    target.className = 'tutorial-drop-target';
    const ghost = document.createElement('div');
    ghost.className = 'tutorial-drag-ghost';
    const unit = document.createElement('span');
    unit.className = 'tutorial-drag-unit';
    const cursor = document.createElement('span');
    cursor.className = 'tutorial-drag-cursor';
    cursor.setAttribute('aria-hidden', 'true');
    ghost.append(unit, cursor);
    root.append(source, target, ghost);
    tutorialDragHintsEl.append(root);
  }
  return {
    root,
    source: root.querySelector('.tutorial-source-highlight'),
    target: root.querySelector('.tutorial-drop-target'),
    ghost: root.querySelector('.tutorial-drag-ghost'),
    unit: root.querySelector('.tutorial-drag-unit'),
  };
}

function showDragHints(hints) {
  const activeIds = new Set();
  hints.forEach((hint, index) => {
    const from = hint?.from ? document.querySelector(hint.from) : null;
    const to = hint?.to ? document.querySelector(hint.to) : null;
    if (!from || !to) return;
    const id = hint.id ?? `drag-${index}`;
    activeIds.add(id);
    const elements = dragHintElements(id);
    const fr = from.getBoundingClientRect();
    const tr = to.getBoundingClientRect();
    const pad = 6;
    Object.assign(elements.source.style, {
      left: `${fr.left - pad}px`, top: `${fr.top - pad}px`,
      width: `${fr.width + pad * 2}px`, height: `${fr.height + pad * 2}px`,
    });
    Object.assign(elements.target.style, {
      left: `${tr.left - pad}px`, top: `${tr.top - pad}px`,
      width: `${tr.width + pad * 2}px`, height: `${tr.height + pad * 2}px`,
    });
    const srcCanvas = from.querySelector('canvas');
    elements.unit.style.backgroundImage = srcCanvas ? `url(${srcCanvas.toDataURL()})` : 'none';
    const previous = dragHintAnimations.get(id);
    if (prefersReducedMotion) {
      previous?.animation.cancel();
      dragHintAnimations.delete(id);
      elements.ghost.hidden = true;
      return;
    }
    const signature = `${hint.from}=>${hint.to}`;
    if (previous?.signature === signature) { elements.ghost.hidden = false; return; }
    previous?.animation.cancel();
    const fromX = fr.left + fr.width / 2, fromY = fr.top + fr.height / 2;
    const toX = tr.left + tr.width / 2, toY = tr.top + tr.height / 2;
    elements.ghost.hidden = false;
    const animation = elements.ghost.animate([
      { offset: 0,    left: `${fromX}px`, top: `${fromY}px`, opacity: 0, transform: 'translate(-50%, -50%) scale(0.7)' },
      { offset: 0.14, left: `${fromX}px`, top: `${fromY}px`, opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
      { offset: 0.70, left: `${toX}px`,   top: `${toY}px`,   opacity: 1, transform: 'translate(-50%, -50%) scale(1)' },
      { offset: 0.86, left: `${toX}px`,   top: `${toY}px`,   opacity: 1, transform: 'translate(-50%, -50%) scale(0.88)' },
      { offset: 1,    left: `${toX}px`,   top: `${toY}px`,   opacity: 0, transform: 'translate(-50%, -50%) scale(0.88)' },
    ], { duration: 2200, iterations: Infinity, easing: 'ease-in-out' });
    dragHintAnimations.set(id, { signature, animation });
  });

  [...tutorialDragHintsEl.children].forEach((root) => {
    if (activeIds.has(root.dataset.hintId)) return;
    dragHintAnimations.get(root.dataset.hintId)?.animation.cancel();
    dragHintAnimations.delete(root.dataset.hintId);
    root.remove();
  });
}

function hideDragHint() {
  dragHintAnimations.forEach(({ animation }) => animation.cancel());
  dragHintAnimations.clear();
  tutorialDragHintsEl.replaceChildren();
}

function tutorialCatColumns(state) {
  // Highest-level cat's column first (the merged Purrcy for the R3 biter), then the rest.
  return [...state.cats]
    .sort((a, b) => (b.level - a.level))
    .map((cat) => cat.col)
    .filter((col) => typeof col === 'number');
}

function startNewGameSession() {
  gameSessionId += 1;
  const banner = $('#wave-banner');
  if (!banner) return;
  banner.hidden = true;
  banner.classList.remove('is-exiting');
}

function startTutorial() {
  startNewGameSession();
  startLevelMusic();
  game = createGame();
  selected = null;
  playing = false;
  manualPaused = false;
  glossaryPaused = false;
  if (glossaryModalEl) glossaryModalEl.hidden = true;
  if (modalEl) modalEl.hidden = true;
  syncPauseState();
  tutorialActive = true;
  tutorialStepIndex = 0;
  tutorialCurrentTip = null;
  tutorialSeenTips.clear();
  tutorialCompletedMergeTasks.clear();
  tutorialStartNudged = false;
  tutorialMoveFocusCleared = false;
  game.shop = tutorialShop(1) ?? game.shop;
  game.message = 'Tutorial: follow the highlights.';
  render();
}

function endTutorial() {
  tutorialActive = false;
  tutorialCurrentTip = null;
  hideTutorialOverlay();
}

function requestTutorialSkip() {
  if (confirmTutorialSkip((message) => window.confirm(message))) endTutorial();
}

// R1 cannot be staged until the player has chosen lanes, so set it immediately
// before combat. Late tutorial waves are staged during prep for an exact Scout Report.
function applyTutorialWave() {
  if (game.round !== 1) return;
  const wave = tutorialWave(game.round, tutorialCatColumns(game), game.random);
  if (wave) game.nextWave = wave;
}

// Set the scripted shop and late-game wave when a new prep round begins.
function applyTutorialRound() {
  // Coaching stays on for the whole run (sparse just-in-time tips after the
  // core R1-3 lessons) — no hard graduation, so late reminders can still fire.
  tutorialStartNudged = false;
  const shop = tutorialShop(game.round);
  if (shop) game.shop = shop;
  const wave = tutorialWave(game.round, tutorialCatColumns(game), game.random);
  if (wave) game.nextWave = wave;
  // Round 3 teaches healing: leave the strongest cat lightly wounded (persisted
  // "damage" from the advancing pack) so one Whisker treat fully patches it.
  if (game.round === 3) {
    const front = [...game.cats].sort((a, b) => b.level - a.level)[0];
    if (front && front.hp === front.maxHp) front.hp = Math.max(1, front.maxHp - 2);
  }
}

function showCurrentTutorialTip() {
  hideDragHint();
  const focusSelectors = typeof tutorialCurrentTip?.focusSelectors === 'function'
    ? tutorialCurrentTip.focusSelectors(game)
    : [];
  if (focusSelectors.length && !tutorialMoveFocusCleared) showTutorialFocus(focusSelectors);
  else hideTutorialFocus();
  showTutorialBubble(tutorialCurrentTip.text, tutorialCurrentTip.spotlight, true, {
    dim: false,
    showSpotlight: focusSelectors.length === 0,
    anchorSelectors: focusSelectors,
  });
}

// Called at the tail of every render() while the tutorial is active.
function syncTutorial() {
  setTutorialStartCue(false);
  if (playing) { hideTutorialOverlay(); return; } // never cover a live animation
  if (game.phase === 'gameover' || game.phase === 'victory') { hideTutorialOverlay(); return; }
  // Nudge: don't start a round with gold still to spend.
  if (tutorialStartNudged && game.phase === 'prep' && game.gold >= 3) {
    hideDragHint();
    showTutorialBubble(`Hold on — you've still got ${game.gold} gold. Grab another cat before you start; unspent gold is lost.`,
      '#shop', false, { dim: false });
    return;
  }
  // Squad-full coaching, once, the moment you hit the 5-cat cap.
  if (game.phase === 'prep' && game.cats.length >= MAX_FIELD_CATS
      && tutorialStepIndex >= CORE_STEPS.length
      && !tutorialCurrentTip && !tutorialSeenTips.has('squad-full')) {
    tutorialCurrentTip = { id: 'squad-full', spotlight: '#adoption-box',
      text: "Squad's full at 5! To add another cat, make room: combine three matching cats into one, park one on the Workbench, or sell your weakest in the Adoption Box." };
  }
  while (tutorialStepIndex < CORE_STEPS.length) {
    const step = CORE_STEPS[tutorialStepIndex];
    if (step.mode === 'gate' && step.isDone(game, tutorialCompletedMergeTasks)) {
      tutorialStepIndex += 1;
      continue;
    }
    break;
  }
  if (tutorialStepIndex < CORE_STEPS.length) {
    const step = CORE_STEPS[tutorialStepIndex];
    if (!step.showWhen || step.showWhen(game)) {
      setTutorialStartCue(step.id === 'r1-start');
      const dragFrom = typeof step.dragFrom === 'function' ? step.dragFrom(game) : step.dragFrom;
      const dragTo = typeof step.dragTo === 'function' ? step.dragTo(game) : step.dragTo;
      const dragHints = typeof step.dragHints === 'function'
        ? step.dragHints(game, tutorialCompletedMergeTasks)
        : dragFrom && dragTo ? [{ id: step.id, from: dragFrom, to: dragTo }] : [];
      const text = typeof step.text === 'function'
        ? step.text(game, tutorialCompletedMergeTasks)
        : step.text;
      const isDrag = dragHints.length > 0;
      showTutorialBubble(text, step.spotlight, step.mode === 'tap',
        { dim: step.mode === 'tap', showSpotlight: !isDrag, mutedRegion: step.mutedRegion });
      if (isDrag) showDragHints(dragHints);
      else hideDragHint();
      return;
    }
    hideTutorialOverlay();
    return;
  }
  if (tutorialCurrentTip) {
    showCurrentTutorialTip();
    return;
  }
  const tip = TIPS.find((t) => !tutorialSeenTips.has(t.id) && t.when(game));
  if (tip) { tutorialCurrentTip = tip; showCurrentTutorialTip(); return; }
  hideTutorialOverlay();
}

function advanceTutorialByTap() {
  if (tutorialCurrentTip) {
    tutorialSeenTips.add(tutorialCurrentTip.id);
    tutorialCurrentTip = null;
    syncTutorial();
    return;
  }
  const step = CORE_STEPS[tutorialStepIndex];
  if (step && step.mode === 'tap') { tutorialStepIndex += 1; syncTutorial(); }
}

function render() {
  hideUnitTooltip();
  renderShop();
  renderProduction();
  renderWorkbench();
  renderDogPreview();
  renderBoard();
  renderHud();
  renderTacticsPanel();
  renderProductionLegend();
  renderLegend();
  playPendingUpgrade();
  if (tutorialActive) syncTutorial();
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const WAVE_BANNER_READ_MS = 2400;

async function runCombatSection(sessionId) {
  // Take the roll call before resolving: the engine drops the dead as it goes, and the
  // deaths cannot be animated without knowing who they were.
  snapshotUnits(game);
  const nextGame = resolveSection(game);
  await animateEvents(nextGame.events);
  if (sessionId !== gameSessionId) return false;
  // Only now is it safe to re-render — that is what removes the bodies from the board.
  game = nextGame;
  render();
  await wait(timing.hpPauseMs);
  return sessionId === gameSessionId;
}

/** Drop-in banner naming the wave and what just walked through the gate. */
async function announceWave(sessionId) {
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
  banner.innerHTML = `<b>WAVE ${game.round}</b> · ${parts.join(' + ') || 'INCOMING'}`;
  banner.classList.remove('is-exiting');
  banner.hidden = false;
  playWaveStart();
  await wait(WAVE_BANNER_READ_MS);
  if (sessionId !== gameSessionId) return false;
  await waitForResume();
  if (sessionId !== gameSessionId) return false;
  banner.classList.add('is-exiting');
  await Promise.all(banner.getAnimations({ subtree: true })
    .map((animation) => animation.finished.catch(() => {})));
  if (sessionId !== gameSessionId) return false;
  banner.hidden = true;
  banner.classList.remove('is-exiting');
  return true;
}

async function playRound() {
  if (playing || isGamePaused() || (game.phase !== 'prep' && game.phase !== 'tactics')) return;
  if (game.phase === 'prep' && game.cats.length === 0) return;
  const sessionId = gameSessionId;
  const startingRound = game.phase === 'prep';
  playing = true;
  selected = null;
  activeTargeting = null;
  if (startingRound) {
    if (tutorialActive) applyTutorialWave();
    game = startRound(game);
    render();
    if (!await announceWave(sessionId)) return;
    await waitForResume();
    if (sessionId !== gameSessionId) return;
  } else {
    game = continueCombat(game);
    render();
  }

  await waitForResume();
  if (sessionId !== gameSessionId) return;
  if (game.phase === 'combat' && game.dogs.length > 0) {
    const completed = await runCombatSection(sessionId);
    if (!completed) return;
  }
  if (game.phase === 'combat') {
    const needsAnotherExchange = game.dogs.length > 0
      && (game.round >= MAX_ROUNDS || game.section < ACTIONS_PER_ROUND);
    game = needsAnotherExchange ? openTacticsWindow(game) : finishRound(game);
    // Back to prep means the wave was cleared — victory/defeat get their own fanfare.
    if (!needsAnotherExchange && game.phase === 'prep') playRoundComplete();
    if (tutorialActive && game.phase === 'prep') applyTutorialRound();
  }
  playing = false;
  render();
  if (game.phase === 'victory' || game.phase === 'gameover') {
    await wait(350);
    if (sessionId !== gameSessionId) return;
    showResult();
  }
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
  startNewGameSession();
  startLevelMusic();
  game = createGame();
  selected = null;
  playing = false;
  manualPaused = false;
  glossaryPaused = false;
  if (glossaryModalEl) glossaryModalEl.hidden = true;
  syncPauseState();
  modalEl.hidden = true;
  tutorialActive = false;
  hideTutorialOverlay();
  render();
}

function armAudioOnce() {
  unlockAudio();
  startLevelMusic();
  window.removeEventListener('pointerdown', armAudioOnce);
  window.removeEventListener('keydown', armAudioOnce);
}
window.addEventListener('pointerdown', armAudioOnce);
window.addEventListener('keydown', armAudioOnce);
window.addEventListener('pointermove', onDragMove, { passive: false });
window.addEventListener('pointerup', (event) => { void finishDrag(event); });
window.addEventListener('pointercancel', (event) => { void finishDrag(event, true); });
window.addEventListener('resize', () => { if (tutorialActive) { hideDragHint(); hideTutorialFocus(); syncTutorial(); } });
window.addEventListener('click', (event) => {
  const control = event.target?.closest?.('button, input[type="checkbox"], [role="button"]');
  if (!control || control.disabled || control.getAttribute('aria-disabled') === 'true') return;
  if (control.id === 'refresh') return;
  playUiClick();
});

$('#refresh').addEventListener('click', () => {
  const previousGame = game;
  game = tutorialActive ? refreshTutorialShop(game) : refreshShop(game);
  if (game !== previousGame) playRefreshClick();
  selected = null;
  render();
});
function onDoneClick() {
  // In the tutorial, if you'd start a round with money on the table, nudge once first.
  if (tutorialActive && game.phase === 'prep' && game.gold >= 3 && !tutorialStartNudged) {
    tutorialStartNudged = true;
    render();
    return;
  }
  playRound();
}
$('#done').addEventListener('click', onDoneClick);
$('#tutorial')?.addEventListener('click', startTutorial);
tutorialNextEl?.addEventListener('click', advanceTutorialByTap);
$('#tutorial-skip')?.addEventListener('click', requestTutorialSkip);

// Two-tap restart: a single stray click must not wipe a six-round run.
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
  game.message = combatSpeed === 2 ? 'Combat speed 2× — replays fly by.' : 'Combat speed 1×.';
  renderHud();
});
$('#pause-toggle')?.addEventListener('click', () => {
  manualPaused = !manualPaused;
  syncPauseState();
  game.message = manualPaused ? 'Game paused.' : 'Game resumed.';
  renderHud();
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
  if (soundToggleEl.checked) playUiClick();
  game.message = soundToggleEl.checked ? 'Sound and music on.' : 'Sound and music muted.';
  renderHud();
});
window.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (glossaryModalEl && !glossaryModalEl.hidden) closeGlossary();
  else if (settingsModalEl && !settingsModalEl.hidden) closeSettings();
});


loadSoundEnabled();
syncSettingsUi();
drawBackyard($('#yard-art'));
render();

// Dev-only QA hook. Vite strips this from production builds. Combat effects are hard to
// reach by clicking — Bombay Boom's bomb needs round 4 and a useful dog formation — so
// this allows a board to be set up directly and one exchange to be run against it.
if (import.meta.env?.DEV) {
  window.__cvd = {
    get state() { return game; },
    apply(mutate) { mutate(game); render(); },
    runSection: runCombatSection,
    render,
  };
}
