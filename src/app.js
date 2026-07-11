import {
  ROWS, COLS, CAT_ZONE_START, BENCH_SIZE, MAX_ROUNDS, ACTIONS_PER_ROUND,
  CAT_COAT_INFO, catStatsFor, normalizeCoat, catTooltipInfo, dogTooltipInfo,
  createGame, buyShopCat, refreshShop, toggleSaveShopSlot, placeCat, moveCat,
  returnCatToBench, mergeUnitOnto, startRound, resolveSection, finishRound,
  shopTierForRound,
} from './game-engine.js';
import { drawBackyard, drawCat, drawDog } from './pixel-art.js';
import { selectionAfterPurchase, shopPetAvailability, hpTone } from './ui-state.js';
import { combatTiming, cellCenter, homingShotKeyframes } from './combat-animation.js';
import { unlockAudio, playCatDrop, playHit, isSoundEnabled, setSoundEnabled, loadSoundEnabled } from './sound.js';
import { DRAG_FEEDBACK, DROP_IMPACT, getDropAction } from './drag-drop.js';
import { UPGRADE_TIMING, describeUpgrade } from './upgrade-animation.js';
import { BLUE_SCRATCH_FLURRY } from './melee-animation.js';

let game = createGame();
let selected = null;
let playing = false;
let dragState = null;
let suppressNextPetClick = false;
let dragHoverElement = null;
let pendingUpgrade = null;

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
const benchEl = $('#bench');
const gridEl = $('#grid');
const effectsEl = $('#effects');
const modalEl = $('#result-modal');
const settingsModalEl = $('#settings-modal');
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
    <p class="tooltip-attack"><b>Attack</b> ${info.attack}</p>
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
  else drawDog(canvas, unit.tier);
  return canvas;
}

function selectedMatches(type, id) {
  return selected?.type === type && selected?.id === id;
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
    : 'The bench is full — place a cat in the yard before adopting another.';
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
    const stats = catStatsFor(slot.level ?? 1, slot.coat);
    const info = CAT_COAT_INFO[normalizeCoat(slot.coat)];
    const availability = shopPetAvailability({
      sold: slot.sold,
      gold: game.gold,
      benchLength: game.bench.length,
      benchSize: BENCH_SIZE,
      phase: game.phase,
      playing,
    });
    const wrap = document.createElement('div');
    wrap.className = `shop-slot ${slot.saved ? 'saved' : ''} ${slot.sold ? 'sold' : ''} ${availability.reason === 'gold' ? 'unaffordable' : ''} ${availability.reason === 'bench' ? 'bench-blocked' : ''}`;

    const button = document.createElement('button');
    button.className = 'shop-card';
    button.disabled = !availability.interactive;
    button.setAttribute('aria-disabled', availability.canBuy ? 'false' : 'true');
    button.append(unitCanvas('cat', slot));
    button.insertAdjacentHTML('beforeend', `
      <span class="shop-tier">T${info.shopTier}</span>
      <strong>${slot.sold ? 'ADOPTED' : info.name}</strong>
      <small class="ability-blurb">${info.blurb}</small>
      <div class="stats"><span>♥ ${stats.hp}</span><span>↑ ${stats.attack}</span></div>
      <span class="price">● 3</span>`);
    button.addEventListener('click', () => {
      if (!availability.canBuy) {
        showShopPurchaseDenied(button, availability.reason);
        return;
      }
      const before = game;
      game = buyShopCat(game, index);
      selected = selectionAfterPurchase(selected, game !== before);
      render();
    });
    bindTooltip(button, () => catTooltipInfo(slot));

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
  const copies = cat.copies ?? 1;
  unit.insertAdjacentHTML('beforeend', `
    <span class="unit-badge">L${cat.level}</span>
    <span class="copy-pips">${Array.from({ length: copies }, () => '<i></i>').join('')}</span>
    <span class="hp-wrap"><span class="hp-bar hp-${hpTone(cat.hp, cat.maxHp)}" style="width:${Math.max(0, cat.hp / cat.maxHp * 100)}%"></span></span>`);
  return unit;
}

