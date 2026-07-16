import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

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

test('starting any cat drag dismisses the visible tutorial overlay', () => {
  assert.match(app, /dragState\.started = true;\s*if \(dragState\.source\.type !== 'item'\) hideTutorialOverlay\(\);/);
});

test('the Next Wave panel replaces the standalone Adoption Box while a cat is dragged', () => {
  assert.doesNotMatch(html, /<section id="adoption-box"/);
  assert.match(html, /<div id="board"[\s\S]*<aside id="next-wave-zone"[\s\S]*<section id="next-wave-adoption"/);
  assert.match(app, /closest\?\.\('\.next-wave-zone'\)/);
  assert.match(app, /querySelectorAll\('\.cell, \.worker-slot, \.bench-slot, \.next-wave-zone'\)/);
  assert.doesNotMatch(css, /^\.adoption-box\s*\{/m);
  assert.match(css, /body\.cat-sell-dragging \.next-wave-zone\.drag-over \.next-wave-adoption\s*{[^}]*opacity:\s*1;/s);
});

test('the Next Wave button toggles the incoming dogs over the current battlefield dogs', () => {
  assert.match(html, /<button id="next-wave-toggle"[^>]*aria-pressed="false"[^>]*>[\s\S]*Tap here to see[\s\S]*NEXT WAVE[\s\S]*<\/button>/);
  assert.match(html, /<div id="dog-preview-grid" class="dog-preview-grid" hidden><\/div>/);
  assert.doesNotMatch(html, /id="preview-round"|NEXT WAVE\s*<small>ROUND/);
  assert.match(app, /let nextWaveVisible = false;/);
  assert.match(app, /dogPreviewEl\.hidden = !nextWaveVisible;/);
  assert.match(app, /board\?\.classList\.toggle\('showing-next-wave', nextWaveVisible\);/);
  assert.match(app, /nextWaveVisible = !nextWaveVisible;\s*renderDogPreview\(\);\s*renderBoard\(\);/);
  assert.match(app, /toggle\?\.setAttribute\('aria-pressed', String\(nextWaveVisible\)\);/);
  assert.match(app, /label\.textContent = nextWaveVisible \? 'HIDE NEXT WAVE' : 'NEXT WAVE';/);
  assert.match(css, /\.board\.showing-next-wave \.grid \.dog-unit\s*{\s*visibility:\s*hidden;\s*}/);
  assert.match(css, /\.preview-sign\.is-active \.tiny-label\s*{\s*display:\s*none;\s*}/);
});

test('the left wing swaps planning controls for persistent battle tactics', () => {
  assert.match(html, /id="phase-control-wing"[\s\S]*id="planning-panel"[\s\S]*id="shop-panel"[\s\S]*class="workbench-panel"[\s\S]*id="tactics-panel"[\s\S]*class="round-controls phase-action"/);
  assert.match(app, /const isBattle = game\.phase === 'combat' \|\| game\.phase === 'tactics';/);
  assert.match(app, /planningPanel\.hidden = !isPlanning;\s*panel\.hidden = !isBattle;/);
  assert.match(app, /doneButton\.hidden = game\.phase === 'combat'/);
  assert.match(app, /zone\.hidden = !isPlanning;/);
});

test('planning actions sit directly below the Cat Workbench', () => {
  assert.doesNotMatch(html, /PICK YOUR DEFENDERS/);
  assert.match(css, /\.planning-panel\s*{[^}]*flex:\s*0 1 auto;/s);
});

test('empty Cat Workbench slots stay visually blank', () => {
  assert.doesNotMatch(html, /Hold, merge, then deploy\./);
  assert.doesNotMatch(app, /<span class="empty-plus">\+<\/span><small>RESERVE<\/small>/);
  assert.match(app, /slot\.setAttribute\('aria-label', `Empty Cat Workbench slot \$\{index \+ 1\}`\);/);
});

test('tutorial selectors follow the relocated planning, scout, adoption, and tactics UI', () => {
  assert.match(html, /id="planning-panel"[\s\S]*id="shop"[\s\S]*id="workbench"/);
  assert.match(html, /id="board"[\s\S]*id="dog-preview-grid"/);
  assert.match(html, /id="tactics-panel"/);
  assert.doesNotMatch(html, /class="dog-preview-wing/);
});

test('the permanent Cat Cart information panel keeps the title and a single row of status chips', () => {
  assert.match(html, /id="phase-control-wing"[\s\S]*class="phase-status-panel"[\s\S]*<h1>CATS <span>VS<\/span> DOGS<\/h1>[\s\S]*id="settings"[\s\S]*class="phase-hud"[\s\S]*id="gold"[\s\S]*id="lives"[\s\S]*id="round"[\s\S]*id="planning-panel"/);
  assert.equal((html.match(/phase-hud-chip/g) ?? []).length, 3);
  assert.doesNotMatch(html, /id="squad-count"|id="speed-toggle"|id="pause-toggle"/);
  assert.match(css, /\.phase-hud\s*{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);/s);
  assert.match(css, /\.phase-hud-chip\.hud-chip\s*{[^}]*border-width:\s*2px;[^}]*box-shadow:\s*2px 2px 0 var\(--ink\);/s);
  assert.doesNotMatch(html, /id="tutorial"/);
  assert.doesNotMatch(html, /id="restart"/);
});

test('the command wing and supporting UI use the large readable type scale', () => {
  assert.match(css, /\.field-house-layout\s*{[^}]*grid-template-columns:\s*5fr 6fr;[^}]*aspect-ratio:\s*11 \/ 14;/s);
  assert.match(css, /\/\* Large-type interface scale\./);
  assert.match(css, /\.phase-titlebar h1\s*{\s*font-size:\s*14px;/);
  assert.match(css, /\.phase-hud-chip\.hud-chip strong\s*{\s*font-size:\s*18px;/);
  assert.match(css, /\.phase-control-wing \.shop-grid\s*{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(css, /\.phase-control-wing \.shop-card strong\s*{[^}]*white-space:\s*normal;[^}]*text-overflow:\s*clip;/s);
  assert.match(css, /\.phase-control-wing \.tactics-panel > p\s*{[^}]*font-size:\s*13px;/);
  assert.match(css, /\.phase-control-wing \.message\s*{[^}]*font-size:\s*13px;/);
  assert.match(css, /\.tutorial-bubble p\s*{[^}]*font-size:\s*18px;/);
  assert.match(css, /\.glossary-entry\s*{\s*height:\s*max-content;\s*min-height:\s*224px;/);
  assert.match(html, /<small>Spend every coin · Clear every dog to win<\/small>/);
});

test('the Cat Cart wing and fence align with the left wood rail', () => {
  assert.match(css, /\.field-house-layout::before\s*{[^}]*left:\s*-16px;/s);
  assert.match(css, /\.phase-control-wing\s*{[^}]*width:\s*calc\(100% \+ 16px\);[^}]*margin-left:\s*-16px;[^}]*box-shadow:\s*inset 0 0 0 2px #75905e;/s);
  assert.match(css, /\.phase-control-wing\.is-battle\s*{[^}]*box-shadow:\s*inset 0 0 0 2px #54849c,/s);
});

test('wood side rails begin at the house roofline', () => {
  assert.match(css, /\.board-frame::after\s*{[^}]*height:\s*calc\(100% \/ 14 \* 2\);/s);
  const houseRoof = css.match(/\.house-wing::before\s*{([\s\S]*?)\n}/)?.[1] ?? '';
  assert.doesNotMatch(houseRoof, /repeating-linear-gradient\(180deg/);
});

test('the glossary opens from Cat Cart and Settings', () => {
  assert.match(html, /class="cart-actions"[\s\S]*id="cart-info"[\s\S]*id="refresh"/);
  assert.match(html, /id="settings-glossary"[\s\S]*Cat &amp; Dog Glossary/);
  assert.match(app, /\$\('#cart-info'\)\?\.addEventListener\('click', \(\) => openGlossary\(\$\('#cart-info'\)\)\)/);
  assert.match(app, /\$\('#settings-glossary'\)\?\.addEventListener\('click'/);
});

test('stable game progress is restored and saved locally', () => {
  assert.match(app, /const GAME_SAVE_KEY = 'cvd-game-save-v1';/);
  assert.match(app, /return restoreGame\(saved\.game, Math\.random\);/);
  assert.match(app, /if \(playing \|\| !\['prep', 'tactics'\]\.includes\(game\.phase\)\) return;/);
  assert.match(app, /if \(tutorialActive\) syncTutorial\(\);\s*saveGameProgress\(\);/);
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
