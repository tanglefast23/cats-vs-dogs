// Fence-peekaboo start screen: the roster pops up over the back fence,
// whack-a-mole style, until the player picks Campaign, Tutorial, or Settings.
// Pets are drawn with the real battle art so the title screen is a preview of
// the cast, and pops occasionally meow or woof through the shared SFX layer.
import { drawCat, drawDog } from './pixel-art.js';
import { playMeow, playWoof } from './sound.js';

// Pop pools are [coat, level] / [role, tier] pairs from the battle rosters.
// Coat 4 (Bombay Boom) prowls too low in his tile to clear the fence line,
// so he sits the title screen out.
export const SPLASH_POP_CATS = Object.freeze([
  [0, 1], [1, 1], [2, 1], [3, 1], [5, 1], [8, 1], [0, 2], [9, 1],
]);
export const SPLASH_POP_DOGS = Object.freeze([
  ['scruffy', 1], ['tennis', 2], ['howler', 1], ['skittish', 1],
  ['medic', 1], ['growler', 1], ['frisbee', 2], ['jumper', 1],
]);

/** How often a pop-up pet speaks, and the quiet gap enforced between voices.
 * Pops land every second or so; the long gap keeps voices an occasional
 * accent over the music rather than a constant chorus. */
export const VOICE_CHANCE = 0.3;
export const VOICE_MIN_GAP_MS = 2600;

// Must match the .splash-fence height in styles.css.
const FENCE_VH = 24;

const DESKTOP_SLOTS = [3, 17, 31, 45, 59, 73, 87];
const MOBILE_SLOTS = [4, 26, 50, 74];

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * Rate-limits the splash animal voices: at most one voice per gap, and each
 * eligible moment still has to win its chance roll. Injectable random/now
 * keep it deterministic under test.
 */
export function createVoiceGate({ minGapMs = VOICE_MIN_GAP_MS, random = Math.random, now = () => Date.now() } = {}) {
  let last = -Infinity;
  return (chance = VOICE_CHANCE) => {
    const at = now();
    if (at - last < minGapMs) return false;
    if (random() >= chance) return false;
    last = at;
    return true;
  };
}

// Timer registry so dismissing the splash never leaks a scheduler loop.
function makeClock(win) {
  const ids = new Set();
  let dead = false;
  return {
    later(fn, ms) {
      if (dead) return;
      const id = win.setTimeout(() => { ids.delete(id); if (!dead) fn(); }, ms);
      ids.add(id);
    },
    kill() { dead = true; ids.forEach((id) => win.clearTimeout(id)); ids.clear(); },
    get dead() { return dead; },
  };
}

function el(doc, className, styles = {}) {
  const node = doc.createElement('div');
  node.className = className;
  Object.assign(node.style, styles);
  return node;
}

/** Repaint a pop canvas as a random roster pet; returns whether it is a cat. */
function repaintRandomPet(canvas) {
  const isCat = Math.random() < 0.5;
  if (isCat) {
    const [coat, level] = pick(SPLASH_POP_CATS);
    drawCat(canvas, level, coat);
    canvas.classList.remove('flip');
  } else {
    const [role, tier] = pick(SPLASH_POP_DOGS);
    drawDog(canvas, tier, role);
    canvas.classList.toggle('flip', Math.random() < 0.5);
  }
  return isCat;
}

function buildStars(doc, root, count = 26) {
  for (let i = 0; i < count; i += 1) {
    const star = el(doc, 'splash-star', {
      left: `${rand(0, 100)}%`,
      top: `${rand(0, 52)}%`,
      width: `${pick([2, 2, 3])}px`,
      height: `${pick([2, 2, 3])}px`,
    });
    star.style.setProperty('--d', `${rand(2.2, 5).toFixed(2)}s`);
    star.style.setProperty('--del', `${rand(0, 4).toFixed(2)}s`);
    root.append(star);
  }
}

