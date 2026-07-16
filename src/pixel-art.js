import { ROWS, COLS } from './game-engine.js';

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

const OUTLINE = '#172b36';

export const CAT_EQUIPMENT = {
  1: [],
  2: ['skyguard-helmet', 'cobalt-chest-armor', 'cyan-shoulder-pads'],
  3: ['royal-helmet', 'magenta-chest-armor', 'crown-pads', 'battle-cape', 'plasma-core', 'power-cannon', 'energy-wings'],
};

// A cat keeps its role silhouette and coat at every level, while the equipment
// color and outline change enough to identify its level without a text badge.
export const CAT_LEVEL_STYLES = {
  1: Object.freeze({ name: 'house colors', colors: ['natural-coat', 'signature-prop'], markers: ['open-head', 'unarmored-body'] }),
  2: Object.freeze({ name: 'skyguard armor', colors: ['cobalt', 'cyan', 'ivory'], markers: ['cyan-crested-helmet', 'cobalt-vest', 'shoulder-pads'] }),
  3: Object.freeze({ name: 'royal power armor', colors: ['magenta', 'gold', 'energy-cyan'], markers: ['crown-fins', 'battle-cape', 'plasma-core', 'power-cannon', 'energy-wings'] }),
};

export const CAT_ARCHETYPE_MARKERS = {
  3: ['calico-patches', 'yarn-ball'],
  4: ['black-coat', 'bomb-pack'],
  5: ['prism-coat', 'crystal-crown'],
  6: ['ice-coat', 'frost-staff'],
  7: ['rift-cloak', 'portal-rings'],
  8: ['mirage-mask', 'phantom-double'],
  9: ['storm-coat', 'lightning-rod'],
  10: ['maestro-coat', 'conductor-baton'],
};

// Every battle cat gets its own silhouette matched to its combat role:
// the melee tank is a wide bruiser, the casters are thin and frail.
export const CAT_BODY_BUILDS = {
  0: 'gunslinger',
  1: 'bruiser',
  2: 'slinky',
  3: 'kitten',
  4: 'saboteur',
  5: 'sleek-tech',
  6: 'robed-mystic',
  7: 'hooded-phantom',
  8: 'showman',
  9: 'stormcaller',
  10: 'maestro',
};

export const DOG_TIER_MARKERS = {
  1: ['amber-leather-collar', 'round-tag'],
  2: ['blue-steel-helmet', 'cyan-crest', 'blue-collar'],
  3: ['bronze-helmet', 'gold-crest', 'crimson-collar', 'spiked-bruiser-plates'],
  4: ['obsidian-helmet', 'magenta-collar', 'alpha-armor', 'gold-crown'],
};

export const DOG_TIER_STYLES = {
  1: Object.freeze({ name: 'yard punk', colors: ['warm-brown', 'amber-leather', 'gold-tag'] }),
  2: Object.freeze({ name: 'ironhide', colors: ['slate-fur', 'blue-steel', 'ice-cyan'] }),
  3: Object.freeze({ name: 'bonecrusher', colors: ['umber-fur', 'burnished-bronze', 'crimson', 'gold'] }),
  4: Object.freeze({ name: 'top dog', colors: ['wine-fur', 'obsidian', 'royal-magenta', 'crown-gold'] }),
};

export const DOG_ROLE_MARKERS = {
  scruffy: ['plain-collar'],
  frisbee: ['blue-frisbee', 'flight-goggles'],
  tennis: ['visor', 'tennis-ball'],
  howler: ['sound-cone', 'purple-bandana'],
  lobber: ['bone-cannon', 'ammo-pack'],
  jumper: ['spring-boots', 'red-cape'],
  skittish: ['shaking-knees', 'security-blanket'],
  medic: ['medic-cap', 'heart-pack'],
  growler: ['megaphone', 'spiked-collar'],
};

// Dog silhouettes follow their battlefield role too.
export const DOG_BODY_BUILDS = {
  scruffy: 'mutt',
  frisbee: 'disc-retriever',
  tennis: 'athlete',
  howler: 'crooner',
  lobber: 'artillery-dachshund',
  jumper: 'springer',
  skittish: 'trembling-chihuahua',
  medic: 'saint-bernard-medic',
  growler: 'corgi-intimidator',
};

export const WORKER_ART_MARKERS = {
  cook: ['straw-hat', 'apron', 'spoon'],
  trader: ['waistcoat', 'coin-purse', 'merchant-hat'],
  weaponsmith: ['leather-apron', 'hammer', 'anvil'],
  armourer: ['goggles', 'heavy-gloves', 'anvil'],
};

export const ITEM_ART_MARKERS = {
  food: ['apple', 'leaf'],
  coins: ['gold-stack', 'shine'],
  weapon: ['blade', 'tier-trim'],
  armour: ['breastplate', 'tier-trim'],
};

const COAT_PALETTES = [
  ['#e9963f', '#ffd18a', '#9c4d2e'],
  ['#71868d', '#cdd9d5', '#3e5159'],
  ['#f0e1bc', '#fff7df', '#9a7759'],
  ['#f2d7a7', '#fff0ce', '#a84f35'],
  ['#2f3540', '#697482', '#151923'],
  ['#9f71d8', '#d9c7ff', '#593c91'],
  ['#8fd3e8', '#e5fbff', '#3f7f9f'],
  ['#6044a5', '#b9a7ff', '#2a205f'],
  ['#dca4e8', '#fff0ff', '#79528f'],
  ['#536675', '#a8c7d4', '#252f3a'],
  ['#b8444c', '#f1c083', '#632733'],
];

// Anchor points for the shared level gear so armor fits every silhouette:
// helm [x,y,w] hugs the head, vest [x,y,w,h] wraps the torso, pads sit on
// the shoulders. Null side slots skip a piece where a signature prop lives.
const CAT_GEOM = {
  0: { helm: [10, 5, 13], padL: [5, 17], padR: [22, 17], vest: [10, 19, 14, 9], barrel: [13, 0], cannon: [12, 0], podL: [3, 10], podR: [25, 10], core: [14, 20], cape: [3, 15], wingL: [1, 17], wingR: [24, 17] },
  1: { helm: [9, 1, 15], padL: [1, 12], padR: [24, 12], vest: [10, 16, 13, 10], barrel: [1, 2], cannon: [0, 1], podL: null, podR: [25, 2], core: [13, 18], cape: [0, 12], wingL: [0, 4], wingR: [25, 4] },
  2: { helm: [11, 3, 11], padL: [6, 11], padR: [20, 11], vest: [11, 13, 11, 9], barrel: [12, 0], cannon: [11, 0], podL: [3, 10], podR: [26, 22], core: [13, 15], cape: [4, 14], wingL: [1, 16], wingR: [25, 16] },
  3: { helm: [8, 4, 15], padL: [4, 16], padR: [18, 16], vest: [10, 18, 11, 8], barrel: [12, 0], cannon: [11, 0], podL: [2, 8], podR: null, core: [13, 19], cape: [2, 14], wingL: [1, 14], wingR: [25, 8] },
  4: { helm: [4, 7, 14], padL: [2, 15], padR: [18, 15], vest: [7, 18, 12, 8], barrel: [5, 0], cannon: [4, 0], podL: null, podR: null, core: [11, 19], cape: [0, 12], wingL: [0, 9], wingR: [26, 7] },
  5: { helm: [10, 5, 13], padL: [6, 16], padR: [20, 16], vest: [11, 17, 11, 9], barrel: [12, 0], cannon: [11, 0], podL: [3, 9], podR: [26, 3], core: [14, 20], cape: [3, 14], wingL: [1, 16], wingR: [25, 17] },
  6: { helm: [11, 2, 11], padL: [7, 15], padR: [20, 15], vest: [11, 18, 11, 8], barrel: [12, 0], cannon: [11, 0], podL: null, podR: [24, 8], core: [13, 19], cape: [23, 15], wingL: [0, 17], wingR: [25, 3] },
  7: { helm: [11, 3, 11], padL: [6, 14], padR: [20, 14], vest: [11, 15, 11, 8], barrel: [12, 0], cannon: [11, 0], podL: [4, 1], podR: [25, 1], core: [13, 16], cape: [2, 14], wingL: [0, 4], wingR: [26, 4] },
  8: { helm: [10, 4, 13], padL: [6, 15], padR: [19, 15], vest: [12, 16, 10, 9], barrel: [12, 0], cannon: [11, 0], podL: [1, 0], podR: [26, 21], core: [13, 17], cape: [1, 14], wingL: [0, 6], wingR: [25, 6] },
  9: { helm: [10, 5, 12], padL: [7, 16], padR: [18, 16], vest: [12, 18, 9, 8], barrel: [11, 0], cannon: [10, 0], podL: [1, 8], podR: null, core: [13, 19], cape: [1, 15], wingL: [0, 3], wingR: [23, 18] },
  10: { helm: [10, 1, 13], padL: [5, 16], padR: [19, 16], vest: [11, 18, 12, 8], barrel: [12, 0], cannon: [11, 0], podL: [2, 8], podR: null, core: [13, 19], cape: [1, 14], wingL: [0, 16], wingR: [25, 16] },
};

