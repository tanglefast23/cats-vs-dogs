// Splash screen concept explorations — demo page only, not wired into the game.
// Reuses the real in-game sprite art from pixel-art.js so every concept is
// previewed with the exact characters the player will meet.
import { drawCat, drawDog } from './pixel-art.js';

const stage = document.getElementById('stage');
const switcher = document.getElementById('switcher');
const captionEl = document.getElementById('caption');

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function catCanvas(coat, level = 1, size = 64, flip = false) {
  const c = document.createElement('canvas');
  drawCat(c, level, coat);
  c.className = `sc-sprite${flip ? ' flip' : ''}`;
  c.style.width = `${size}px`;
  c.style.height = `${size}px`;
  return c;
}

function dogCanvas(role, tier = 1, size = 64, flip = false) {
  const c = document.createElement('canvas');
  drawDog(c, tier, role);
  c.className = `sc-sprite${flip ? ' flip' : ''}`;
  c.style.width = `${size}px`;
  c.style.height = `${size}px`;
  return c;
}

function div(className, styles = {}) {
  const d = document.createElement('div');
  d.className = className;
  Object.assign(d.style, styles);
  return d;
}

function buildChrome(root) {
  root.insertAdjacentHTML('beforeend', `
    <header class="sc-title">
      <p class="sc-eyebrow">BACKYARD BATTLE</p>
      <h1>CATS <span class="vs">VS</span> DOGS</h1>
    </header>
    <nav class="sc-menu" aria-label="Main menu">
      <button class="sc-btn primary" type="button">CAMPAIGN</button>
      <button class="sc-btn" type="button">TUTORIAL</button>
      <button class="sc-btn" type="button">SETTINGS</button>
    </nav>`);
}

function buildStars(root, count = 26) {
  for (let i = 0; i < count; i += 1) {
    const s = div('sc-star', {
      left: `${rand(0, 100)}%`,
      top: `${rand(0, 52)}%`,
      width: `${pick([2, 2, 3])}px`,
      height: `${pick([2, 2, 3])}px`,
    });
    s.style.setProperty('--d', `${rand(2.2, 5)}s`);
    s.style.setProperty('--del', `${rand(0, 4)}s`);
    root.append(s);
  }
}

// Tiny timer registry so switching concepts never leaks loops.
function makeClock() {
  const ids = new Set();
  let dead = false;
  return {
    later(fn, ms) {
      if (dead) return;
      const id = setTimeout(() => { ids.delete(id); if (!dead) fn(); }, ms);
      ids.add(id);
    },
    kill() { dead = true; ids.forEach(clearTimeout); ids.clear(); },
    get dead() { return dead; },
  };
}