function buildPopSlot(doc, root, clock, voiceGate, leftPct, size) {
  const slot = el(doc, 'splash-slot', {
    left: `${leftPct}%`,
    bottom: `calc(${FENCE_VH}vh - ${Math.round(size * 0.32)}px)`,
    width: `${size}px`,
    height: `${size}px`,
  });
  const pop = el(doc, 'splash-pop');
  const canvas = doc.createElement('canvas');
  canvas.className = 'splash-sprite';
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  repaintRandomPet(canvas);
  pop.append(canvas);
  slot.append(pop);
  root.append(slot);

  const shout = () => {
    const bubble = el(doc, 'splash-shout');
    bubble.textContent = pick(['!', '?', '!!', '?!']);
    slot.append(bubble);
    clock.later(() => bubble.remove(), 980);
  };

  const cycle = () => {
    clock.later(() => {
      const isCat = repaintRandomPet(canvas);
      slot.classList.remove('down');
      slot.classList.add('up');
      if (voiceGate()) (isCat ? playMeow : playWoof)();
      if (Math.random() < 0.3) shout();
      clock.later(() => {
        slot.classList.remove('up');
        slot.classList.add('down');
        clock.later(cycle, 340);
      }, rand(1000, 2400));
    }, rand(400, 2800));
  };
  cycle();
}

function buildPeekers(doc, root, clock, voiceGate) {
  const make = (className, styles, hideX, tilt, draw) => {
    const peek = el(doc, `splash-peek ${className}`, styles);
    peek.style.setProperty('--hx', hideX);
    peek.style.setProperty('--tilt', tilt);
    const canvas = doc.createElement('canvas');
    canvas.className = 'splash-sprite';
    canvas.style.width = '96px';
    canvas.style.height = '96px';
    draw(canvas);
    peek.append(canvas);
    root.append(peek);
    return peek;
  };
  const kitten = make('left', { left: '-6px', top: '32vh' }, '-112%', '7deg', (c) => drawCat(c, 1, 3));
  const mutt = make('right', { right: '-6px', top: '24vh' }, '112%', '-7deg', (c) => {
    drawDog(c, 1, 'scruffy');
    c.classList.add('flip');
  });

  let fromLeft = true;
  const peekLoop = () => {
    const peeker = fromLeft ? kitten : mutt;
    if (voiceGate(1)) (fromLeft ? playMeow : playWoof)();
    fromLeft = !fromLeft;
    peeker.classList.add('in');
    clock.later(() => peeker.classList.remove('in'), 1500);
    clock.later(peekLoop, rand(4200, 7800));
  };
  clock.later(peekLoop, 1600);
}

/**
 * Bring the start screen to life and wire its three actions. Campaign and
 * Tutorial dismiss the splash; Settings opens the shared modal on top of it.
 */
export function initSplash({ root, onCampaign, onTutorial, onSettings } = {}) {
  if (!root) return null;
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  const clock = makeClock(win);
  const voiceGate = createVoiceGate();

  buildStars(doc, root);
  const narrow = win.innerWidth < 720;
  const [slots, sizeMin, sizeMax] = narrow
    ? [MOBILE_SLOTS, 72, 104]
    : [DESKTOP_SLOTS, 96, 140];
  for (const leftPct of slots) {
    buildPopSlot(doc, root, clock, voiceGate, leftPct, Math.round(rand(sizeMin, sizeMax)));
  }
  buildPeekers(doc, root, clock, voiceGate);

  let dismissed = false;
  const dismiss = () => {
    if (dismissed) return;
    dismissed = true;
    clock.kill();
    root.classList.add('leaving');
    const hide = () => { root.hidden = true; };
    root.addEventListener('transitionend', hide, { once: true });
    // Reduced-motion browsers may skip the fade transition entirely.
    win.setTimeout(hide, 600);
  };

  root.querySelector('#splash-campaign')?.addEventListener('click', () => { dismiss(); onCampaign?.(); });
  root.querySelector('#splash-tutorial')?.addEventListener('click', () => { dismiss(); onTutorial?.(); });
  root.querySelector('#splash-settings')?.addEventListener('click', () => { onSettings?.(); });

  return { dismiss };
}