function dogMarkup(dog) {
  const unit = document.createElement('div');
  unit.className = 'unit';
  unit.dataset.unitId = dog.id;
  unit.append(unitCanvas('dog', dog));
  unit.insertAdjacentHTML('beforeend', `
    <span class="unit-badge">T${dog.tier}</span>
    <span class="hp-wrap"><span class="hp-bar hp-${hpTone(dog.hp, dog.maxHp)}" style="width:${Math.max(0, dog.hp / dog.maxHp * 100)}%"></span></span>`);
  return unit;
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
  return { type, id: cat.id, level: cat.level, coat: normalizeCoat(cat.coat) };
}

function targetFromElement(element) {
  const cell = element?.closest?.('.cell');
  if (cell) {
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    const occupied = game.cats.find((cat) => cat.row === row && cat.col === col);
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
        occupied: occupied ? { id: occupied.id, level: occupied.level, coat: normalizeCoat(occupied.coat) } : null,
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
  });
}

function clearDragHighlights() {
  document.querySelectorAll('.drag-valid, .drag-over, .drag-invalid-hover, .drag-origin')
    .forEach((element) => element.classList.remove('drag-valid', 'drag-over', 'drag-invalid-hover', 'drag-origin'));
  dragHoverElement = null;
}

function makeDragGhost(cat, sourceRect) {
  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  ghost.style.width = `${Math.max(64, sourceRect.width)}px`;
  ghost.style.height = `${Math.max(64, sourceRect.height)}px`;
  ghost.append(unitCanvas('cat', cat));
  ghost.insertAdjacentHTML('beforeend', `<b>L${cat.level}</b><small>${catLabel(cat)}</small>`);
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
  document.querySelectorAll('.cell, .bench-slot').forEach((element) => {
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
  const visuals = makeDragGhost(dragState.cat, dragState.sourceRect);
  dragState.ghost = visuals.ghost;
  dragState.shadow = visuals.shadow;
  document.body.classList.add('pet-dragging');
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

function bindPetDrag(anchor, type, cat) {
  anchor.classList.add('pet-draggable');
  anchor.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || game.phase !== 'prep' || playing || dragState) return;
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
  if (action.type === 'place') {
    const benchIndex = game.bench.findIndex((cat) => cat.id === source.id);
    game = placeCat(game, benchIndex, action.row, action.col);
  } else if (action.type === 'move') {
    game = moveCat(game, source.id, action.row, action.col);
  } else if (action.type === 'merge') {
    game = mergeUnitOnto(game, source.type, source.id, action.targetType, action.targetId);
    if (game !== before) queueUpgradeReveal(before, game, action.targetType, action.targetId);
  } else if (action.type === 'return') {
    game = returnCatToBench(game, source.id);
  }
  return game !== before;
}

function showDropWeight(action, descriptor) {
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

function cleanupDragVisual(state) {
  state.ghost?.remove();
  state.shadow?.remove();
  document.body.classList.remove('pet-dragging');
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
    game.message = 'That is not a valid drop. Cats can only use the lower yard and merge with the same color + level.';
    render();
    return;
  }

  const changed = applyDropAction(action, state.source);
  selected = null;
  if (changed) {
    game.message = action.type === 'merge'
      ? pendingUpgrade?.kind === 'level-up'
        ? `${pendingUpgrade.label} New gear unlocked!`
        : 'Matching cats stacked — one step closer to evolving!'
      : action.type === 'return'
        ? 'Cat returned safely to the bench.'
        : 'Cat deployed!';
    playCatDrop();
  }
  render();
  if (changed && action.type !== 'merge') showDropWeight(action, target.descriptor);
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
      const dog = game.dogs.find((unit) => unit.row === row && unit.col === col);
      const zone = row >= CAT_ZONE_START ? 'cat territory' : row === CAT_ZONE_START - 1 ? 'sidewalk' : 'dog yard';
      cell.setAttribute('aria-label', cat
        ? `Level ${cat.level} ${catLabel(cat)}, ${cat.hp} of ${cat.maxHp} HP, row ${row + 1} column ${col + 1}`
        : dog
          ? `${dogTooltipInfo(dog).title}, ${dog.hp} of ${dog.maxHp} HP, row ${row + 1} column ${col + 1}`
          : `Empty ${zone}, row ${row + 1} column ${col + 1}`);
      if (cat) {
        cell.append(catMarkup(cat));
        if (selectedMatches('cat', cat.id)) cell.classList.add('selected');
        cell.classList.add('has-unit');
        bindPetDrag(cell, 'cat', cat);
        bindTooltip(cell, () => catTooltipInfo(cat));
      } else if (dog) {
        cell.append(dogMarkup(dog));
        cell.classList.add('has-unit');
        bindTooltip(cell, () => dogTooltipInfo(dog));
      }
      cell.addEventListener('click', () => {
        if (suppressNextPetClick) {
          suppressNextPetClick = false;
          return;
        }
        if (game.phase !== 'prep' || playing) return;
        if (cat) {
          if (!tryMerge('cat', cat.id)) selectCat('cat', cat);
        } else if (selected && row < CAT_ZONE_START) {
          // A silent no-op reads as a broken game — shake and say why instead.
          game.message = 'Cats stay below the sidewalk — tap one of the four glowing rows.';
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
            }
          } else if (selected.type === 'cat') {
            const before = game;
            game = moveCat(game, selected.id, row, col);
            if (game !== before) {
              selected = null;
              playCatDrop();
            } else {
              selected = null;
            }
          }
        }
        render();
      });
      gridEl.append(cell);
    }
  }
}