/* ================= concept 1 · the standoff ================= */
function buildStandoff(root) {
  const clock = makeClock();
  buildStars(root);
  root.append(div('sc-grass'));
  buildChrome(root);

  const vs = div('sc-vs');
  vs.textContent = 'VS';
  root.append(vs);
  const sparkA = div('sc-spark', { left: 'calc(50% - 74px)', bottom: '11vh' });
  const sparkB = div('sc-spark', { left: 'calc(50% + 58px)', bottom: '15vh' });
  sparkB.style.setProperty('--del', '.85s');
  root.append(sparkA, sparkB);

  // [makeSprite, x%, bottom, size, z] — front rows are bigger and lower (closer).
  const catGang = [
    [() => catCanvas(1, 1, 92), 12, '1vh', 7],  // Clawdius, the wall
    [() => catCanvas(3, 1, 50), 30, '2vh', 7],  // Knotty Kitty, tiny and fearless
    [() => catCanvas(0, 2, 66), 21, '9vh', 6],  // Purrcy in skyguard armor
    [() => catCanvas(2, 1, 62), 35, '10vh', 6], // Hissiletoe
    [() => catCanvas(5, 1, 48), 8, '16vh', 5],  // Laserpaw
    [() => catCanvas(6, 1, 48), 26, '17vh', 5], // Frosty Paws
    [() => catCanvas(9, 1, 48), 40, '16vh', 5], // Thunderpaws
  ];
  const dogGang = [
    [() => dogCanvas('growler', 1, 92), 12, '1vh', 7],  // corgi with the megaphone
    [() => dogCanvas('skittish', 1, 52), 30, '2vh', 7], // trembling up front anyway
    [() => dogCanvas('scruffy', 1, 66), 21, '9vh', 6],
    [() => dogCanvas('tennis', 2, 62), 35, '10vh', 6],
    [() => dogCanvas('howler', 1, 48), 8, '16vh', 5],
    [() => dogCanvas('jumper', 2, 48), 26, '17vh', 5],
    [() => dogCanvas('medic', 3, 48), 40, '16vh', 5],
  ];

  const pets = [];
  const place = (gang, side, dir) => {
    for (const [make, x, bottom, z] of gang) {
      const pet = div('sc-pet', { [side]: `${x}%`, bottom });
      pet.style.setProperty('--z', z);
      pet.style.setProperty('--dir', dir);
      pet.style.setProperty('--idur', `${rand(0.9, 1.5).toFixed(2)}s`);
      pet.style.setProperty('--idel', `${rand(0, 1).toFixed(2)}s`);
      pet.append(make());
      root.append(pet);
      pets.push(pet);
    }
  };
  place(catGang, 'left', 1);    // cats lunge rightward
  place(dogGang, 'right', -1);  // dogs lunge leftward

  const tauntLoop = () => {
    if (clock.dead) return;
    const pet = pick(pets);
    if (!pet.classList.contains('taunt')) {
      pet.classList.add('taunt');
      pet.addEventListener('animationend', () => pet.classList.remove('taunt'), { once: true });
    }
    clock.later(tauntLoop, rand(900, 2000));
  };
  clock.later(tauntLoop, 800);
  return () => clock.kill();
}

/* ================= concept 2 · fence peekaboo ================= */
// Coat 4 (Bombay Boom) is drawn prowling low in his tile, so he never clears
// the fence line — left out of the pop pool.
const POP_CATS = [[0, 1], [1, 1], [2, 1], [3, 1], [5, 1], [8, 1], [0, 2], [9, 1]];
const POP_DOGS = [['scruffy', 1], ['tennis', 2], ['howler', 1], ['skittish', 1], ['medic', 1], ['growler', 1], ['frisbee', 2], ['jumper', 1]];

function repaintRandom(canvas) {
  if (Math.random() < 0.5) {
    const [coat, level] = pick(POP_CATS);
    drawCat(canvas, level, coat);
    canvas.classList.remove('flip');
  } else {
    const [role, tier] = pick(POP_DOGS);
    drawDog(canvas, tier, role);
    canvas.classList.toggle('flip', Math.random() < 0.5);
  }
}

function buildPeekaboo(root) {
  const clock = makeClock();
  buildStars(root);
  buildChrome(root);
  const fence = div('sc-fence');
  root.append(fence);

  const fenceH = () => root.clientHeight * 0.24;
  const slots = [3, 17, 31, 45, 59, 73, 87];

  const shout = (leftPx, bottomPx) => {
    const s = div('sc-shout', { left: `${leftPx}px`, bottom: `${bottomPx}px` });
    s.textContent = pick(['!', '?', '!!', '?!']);
    root.append(s);
    clock.later(() => s.remove(), 980);
  };

  for (const leftPct of slots) {
    const size = Math.round(rand(96, 140));
    const slot = div('sc-slot', {
      left: `${leftPct}%`,
      bottom: `${Math.round(fenceH() - size * 0.32)}px`,
      width: `${size}px`,
      height: `${size}px`,
    });
    const pop = div('sc-pop');
    const canvas = catCanvas(pick(POP_CATS)[0], 1, size);
    pop.append(canvas);
    slot.append(pop);
    root.append(slot);

    const cycle = () => {
      if (clock.dead) return;
      clock.later(() => {
        repaintRandom(canvas);
        slot.classList.remove('down');
        slot.classList.add('up');
        if (Math.random() < 0.3) {
          const rect = slot.getBoundingClientRect();
          shout(rect.left + size * 0.68, root.clientHeight - rect.bottom + size * 1.02);
        }
        clock.later(() => {
          slot.classList.remove('up');
          slot.classList.add('down');
          clock.later(cycle, 340);
        }, rand(1000, 2400));
      }, rand(400, 2800));
    };
    cycle();
  }

  // Side peekers slide in from the screen edges now and then.
  const peekLeft = div('sc-peek', { left: '-6px', top: '34vh' });
  peekLeft.style.setProperty('--hx', '-112%');
  peekLeft.style.setProperty('--tilt', '7deg');
  peekLeft.append(catCanvas(3, 1, 96));
  const peekRight = div('sc-peek', { right: '-6px', top: '26vh' });
  peekRight.style.setProperty('--hx', '112%');
  peekRight.style.setProperty('--tilt', '-7deg');
  peekRight.append(dogCanvas('scruffy', 1, 96, true));
  root.append(peekLeft, peekRight);

  let fromLeft = true;
  const peekLoop = () => {
    if (clock.dead) return;
    const peeker = fromLeft ? peekLeft : peekRight;
    fromLeft = !fromLeft;
    peeker.classList.add('in');
    clock.later(() => peeker.classList.remove('in'), 1500);
    clock.later(peekLoop, rand(4200, 7800));
  };
  clock.later(peekLoop, 1600);
  return () => clock.kill();
}

