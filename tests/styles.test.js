import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');

function zIndexFor(selector) {
  const start = css.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `missing ${selector} rule`);
  const rule = css.slice(start, css.indexOf('}', start));
  const value = rule.match(/z-index:\s*(\d+)/)?.[1];
  assert.ok(value, `missing z-index for ${selector}`);
  return Number(value);
}

test('unit information stays above the tutorial overlay', () => {
  assert.ok(zIndexFor('.unit-tooltip') > zIndexFor('.tutorial-overlay'));
});

test('worker cat offers use a pastel violet background', () => {
  assert.match(css, /\.shop-slot\.worker-offer \.shop-card\s*{[^}]*background:\s*#e6d7f5/);
});

test('production-cat level-ups use a local production reveal instead of pulsing the battlefield', () => {
  assert.match(app, /'purchase-worker': 'worker'/);
  assert.match(app, /'merge-bench-worker': 'bench'/);
  assert.match(app, /if \(reveal\.kind === 'level-up' && !reveal\.production\)/);
  assert.match(css, /\.upgrade-reveal\.upgrade-production \.upgrade-radiance\s*{[^}]*#b9ef78/);
  assert.match(css, /\.upgrade-transforming\.upgrade-production\s*{[^}]*#c9ef82/);
});

test('tutorial outlines use the thicker cyan breathing glow', () => {
  assert.match(css, /--tutorial-accent:\s*#63e6ff/);
  assert.match(css, /\.tutorial-spotlight\s*{[^}]*0 0 0 5px var\(--tutorial-accent\)/s);
  assert.match(css, /\.tutorial-spotlight::after,\s*\.tutorial-source-highlight::after\s*{[^}]*animation:\s*tutorial-cyan-outline-glow 2\.2s/s);
  assert.match(css, /@keyframes tutorial-cyan-outline-glow\s*{[\s\S]*0 0 8px[\s\S]*0 0 20px/s);
  assert.match(css, /\.tutorial-source-highlight\s*{[^}]*border:\s*5px solid var\(--tutorial-accent\)/s);
});

test('tutorial outlines stay strongly visible with reduced motion', () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*{[\s\S]*\.tutorial-spotlight::after, \.tutorial-source-highlight::after\s*{[^}]*animation:\s*none;[^}]*0 0 14px/s);
});

test('Knotty yarn stays tied after cinching and has a separate fade phase', () => {
  assert.match(css, /@keyframes tangle-bind-in\s*{[\s\S]*100%\s*{\s*opacity:\s*1;/s);
  assert.match(css, /\.tangle-bind\.is-fading\s*{\s*animation:\s*tangle-bind-out var\(--tangle-fade-ms\) linear forwards;/s);
  assert.match(css, /@keyframes tangle-bind-out\s*{[\s\S]*from\s*{\s*opacity:\s*1;[\s\S]*to\s*{\s*opacity:\s*0;/s);
  assert.match(app, /restoreActiveTethers\(\);/);
});

test('ranged cats recoil on launch and Laserpaw braces against the beam', () => {
  assert.match(app, /showAttackRecoil\(event, signature\);/);
  assert.match(app, /showAttackRecoil\(primary, signature, \{ durationMs: timing\.blastMs \}\);/);
  assert.match(app, /phase: 'charge',[\s\S]*durationMs: timing\.beamChargeMs/s);
  assert.match(css, /\.unit\.attack-recoil-standard\s*{[^}]*cat-launch-standard/s);
  assert.match(css, /\.unit\.attack-recoil-laser\s*{[^}]*cat-laser-pressure/s);
  assert.match(css, /@keyframes cat-laser-pressure\s*{[\s\S]*var\(--attack-recoil-x\)[\s\S]*var\(--attack-recoil-half-x\)/s);
  assert.match(css, /\.backblast-laser\s*{[^}]*animation-name:\s*laser-backblast/s);
});

test('launch recoil respects reduced-motion preferences', () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*{[\s\S]*\.unit\[class\*="attack-recoil-"\][\s\S]*animation:\s*none/s);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*{[\s\S]*\.launch-backblast\s*{\s*display:\s*none;/s);
});

test('repositionable cats use a separate faint tutorial glow', () => {
  assert.match(css, /#tutorial-focus-highlights,\s*\.tutorial-focus-highlight\s*{[^}]*pointer-events:\s*none/s);
  assert.match(css, /\.tutorial-focus-highlight\s*{[^}]*animation:\s*tutorial-focus-glow 1\.6s/s);
  assert.match(css, /@keyframes tutorial-focus-glow\s*{[\s\S]*0 0 18px/s);
});

test('tutorial buttons cannot intercept a cat drop through the nearby bubble', () => {
  assert.match(css, /body\.pet-dragging \.tutorial-next,\s*body\.pet-dragging \.tutorial-skip\s*{\s*pointer-events:\s*none;/s);
});

test('tutorial text bubble keeps ten clear pixels beyond the spotlight ring', () => {
  assert.match(app, /const TUTORIAL_SPOTLIGHT_PAD = 8;/);
  assert.match(app, /const TUTORIAL_OUTLINE_REACH = 8;/);
  assert.match(app, /const TUTORIAL_BUBBLE_CLEARANCE = 10;/);
  assert.match(app, /r\.bottom \+ targetGap/);
  assert.match(app, /r\.top - bubbleH - targetGap/);
  assert.match(app, /r\.right \+ targetGap/);
  assert.match(app, /r\.left - bubbleW - targetGap/);
});

test('five or more tactics use compact three-column buttons', () => {
  assert.match(app, /host\.classList\.toggle\('compact', activeCats\.length >= 5\)/);
  assert.match(css, /\.active-abilities\.compact\s*{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
});

test('stacked dogs show two individual tooltip cards with pixel art', () => {
  assert.match(app, /return dogs\.map\(\(dog\) => \(\{[\s\S]*dogTooltipInfo\(dog\)[\s\S]*preview: dog/s);
  assert.match(app, /tooltipInfos\.map\(\(tooltipInfo, index\) => tooltipCardMarkup\(tooltipInfo, index\)\)/);
  assert.match(app, /preview\.append\(unitCanvas\('dog', tooltipInfo\.preview\)\)/);
  assert.match(css, /\.unit-tooltip\.is-grouped\s*{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/s);
  assert.match(css, /\.tooltip-unit-art canvas\s*{[^}]*image-rendering:\s*pixelated/s);
});
