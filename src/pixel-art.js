import { ROWS, COLS, CAT_ZONE_START } from './game-engine.js';

const px = (ctx, color, x, y, w = 1, h = 1) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

function prepare(canvas, size = 32) {
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, size, size);
  return ctx;
}

export const CAT_EQUIPMENT = {
  1: [],
  2: ['steel-helmet', 'chest-armor', 'shoulder-pads'],
  3: ['steel-helmet', 'chest-armor', 'shoulder-pads', 'battle-cape', 'plasma-core', 'power-cannon', 'energy-wings'],
};

export const CAT_ARCHETYPE_MARKERS = {
  3: ['calico-patches', 'yarn-ball'],
  4: ['black-coat', 'bomb-pack'],
  5: ['prism-coat', 'crystal-crown'],
};

export const DOG_TIER_MARKERS = {
  1: ['plain-collar'],
  2: ['steel-helmet'],
  3: ['bruiser-plates'],
  4: ['alpha-armor', 'crown'],
};

export const WORKER_ART_MARKERS = {
  cook: ['straw-hat', 'apron', 'spoon'],
  trader: ['waistcoat', 'coin-purse', 'merchant-hat'],
  weaponsmith: ['leather-apron', 'hammer', 'weapon-rack'],
  armourer: ['goggles', 'heavy-gloves', 'anvil'],
};

export const ITEM_ART_MARKERS = {
  food: ['apple', 'leaf'],
  coins: ['gold-stack', 'shine'],
  weapon: ['blade', 'tier-trim'],
  armour: ['breastplate', 'tier-trim'],
};