// The neutral house-cat frame — Purrcy's base and every worker's body.
function standardCatBody(ctx, fur, light, dark) {
  // Tail and body.
  px(ctx, OUTLINE, 22, 17, 6, 10); px(ctx, fur, 23, 18, 4, 7); px(ctx, OUTLINE, 25, 14, 3, 5); px(ctx, fur, 25, 15, 2, 3);
  px(ctx, OUTLINE, 8, 14, 17, 14); px(ctx, fur, 9, 15, 15, 12); px(ctx, light, 12, 20, 9, 7);
  px(ctx, OUTLINE, 8, 5, 17, 15);
  // Ears.
  px(ctx, OUTLINE, 7, 3, 7, 8); px(ctx, OUTLINE, 19, 3, 7, 8);
  px(ctx, fur, 9, 5, 4, 7); px(ctx, fur, 20, 5, 4, 7);
  px(ctx, '#dc7f76', 10, 6, 2, 3); px(ctx, '#dc7f76', 21, 6, 2, 3);
  // Face.
  px(ctx, fur, 9, 8, 15, 11); px(ctx, light, 12, 14, 9, 5);
  px(ctx, OUTLINE, 11, 11, 3, 3); px(ctx, OUTLINE, 20, 11, 3, 3);
  px(ctx, '#ecf3c5', 12, 11, 1, 1); px(ctx, '#ecf3c5', 21, 11, 1, 1);
  px(ctx, dark, 16, 14, 2, 2); px(ctx, OUTLINE, 15, 17, 4, 1);
  // Feet.
  px(ctx, OUTLINE, 8, 26, 7, 3); px(ctx, OUTLINE, 19, 26, 7, 3); px(ctx, light, 10, 26, 4, 2); px(ctx, light, 20, 26, 4, 2);
}