function renderBench() {
  benchEl.innerHTML = '';
  for (let index = 0; index < BENCH_SIZE; index += 1) {
    const cat = game.bench[index];
    const button = document.createElement('button');
    button.dataset.benchIndex = index;
    button.className = `bench-slot ${cat ? 'filled' : ''} ${cat && selectedMatches('bench', cat.id) ? 'selected' : ''}`;
    button.disabled = !cat || game.phase !== 'prep';
    button.setAttribute('aria-label', cat
      ? `Bench: level ${cat.level} ${catLabel(cat)}, ${cat.copies ?? 1} of 3 copies`
      : `Empty bench slot ${index + 1}`);
    if (cat) {
      button.dataset.unitId = cat.id;
      button.append(unitCanvas('cat', cat));
      button.insertAdjacentHTML('beforeend', `<span class="bench-level">L${cat.level} ${catLabel(cat)} · ${cat.copies ?? 1}/3</span>`);
      bindPetDrag(button, 'bench', cat);
      button.addEventListener('click', () => {
        if (suppressNextPetClick) {
          suppressNextPetClick = false;
          return;
        }
        if (!tryMerge('bench', cat.id)) selectCat('bench', cat);
        render();
      });
      bindTooltip(button, () => catTooltipInfo(cat));
    }
    benchEl.append(button);
  }
}