export function drawCat(canvas, level = 1, coat = 0, superCat = false) {
  const ctx = prepare(canvas);
  const coats = [
    ['#e9963f', '#ffd18a', '#9c4d2e'],
    ['#71868d', '#cdd9d5', '#3e5159'],
    ['#f0e1bc', '#fff7df', '#9a7759'],
    ['#f2d7a7', '#fff0ce', '#a84f35'],
    ['#2f3540', '#697482', '#151923'],
    ['#9f71d8', '#d9c7ff', '#593c91'],
  ];
  const [fur, light, dark] = coats[coat % coats.length];
  const outline = '#172b36';

  if (superCat) {
    px(ctx, '#d64843', 4, 14, 7, 12);
    px(ctx, '#a32d38', 2, 18, 6, 9);
    px(ctx, '#f2c735', 10, 8, 12, 4);
  }
  if (level >= 3 && !superCat) {
    // Royal battle cape and cyan energy wings sit behind the body.
    px(ctx, outline, 3, 15, 7, 13); px(ctx, '#a92f4b', 4, 16, 6, 11); px(ctx, '#ee4f61', 5, 17, 3, 8);
    px(ctx, outline, 1, 17, 7, 7); px(ctx, '#55e6ef', 2, 18, 5, 5); px(ctx, '#e2ffff', 1, 19, 3, 2);
    px(ctx, outline, 24, 17, 7, 7); px(ctx, '#55e6ef', 25, 18, 5, 5); px(ctx, '#e2ffff', 28, 19, 3, 2);
  }
  // Tail and body.
  px(ctx, outline, 22, 17, 6, 10); px(ctx, fur, 23, 18, 4, 7); px(ctx, outline, 25, 14, 3, 5); px(ctx, fur, 25, 15, 2, 3);
  px(ctx, outline, 8, 14, 17, 14); px(ctx, fur, 9, 15, 15, 12); px(ctx, light, 12, 20, 9, 7);
  px(ctx, outline, 8, 5, 17, 15);
  // Ears.
  px(ctx, outline, 7, 3, 7, 8); px(ctx, outline, 19, 3, 7, 8);
  px(ctx, fur, 9, 5, 4, 7); px(ctx, fur, 20, 5, 4, 7);
  px(ctx, '#dc7f76', 10, 6, 2, 3); px(ctx, '#dc7f76', 21, 6, 2, 3);
  // Face.
  px(ctx, fur, 9, 8, 15, 11); px(ctx, light, 12, 14, 9, 5);
  px(ctx, outline, 11, 11, 3, 3); px(ctx, outline, 20, 11, 3, 3);
  px(ctx, '#ecf3c5', 12, 11, 1, 1); px(ctx, '#ecf3c5', 21, 11, 1, 1);
  px(ctx, dark, 16, 14, 2, 2); px(ctx, outline, 15, 17, 4, 1);
  // Feet.
  px(ctx, outline, 8, 26, 7, 3); px(ctx, outline, 19, 26, 7, 3); px(ctx, light, 10, 26, 4, 2); px(ctx, light, 20, 26, 4, 2);
  if (coat === 3) {
    px(ctx, '#d66d35', 9, 8, 5, 5); px(ctx, '#473b3a', 20, 9, 4, 4); px(ctx, '#d66d35', 10, 18, 5, 5);
    px(ctx, outline, 22, 18, 8, 8); px(ctx, '#df6ba8', 23, 19, 6, 6);
    px(ctx, '#ffb6dc', 24, 20, 2, 2); px(ctx, '#9a3f77', 27, 21, 2, 3); px(ctx, '#df6ba8', 29, 24, 3, 2);
  }
  if (coat === 4) {
    px(ctx, outline, 23, 17, 8, 10); px(ctx, '#5d496c', 24, 18, 6, 8); px(ctx, '#a784c1', 25, 19, 4, 2);
    px(ctx, '#f2c94c', 27, 14, 2, 4); px(ctx, '#ff7048', 28, 13, 2, 2);
  }
  if (coat === 5) {
    px(ctx, outline, 10, 1, 14, 6); px(ctx, '#60e6ed', 11, 2, 3, 4); px(ctx, '#f0a8ff', 15, 0, 4, 6); px(ctx, '#60e6ed', 20, 2, 3, 4);
    px(ctx, outline, 14, 20, 6, 6); px(ctx, '#79f5ff', 15, 21, 4, 4); px(ctx, '#fff', 16, 21, 2, 2);
  }
  // Level equipment is deliberately bold enough to read at board scale.
  if (level === 1 && coat <= 2) {
    px(ctx, outline, 14, 1, 6, 8); px(ctx, '#4b8790', 15, 2, 4, 6); px(ctx, '#d9f1d6', 16, 1, 2, 2);
  }
  if (level >= 2) {
    const armor = level >= 3 ? '#493f87' : '#557f96';
    const armorLight = level >= 3 ? '#9b86e8' : '#8eb8c6';
    const trim = level >= 3 ? '#ffd94f' : '#d7e5df';
    // Steel helmet with open face.
    px(ctx, outline, 9, 5, 15, 5); px(ctx, armor, 10, 5, 13, 4); px(ctx, armorLight, 12, 5, 7, 2);
    px(ctx, trim, 15, 6, 3, 3); px(ctx, outline, 8, 8, 4, 4); px(ctx, outline, 22, 8, 4, 4);
    // Shoulder pads and armored vest.
    px(ctx, outline, 5, 17, 7, 6); px(ctx, armor, 6, 18, 6, 4); px(ctx, trim, 7, 18, 3, 1);
    px(ctx, outline, 22, 17, 7, 6); px(ctx, armor, 22, 18, 6, 4); px(ctx, trim, 24, 18, 3, 1);
    px(ctx, outline, 10, 19, 14, 9); px(ctx, armor, 11, 20, 12, 7); px(ctx, armorLight, 12, 20, 10, 2);
    px(ctx, trim, 16, 21, 2, 5);
    // Upgraded barrel.
    px(ctx, outline, 13, 0, 8, 9); px(ctx, armor, 14, 1, 6, 7); px(ctx, trim, 15, 1, 4, 2); px(ctx, '#9ffcff', 16, 0, 2, 2);
  }
  if (level >= 3) {
    // Twin power pods, glowing plasma core, crown fins and oversized cannon.
    px(ctx, outline, 3, 10, 6, 9); px(ctx, '#493f87', 4, 11, 4, 7); px(ctx, '#55e6ef', 5, 12, 2, 4);
    px(ctx, outline, 25, 10, 6, 9); px(ctx, '#493f87', 26, 11, 4, 7); px(ctx, '#55e6ef', 27, 12, 2, 4);
    px(ctx, '#ffd94f', 9, 3, 3, 3); px(ctx, '#ffd94f', 22, 3, 3, 3); px(ctx, '#fff3a5', 10, 3, 1, 1); px(ctx, '#fff3a5', 23, 3, 1, 1);
    px(ctx, outline, 14, 20, 6, 6); px(ctx, '#55e6ef', 15, 21, 4, 4); px(ctx, '#e2ffff', 16, 21, 2, 2);
    px(ctx, outline, 12, 0, 10, 4); px(ctx, '#493f87', 13, 0, 8, 3); px(ctx, '#55e6ef', 15, 0, 4, 2);
  }
}