const CAT_BODIES = {
  // Purrcy Pew-Pew — eager gunslinger tabby with a triple-barrel pop-gun.
  0: (ctx, [fur, light, dark], level) => {
    standardCatBody(ctx, fur, light, dark);
    // Tabby stripes on brow, back and tail.
    px(ctx, dark, 14, 8, 1, 2); px(ctx, dark, 16, 8, 1, 3); px(ctx, dark, 18, 8, 1, 2);
    px(ctx, dark, 17, 16, 4, 1); px(ctx, dark, 16, 18, 4, 1);
    px(ctx, dark, 23, 20, 4, 1); px(ctx, dark, 23, 23, 4, 1);
    if (level === 1) {
      // Three barrels for the three-shot column burst.
      px(ctx, OUTLINE, 13, 1, 8, 8); px(ctx, '#4b8790', 14, 2, 6, 6);
      px(ctx, '#d9f1d6', 14, 2, 1, 4); px(ctx, '#d9f1d6', 16, 2, 1, 4); px(ctx, '#d9f1d6', 18, 2, 1, 4);
    }
  },
  // Clawdius — the melee wall: a slab of muscle with fists, scars and fangs.
  1: (ctx, [fur, light, dark]) => {
    // Stub tail off a torso that nearly fills the tile.
    px(ctx, OUTLINE, 28, 15, 4, 6); px(ctx, fur, 29, 16, 2, 4);
    px(ctx, OUTLINE, 2, 11, 28, 17); px(ctx, fur, 3, 12, 26, 15);
    // Gorilla-stance forelegs ending in oversized fists.
    px(ctx, OUTLINE, 1, 14, 8, 12); px(ctx, fur, 2, 15, 6, 10); px(ctx, light, 2, 21, 6, 3);
    px(ctx, OUTLINE, 23, 14, 8, 12); px(ctx, fur, 24, 15, 6, 10); px(ctx, light, 24, 21, 6, 3);
    // Head sunk into the shoulders, tiny ears, one heavy brow.
    px(ctx, OUTLINE, 8, 1, 17, 13); px(ctx, fur, 9, 2, 15, 11);
    px(ctx, OUTLINE, 8, 0, 5, 4); px(ctx, fur, 9, 1, 3, 2);
    px(ctx, OUTLINE, 20, 0, 5, 4); px(ctx, fur, 21, 1, 3, 2);
    px(ctx, OUTLINE, 10, 4, 13, 2);
    px(ctx, OUTLINE, 11, 6, 3, 2); px(ctx, '#ecf3c5', 12, 6, 1, 1);
    px(ctx, OUTLINE, 19, 6, 3, 2); px(ctx, '#ecf3c5', 20, 6, 1, 1);
    // Grim jaw with fangs, plus a scar across the right brow.
    px(ctx, light, 11, 8, 11, 5); px(ctx, dark, 15, 8, 3, 2); px(ctx, OUTLINE, 13, 11, 7, 1);
    px(ctx, '#f2eee0', 12, 11, 2, 2); px(ctx, '#f2eee0', 19, 11, 2, 2);
    px(ctx, light, 21, 3, 1, 1); px(ctx, light, 22, 4, 1, 1); px(ctx, light, 23, 5, 1, 1);
    // Chest fur crossed by an old X-shaped battle scar.
    px(ctx, light, 12, 16, 9, 8);
    px(ctx, dark, 14, 18, 1, 1); px(ctx, dark, 16, 18, 1, 1); px(ctx, dark, 15, 19, 1, 1);
    px(ctx, dark, 14, 20, 1, 1); px(ctx, dark, 16, 20, 1, 1);
    // Feet.
    px(ctx, OUTLINE, 6, 27, 8, 3); px(ctx, OUTLINE, 18, 27, 8, 3);
    px(ctx, light, 8, 28, 4, 2); px(ctx, light, 20, 28, 4, 2);
  },
  // Hissiletoe — slim and elegant, plumed S-curve tail, prim little smile.
  2: (ctx, [fur, light, dark]) => {
    // Thick plumed S-curve tail rising behind the head.
    px(ctx, OUTLINE, 24, 14, 4, 8); px(ctx, fur, 25, 15, 2, 6);
    px(ctx, OUTLINE, 22, 4, 4, 11); px(ctx, fur, 23, 5, 2, 9);
    px(ctx, OUTLINE, 23, 0, 5, 4); px(ctx, light, 24, 1, 3, 2);
    // Slim upright haunch and narrow chest with a fluffy tuft.
    px(ctx, OUTLINE, 9, 20, 15, 8); px(ctx, fur, 10, 21, 13, 6);
    px(ctx, OUTLINE, 11, 10, 11, 12); px(ctx, fur, 12, 11, 9, 10);
    px(ctx, light, 13, 16, 7, 5); px(ctx, light, 12, 17, 1, 1); px(ctx, light, 20, 17, 1, 1);
    // Refined head with wide-set pointed ears.
    px(ctx, OUTLINE, 10, 3, 13, 11); px(ctx, fur, 11, 4, 11, 9);
    px(ctx, OUTLINE, 9, 1, 5, 4); px(ctx, fur, 10, 2, 3, 2); px(ctx, '#dc7f76', 11, 2, 1, 2);
    px(ctx, OUTLINE, 19, 1, 5, 4); px(ctx, fur, 20, 2, 3, 2); px(ctx, '#dc7f76', 21, 2, 1, 2);
    // Soft lashed eyes, prim smile.
    px(ctx, OUTLINE, 13, 7, 2, 2); px(ctx, '#ecf3c5', 13, 7, 1, 1); px(ctx, OUTLINE, 12, 6, 1, 1);
    px(ctx, OUTLINE, 18, 7, 2, 2); px(ctx, '#ecf3c5', 18, 7, 1, 1); px(ctx, OUTLINE, 21, 6, 1, 1);
    px(ctx, light, 14, 9, 5, 4); px(ctx, dark, 16, 10, 1, 1);
    px(ctx, OUTLINE, 15, 12, 3, 1); px(ctx, OUTLINE, 14, 11, 1, 1); px(ctx, OUTLINE, 18, 11, 1, 1);
    // Neat front paws.
    px(ctx, OUTLINE, 12, 26, 4, 3); px(ctx, OUTLINE, 17, 26, 4, 3);
    px(ctx, light, 13, 27, 2, 1); px(ctx, light, 18, 27, 2, 1);
  },
  // Knotty Kitty — tiny round-headed kitten, folded ear, yarn ball in tow.
  3: (ctx, [fur, light, dark]) => {
    // Upright kitten tail with an orange ring.
    px(ctx, OUTLINE, 21, 10, 4, 9); px(ctx, fur, 22, 11, 2, 7); px(ctx, '#d66d35', 22, 13, 2, 2);
    // Small round body with calico patches.
    px(ctx, OUTLINE, 9, 17, 13, 10); px(ctx, fur, 10, 18, 11, 8); px(ctx, light, 12, 20, 7, 5);
    px(ctx, '#d66d35', 10, 19, 3, 3); px(ctx, '#473b3a', 18, 21, 3, 3);
    // Oversized head; the left ear is folded over.
    px(ctx, OUTLINE, 7, 4, 17, 14); px(ctx, fur, 8, 5, 15, 12);
    px(ctx, OUTLINE, 6, 2, 6, 5); px(ctx, fur, 7, 3, 4, 2); px(ctx, dark, 7, 5, 4, 2);
    px(ctx, OUTLINE, 19, 1, 6, 7); px(ctx, fur, 20, 2, 4, 5); px(ctx, '#dc7f76', 21, 3, 2, 2);
    px(ctx, '#d66d35', 8, 5, 5, 4); px(ctx, '#473b3a', 18, 6, 5, 3);
    // Huge sparkly kitten eyes and a :3 mouth.
    px(ctx, OUTLINE, 9, 9, 4, 4); px(ctx, '#ecf3c5', 10, 10, 2, 2); px(ctx, '#fff', 10, 10, 1, 1);
    px(ctx, OUTLINE, 18, 9, 4, 4); px(ctx, '#ecf3c5', 19, 10, 2, 2); px(ctx, '#fff', 19, 10, 1, 1);
    px(ctx, light, 12, 13, 8, 4); px(ctx, '#dc7f76', 15, 13, 2, 1);
    px(ctx, OUTLINE, 13, 15, 2, 1); px(ctx, OUTLINE, 17, 15, 2, 1);
    // Stubby legs.
    px(ctx, OUTLINE, 9, 26, 5, 3); px(ctx, OUTLINE, 16, 26, 5, 3);
    px(ctx, light, 10, 27, 3, 1); px(ctx, light, 17, 27, 3, 1);
    // Yarn ball with a strand looping to the paw.
    px(ctx, OUTLINE, 23, 19, 8, 9); px(ctx, '#df6ba8', 24, 20, 6, 7);
    px(ctx, '#ffb6dc', 25, 21, 2, 2); px(ctx, '#9a3f77', 27, 23, 2, 3);
    px(ctx, '#df6ba8', 21, 26, 3, 1); px(ctx, '#df6ba8', 19, 27, 3, 1);
  },
  // Bombay Boom — wiry saboteur prowling low with a lit bomb on his back.
  4: (ctx, [fur, light, dark]) => {
    // Kinked wiry tail.
    px(ctx, OUTLINE, 26, 19, 3, 4); px(ctx, OUTLINE, 28, 15, 3, 5);
    px(ctx, fur, 27, 20, 1, 2); px(ctx, fur, 29, 16, 1, 3);
    // Long low prowling body with soot smudges.
    px(ctx, OUTLINE, 5, 16, 21, 11); px(ctx, fur, 6, 17, 19, 9);
    px(ctx, light, 10, 20, 2, 1); px(ctx, light, 15, 22, 2, 1);
    // Bomb satchel strapped across the back, fuse lit.
    px(ctx, OUTLINE, 20, 9, 10, 10); px(ctx, '#232c3d', 21, 10, 8, 8);
    px(ctx, '#697482', 23, 10, 4, 1); px(ctx, light, 22, 11, 3, 2);
    px(ctx, OUTLINE, 24, 7, 1, 3); px(ctx, '#f2c94c', 23, 4, 2, 3); px(ctx, '#ff7048', 25, 3, 2, 2);
    px(ctx, '#5d496c', 18, 16, 2, 1); px(ctx, '#5d496c', 16, 17, 2, 1); px(ctx, '#5d496c', 14, 18, 2, 1);
    // Head slung low and forward with swept-back ears.
    px(ctx, OUTLINE, 3, 7, 16, 13); px(ctx, fur, 4, 8, 14, 11);
    px(ctx, OUTLINE, 2, 4, 5, 7); px(ctx, fur, 3, 5, 3, 4);
    px(ctx, OUTLINE, 13, 3, 6, 8); px(ctx, fur, 14, 4, 4, 5);
    // Sly slit eyes, smug grin, singed whisker tips.
    px(ctx, OUTLINE, 6, 11, 4, 2); px(ctx, '#cfe97a', 7, 11, 2, 1);
    px(ctx, OUTLINE, 13, 11, 4, 2); px(ctx, '#cfe97a', 14, 11, 2, 1);
    px(ctx, light, 6, 14, 9, 4); px(ctx, dark, 9, 15, 2, 1);
    px(ctx, OUTLINE, 7, 17, 6, 1); px(ctx, OUTLINE, 13, 16, 1, 1);
    px(ctx, '#f59d37', 2, 13, 2, 1); px(ctx, '#f59d37', 17, 12, 2, 1);
    // Crouched paws.
    px(ctx, OUTLINE, 4, 25, 6, 3); px(ctx, OUTLINE, 12, 25, 5, 3); px(ctx, OUTLINE, 20, 25, 6, 3);
    px(ctx, light, 5, 26, 3, 1); px(ctx, light, 13, 26, 2, 1); px(ctx, light, 21, 26, 3, 1);
  },
  // Laserpaw — sleek earless tech cat: crystal crown, targeting visor, glow tail.
  5: (ctx, [fur, light, dark]) => {
    // Glow-tipped tech tail.
    px(ctx, OUTLINE, 22, 15, 3, 11); px(ctx, fur, 23, 16, 1, 9); px(ctx, '#79f5ff', 22, 12, 3, 3);
    // Narrow smooth body — wide head over slim chassis reads futuristic.
    px(ctx, OUTLINE, 11, 16, 11, 12); px(ctx, fur, 12, 17, 9, 10);
    px(ctx, light, 14, 18, 5, 1);
    px(ctx, OUTLINE, 14, 20, 6, 6); px(ctx, '#79f5ff', 15, 21, 4, 4); px(ctx, '#fff', 16, 21, 2, 2);
    // Rounded head under a floating crystal crown.
    px(ctx, OUTLINE, 9, 5, 15, 12); px(ctx, fur, 10, 6, 13, 10);
    px(ctx, OUTLINE, 11, 1, 12, 6); px(ctx, '#60e6ed', 12, 2, 3, 4); px(ctx, '#f0a8ff', 15, 0, 4, 6); px(ctx, '#60e6ed', 19, 2, 3, 4);
    // Cyan targeting visor with a scanline.
    px(ctx, OUTLINE, 9, 9, 15, 5); px(ctx, '#60e6ed', 10, 10, 13, 3); px(ctx, '#fff', 11, 11, 6, 1); px(ctx, '#dfffff', 20, 10, 2, 1);
    // Calm chin below the visor.
    px(ctx, light, 13, 14, 7, 2); px(ctx, dark, 16, 14, 1, 1); px(ctx, OUTLINE, 15, 15, 3, 1);
    // Feet.
    px(ctx, OUTLINE, 11, 26, 4, 3); px(ctx, OUTLINE, 18, 26, 4, 3);
    px(ctx, light, 12, 27, 2, 1); px(ctx, light, 19, 27, 2, 1);
  },
  // Frosty Paws — frail robed mystic with a slouchy hat and planted frost staff.
  6: (ctx, [fur, light, dark]) => {
    // Frost staff planted at the left.
    px(ctx, OUTLINE, 3, 7, 3, 21); px(ctx, '#8eefff', 4, 8, 1, 19);
    px(ctx, OUTLINE, 1, 3, 7, 7); px(ctx, '#dfffff', 2, 4, 5, 5); px(ctx, '#65cce8', 4, 1, 2, 11); px(ctx, '#dfffff', 1, 6, 8, 2);
    // Narrow-shouldered robe flaring at the hem, snowflake embroidery.
    px(ctx, OUTLINE, 10, 16, 13, 12); px(ctx, fur, 11, 17, 11, 9);
    px(ctx, OUTLINE, 8, 24, 2, 4); px(ctx, fur, 9, 25, 1, 2);
    px(ctx, OUTLINE, 23, 24, 2, 4); px(ctx, fur, 23, 25, 1, 2);
    px(ctx, dark, 11, 25, 11, 2); px(ctx, light, 12, 20, 9, 1);
    px(ctx, '#fff', 16, 21, 1, 3); px(ctx, '#fff', 15, 22, 3, 1);
    // Tiny feet peeking under the robe.
    px(ctx, OUTLINE, 12, 28, 3, 2); px(ctx, OUTLINE, 18, 28, 3, 2);
    // Small tired head wrapped in a scarf.
    px(ctx, OUTLINE, 11, 7, 11, 10); px(ctx, fur, 12, 8, 9, 8);
    px(ctx, light, 11, 15, 11, 2); px(ctx, light, 19, 17, 2, 3);
    // Slouched wizard hat with a flopped tip and a tiny star.
    px(ctx, OUTLINE, 10, 2, 13, 6); px(ctx, dark, 11, 3, 11, 4); px(ctx, '#fff', 14, 4, 1, 1);
    px(ctx, OUTLINE, 7, 4, 4, 4); px(ctx, dark, 8, 5, 2, 2); px(ctx, '#dfffff', 11, 6, 11, 1);
    // Gentle tired eyes.
    px(ctx, OUTLINE, 13, 10, 2, 2); px(ctx, OUTLINE, 18, 10, 2, 2);
    px(ctx, light, 14, 12, 5, 3); px(ctx, dark, 16, 12, 1, 1); px(ctx, OUTLINE, 15, 14, 2, 1);
  },
  // Purrtal — levitating hooded phantom; glowing eyes, hem dissolving to motes.
  7: (ctx, [fur, light, dark]) => {
    // Floating cloak with no feet — the hem breaks into drifting motes.
    px(ctx, OUTLINE, 10, 13, 13, 11); px(ctx, fur, 11, 14, 11, 9);
    px(ctx, fur, 11, 25, 3, 2); px(ctx, fur, 18, 25, 3, 2); px(ctx, fur, 14, 28, 3, 2);
    // Rune circle glowing on the chest.
    px(ctx, '#5ff4ef', 15, 16, 3, 1); px(ctx, '#5ff4ef', 14, 17, 1, 2); px(ctx, '#5ff4ef', 18, 17, 1, 2); px(ctx, '#5ff4ef', 15, 19, 3, 1);
    // Peaked, cat-eared hood shadowing the face; only the eyes glow out.
    px(ctx, OUTLINE, 10, 3, 13, 11); px(ctx, fur, 11, 4, 11, 4);
    px(ctx, OUTLINE, 14, 0, 5, 4); px(ctx, fur, 15, 1, 3, 2);
    px(ctx, OUTLINE, 9, 2, 3, 4); px(ctx, fur, 10, 3, 1, 2);
    px(ctx, OUTLINE, 21, 2, 3, 4); px(ctx, fur, 22, 3, 1, 2);
    px(ctx, dark, 12, 8, 9, 5);
    px(ctx, '#5ff4ef', 13, 9, 2, 2); px(ctx, '#5ff4ef', 18, 9, 2, 2);
    px(ctx, light, 11, 13, 11, 1);
    // Portal rings orbit both sides.
    px(ctx, '#5ff4ef', 1, 12, 2, 9); px(ctx, '#9b7cff', 3, 10, 2, 13);
    px(ctx, '#5ff4ef', 27, 11, 2, 10); px(ctx, '#9b7cff', 29, 13, 2, 7);
  },
  // Faux Paw — theatrical showman: mask, ruffle collar, ta-daa paw, ghost double.
  8: (ctx, [fur, light, dark]) => {
    // Translucent phantom double — complete with spooky eyes — waits stage left.
    px(ctx, '#9cebf1', 2, 9, 5, 12); px(ctx, '#d8a9e8', 3, 7, 4, 4); px(ctx, '#8bcbd8', 1, 15, 5, 8);
    px(ctx, '#79528f', 3, 8, 1, 1); px(ctx, '#79528f', 5, 8, 1, 1);
    // Slim tail swishing out beside the extended paw.
    px(ctx, OUTLINE, 24, 19, 3, 8); px(ctx, fur, 25, 20, 1, 6);
    // Slim performer body with a white ruffle collar.
    px(ctx, OUTLINE, 11, 14, 12, 13); px(ctx, fur, 12, 15, 10, 11);
    px(ctx, light, 12, 15, 10, 2);
    px(ctx, light, 13, 17, 2, 1); px(ctx, light, 16, 17, 2, 1); px(ctx, light, 19, 17, 2, 1);
    // Ta-daa! One gloved paw flung out, trailing sparkles.
    px(ctx, OUTLINE, 22, 16, 7, 4); px(ctx, fur, 23, 17, 4, 2); px(ctx, light, 26, 16, 3, 3);
    px(ctx, '#f3d8ff', 29, 13, 2, 2);
    // Head with a masquerade mask.
    px(ctx, OUTLINE, 9, 4, 15, 12); px(ctx, fur, 10, 5, 13, 10);
    px(ctx, OUTLINE, 8, 2, 6, 5); px(ctx, fur, 9, 3, 4, 3); px(ctx, '#dc7f76', 10, 4, 2, 2);
    px(ctx, OUTLINE, 19, 2, 6, 5); px(ctx, fur, 20, 3, 4, 3); px(ctx, '#dc7f76', 21, 4, 2, 2);
    px(ctx, OUTLINE, 9, 8, 15, 5); px(ctx, '#6e3f82', 10, 9, 13, 3);
    px(ctx, '#f3d8ff', 12, 10, 2, 1); px(ctx, '#f3d8ff', 19, 10, 2, 1);
    // Showman grin.
    px(ctx, light, 13, 13, 7, 3); px(ctx, dark, 16, 13, 1, 1);
    px(ctx, OUTLINE, 14, 15, 6, 1); px(ctx, OUTLINE, 13, 14, 1, 1); px(ctx, OUTLINE, 20, 14, 1, 1);
    // Feet.
    px(ctx, OUTLINE, 11, 26, 5, 3); px(ctx, OUTLINE, 17, 26, 5, 3);
    px(ctx, light, 12, 27, 3, 1); px(ctx, light, 18, 27, 3, 1);
  },
  // Thunderpaws — skinny stormcaller, static-spiked fur, mania in the eyes.
  9: (ctx, [fur, light, dark]) => {
    // Zigzag static tail.
    px(ctx, OUTLINE, 8, 21, 3, 3); px(ctx, OUTLINE, 6, 18, 3, 3); px(ctx, OUTLINE, 8, 15, 3, 3);
    px(ctx, fur, 9, 22, 1, 1); px(ctx, fur, 7, 19, 1, 1); px(ctx, fur, 9, 16, 1, 1);
    // Skinny frame with a storm-cloud chest patch and tiny bolt.
    px(ctx, OUTLINE, 11, 16, 10, 12); px(ctx, fur, 12, 17, 8, 10);
    px(ctx, dark, 13, 19, 6, 5); px(ctx, '#80d8e8', 13, 19, 6, 1);
    px(ctx, '#ffe35f', 15, 20, 2, 1); px(ctx, '#ffe35f', 14, 21, 2, 1); px(ctx, '#ffe35f', 15, 22, 2, 1);
    // Wild spiked head — fur standing on end.
    px(ctx, OUTLINE, 9, 5, 14, 12); px(ctx, fur, 10, 6, 12, 10);
    px(ctx, OUTLINE, 9, 2, 2, 4); px(ctx, OUTLINE, 13, 1, 2, 5); px(ctx, OUTLINE, 17, 1, 2, 5); px(ctx, OUTLINE, 21, 2, 2, 4);
    px(ctx, fur, 13, 3, 1, 3); px(ctx, fur, 17, 3, 1, 3);
    // Wide crazed eyes and a jittery mouth.
    px(ctx, '#ecf3c5', 11, 8, 4, 3); px(ctx, dark, 12, 9, 1, 1);
    px(ctx, '#ecf3c5', 17, 8, 4, 3); px(ctx, dark, 18, 9, 1, 1);
    px(ctx, light, 13, 12, 6, 3); px(ctx, dark, 15, 12, 2, 1);
    px(ctx, OUTLINE, 13, 14, 2, 1); px(ctx, OUTLINE, 16, 14, 2, 1); px(ctx, OUTLINE, 19, 14, 1, 1);
    // Stray static sparks.
    px(ctx, '#ffe35f', 6, 6, 2, 2); px(ctx, '#ffe35f', 5, 24, 2, 2);
    // Lightning rod drinking a sky bolt.
    px(ctx, OUTLINE, 26, 4, 3, 22); px(ctx, '#d6e4e8', 27, 5, 1, 20);
    px(ctx, '#ffe35f', 22, 0, 7, 3); px(ctx, '#ffe35f', 20, 2, 6, 5); px(ctx, '#f59d37', 23, 6, 4, 5); px(ctx, '#ffe35f', 20, 10, 5, 3);
    // Thin legs.
    px(ctx, OUTLINE, 11, 27, 4, 2); px(ctx, OUTLINE, 17, 27, 4, 2);
    px(ctx, light, 12, 28, 2, 1); px(ctx, light, 18, 28, 2, 1);
  },
  // Meowstro — tuxedo, monocle, maestro hat, baton: the distinguished conductor.
  10: (ctx, [fur, light, dark]) => {
    // Tailcoat tails and slim tuxedo body.
    px(ctx, OUTLINE, 7, 23, 4, 7); px(ctx, '#6e2635', 8, 24, 2, 5);
    px(ctx, OUTLINE, 22, 23, 4, 7); px(ctx, '#6e2635', 23, 24, 2, 5);
    px(ctx, OUTLINE, 9, 16, 15, 12); px(ctx, '#6e2635', 10, 17, 13, 10);
    // White dress bib with a bow tie.
    px(ctx, '#f5e6c8', 14, 17, 5, 5); px(ctx, '#f5e6c8', 15, 22, 3, 2);
    px(ctx, dark, 13, 18, 3, 2); px(ctx, dark, 17, 18, 3, 2); px(ctx, light, 16, 18, 1, 2);
    // Head held high with sideburn tufts.
    px(ctx, OUTLINE, 9, 6, 15, 11); px(ctx, fur, 10, 7, 13, 9);
    px(ctx, fur, 8, 9, 2, 3); px(ctx, fur, 23, 9, 2, 3);
    // Flat-brim maestro hat with a gold band.
    px(ctx, OUTLINE, 7, 5, 19, 2); px(ctx, OUTLINE, 9, 0, 16, 6);
    px(ctx, '#402337', 10, 1, 14, 5); px(ctx, '#f1c083', 11, 4, 12, 2);
    // Refined cream muzzle and smile — kept pale so the gold monocle pops.
    px(ctx, '#f5e6c8', 13, 12, 7, 3); px(ctx, dark, 16, 12, 1, 1);
    px(ctx, OUTLINE, 14, 14, 4, 1); px(ctx, OUTLINE, 13, 13, 1, 1); px(ctx, OUTLINE, 18, 13, 1, 1);
    // One proud closed eye, monocle on the other.
    px(ctx, OUTLINE, 11, 10, 3, 1);
    px(ctx, '#f1c083', 17, 9, 4, 1); px(ctx, '#f1c083', 17, 12, 4, 1);
    px(ctx, '#f1c083', 17, 10, 1, 2); px(ctx, '#f1c083', 20, 10, 1, 2); px(ctx, '#fff', 18, 10, 1, 1);
    // Conductor baton held in a white glove.
    px(ctx, OUTLINE, 26, 7, 2, 18); px(ctx, '#f5e6c8', 27, 7, 1, 17); px(ctx, '#ffe56e', 25, 5, 4, 4);
    px(ctx, '#6e2635', 21, 20, 4, 2); px(ctx, '#f5e6c8', 24, 21, 4, 3);
    // Spats.
    px(ctx, OUTLINE, 12, 26, 4, 3); px(ctx, OUTLINE, 17, 26, 4, 3);
    px(ctx, '#f5e6c8', 13, 27, 2, 2); px(ctx, '#f5e6c8', 18, 27, 2, 2);
  },
};

