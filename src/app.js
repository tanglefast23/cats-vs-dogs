import {
  ROWS, COLS, CAT_ZONE_START, BENCH_SIZE, MAX_ROUNDS, ACTIONS_PER_ROUND,
  CAT_COAT_INFO, catStatsFor, normalizeCoat, catTooltipInfo, dogTooltipInfo,
  createGame, buyShopCat, refreshShop, toggleSaveShopSlot, placeCat, moveCat,
  returnCatToBench, mergeUnitOnto, startRound, resolveSection, finishRound,
} from './game-engine.js';
import { drawBackyard, drawCat, drawDog } from './pixel-art.js';
import { selectionAfterPurchase } from './ui-state.js';
import { COMBAT_TIMING, cellCenter, homingShotKeyframes } from './combat-animation.js';
import { unlockAudio, playCatDrop, playHit, isSoundEnabled, setSoundEnabled, loadSoundEnabled } from './sound.js';

let game = createGame();
let selected = null;
let playing = false;

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

function hideUnitTooltip() {
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
  const show = (event) => {
    const info = typeof infoFactory === 'function' ? infoFactory() : infoFactory;
    const x = event.clientX;
    const y = event.clientY;
    showUnitTooltip(anchor, info, x, y);
  };
  const move = (event) => {
    if (tooltipEl.hidden) return;
    const info = typeof infoFactory === 'function' ? infoFactory() : infoFactory;
    showUnitTooltip(anchor, info, event.clientX, event.clientY);
  };
  anchor.addEventListener('mouseenter', show);
  anchor.addEventListener('mousemove', move);
  anchor.addEventListener('mouseleave', hideUnitTooltip);
  anchor.addEventListener('focus', () => showUnitTooltip(anchor, typeof infoFactory === 'function' ? infoFactory() : infoFactory));
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

function renderShop() {
  shopEl.innerHTML = '';
  game.shop.forEach((slot, index) => {
    const stats = catStatsFor(slot.level ?? 1, slot.coat);
    const info = CAT_COAT_INFO[normalizeCoat(slot.coat)];
    const wrap = document.createElement('div');
    wrap.className = `shop-slot ${slot.saved ? 'saved' : ''} ${slot.sold ? 'sold' : ''}`;

    const button = document.createElement('button');
    button.className = 'shop-card';
    button.disabled = slot.sold || game.gold < 3 || game.bench.length >= BENCH_SIZE || game.phase !== 'prep';
    button.append(unitCanvas('cat', slot));
    button.insertAdjacentHTML('beforeend', `
      <strong>${slot.sold ? 'ADOPTED' : info.name}</strong>
      <small class="ability-blurb">${info.blurb}</small>
      <div class="stats"><span>♥ ${stats.hp}</span><span>↑ ${stats.attack}</span></div>
      <span class="price">● 3</span>`);
    button.addEventListener('click', () => {
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
    <span class="hp-wrap"><span class="hp-bar" style="width:${Math.max(0, cat.hp / cat.maxHp * 100)}%"></span></span>`);
  return unit;
}

function dogMarkup(dog) {
  const unit = document.createElement('div');
  unit.className = 'unit';
  unit.dataset.unitId = dog.id;
  unit.append(unitCanvas('dog', dog));
  unit.insertAdjacentHTML('beforeend', `
    <span class="unit-badge">T${dog.tier}</span>
    <span class="hp-wrap"><span class="hp-bar" style="width:${Math.max(0, dog.hp / dog.maxHp * 100)}%"></span></span>`);
  return unit;
}

function tryMerge(targetType, targetId) {
  if (!selected || (selected.type !== 'bench' && selected.type !== 'cat')) return false;
  const before = game;
  game = mergeUnitOnto(game, selected.type, selected.id, targetType, targetId);
  if (game === before) return false;
  selected = null;
  game.message = 'Same-color cats merged! Add a third matching coat + level to evolve.';
  return true;
}

function selectCat(type, cat) {
  selected = { type, id: cat.id };
  const info = CAT_COAT_INFO[normalizeCoat(cat.coat)];
  game.message = `Level ${cat.level} ${info.name} selected (${info.blurb}). Tap an empty cat-territory tile to place it, or merge only onto the same color + level.`;
}

function renderBoard() {
  gridEl.innerHTML = '';
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const cell = document.createElement('button');
      cell.className = `cell ${row >= CAT_ZONE_START ? 'cat-zone' : ''} ${row === CAT_ZONE_START - 1 ? 'middle' : ''}`;
      cell.dataset.row = row;
      cell.dataset.col = col;
      const cat = game.cats.find((unit) => unit.row === row && unit.col === col);
      const dog = game.dogs.find((unit) => unit.row === row && unit.col === col);
      if (cat) {
        cell.append(catMarkup(cat));
        if (selectedMatches('cat', cat.id)) cell.classList.add('selected');
        cell.classList.add('has-unit');
        bindTooltip(cell, () => catTooltipInfo(cat));
      } else if (dog) {
        cell.append(dogMarkup(dog));
        cell.classList.add('has-unit');
        bindTooltip(cell, () => dogTooltipInfo(dog));
      }
      cell.addEventListener('click', () => {
        if (game.phase !== 'prep' || playing) return;
        if (cat) {
          if (!tryMerge('cat', cat.id)) selectCat('cat', cat);
        } else if (row >= CAT_ZONE_START && selected) {
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
    button.className = `bench-slot ${cat ? 'filled' : ''} ${cat && selectedMatches('bench', cat.id) ? 'selected' : ''}`;
    button.disabled = !cat || game.phase !== 'prep';
    if (cat) {
      button.append(unitCanvas('cat', cat));
      button.insertAdjacentHTML('beforeend', `<span class="bench-level">L${cat.level} ${catLabel(cat)} · ${cat.copies ?? 1}/3</span>`);
      button.addEventListener('click', () => {
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
  [...document.querySelectorAll('#section-dots i')].forEach((dot, index) => {
    dot.className = index < game.section ? 'done' : index === game.section && game.phase === 'combat' ? 'active' : '';
  });
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
  playHit({ heavy });
  const target = findUnitElement(event.to);
  const burst = effectAt('impact-burst', event.toRow, event.col);
  const damage = effectAt('damage-number', event.toRow, event.col, `-${event.damage}`);
  if (target) {
    target.classList.remove('hurt');
    void target.offsetWidth;
    target.classList.add('hurt');
    const hpBar = target.querySelector('.hp-bar');
    if (hpBar) hpBar.style.width = `${Math.max(0, event.hpAfter / event.maxHp * 100)}%`;
  }
  window.setTimeout(() => burst.remove(), COMBAT_TIMING.impactMs);
  window.setTimeout(() => damage.remove(), COMBAT_TIMING.impactMs + COMBAT_TIMING.hpPauseMs);
  window.setTimeout(() => target?.classList.remove('hurt'), COMBAT_TIMING.impactMs);
}

async function animateShot(event, index) {
  await wait(index * COMBAT_TIMING.shotStaggerMs);
  const fromCol = event.fromCol ?? event.col;
  const toCol = event.col;
  const start = cellCenter(event.fromRow, fromCol);
  const end = cellCenter(event.toRow, toCol);
  const isHoming = event.style === 'homing';
  const projectile = effectAt(
    isHoming ? 'projectile-effect homing-projectile' : 'projectile-effect',
    event.fromRow,
    fromCol,
  );
  const flight = projectile.animate(
    isHoming
      ? homingShotKeyframes(start, end)
      : [
        { left: `${start.xPercent}%`, top: `${start.yPercent}%`, transform: 'translate(-50%, -50%) scale(.8) rotate(0deg)' },
        { left: `${end.xPercent}%`, top: `${end.yPercent}%`, transform: 'translate(-50%, -50%) scale(1.15) rotate(360deg)' },
      ],
    {
      duration: isHoming ? COMBAT_TIMING.homingMs : COMBAT_TIMING.projectileMs,
      // Linear keyframe timing — the path itself eases the seek.
      easing: 'linear',
      fill: 'forwards',
    },
  );
  await flight.finished.catch(() => {});
  projectile.remove();
  showHit(event);
  await wait(COMBAT_TIMING.impactMs + COMBAT_TIMING.hpPauseMs);
}

async function animateMelee(event, direction = 'down') {
  const attacker = findUnitElement(event.from);
  const className = direction === 'up' ? 'melee-lunge-up' : 'melee-lunge';
  attacker?.classList.add(className);
  await wait(Math.floor(COMBAT_TIMING.meleeMs / 2));
  showHit(event, { heavy: true });
  await wait(Math.ceil(COMBAT_TIMING.meleeMs / 2) + COMBAT_TIMING.hpPauseMs);
  attacker?.classList.remove(className);
}

async function animateMove(event) {
  const dog = findUnitElement(event.id);
  if (!dog) return;
  const movement = dog.animate([
    { transform: 'translateY(0)' },
    { transform: 'translateY(100%)' },
  ], { duration: COMBAT_TIMING.movePauseMs, easing: 'steps(4)', fill: 'forwards' });
  await movement.finished.catch(() => {});
}

async function animateSuperCat(event) {
  const runner = document.createElement('div');
  runner.className = 'super-effect';
  runner.style.left = `${event.col * (100 / COLS)}%`;
  const canvas = document.createElement('canvas');
  drawCat(canvas, 3, 0, true);
  runner.append(canvas);
  effectsEl.append(runner);
  await wait(720);
  runner.remove();
}

async function animateEvents(events) {
  effectsEl.innerHTML = '';
  const shots = events.filter((event) => event.type === 'shot');
  const catMelee = events.filter((event) => event.type === 'cat-melee');
  const melee = events.filter((event) => event.type === 'melee');
  const moves = events.filter((event) => event.type === 'move');
  const superCats = events.filter((event) => event.type === 'super-cat');

  await Promise.all([
    ...shots.map((event, index) => animateShot(event, index)),
    ...catMelee.map((event) => animateMelee(event, 'up')),
  ]);
  await Promise.all(melee.map((event) => animateMelee(event, 'down')));
  await Promise.all(moves.map(animateMove));
  await Promise.all(superCats.map(animateSuperCat));
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

function render() {
  hideUnitTooltip();
  renderShop();
  renderBoard();
  renderBench();
  renderHud();
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function playRound() {
  if (playing || game.phase !== 'prep' || game.cats.length === 0) return;
  playing = true;
  selected = null;
  game = startRound(game);
  render();
  await wait(650);
  for (let action = 0; action < ACTIONS_PER_ROUND; action += 1) {
    const nextGame = resolveSection(game);
    await animateEvents(nextGame.events);
    game = nextGame;
    render();
    await wait(COMBAT_TIMING.hpPauseMs);
    if (game.phase === 'gameover') break;
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

$('#refresh').addEventListener('click', () => { game = refreshShop(game); selected = null; render(); });
$('#return-bench').addEventListener('click', () => {
  if (selected?.type === 'cat') game = returnCatToBench(game, selected.id);
  selected = null;
  render();
});
$('#done').addEventListener('click', playRound);
$('#restart').addEventListener('click', resetGame);
$('#play-again').addEventListener('click', resetGame);
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