export function drawWorker(canvas, role = 'cook', level = 1) {
  const coat = { cook: 3, trader: 4, weaponsmith: 0, armourer: 1 }[role] ?? 3;
  drawCat(canvas, level, coat);
  const ctx = canvas.getContext('2d');
  const outline = '#172b36';
  if (role === 'cook') {
    px(ctx, outline, 7, 2, 20, 5); px(ctx, '#e7c35e', 8, 2, 18, 4);
    px(ctx, outline, 12, 0, 10, 4); px(ctx, '#f2d779', 13, 0, 8, 3);
    px(ctx, '#fff1ca', 11, 19, 12, 8); px(ctx, '#d84a45', 16, 19, 2, 8);
  } else if (role === 'trader') {
    px(ctx, outline, 9, 2, 16, 5); px(ctx, '#6d3f70', 10, 2, 14, 4);
    px(ctx, '#7e3850', 11, 18, 12, 9); px(ctx, '#f2cf4a', 16, 20, 2, 2);
    px(ctx, outline, 24, 20, 7, 8); px(ctx, '#b7793f', 25, 21, 5, 6); px(ctx, '#f4ca49', 27, 22, 2, 2);
  } else if (role === 'weaponsmith') {
    px(ctx, '#7a472e', 10, 18, 14, 10); px(ctx, '#c68242', 12, 19, 10, 7);
    px(ctx, outline, 25, 7, 3, 16); px(ctx, '#aeb8b9', 22, 5, 9, 5);
  } else {
    px(ctx, outline, 9, 8, 16, 4); px(ctx, '#79d7e5', 10, 9, 6, 2); px(ctx, '#79d7e5', 18, 9, 6, 2);
    px(ctx, '#66727a', 10, 18, 14, 10); px(ctx, '#b9c4c5', 12, 19, 10, 3);
  }
}

export function drawStation(canvas, role = 'cook') {
  const ctx = prepare(canvas);
  const outline = '#172b36';
  px(ctx, '#a87b52', 0, 23, 32, 9); px(ctx, '#714832', 0, 28, 32, 4);
  if (role === 'cook') {
    px(ctx, '#d84a45', 10, 20, 4, 7); px(ctx, '#ff9e3d', 14, 17, 5, 10); px(ctx, '#ffe05b', 17, 21, 4, 6);
    px(ctx, outline, 8, 9, 17, 10); px(ctx, '#4f5860', 9, 10, 15, 8); px(ctx, '#89959a', 11, 10, 11, 3);
  } else if (role === 'trader') {
    px(ctx, outline, 4, 8, 24, 17); px(ctx, '#b96f42', 5, 9, 22, 15); px(ctx, '#f3d27b', 7, 11, 18, 5);
    px(ctx, '#d84a45', 3, 4, 26, 6); px(ctx, '#f2cf4a', 13, 17, 6, 6);
  } else if (role === 'weaponsmith') {
    px(ctx, outline, 4, 7, 4, 19); px(ctx, outline, 24, 6, 4, 20);
    px(ctx, '#cbd2d0', 10, 5, 4, 19); px(ctx, '#d5a544', 17, 8, 3, 16);
  } else {
    px(ctx, outline, 7, 17, 19, 8); px(ctx, '#697982', 8, 18, 17, 6);
    px(ctx, outline, 12, 8, 9, 10); px(ctx, '#8d9ba0', 13, 9, 7, 8); px(ctx, outline, 14, 25, 5, 6);
  }
}

