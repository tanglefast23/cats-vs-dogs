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

export function drawCat(canvas, level = 1, coat = 0, superCat = false) {
  const ctx = prepare(canvas);
  const coats = [
    ['#e9963f', '#ffd18a', '#9c4d2e'],
    ['#71868d', '#cdd9d5', '#3e5159'],
    ['#f0e1bc', '#fff7df', '#9a7759'],
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
  // Level equipment is deliberately bold enough to read at board scale.
  if (level === 1) {
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

export function drawDog(canvas, tier = 1) {
  const ctx = prepare(canvas);
  const outline = '#172b36';
  const fur = tier === 1 ? '#9c613b' : '#5f4a46';
  const light = tier === 1 ? '#dcaa6d' : '#a58879';
  const dark = tier === 1 ? '#623a2c' : '#382e35';
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
  if (tier >= 2) { px(ctx, '#d84a45', 8, 20, 17, 3); px(ctx, '#f0c948', 13, 21, 3, 3); }
  if (tier >= 3) { px(ctx, '#d9d5c6', 5, 3, 4, 4); px(ctx, '#d9d5c6', 25, 3, 4, 4); }
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