function renderHud() {
  $('#gold').textContent = game.gold;
  $('#lives').textContent = game.lives;
  $('#round').textContent = `${game.round}/${MAX_ROUNDS}`;
  $('#bench-count').textContent = `${game.bench.length}/${BENCH_SIZE}`;
  $('#message').textContent = game.message;
  const speedChip = $('#speed-toggle');
  if (speedChip) {
    speedChip.classList.toggle('is-fast', combatSpeed === 2);
    speedChip.setAttribute('aria-pressed', combatSpeed === 2 ? 'true' : 'false');
    $('#speed-label').textContent = `${combatSpeed}×`;
  }
  $('#refresh').disabled = game.phase !== 'prep' || game.gold < 1 || playing;
  const returnButton = $('#return-bench');
  returnButton.disabled = game.phase !== 'prep' || selected?.type !== 'cat' || game.bench.length >= BENCH_SIZE;
  $('#done').disabled = game.phase !== 'prep' || playing || game.cats.length === 0;
  $('#done-label').textContent = game.cats.length ? `START ROUND ${game.round}` : 'PLACE A CAT FIRST';
  $('#shop-panel').style.opacity = game.phase === 'prep' ? '1' : '.62';
  $('#bench-panel').style.opacity = game.phase === 'prep' ? '1' : '.62';
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

function showHit(event, { heavy = false } = {}) {
  if (event.miss || !event.to) return;
  playHit({ heavy });
  const target = findUnitElement(event.to);
  const burst = effectAt('impact-burst', event.toRow, event.col);
  // 'melee' is a dog biting a cat; everything else is damage the player dealt.
  const tone = event.type === 'melee' ? '' : ' to-dog';
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
  const movement = dog.animate([
    { transform: 'translateY(0)' },
    { transform: 'translateY(100%)' },
  ], { duration: timing.movePauseMs, easing: 'steps(4)', fill: 'forwards' });
  await movement.finished.catch(() => {});
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

/** Small pill over the board that names whose half of the exchange is animating. */
function setTurnTag(side) {
  const tag = $('#turn-tag');
  if (!tag) return;
  if (!side) {
    tag.hidden = true;
    return;
  }
  tag.textContent = side === 'cats' ? '▸ CATS ACT' : '▸ DOGS ACT';
  tag.className = `turn-tag ${side}`;
  tag.hidden = false;
}

async function animateEvents(events) {
  effectsEl.innerHTML = '';
  const shots = events.filter((event) => event.type === 'shot');
  const catMelee = events.filter((event) => event.type === 'cat-melee');
  const melee = events.filter((event) => event.type === 'melee');
  const moves = events.filter((event) => event.type === 'move');
  const heals = events.filter((event) => event.type === 'heal');
  const superCats = events.filter((event) => event.type === 'super-cat');

  if (shots.length || catMelee.length) setTurnTag('cats');
  await Promise.all([
    ...shots.map((event, index) => animateShot(event, index)),
    ...catMelee.map(animateCatScratch),
    ...heals.map(animateHeal),
  ]);
  if (melee.length || moves.length) setTurnTag('dogs');
  await Promise.all(melee.map((event) => animateMelee(event, 'down')));
  await Promise.all(moves.map(animateMove));
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

/** Legend row per coat: sprite, name, five-word role, and the unlock round when locked. */
const COAT_ROLE_WORDS = {
  0: 'bursts down its own lane',
  1: 'blocks & bites · extra HP',
  2: 'homing shot, nearest lane',
  3: 'homing yarn · heals itself',
  4: 'bomb + splash beside target',
  5: 'beam pierces 3 in its lane',
};

function renderLegend() {
  const host = $('#coat-legend');
  if (!host) return;
  host.innerHTML = '';
  const unlockedTier = shopTierForRound(game.round);
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
      chip.textContent = `R${info.shopTier * 2 - 1}`;
      row.append(chip);
    }
    const role = document.createElement('span');
    role.textContent = COAT_ROLE_WORDS[coat] ?? info.blurb;
    row.append(role);
    host.append(row);
  });
}

function render() {
  hideUnitTooltip();
  renderShop();
  renderBoard();
  renderBench();
  renderHud();
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
  const tough = fresh.filter((dog) => dog.tier >= 2).length;
  const plain = fresh.length - tough;
  const parts = [];
  if (plain) parts.push(`${plain} DOG${plain === 1 ? '' : 'S'}`);
  if (tough) parts.push(`<b>+ ${tough} TOUGH</b>`);
  banner.innerHTML = `WAVE ${game.round} · ${parts.join(' ') || 'INCOMING'}`;
  banner.hidden = false;
  window.setTimeout(() => { banner.hidden = true; }, Math.round(1300 / combatSpeed));
}

async function playRound() {
  if (playing || game.phase !== 'prep' || game.cats.length === 0) return;
  playing = true;
  selected = null;
  game = startRound(game);
  render();
  announceWave();
  await wait(Math.round(650 / combatSpeed));

  for (let action = 0; action < ACTIONS_PER_ROUND; action += 1) {
    if (game.phase !== 'combat') break;
    // Board already clear mid-level: stop early and go to the next wave / victory check.
    if (game.dogs.length === 0) break;
    await runCombatSection();
    if (game.phase === 'gameover' || game.phase === 'victory') break;
  }

  // Final wave: keep fighting past the normal 2 actions until dogs are cleared or lives hit 0.
  while (
    game.phase === 'combat'
    && game.round >= MAX_ROUNDS
    && game.dogs.length > 0
    && game.lives > 0
  ) {
    await runCombatSection();
    if (game.phase === 'gameover' || game.phase === 'victory') break;
  }

  if (game.phase === 'combat') game = finishRound(game);
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
$('#return-bench').addEventListener('click', () => {
  if (selected?.type === 'cat') game = returnCatToBench(game, selected.id);
  selected = null;
  render();
});
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
  if (event.key === 'Escape' && settingsModalEl && !settingsModalEl.hidden) closeSettings();
});


loadSoundEnabled();
syncSettingsUi();
drawBackyard($('#yard-art'));
render();