/* ================= concept 3 · the backyard chase ================= */
function pixelMoon(size = 84) {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 16;
  c.className = 'sc-moon';
  c.style.width = `${size}px`;
  c.style.height = `${size}px`;
  const ctx = c.getContext('2d');
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const d = (x - 8) ** 2 + (y - 8) ** 2;
      if (d <= 46) { ctx.fillStyle = '#f4e7bd'; ctx.fillRect(x, y, 1, 1); }
    }
  }
  ctx.fillStyle = '#d9c99b';
  [[5, 5, 2, 2], [10, 8, 3, 2], [6, 11, 2, 2], [11, 4, 1, 1]].forEach(([x, y, w, h]) => ctx.fillRect(x, y, w, h));
  return c;
}

const LANES = [
  { bottom: '23vh', size: 42, dur: [8.5, 10.5], z: 4, dim: 'brightness(.72) saturate(.92)' },
  { bottom: '11vh', size: 66, dur: [6.2, 7.6], z: 6, dim: 'brightness(.88)' },
  { bottom: '4px', size: 100, dur: [4.6, 5.6], z: 8, dim: 'none' },
];

// [lead spec, chaser spec] — kind decides drawCat vs drawDog. A couple of
// pairs flip the joke and let the cats do the chasing.
const CHASE_PAIRS = [
  [{ kind: 'cat', a: 3, b: 1 }, { kind: 'dog', a: 'scruffy', b: 1 }],
  [{ kind: 'cat', a: 2, b: 1 }, { kind: 'dog', a: 'growler', b: 1 }],
  [{ kind: 'cat', a: 5, b: 1 }, { kind: 'dog', a: 'frisbee', b: 2 }],
  [{ kind: 'cat', a: 0, b: 2 }, { kind: 'dog', a: 'tennis', b: 2 }],
  [{ kind: 'dog', a: 'skittish', b: 1 }, { kind: 'cat', a: 1, b: 2 }],
  [{ kind: 'dog', a: 'jumper', b: 2 }, { kind: 'cat', a: 9, b: 3 }],
  [{ kind: 'dog', a: 'howler', b: 1 }, { kind: 'cat', a: 4, b: 1 }],
];

function runnerFor(spec, size, dir) {
  // Dog sprites are drawn facing left, cats face front — flip dogs when the
  // chase travels left-to-right so everyone runs nose first.
  const flip = spec.kind === 'dog' && dir === 'ltr';
  const canvas = spec.kind === 'cat'
    ? catCanvas(spec.a, spec.b, size, flip)
    : dogCanvas(spec.a, spec.b, size, flip);
  const wrap = div('sc-runner');
  wrap.style.setProperty('--gdur', `${rand(0.28, 0.4).toFixed(2)}s`);
  wrap.style.setProperty('--lean', `${dir === 'ltr' ? '' : '-'}4deg`);
  wrap.append(canvas);
  return wrap;
}