export function drawItem(canvas, kind = 'food', tier = 1) {
  const ctx = prepare(canvas);
  const outline = '#172b36';
  if (kind === 'food') {
    px(ctx, outline, 8, 9, 17, 18); px(ctx, '#dc4f46', 9, 10, 15, 16); px(ctx, '#f27a58', 11, 11, 5, 10);
    px(ctx, '#5b8f45', 17, 4, 9, 7); px(ctx, '#69452e', 15, 5, 3, 7);
  } else if (kind === 'coins') {
    for (let row = 0; row < 3; row += 1) {
      px(ctx, outline, 7 + row * 2, 18 - row * 5, 19 - row * 4, 6);
      px(ctx, '#f2c735', 8 + row * 2, 19 - row * 5, 17 - row * 4, 4);
    }
  } else if (kind === 'weapon') {
    const metal = ['#9aa9ad', '#73c6d6', '#c98be3'][Math.max(0, Math.min(2, tier - 1))];
    px(ctx, outline, 14, 3, 7, 20); px(ctx, metal, 16, 4, 3, 17);
    px(ctx, outline, 8, 20, 17, 5); px(ctx, '#f2cf4a', 10, 21, 13, 3); px(ctx, outline, 15, 24, 5, 7);
  } else {
    const metal = ['#71868d', '#4f91a8', '#8d69c7'][Math.max(0, Math.min(2, tier - 1))];
    px(ctx, outline, 7, 6, 19, 22); px(ctx, metal, 8, 7, 17, 19); px(ctx, '#c8d7d6', 11, 8, 11, 4);
    px(ctx, outline, 14, 12, 5, 12); px(ctx, '#f2cf4a', 15, 13, 3, 10);
  }
}

