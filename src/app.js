import {
  ROWS, COLS, CAT_ZONE_START, BENCH_SIZE, PRODUCTION_CAPACITY, MAX_FIELD_CATS, MAX_ROUNDS, ACTIONS_PER_ROUND,
  CAT_COAT_INFO, DOG_ROLE_INFO, catStatsFor, dogStatsFor, normalizeCoat, catTooltipInfo, dogTooltipInfo,
  WORKER_INFO, createGame, refreshShop, toggleSaveShopSlot, placeCat, moveCat,
  returnCatToBench, mergeUnitOnto, startRound, resolveSection, finishRound,
  openTacticsWindow, continueCombat, useActiveAbility,
  purchaseShopFighterToBench, purchaseShopFighterToBoard,
  purchaseShopFighterOnto, purchaseShopWorker, purchaseShopWorkerToBench,
  moveWorker, mergeWorkerOnto, moveBenchWorkerToHouse, returnWorkerToBench, mergeBenchWorkerOnto,
  collectWorkerOutput, mergeInventoryItems, equipInventoryItem, useFood,
  catSaleQuote, sellCat,
} from './game-engine.js';
import { drawBackyard, drawCat, drawDog, drawWorker, drawStation, drawItem } from './pixel-art.js';
import { selectionAfterPurchase, shopPetAvailability, hpTone, equippedItemMarkers, productionLegendRows, glossaryTabs, glossaryEntriesByUnlockRound, dogPreviewQueue, productionCollectionDestination, shopCardSummary, workerTooltipInfo } from './ui-state.js';
import { combatTiming, cellCenter, homingShotKeyframes, stormColumnPosition } from './combat-animation.js';
import { unlockAudio, playCatDrop, playHit, playCollection, isSoundEnabled, setSoundEnabled, loadSoundEnabled } from './sound.js';
import { FIELD_CAP_MESSAGE, DRAG_FEEDBACK, DROP_IMPACT, getDropAction } from './drag-drop.js';
import { CAT_PLANNING_MOVE_SPENT_MESSAGE, catMovementPath, catMoveLimitMessage } from './movement-rules.js';
import { UPGRADE_TIMING, describeUpgrade } from './upgrade-animation.js';
import { BLUE_SCRATCH_FLURRY } from './melee-animation.js';

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

function renderShop() {
  shopEl.innerHTML = '';
  shopEl.dataset.count = String(game.shop.length);
  game.shop.forEach((slot, index) => {
    const isWorker = slot.category === 'worker';
    const info = isWorker ? WORKER_INFO[slot.role] : CAT_COAT_INFO[normalizeCoat(slot.coat)];
    const summary = shopCardSummary(slot, info);
    const interactive = !slot.sold && game.phase === 'prep' && !playing;
    const canBuy = interactive && game.gold >= 3;
    const reason = slot.sold ? 'sold' : game.gold < 3 ? 'gold' : 'ready';
    const wrap = document.createElement('div');
    wrap.className = `shop-slot ${slot.saved ? 'saved' : ''} ${slot.sold ? 'sold' : ''} ${reason === 'gold' ? 'unaffordable' : ''} ${isWorker ? 'worker-offer' : 'fighter-offer'}`;

    const button = document.createElement('button');
    button.className = 'shop-card';
    button.disabled = !interactive;
    button.setAttribute('aria-disabled', canBuy ? 'false' : 'true');
    button.append(unitCanvas(isWorker ? 'worker' : 'cat', slot));
    button.insertAdjacentHTML('beforeend', `
      <span class="shop-tier">${summary.badge}</span>
      <strong>${summary.name}</strong>
      <span class="price">● ${summary.cost}</span>`);
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
    bindPetDrag(button, isWorker ? 'shop-worker' : 'shop-fighter', { ...slot, shopIndex: index });
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
      event.stopPropagation();
      game = toggleSaveShopSlot(game, index);
      render();
    });

    wrap.append(button, save);
    shopEl.append(wrap);
  });
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
      const tier = document.createElement('b');
      tier.textContent = String(item.tier);
      marker.append(tier);
      markers.append(marker);
    });
    unit.append(markers);
  }
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
  unit.insertAdjacentHTML('beforeend', `
    <span class="unit-badge">T${dog.tier}</span>
    <span class="hp-wrap"><span class="hp-bar hp-${hpTone(dog.hp, dog.maxHp)}" style="width:${Math.max(0, dog.hp / dog.maxHp * 100)}%"></span></span>`);
  return unit;
}