// Battle cape and energy wings render behind whichever body comes next.
function drawCatBackGear(ctx, geom) {
  const [kx, ky] = geom.cape;
  px(ctx, OUTLINE, kx, ky, 7, 13); px(ctx, '#a92f4b', kx + 1, ky + 1, 6, 11); px(ctx, '#ee4f61', kx + 2, ky + 2, 3, 8);
  for (const wing of [geom.wingL, geom.wingR]) {
    if (!wing) continue;
    px(ctx, OUTLINE, wing[0], wing[1], 7, 7);
    px(ctx, '#55e6ef', wing[0] + 1, wing[1] + 1, 5, 5);
    px(ctx, '#e2ffff', wing[0] + 2, wing[1] + 2, 3, 2);
  }
}

// Level equipment is deliberately bold enough to read at board scale; the
// geometry table keeps each piece anchored to the wearer's own head and torso.
function drawCatEquipment(ctx, level, geom) {
  if (level < 2) return;
  const armor = level >= 3 ? '#6d285e' : '#176b9e';
  const armorLight = level >= 3 ? '#d95c9f' : '#55d6e8';
  const trim = level >= 3 ? '#ffd94f' : '#f4f0ce';
  const [hx, hy, hw] = geom.helm;
  // Level helmet with open face.
  px(ctx, OUTLINE, hx - 1, hy, hw + 2, 5); px(ctx, armor, hx, hy, hw, 4);
  px(ctx, armorLight, hx + 2, hy, Math.max(3, hw - 6), 2);
  px(ctx, trim, hx + (hw >> 1) - 1, hy + 1, 3, 3);
  px(ctx, OUTLINE, hx - 2, hy + 3, 4, 4); px(ctx, OUTLINE, hx + hw - 2, hy + 3, 4, 4);
  // Shoulder pads.
  for (const pad of [geom.padL, geom.padR]) {
    px(ctx, OUTLINE, pad[0], pad[1], 7, 6);
    px(ctx, armor, pad[0] + 1, pad[1] + 1, 6, 4);
    px(ctx, trim, pad[0] + 2, pad[1] + 1, 3, 1);
  }
  // Armored vest.
  const [vx, vy, vw, vh] = geom.vest;
  px(ctx, OUTLINE, vx, vy, vw, vh); px(ctx, armor, vx + 1, vy + 1, vw - 2, vh - 2);
  px(ctx, armorLight, vx + 2, vy + 1, vw - 4, 2);
  px(ctx, trim, vx + (vw >> 1) - 1, vy + 2, 2, vh - 4);
  // Upgraded barrel.
  const [bx, by] = geom.barrel;
  px(ctx, OUTLINE, bx, by, 8, 9); px(ctx, armor, bx + 1, by + 1, 6, 7);
  px(ctx, trim, bx + 2, by + 1, 4, 2); px(ctx, '#9ffcff', bx + 3, by, 2, 2);
  if (level < 3) return;
  // Twin power pods, glowing plasma core, crown fins and oversized cannon.
  for (const pod of [geom.podL, geom.podR]) {
    if (!pod) continue;
    px(ctx, OUTLINE, pod[0], pod[1], 6, 9);
    px(ctx, '#6d285e', pod[0] + 1, pod[1] + 1, 4, 7);
    px(ctx, '#55e6ef', pod[0] + 2, pod[1] + 2, 2, 4);
  }
  const finY = Math.max(0, hy - 2);
  px(ctx, '#ffd94f', hx - 1, finY, 3, 3); px(ctx, '#ffd94f', hx + hw - 2, finY, 3, 3);
  px(ctx, '#fff3a5', hx, finY, 1, 1); px(ctx, '#fff3a5', hx + hw - 1, finY, 1, 1);
  const [cx, cy] = geom.core;
  px(ctx, OUTLINE, cx, cy, 6, 6); px(ctx, '#55e6ef', cx + 1, cy + 1, 4, 4); px(ctx, '#e2ffff', cx + 2, cy + 1, 2, 2);
  const [gx, gy] = geom.cannon;
  px(ctx, OUTLINE, gx, gy, 10, 4); px(ctx, '#6d285e', gx + 1, gy, 8, 3); px(ctx, '#55e6ef', gx + 3, gy, 4, 2);
}