export function drawDog(canvas, tier = 1) {
  const ctx = prepare(canvas);
  const outline = '#172b36';
  const dogCoats = {
    1: ['#9c613b', '#dcaa6d', '#623a2c'],
    2: ['#66727a', '#aeb8b9', '#38444d'],
    3: ['#75483d', '#c18462', '#422b2b'],
    4: ['#732f46', '#cf6a6c', '#351e35'],
  };
  const [fur, light, dark] = dogCoats[tier] ?? dogCoats[1];
  // Body and tail.
  px(ctx, outline, 7, 14, 19, 13); px(ctx, fur, 8, 15, 17, 11);
  px(ctx, outline, 24, 12, 6, 5); px(ctx, fur, 24, 13, 4, 3);
  // Head and floppy ears.
  px(ctx, outline, 8, 5, 17, 15); px(ctx, fur, 9, 6, 15, 13);
  px(ctx, outline, 5, 6, 7, 12); px(ctx, dark, 6, 7, 5, 10);
  px(ctx, outline, 22, 6, 6, 12); px(ctx, dark, 23, 7, 4, 10);
  // Muzzle.
  px(ctx, light, 11, 13, 12, 7); px(ctx, outline, 15, 13, 5, 4); px(ctx, '#f4d1b3', 16, 13, 2, 1);
  px(ctx, outline, 12, 10, 3, 3); px(ctx, outline, 21, 10, 3, 3);
  px(ctx, '#eef0c2', 13, 10, 1, 1); px(ctx, '#eef0c2', 22, 10, 1, 1);
  px(ctx, outline, 14, 19, 8, 2); px(ctx, '#f2eee0', 15, 19, 2, 2); px(ctx, '#f2eee0', 19, 19, 2, 2);
  // Legs.
  px(ctx, outline, 8, 25, 7, 4); px(ctx, outline, 20, 25, 7, 4); px(ctx, dark, 9, 26, 5, 2); px(ctx, dark, 21, 26, 5, 2);
  if (tier >= 2) {
    px(ctx, outline, 8, 4, 17, 6); px(ctx, '#758893', 9, 4, 15, 5); px(ctx, '#b8cbd0', 12, 4, 8, 2);
    px(ctx, '#d84a45', 8, 20, 17, 3); px(ctx, '#f0c948', 15, 20, 3, 4);
  }
  if (tier >= 3) {
    px(ctx, outline, 4, 16, 8, 8); px(ctx, '#8e604f', 5, 17, 7, 6);
    px(ctx, outline, 22, 16, 8, 8); px(ctx, '#8e604f', 22, 17, 7, 6);
  }
  if (tier >= 4) {
    px(ctx, outline, 8, 14, 18, 13); px(ctx, '#623f78', 9, 15, 16, 11); px(ctx, '#d85c75', 11, 16, 12, 3);
    px(ctx, '#f2cf4a', 9, 1, 4, 5); px(ctx, '#f2cf4a', 15, 0, 4, 6); px(ctx, '#f2cf4a', 21, 1, 4, 5);
    px(ctx, '#fff0a1', 16, 1, 2, 2);
  }
}

export function drawBackyard(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const w = canvas.width;
  const h = canvas.height;
  px(ctx, '#79a950', 0, 0, w, h);
  // Quiet checker-grass texture.
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      px(ctx, (row + col) % 2 ? '#77a64e' : '#82ad55', col * 32, row * 32, 32, 32);
      const seed = row * 7 + col * 13;
      px(ctx, '#629246', col * 32 + 5 + (seed % 17), row * 32 + 8 + (seed % 11), 2, 4);
      px(ctx, '#94bc63', col * 32 + 20 - (seed % 7), row * 32 + 21, 1, 3);
    }
  }
  // Back fence.
  px(ctx, '#5b3d31', 0, 0, w, 5);
  for (let x = 0; x < w; x += 16) {
    px(ctx, '#7a5238', x, 2, 14, 23);
    px(ctx, '#a7764b', x + 2, 4, 10, 18);
    px(ctx, '#c18b57', x + 3, 5, 2, 15);
    px(ctx, '#4b352e', x + 13, 2, 3, 23);
  }
  px(ctx, '#5b3d31', 0, 20, w, 4);
  // Neutral paving strip immediately above cat territory.
  const neutralY = (CAT_ZONE_START - 1) * 32;
  px(ctx, '#648f49', 0, neutralY, w, 32);
  for (let x = 8; x < w; x += 32) {
    px(ctx, '#b9ad87', x, neutralY + 11, 17, 9);
    px(ctx, '#d4c69a', x + 2, neutralY + 12, 13, 6);
  }
  // Small, sparse flower details.
  [[8,70],[w-14,101],[17,205],[w-18,301],[50,380],[w-50,420]].forEach(([x,y], i) => {
    px(ctx, '#3f763f', x, y + 2, 1, 5);
    px(ctx, i % 2 ? '#f4c95c' : '#e87a70', x - 2, y, 5, 3);
    px(ctx, '#fff0a8', x, y, 1, 1);
  });
  // Porch at bottom.
  const porchY = h - 12;
  px(ctx, '#59413a', 0, porchY, w, 12);
  for (let x = 0; x < w; x += 20) {
    px(ctx, '#8c6250', x, porchY + 1, 18, 10);
    px(ctx, '#b17c5d', x + 2, porchY + 2, 14, 2);
  }
}