function buildChase(root) {
  const clock = makeClock();
  buildStars(root, 34);
  root.append(pixelMoon());
  root.append(div('sc-field'));
  buildChrome(root);

  for (let i = 0; i < 8; i += 1) {
    const fly = div('sc-fly', { left: `${rand(4, 94)}%`, top: `${rand(58, 72)}%` });
    fly.style.setProperty('--d', `${rand(3, 6).toFixed(1)}s`);
    fly.style.setProperty('--del', `${rand(0, 2).toFixed(1)}s`);
    fly.style.setProperty('--dx', `${Math.round(rand(-60, 60))}px`);
    fly.style.setProperty('--dy', `${Math.round(rand(-40, 14))}px`);
    root.append(fly);
  }

  const busy = [false, false, false];
  const spawnChase = () => {
    if (clock.dead) return;
    const free = LANES.map((lane, i) => i).filter((i) => !busy[i]);
    if (free.length) {
      const laneIdx = pick(free);
      const lane = LANES[laneIdx];
      busy[laneIdx] = true;
      const dir = laneIdx === 2 ? 'ltr' : pick(['ltr', 'rtl']);
      const [lead, chaser] = pick(CHASE_PAIRS);
      const group = div(`sc-chase${dir === 'rtl' ? ' rev' : ''}`);
      group.style.setProperty('--lane-b', lane.bottom);
      group.style.setProperty('--z', lane.z);
      group.style.setProperty('--dim', lane.dim);
      group.style.setProperty('--gap', `${Math.round(lane.size * 0.5)}px`);
      group.style.setProperty('--dur', `${rand(lane.dur[0], lane.dur[1]).toFixed(2)}s`);
      // Flex order puts the lead nose-first in the direction of travel.
      group.style.flexDirection = dir === 'ltr' ? 'row-reverse' : 'row';
      group.append(runnerFor(lead, lane.size, dir), runnerFor(chaser, lane.size, dir));
      group.addEventListener('animationend', (e) => {
        if (e.target !== group) return;
        group.remove();
        busy[laneIdx] = false;
      });
      root.append(group);
    }
    clock.later(spawnChase, rand(1200, 2600));
  };
  clock.later(spawnChase, 200);

  const discLoop = () => {
    if (clock.dead) return;
    const disc = div('sc-disc', { left: '0', top: `${rand(20, 34)}vh` });
    disc.style.setProperty('--dur', `${rand(4, 6).toFixed(1)}s`);
    disc.addEventListener('animationend', () => disc.remove());
    root.append(disc);
    clock.later(discLoop, rand(6500, 11000));
  };
  clock.later(discLoop, 2500);
  return () => clock.kill();
}

/* ================= switcher ================= */
const CONCEPTS = [
  {
    label: '1 · STANDOFF',
    caption: 'CONCEPT 1 · THE STANDOFF — two rival gangs line the yard and size each other up. Random pets hop forward to taunt across the line.',
    build: buildStandoff,
  },
  {
    label: '2 · PEEKABOO',
    caption: 'CONCEPT 2 · FENCE PEEKABOO — the whole neighborhood pops up over the back fence, whack-a-mole style. Watch the screen edges too.',
    build: buildPeekaboo,
  },
  {
    label: '3 · THE CHASE',
    caption: 'CONCEPT 3 · THE BACKYARD CHASE — endless cartoon chases streak across three depth layers. Sometimes the cats do the chasing.',
    build: buildChase,
  },
];

let cleanup = null;
function show(index) {
  if (cleanup) cleanup();
  stage.innerHTML = '';
  captionEl.textContent = CONCEPTS[index].caption;
  cleanup = CONCEPTS[index].build(stage);
  [...switcher.children].forEach((b, i) => b.setAttribute('aria-pressed', String(i === index)));
}

CONCEPTS.forEach((concept, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = concept.label;
  b.addEventListener('click', () => show(i));
  switcher.append(b);
});
window.addEventListener('keydown', (e) => {
  const idx = ['1', '2', '3'].indexOf(e.key);
  if (idx !== -1) show(idx);
});

show(0);