function dogStackTooltipInfo(dogs) {
  if (dogs.length <= 1) return dogTooltipInfo(dogs[0]);
  const [backDog, frontDog] = dogs;
  const back = dogTooltipInfo(backDog);
  const front = dogTooltipInfo(frontDog);
  return {
    kind: 'dog',
    title: '2 DOGS STACKED',
    stats: `${back.title} ${backDog.hp}/${backDog.maxHp} HP · ${front.title} ${frontDog.hp}/${frontDog.maxHp} HP`,
    attack: 'Both dogs act separately. The slightly raised dog is behind the front dog.',
    note: 'This square is full; a third dog must stop behind it.',
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

function tryMerge(targetType, targetId) {
  if (!selected || (selected.type !== 'bench' && selected.type !== 'cat')) return false;
  const before = game;
  game = mergeUnitOnto(game, selected.type, selected.id, targetType, targetId);
  if (game === before) return false;
  const reveal = queueUpgradeReveal(before, game, targetType, targetId);
  selected = null;
  game.message = reveal?.kind === 'level-up'
    ? `${reveal.label} New gear unlocked!`
    : 'Same-color cats stacked! Add one more matching color + level to evolve.';
  return true;
}

function selectCat(type, cat) {
  selected = { type, id: cat.id };
  const info = CAT_COAT_INFO[normalizeCoat(cat.coat)];
  game.message = `Level ${cat.level} ${info.name} selected (${info.blurb}). Tap an empty cat-territory tile to place it, or merge only onto the same color + level.`;
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
        occupied: occupied ? { id: occupied.id, level: occupied.level, coat: normalizeCoat(occupied.coat) } : null,
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
}

function showMovementPath(source, descriptor) {
  document.querySelectorAll('.move-path-valid, .move-path-invalid').forEach((element) => {
    element.classList.remove('move-path-valid', 'move-path-invalid');
  });
  catMovementPath(source, descriptor).forEach(({ row, col, withinLimit }) => {
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
  suppressNextPetClick = true;
  hideUnitTooltip();
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
    || (type === 'item' && game.phase === 'tactics');
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
    const workerAction = action.type.includes('worker');
    game.message = action.type === 'sell' || workerAction
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
    playCatDrop();
  }
  render();
  if (changed && action.type === 'sell') showAdoptionFeedback(state.cat, action.value);
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
          game = mergeInventoryItems(game, index);
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
  freeze: ['FREEZE', 'Choose a dog to skip its next action.'],
  teleport: ['PORTAL', 'Choose an ally, then any empty cat square.'],
  decoy: ['DECOY', 'Choose an empty cat square for a phantom blocker.'],
  storm: ['STORM', 'Choose a dog column to strike.'],
  encore: ['ENCORE', 'Choose another cat for an immediate attack.'],
};

function renderTacticsPanel() {
  const panel = $('#tactics-panel');
  const host = $('#active-abilities');
  if (!panel || !host) return;
  panel.hidden = game.phase !== 'tactics';
  host.innerHTML = '';
  if (panel.hidden) return;
  const activeCats = game.cats.filter((cat) => cat.activeAbility);
  activeCats.forEach((cat) => {
    const copy = ACTIVE_COPY[cat.activeAbility] ?? ['CAST', 'Choose a target.'];
    const button = document.createElement('button');
    button.className = `active-ability ${cat.activeUsed ? 'used' : ''} ${activeTargeting?.casterId === cat.id ? 'targeting' : ''}`;
    button.disabled = cat.activeUsed || playing;
    button.innerHTML = `<b>${copy[0]}</b><span>${CAT_COAT_INFO[normalizeCoat(cat.coat)].shortName} · L${cat.level}</span>`;
    button.title = copy[1];
    button.addEventListener('click', () => {
      activeTargeting = { casterId: cat.id, mode: cat.activeAbility, targetCatId: null };
      game.message = copy[1];
      render();
    });
    host.append(button);
  });
  if (!activeCats.length) host.innerHTML = '<p class="no-active-cats">No active-ability cats deployed.</p>';
  $('#tactics-help').textContent = activeTargeting
    ? (ACTIVE_COPY[activeTargeting.mode]?.[1] ?? 'Choose a target.')
    : 'Drag food or equipment onto a cat, or cast one available ability. Cats only move during setup.';
}

function tryActiveTarget(row, col, cat, dog) {
  if (playing || game.phase !== 'tactics' || !activeTargeting) return false;
  const targeting = activeTargeting;
  let payload = null;
  if (targeting.mode === 'freeze' && dog) payload = { dogId: dog.id };
  else if (targeting.mode === 'storm' && dog) payload = { col };
  else if (targeting.mode === 'decoy' && row >= CAT_ZONE_START && !cat) payload = { row, col };
  else if (targeting.mode === 'encore' && cat && cat.id !== targeting.casterId) payload = { targetCatId: cat.id };
  else if (targeting.mode === 'teleport') {
    if (!targeting.targetCatId && cat) {
      activeTargeting = { ...targeting, targetCatId: cat.id };
      game.message = 'Now choose any empty cat-territory square.';
      render();
      return true;
    }
    if (targeting.targetCatId && row >= CAT_ZONE_START && !cat) payload = { targetCatId: targeting.targetCatId, row, col };
  }
  if (!payload) {
    game.message = ACTIVE_COPY[targeting.mode]?.[1] ?? 'That is not a valid target.';
    renderHud();
    return true;
  }
  const before = game;
  const nextGame = useActiveAbility(game, targeting.casterId, payload);
  if (nextGame !== before) {
    activeTargeting = null;
    if (targeting.mode === 'storm') {
      void playStormAbility(nextGame);
      return true;
    }
    game = nextGame;
    $('#board')?.classList.add('ability-cast');
    window.setTimeout(() => $('#board')?.classList.remove('ability-cast'), 420);
  }
  render();
  return true;
}

async function playStormAbility(nextGame) {
  playing = true;
  game = nextGame;
  renderHud();
  renderTacticsPanel();
  try {
    await animateStorm(nextGame.events);
  } finally {
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
      const zone = row >= CAT_ZONE_START ? 'cat territory' : 'dog yard';
      const equipmentLabel = cat
        ? equippedItemMarkers(cat).map((item) => `tier ${item.tier} ${item.kind}`).join(' and ')
        : '';
      cell.setAttribute('aria-label', cat
        ? `Level ${cat.level} ${catLabel(cat)}, ${cat.hp} of ${cat.maxHp} HP${equipmentLabel ? `, equipped with ${equipmentLabel}` : ''}, row ${row + 1} column ${col + 1}`
        : dogs.length
          ? `${dogs.map((unit) => `${dogTooltipInfo(unit).title}, ${unit.hp} of ${unit.maxHp} HP`).join('; ')}${dogs.length > 1 ? ', stacked together' : ''}, row ${row + 1} column ${col + 1}`
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
        const visual = unitCanvas('cat', { level: 1, coat: 8 });
        visual.classList.add('decoy-unit');
        cell.append(visual);
        cell.classList.add('has-unit', 'has-decoy');
      }
      if (activeTargeting) {
        const validActiveTarget = (activeTargeting.mode === 'freeze' && dog)
          || (activeTargeting.mode === 'storm' && dog)
          || (activeTargeting.mode === 'decoy' && row >= CAT_ZONE_START && !cat && !decoy)
          || (activeTargeting.mode === 'encore' && cat && cat.id !== activeTargeting.casterId)
          || (activeTargeting.mode === 'teleport' && !activeTargeting.targetCatId && cat)
          || (activeTargeting.mode === 'teleport' && activeTargeting.targetCatId && row >= CAT_ZONE_START && !cat && !decoy);
        if (validActiveTarget) cell.classList.add('ability-target');
      }
      // A click-selected cat lights the same targets, the same way, a drag would.
      if (!activeTargeting && selected && game.phase === 'prep' && !playing) {
        const selectedUnit = selected.type === 'bench'
          ? game.bench.find((entry) => entry.id === selected.id)
          : selected.type === 'cat' ? game.cats.find((entry) => entry.id === selected.id) : null;
        if (selectedUnit) {
          const descriptor = {
            kind: 'cell', row, col,
            occupied: cat ? { id: cat.id, level: cat.level, coat: normalizeCoat(cat.coat) } : null,
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
        if (game.phase !== 'prep' || playing) return;
        if (cat) {
          if (!tryMerge('cat', cat.id)) selectCat('cat', cat);
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
            const attemptedAction = dropAction(
              movingCat ? { ...movingCat, type: 'cat' } : null,
              { kind: 'cell', row, col, occupied: null },
            );
            const before = game;
            game = moveCat(game, selected.id, row, col);
            if (game !== before) {
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

function showHit(event, { heavy = false, sound = true } = {}) {
  if (event.miss || !event.to) return;
  if (sound) playHit({ heavy });
  const target = findUnitElement(event.to);
  const burst = effectAt('impact-burst', event.toRow, event.col);
  // Dog bites and tennis shots hurt cats; cat attacks use the opposing damage tone.
  const tone = event.type === 'melee' || event.type === 'dog-shot' ? '' : ' to-dog';
  const damage = effectAt(`damage-number${tone}`, event.toRow, event.col, `-${event.damage}`);
  if (target) {
    target.classList.remove('hurt');
    void target.offsetWidth;
    target.classList.add('hurt');
    const hpBar = target.querySelector('.hp-bar');
    if (hpBar) {
      hpBar.style.width = `${Math.max(0, event.hpAfter / event.maxHp * 100)}%`;
      hpBar.className = `hp-bar hp-${hpTone(event.hpAfter, event.maxHp)}`;
    }
  }
  window.setTimeout(() => burst.remove(), timing.impactMs);
  window.setTimeout(() => damage.remove(), timing.impactMs + timing.hpPauseMs);
  window.setTimeout(() => target?.classList.remove('hurt'), timing.impactMs);
}

async function animateShot(event, index) {
  const isBurst = Boolean(event.burst);
  const isHoming = event.style === 'homing' || event.style === 'medic';
  const stagger = isBurst
    ? (event.pelletIndex ?? 0) * timing.burstStaggerMs + index * 8
    : index * timing.shotStaggerMs;
  await wait(stagger);
  const fromCol = event.fromCol ?? event.col;
  const toCol = event.col;
  const start = cellCenter(event.fromRow, fromCol);
  const end = cellCenter(event.toRow, toCol);
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
    {
      duration: isHoming
        ? timing.homingMs
        : isBurst
          ? timing.burstProjectileMs
          : timing.projectileMs,
      // Linear keyframe timing — the path itself eases the seek.
      easing: 'linear',
      fill: 'forwards',
    },
  );
  await flight.finished.catch(() => {});
  projectile.remove();
  if (event.miss || !event.to) {
    const fizzle = effectAt('impact-burst miss-fizzle', event.toRow, event.col);
    window.setTimeout(() => fizzle.remove(), timing.impactMs);
    await wait(Math.floor(timing.impactMs * 0.55));
    return;
  }
  showHit(event);
  await wait(timing.impactMs + timing.hpPauseMs);
}

async function animateMelee(event, direction = 'down') {
  const attacker = findUnitElement(event.from);
  const className = direction === 'up' ? 'melee-lunge-up' : 'melee-lunge';
  attacker?.classList.add(className);
  await wait(Math.floor(timing.meleeMs / 2));
  if (!event.miss && event.to) {
    showHit(event, { heavy: true });
    await wait(Math.ceil(timing.meleeMs / 2) + timing.hpPauseMs);
  } else {
    await wait(Math.ceil(timing.meleeMs / 2));
  }
  attacker?.classList.remove(className);
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
  if (!event.miss && event.to) showHit(event, { heavy: true });
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
  const origin = path[0];
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

async function animateHeal(event) {
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

async function animateSuperCat(event) {
  const runner = document.createElement('div');
  runner.className = 'super-effect';
  runner.style.left = `${event.col * (100 / COLS)}%`;
  const canvas = document.createElement('canvas');
  drawCat(canvas, 3, 0, true);
  runner.append(canvas);
  effectsEl.append(runner);
  await wait(Math.round(720 / combatSpeed));
  runner.remove();
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
    playHit({ heavy: true });
    strikes.forEach((event) => showHit(event, { heavy: true, sound: false }));
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
  const jumps = events.filter((event) => event.type === 'dog-jump');
  const howls = events.filter((event) => event.type === 'howl');
  const heals = events.filter((event) => event.type === 'heal');
  const dogHeals = events.filter((event) => event.type === 'dog-heal');
  const fears = events.filter((event) => event.type === 'dog-fear');
  const superCats = events.filter((event) => event.type === 'super-cat');

  if (shots.length || catMelee.length) setTurnTag('cats');
  await Promise.all([
    ...shots.map((event, index) => animateShot(event, index)),
    ...catMelee.map(animateCatScratch),
    ...heals.map(animateHeal),
  ]);
  if (melee.length || dogShots.length || moves.length || jumps.length || howls.length || dogHeals.length || fears.length) setTurnTag('dogs');
  await Promise.all([
    ...dogShots.map((event, index) => animateShot(event, index)),
    ...howls.map(animateHowl),
    ...dogHeals.map(animateHeal),
    ...fears.map(animateFear),
  ]);
  await Promise.all([...moves.map(animateMove), ...jumps.map(animateDogJump)]);
  await Promise.all(melee.map((event) => animateMelee(event, 'down')));
  await Promise.all(superCats.map(animateSuperCat));
  setTurnTag(null);
  effectsEl.innerHTML = '';
}

function showResult() {
  const won = game.phase === 'victory';
  $('#result-kicker').textContent = won ? 'LEVEL 1 COMPLETE' : 'OUT OF LIVES';
  $('#result-title').textContent = won ? 'Backyard Defended!' : 'The Dogs Broke Through';
  $('#result-copy').textContent = won ? 'The porch is safe—for now.' : 'Rebuild your cat squad and try again.';
  drawCat($('#result-cat'), won ? 3 : 1, won ? 0 : 1, won);
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
  4: 'wide splash · weak single hit',
  5: 'pierces 3 · fragile & lane-locked',
  6: 'hard freeze · weak normal attack',
  7: 'best mobility · low attack',
  8: 'free blocker · fragile caster',
  9: 'huge spell · weakest normal attack',
  10: 'ally encore · tiny personal attack',
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
    glossaryEntriesByUnlockRound(CAT_COAT_INFO).forEach(([coatKey, info]) => {
      const coat = Number(coatKey);
      const stats = catStatsFor(1, coat);
      const round = info.unlockRound;
      grid.append(glossaryCard({
        kind: 'battle', key: coat, name: info.name,
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
        kicker: `PRODUCTION CAT · ${info.station.toUpperCase()}`,
        stats: outputs,
        description: `${info.blurb}. ${productionTimingDescription(info)}`,
        note: 'Lives in the House. Match 3 of the same role and level to evolve.',
      }));
    });
  } else {
    Object.entries(DOG_ROLE_INFO).forEach(([role, info]) => {
      const stats = dogStatsFor(1, role);
      const roleStat = {
        frisbee: `DISC ${Math.ceil(stats.attack * 0.7)}`,
        tennis: `BALL ${Math.ceil(stats.attack * 0.6)}`,
        howler: `HOWL +${stats.howlBonus}`,
        lobber: `BOMB ${Math.max(1, Math.floor(stats.attack * 0.6))} SPLASH`,
        jumper: 'MOVE 3 · JUMP 1×',
        medic: `HEAL ${stats.healPower}`,
        growler: `FRIGHTEN -${stats.fearPower}`,
      }[role] ?? `BITE ${stats.attack}`;
      grid.append(glossaryCard({
        kind: 'dogs', key: role, name: info.name,
        kicker: `DOG ROLE · ${info.unlockRound === 1 ? 'STARTER' : `UNLOCKS ROUND ${info.unlockRound}`}`,
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
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runCombatSection() {
  const nextGame = resolveSection(game);
  await animateEvents(nextGame.events);
  game = nextGame;
  render();
  await wait(timing.hpPauseMs);
}

/** Drop-in banner naming the wave and what just walked through the gate. */
function announceWave() {
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
  banner.innerHTML = `WAVE ${game.round} · ${parts.join(' + ') || 'INCOMING'}`;
  banner.hidden = false;
  window.setTimeout(() => { banner.hidden = true; }, Math.round(1300 / combatSpeed));
}

async function playRound() {
  if (playing || isGamePaused() || (game.phase !== 'prep' && game.phase !== 'tactics')) return;
  if (game.phase === 'prep' && game.cats.length === 0) return;
  const startingRound = game.phase === 'prep';
  playing = true;
  selected = null;
  activeTargeting = null;
  if (startingRound) {
    game = startRound(game);
    render();
    announceWave();
    await wait(Math.round(650 / combatSpeed));
    await waitForResume();
  } else {
    game = continueCombat(game);
    render();
  }

  await waitForResume();
  if (game.phase === 'combat' && game.dogs.length > 0) await runCombatSection();
  if (game.phase === 'combat') {
    const needsAnotherExchange = game.dogs.length > 0
      && (game.round >= MAX_ROUNDS || game.section < ACTIONS_PER_ROUND);
    game = needsAnotherExchange ? openTacticsWindow(game) : finishRound(game);
  }
  playing = false;
  render();
  if (game.phase === 'victory' || game.phase === 'gameover') {
    await wait(350);
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
  game = createGame();
  selected = null;
  playing = false;
  manualPaused = false;
  glossaryPaused = false;
  if (glossaryModalEl) glossaryModalEl.hidden = true;
  syncPauseState();
  modalEl.hidden = true;
  render();
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

$('#refresh').addEventListener('click', () => { game = refreshShop(game); selected = null; render(); });
$('#done').addEventListener('click', playRound);

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
  game.message = soundToggleEl.checked ? 'Sound effects on.' : 'Sound effects muted.';
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