export function drawCat(canvas, level = 1, coat = 0, superCat = false) {
  const ctx = prepare(canvas);
  const safe = CAT_BODIES[coat] ? coat : 0;
  const pal = COAT_PALETTES[safe];
  const geom = CAT_GEOM[safe];

  if (superCat) {
    px(ctx, '#d64843', 4, 14, 7, 12);
    px(ctx, '#a32d38', 2, 18, 6, 9);
    px(ctx, '#f2c735', 10, 8, 12, 4);
  }
  if (level >= 3 && !superCat) drawCatBackGear(ctx, geom);
  CAT_BODIES[safe](ctx, pal, level);
  drawCatEquipment(ctx, level, geom);
}

export function drawWorker(canvas, role = 'cook', level = 1) {
  const coat = { cook: 3, trader: 4, weaponsmith: 0, armourer: 1 }[role] ?? 3;
  const ctx = prepare(canvas);
  const [fur, light, dark] = COAT_PALETTES[coat];
  // Workers share the neutral house-cat frame; their tools tell the story.
  standardCatBody(ctx, fur, light, dark);
  drawCatEquipment(ctx, level, CAT_GEOM[0]);
  const outline = OUTLINE;
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
  if (role === 'cook') {
    // One compact enamel oven: stovetop, controls, handle, and a warm dark door.
    px(ctx, outline, 8, 2, 16, 3); px(ctx, '#4f5d60', 9, 3, 6, 1); px(ctx, '#4f5d60', 17, 3, 6, 1);
    px(ctx, outline, 6, 5, 20, 25); px(ctx, '#9aa5a5', 7, 6, 18, 23);
    px(ctx, '#d8ddd4', 8, 7, 16, 5);
    px(ctx, outline, 10, 8, 2, 2); px(ctx, '#f1c94d', 10, 8, 1, 1);
    px(ctx, outline, 20, 8, 2, 2); px(ctx, '#f1c94d', 20, 8, 1, 1);
    px(ctx, outline, 9, 13, 14, 2); px(ctx, '#d8ddd4', 10, 13, 12, 1);
    px(ctx, outline, 8, 16, 16, 11); px(ctx, '#3e4b50', 10, 18, 12, 7);
    px(ctx, '#7f4e35', 11, 22, 10, 2); px(ctx, '#e87832', 14, 22, 4, 1);
    px(ctx, outline, 8, 29, 4, 3); px(ctx, outline, 20, 29, 4, 3);
  } else if (role === 'trader') {
    px(ctx, '#a87b52', 0, 23, 32, 9); px(ctx, '#714832', 0, 28, 32, 4);
    px(ctx, outline, 4, 8, 24, 17); px(ctx, '#b96f42', 5, 9, 22, 15); px(ctx, '#f3d27b', 7, 11, 18, 5);
    px(ctx, '#d84a45', 3, 4, 26, 6); px(ctx, '#f2cf4a', 13, 17, 6, 6);
  } else if (role === 'weaponsmith') {
    px(ctx, '#a87b52', 0, 23, 32, 9); px(ctx, '#714832', 0, 28, 32, 4);
    // Broad weapon anvil, with a hot blade blank resting on its face.
    px(ctx, outline, 2, 11, 28, 8); px(ctx, '#68777d', 3, 12, 26, 6);
    px(ctx, '#b9c5c5', 5, 12, 20, 2); px(ctx, '#3e4c52', 4, 17, 23, 2);
    px(ctx, outline, 12, 18, 10, 7); px(ctx, '#59666b', 14, 18, 6, 7);
    px(ctx, outline, 8, 24, 18, 4); px(ctx, '#49565b', 9, 24, 16, 3);
    px(ctx, '#ffb33d', 8, 9, 14, 3); px(ctx, '#fff17a', 10, 9, 8, 1); px(ctx, '#d85a32', 21, 10, 5, 2);
  } else {
    px(ctx, '#a87b52', 0, 23, 32, 9); px(ctx, '#714832', 0, 28, 32, 4);
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

const DOG_PALETTES = {
  1: ['#9c613b', '#dcaa6d', '#623a2c'],
  2: ['#66727a', '#aeb8b9', '#38444d'],
  3: ['#75483d', '#c18462', '#422b2b'],
  4: ['#732f46', '#cf6a6c', '#351e35'],
};

// Same idea as CAT_GEOM: tier gear anchors per role silhouette.
const DOG_GEOM = {
  scruffy: { helm: [9, 4, 15], collar: [9, 22, 15], plates: [[4, 16], [22, 16]], armor: [8, 14, 18, 13], crown: [8, 0] },
  frisbee: { helm: [8, 3, 14], collar: [8, 16, 15], plates: [[4, 16], [21, 16]], armor: [8, 15, 17, 11], crown: [7, 0] },
  tennis: { helm: [10, 2, 13], collar: [10, 15, 13], plates: [[4, 14], [22, 12]], armor: [9, 12, 16, 11], crown: [10, 0] },
  howler: { helm: [13, 2, 10], collar: [10, 19, 14], plates: [[4, 19], [24, 18]], armor: [9, 18, 16, 9], crown: [7, 1] },
  lobber: { helm: [3, 8, 12], collar: [5, 19, 12], plates: [[12, 18], [23, 17]], armor: [10, 16, 18, 10], crown: [2, 4] },
  jumper: { helm: [4, 7, 11], collar: [5, 16, 12], plates: [[12, 17], [24, 15]], armor: [17, 10, 12, 11], crown: [2, 3] },
  skittish: { helm: [10, 3, 12], collar: [10, 17, 12], plates: [[5, 18], [21, 18]], armor: [8, 16, 17, 11], crown: [8, 0] },
  medic: { helm: [7, 2, 15], collar: [8, 18, 16], plates: [[3, 17], [23, 17]], armor: [7, 16, 19, 11], crown: [7, 0] },
  growler: { helm: [4, 7, 12], collar: [5, 19, 13], plates: [[3, 18], [19, 18]], armor: [5, 17, 18, 10], crown: [3, 4] },
};

const DOG_BODIES = {
  // Chomps McGraw — the scrappy front-line mutt: eye patch, underbite, tongue.
  scruffy: (ctx, fur, light, dark) => {
    // Body and wagging tail.
    px(ctx, OUTLINE, 7, 14, 19, 13); px(ctx, fur, 8, 15, 17, 11);
    px(ctx, OUTLINE, 24, 12, 6, 5); px(ctx, fur, 24, 13, 4, 3);
    // Head and floppy ears.
    px(ctx, OUTLINE, 8, 5, 17, 15); px(ctx, fur, 9, 6, 15, 13);
    px(ctx, OUTLINE, 5, 6, 7, 12); px(ctx, dark, 6, 7, 5, 10);
    px(ctx, OUTLINE, 22, 6, 6, 12); px(ctx, dark, 23, 7, 4, 10);
    // Mismatched fur patch over the right eye.
    px(ctx, dark, 19, 8, 5, 5);
    // Muzzle with underbite teeth and a lolling tongue.
    px(ctx, light, 11, 13, 12, 7); px(ctx, OUTLINE, 15, 13, 5, 4); px(ctx, '#f4d1b3', 16, 13, 2, 1);
    px(ctx, OUTLINE, 12, 10, 3, 3); px(ctx, OUTLINE, 21, 10, 3, 3);
    px(ctx, '#eef0c2', 13, 10, 1, 1); px(ctx, '#eef0c2', 22, 10, 1, 1);
    px(ctx, OUTLINE, 14, 19, 8, 2); px(ctx, '#f2eee0', 15, 19, 2, 2); px(ctx, '#f2eee0', 19, 19, 2, 2);
    px(ctx, '#dc7f76', 16, 20, 3, 2);
    // Legs.
    px(ctx, OUTLINE, 8, 25, 7, 4); px(ctx, OUTLINE, 20, 25, 7, 4);
    px(ctx, dark, 9, 26, 5, 2); px(ctx, dark, 21, 26, 5, 2);
  },
  // Fetch Armstrong — low retriever launch stance with a bright blue disc in flight.
  frisbee: (ctx, fur, light, dark) => {
    // Long athletic body and tail held straight for balance.
    px(ctx, OUTLINE, 7, 14, 19, 11); px(ctx, fur, 8, 15, 17, 9);
    px(ctx, OUTLINE, 24, 11, 8, 4); px(ctx, fur, 25, 12, 6, 2);
    // Head leaning into the throw, with wind goggles and swept ears.
    px(ctx, OUTLINE, 5, 5, 15, 14); px(ctx, fur, 6, 6, 13, 12);
    px(ctx, OUTLINE, 3, 7, 6, 9); px(ctx, dark, 4, 8, 4, 7);
    px(ctx, '#4c769c', 6, 7, 13, 4); px(ctx, '#a9e8ff', 8, 8, 3, 2); px(ctx, '#a9e8ff', 14, 8, 3, 2);
    px(ctx, light, 5, 13, 10, 5); px(ctx, OUTLINE, 4, 14, 3, 2); px(ctx, OUTLINE, 10, 16, 5, 1);
    // Braced legs and the signature disc already leaving its paw.
    px(ctx, OUTLINE, 8, 23, 6, 6); px(ctx, fur, 9, 24, 4, 4);
    px(ctx, OUTLINE, 20, 22, 7, 7); px(ctx, fur, 21, 23, 5, 5);
    px(ctx, '#183e60', 23, 5, 9, 5); px(ctx, '#53c7ef', 24, 6, 7, 3); px(ctx, '#d9f8ff', 26, 6, 3, 1);
  },
  // Bark McEnroe — lean ranged athlete up on long legs, visor and ball ready.
  tennis: (ctx, fur, light, dark) => {
    // Alert upright tail.
    px(ctx, OUTLINE, 24, 7, 3, 7); px(ctx, fur, 25, 8, 1, 5);
    // Lean torso raised on long runner legs with white socks.
    px(ctx, OUTLINE, 8, 12, 17, 11); px(ctx, fur, 9, 13, 15, 9);
    px(ctx, OUTLINE, 9, 22, 4, 7); px(ctx, OUTLINE, 20, 22, 4, 7);
    px(ctx, fur, 10, 22, 2, 5); px(ctx, fur, 21, 22, 2, 5);
    px(ctx, '#f2eee0', 10, 27, 2, 2); px(ctx, '#f2eee0', 21, 27, 2, 2);
    px(ctx, '#d84a45', 9, 24, 4, 2);
    // Head with perked ears.
    px(ctx, OUTLINE, 9, 3, 15, 12); px(ctx, fur, 10, 4, 13, 10);
    px(ctx, OUTLINE, 8, 0, 5, 6); px(ctx, dark, 9, 1, 3, 4);
    px(ctx, OUTLINE, 20, 0, 5, 6); px(ctx, dark, 21, 1, 3, 4);
    // Green visor and an unmistakable tennis ball.
    px(ctx, OUTLINE, 9, 2, 15, 3); px(ctx, '#4f9f62', 10, 2, 13, 2); px(ctx, '#baf06f', 18, 4, 9, 2);
    // Game face.
    px(ctx, OUTLINE, 12, 7, 2, 2); px(ctx, '#eef0c2', 12, 7, 1, 1);
    px(ctx, OUTLINE, 19, 7, 2, 2); px(ctx, '#eef0c2', 19, 7, 1, 1);
    px(ctx, light, 12, 9, 9, 5); px(ctx, OUTLINE, 15, 9, 3, 2); px(ctx, OUTLINE, 14, 12, 5, 1);
    px(ctx, OUTLINE, 25, 16, 7, 7); px(ctx, '#cfea4c', 26, 17, 5, 5); px(ctx, '#fff5a0', 27, 17, 1, 5);
  },
  // Howl Pacino — chest out, head thrown back, mid-howl with the pack buff.
  howler: (ctx, fur, light, dark) => {
    // Seated haunches and curled tail.
    px(ctx, OUTLINE, 8, 18, 18, 10); px(ctx, fur, 9, 19, 16, 8);
    px(ctx, OUTLINE, 25, 20, 5, 4); px(ctx, fur, 26, 21, 3, 2);
    // Chest puffed to the sky.
    px(ctx, OUTLINE, 10, 10, 13, 10); px(ctx, fur, 11, 11, 11, 8); px(ctx, light, 13, 13, 6, 6);
    // Head thrown back, muzzle pointed up, mouth open mid-howl.
    px(ctx, OUTLINE, 12, 4, 11, 9); px(ctx, fur, 13, 5, 9, 7);
    px(ctx, OUTLINE, 18, 2, 7, 5); px(ctx, fur, 19, 3, 5, 3);
    px(ctx, OUTLINE, 23, 0, 6, 4); px(ctx, fur, 24, 1, 4, 2); px(ctx, dark, 27, 0, 2, 2);
    px(ctx, OUTLINE, 19, 5, 5, 3); px(ctx, '#dc7f76', 20, 6, 2, 1);
    // Ears flopped back with the tilt; eyes blissfully shut.
    px(ctx, OUTLINE, 9, 4, 5, 8); px(ctx, dark, 10, 5, 3, 6);
    px(ctx, OUTLINE, 14, 7, 3, 1); px(ctx, OUTLINE, 14, 6, 1, 1);
    // Purple bandana knotted at the neck.
    px(ctx, '#784b9c', 10, 16, 13, 3); px(ctx, '#b96ac4', 21, 18, 4, 3);
    // Stepped sound waves rolling off the raised muzzle.
    px(ctx, '#ffe56e', 29, 6, 2, 2); px(ctx, '#ffe56e', 28, 10, 3, 2); px(ctx, '#ffe56e', 30, 13, 2, 2);
    // Front legs.
    px(ctx, OUTLINE, 11, 25, 4, 3); px(ctx, OUTLINE, 18, 25, 4, 3);
    px(ctx, dark, 12, 26, 2, 1); px(ctx, dark, 19, 26, 2, 1);
  },
  // Bone Jovi — long low artillery dachshund with a bone mortar on its back.
  lobber: (ctx, fur, light, dark) => {
    // Extra-long low body and short planted legs.
    px(ctx, OUTLINE, 6, 15, 24, 11); px(ctx, fur, 7, 16, 22, 9);
    px(ctx, OUTLINE, 8, 24, 5, 5); px(ctx, OUTLINE, 23, 24, 5, 5);
    px(ctx, dark, 9, 25, 3, 3); px(ctx, dark, 24, 25, 3, 3);
    // Compact dachshund head with long hanging ear.
    px(ctx, OUTLINE, 2, 9, 13, 12); px(ctx, fur, 3, 10, 11, 10);
    px(ctx, OUTLINE, 9, 7, 7, 12); px(ctx, dark, 10, 8, 5, 10);
    px(ctx, light, 2, 15, 8, 4); px(ctx, OUTLINE, 1, 15, 3, 2);
    px(ctx, '#eef0c2', 6, 12, 2, 2); px(ctx, OUTLINE, 7, 12, 1, 1);
    // Backpack, angled mortar, and a bone loaded in the barrel.
    px(ctx, OUTLINE, 17, 11, 11, 9); px(ctx, '#725449', 18, 12, 9, 7);
    px(ctx, OUTLINE, 19, 4, 7, 11); px(ctx, '#4f6570', 20, 5, 5, 9);
    px(ctx, '#f4e8c8', 18, 2, 9, 4); px(ctx, OUTLINE, 17, 2, 3, 3); px(ctx, OUTLINE, 25, 2, 3, 3);
    px(ctx, '#f0c948', 27, 13, 4, 5);
  },
  // Barkour Bandit — masked springer coiled to leap, cape streaming behind.
  jumper: (ctx, fur, light, dark) => {
    // Red cape streams off the shoulders mid-leap.
    px(ctx, OUTLINE, 25, 4, 6, 11); px(ctx, '#c94b46', 26, 5, 4, 9); px(ctx, '#f0775f', 26, 6, 2, 5);
    // Coiled hindquarters raised high, tail out for balance.
    px(ctx, OUTLINE, 16, 10, 13, 12); px(ctx, fur, 17, 11, 11, 10);
    px(ctx, OUTLINE, 28, 13, 4, 3); px(ctx, fur, 29, 14, 2, 1);
    // Body sloping down to a low, ready stance.
    px(ctx, OUTLINE, 5, 15, 14, 10); px(ctx, fur, 6, 16, 12, 8);
    // Head low and forward, ear pinned back.
    px(ctx, OUTLINE, 3, 9, 12, 12); px(ctx, fur, 4, 10, 10, 10);
    px(ctx, OUTLINE, 11, 6, 7, 5); px(ctx, dark, 12, 7, 5, 3);
    // Bandit mask with keen eyes.
    px(ctx, OUTLINE, 4, 12, 10, 4); px(ctx, '#eef0c2', 6, 13, 2, 1); px(ctx, '#eef0c2', 10, 13, 2, 1);
    // Muzzle at the front tip.
    px(ctx, light, 3, 17, 7, 3); px(ctx, dark, 3, 17, 2, 2); px(ctx, OUTLINE, 5, 19, 4, 1);
    // Spring-loaded legs in launch boots, coils glinting.
    px(ctx, OUTLINE, 5, 24, 6, 4); px(ctx, fur, 6, 24, 4, 3);
    px(ctx, OUTLINE, 19, 21, 7, 6); px(ctx, fur, 20, 22, 5, 4);
    px(ctx, '#f3cb45', 4, 27, 8, 3); px(ctx, OUTLINE, 4, 30, 8, 1);
    px(ctx, '#f3cb45', 18, 26, 9, 3); px(ctx, OUTLINE, 18, 29, 9, 1);
    px(ctx, '#aeb8b9', 6, 26, 2, 1); px(ctx, '#aeb8b9', 21, 25, 2, 1);
  },
  // Sir Flinches-a-Lot — tiny trembling chihuahua clutching a security blanket.
  skittish: (ctx, fur, light, dark) => {
    // Oversized ears and a small round head with alarmed eyes.
    px(ctx, OUTLINE, 8, 5, 16, 14); px(ctx, fur, 9, 6, 14, 12);
    px(ctx, OUTLINE, 5, 0, 8, 10); px(ctx, dark, 7, 2, 5, 7);
    px(ctx, OUTLINE, 20, 0, 8, 10); px(ctx, dark, 21, 2, 5, 7);
    px(ctx, OUTLINE, 11, 9, 4, 5); px(ctx, '#eef0c2', 12, 10, 2, 2); px(ctx, OUTLINE, 13, 11, 1, 1);
    px(ctx, OUTLINE, 18, 9, 4, 5); px(ctx, '#eef0c2', 19, 10, 2, 2); px(ctx, OUTLINE, 19, 11, 1, 1);
    px(ctx, light, 12, 14, 9, 4); px(ctx, OUTLINE, 15, 14, 3, 2); px(ctx, OUTLINE, 14, 17, 5, 1);
    // Sweat drops and shake marks sell the panic even at thumbnail size.
    px(ctx, '#8fd3e8', 26, 8, 2, 3); px(ctx, '#8fd3e8', 28, 12, 1, 2);
    px(ctx, '#f3cb45', 3, 15, 2, 1); px(ctx, '#f3cb45', 1, 18, 3, 1);
    // Little body mostly hidden beneath a purple security blanket.
    px(ctx, OUTLINE, 8, 18, 17, 9); px(ctx, fur, 9, 19, 15, 7);
    px(ctx, OUTLINE, 5, 18, 23, 10); px(ctx, '#8066a8', 6, 19, 21, 8);
    px(ctx, '#bba4de', 7, 20, 18, 2); px(ctx, '#5c477f', 9, 24, 16, 2);
    px(ctx, '#f1d164', 7, 26, 2, 2); px(ctx, '#f1d164', 12, 26, 2, 2); px(ctx, '#f1d164', 17, 26, 2, 2); px(ctx, '#f1d164', 22, 26, 2, 2);
    // Knock-kneed feet, with one lifted as if it is already sidestepping.
    px(ctx, OUTLINE, 9, 27, 5, 4); px(ctx, dark, 10, 28, 3, 2);
    px(ctx, OUTLINE, 20, 26, 5, 4); px(ctx, dark, 21, 27, 3, 2);
    px(ctx, '#f3cb45', 6, 29, 2, 1); px(ctx, '#f3cb45', 26, 28, 3, 1);
  },
  // Dr. Droolittle — broad Saint Bernard medic with cap, satchel, and heart bottle.
  medic: (ctx, fur, light, dark) => {
    // Large dependable body, white chest, and heavy paws.
    px(ctx, OUTLINE, 6, 13, 21, 14); px(ctx, fur, 7, 14, 19, 12); px(ctx, light, 10, 16, 9, 10);
    px(ctx, OUTLINE, 7, 24, 7, 5); px(ctx, OUTLINE, 21, 24, 7, 5);
    px(ctx, dark, 8, 25, 5, 3); px(ctx, dark, 22, 25, 5, 3);
    // Kind square face with drooping ears.
    px(ctx, OUTLINE, 6, 4, 18, 15); px(ctx, fur, 7, 5, 16, 13);
    px(ctx, OUTLINE, 3, 6, 7, 12); px(ctx, dark, 4, 7, 5, 10);
    px(ctx, OUTLINE, 21, 6, 6, 12); px(ctx, dark, 22, 7, 4, 10);
    px(ctx, light, 9, 11, 12, 7); px(ctx, OUTLINE, 13, 11, 4, 3); px(ctx, '#eef0c2', 10, 8, 2, 2); px(ctx, '#eef0c2', 19, 8, 2, 2);
    // White medic cap with red cross.
    px(ctx, '#f3f4e9', 8, 2, 14, 5); px(ctx, '#d84a45', 14, 2, 3, 5); px(ctx, '#d84a45', 12, 4, 7, 2);
    // Green medical satchel and dangling heart tonic.
    px(ctx, OUTLINE, 22, 14, 9, 10); px(ctx, '#4f9f62', 23, 15, 7, 8);
    px(ctx, '#f3f4e9', 26, 16, 2, 5); px(ctx, '#f3f4e9', 24, 18, 6, 2);
    px(ctx, '#e95f68', 2, 20, 5, 5); px(ctx, '#ffd1d4', 3, 21, 3, 2);
  },
  // Growl Gadot — tiny corgi planted behind an oversized megaphone.
  growler: (ctx, fur, light, dark) => {
    // Low corgi body, tiny legs, upright tail.
    px(ctx, OUTLINE, 6, 16, 20, 10); px(ctx, fur, 7, 17, 18, 8);
    px(ctx, OUTLINE, 22, 10, 5, 8); px(ctx, fur, 23, 11, 3, 6);
    px(ctx, OUTLINE, 8, 24, 5, 5); px(ctx, OUTLINE, 20, 24, 5, 5);
    px(ctx, dark, 9, 25, 3, 3); px(ctx, dark, 21, 25, 3, 3);
    // Big triangular ears, fierce brows, white corgi blaze.
    px(ctx, OUTLINE, 4, 5, 17, 15); px(ctx, fur, 5, 7, 15, 12);
    px(ctx, OUTLINE, 4, 1, 6, 8); px(ctx, dark, 5, 3, 4, 5);
    px(ctx, OUTLINE, 15, 1, 6, 8); px(ctx, dark, 16, 3, 4, 5);
    px(ctx, light, 10, 6, 5, 12); px(ctx, OUTLINE, 7, 10, 4, 2); px(ctx, OUTLINE, 15, 10, 4, 2);
    px(ctx, light, 7, 13, 11, 5); px(ctx, OUTLINE, 11, 13, 4, 3); px(ctx, OUTLINE, 9, 17, 8, 1);
    // Spiked collar and comically large red megaphone.
    px(ctx, '#7b2940', 6, 18, 15, 3); px(ctx, '#d9d0b8', 8, 20, 2, 2); px(ctx, '#d9d0b8', 13, 20, 2, 2); px(ctx, '#d9d0b8', 18, 20, 2, 2);
    px(ctx, OUTLINE, 20, 8, 11, 10); px(ctx, '#d84a45', 21, 10, 9, 6); px(ctx, '#ff8576', 27, 8, 4, 10); px(ctx, OUTLINE, 19, 11, 4, 4);
  },
};

// Tier gear layered onto whichever role body was drawn.
function drawDogGear(ctx, tier, geom) {
  const [cx, cy, cw] = geom.collar;
  if (tier === 1) {
    // Plain leather collar with a little tag.
    px(ctx, '#9b572d', cx, cy + 1, cw, 2); px(ctx, '#f0c948', cx + (cw >> 1) - 1, cy + 1, 2, 3);
  }
  if (tier >= 2) {
    const tierArmor = tier >= 4
      ? ['#29263f', '#6f5b8d', '#d95c9f']
      : tier >= 3
        ? ['#9b4e2f', '#e39b42', '#ffd15a']
        : ['#276d91', '#62c9dc', '#e8fbff'];
    const collar = tier >= 4 ? '#a62f67' : tier >= 3 ? '#b63e3a' : '#285e9b';
    const [hx, hy, hw] = geom.helm;
    px(ctx, OUTLINE, hx - 1, hy, hw + 2, 6); px(ctx, tierArmor[0], hx, hy, hw, 5);
    px(ctx, tierArmor[1], hx + 3, hy, Math.max(3, hw - 7), 2);
    px(ctx, tierArmor[2], hx + (hw >> 1) - 1, Math.max(0, hy - 1), 3, 4);
    px(ctx, collar, cx, cy, cw, 3); px(ctx, tierArmor[2], cx + (cw >> 1) - 1, cy, 3, 4);
  }
  if (tier >= 3) {
    for (const plate of geom.plates) {
      px(ctx, OUTLINE, plate[0], plate[1], 8, 8); px(ctx, tier >= 4 ? '#372d50' : '#a95735', plate[0] + 1, plate[1] + 1, 6, 6);
      px(ctx, tier >= 4 ? '#cf5793' : '#ef9d42', plate[0] + 2, plate[1] + 1, 4, 2);
      px(ctx, '#f7e7be', plate[0] + 3, Math.max(0, plate[1] - 1), 2, 3);
    }
  }
  if (tier >= 4) {
    const [ax, ay, aw, ah] = geom.armor;
    px(ctx, OUTLINE, ax, ay, aw, ah); px(ctx, '#29263f', ax + 1, ay + 1, aw - 2, ah - 2);
    px(ctx, '#d95c9f', ax + 3, ay + 2, aw - 6, 3);
    px(ctx, '#f4bbdf', ax + (aw >> 1) - 1, ay + 3, 3, Math.max(3, ah - 6));
    const [rx, ry] = geom.crown;
    px(ctx, '#f2cf4a', rx, ry + 1, 4, 5); px(ctx, '#f2cf4a', rx + 6, ry, 4, 6); px(ctx, '#f2cf4a', rx + 12, ry + 1, 4, 5);
    px(ctx, '#fff0a1', rx + 7, ry + 1, 2, 2);
  }
}

export function drawDog(canvas, tier = 1, role = 'scruffy') {
  const ctx = prepare(canvas);
  const safeRole = DOG_BODIES[role] ? role : 'scruffy';
  const safeTier = DOG_PALETTES[tier] ? tier : 1;
  const [fur, light, dark] = DOG_PALETTES[safeTier];
  DOG_BODIES[safeRole](ctx, fur, light, dark);
  drawDogGear(ctx, safeTier, DOG_GEOM[safeRole]);
}

/**
 * Where a unit's face sits inside its 32×32 tile, as a 0–1 fraction of the sprite.
 * The helm anchor already marks each head (it is where the helmet is fitted), so the
 * KO X-eyes reuse it rather than inventing a second table. Sits a few pixels below the
 * helmet line, which is where the eyes actually are on every body.
 */
export function headAnchor(kind, key) {
  const geom = kind === 'dog' ? DOG_GEOM[key] : CAT_GEOM[key];
  const [x, y, width] = geom?.helm ?? [10, 5, 13];
  return { x: (x + width / 2) / 32, y: (y + 6) / 32 };
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
  // Small, sparse flower details.
  [[8,70],[w-14,101],[17,205],[50,380],[w-50,420]].forEach(([x,y], i) => {
    px(ctx, '#3f763f', x, y + 2, 1, 5);
    px(ctx, i % 2 ? '#f4c95c' : '#e87a70', x - 2, y, 5, 3);
    px(ctx, '#fff0a8', x, y, 1, 1);
  });
}
