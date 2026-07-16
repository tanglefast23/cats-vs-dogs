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

test('mobile uses one wooden status plank above the fence and hides duplicate cat names', () => {
  assert.match(html, /class="battle-column"[\s\S]*class="mobile-status-plank"[\s\S]*data-hud-value="gold"[\s\S]*id="mobile-tutorial"[\s\S]*id="mobile-settings"[\s\S]*class="field-house-layout"/);
  assert.match(css, /@media \(max-width: 880px\)[\s\S]*\.mobile-status-plank\s*{[^}]*display:\s*grid;[^}]*repeating-linear-gradient/s);
  assert.match(css, /\.phase-control-wing > \.phase-status-panel\s*{\s*display:\s*none;\s*}/);
  assert.match(css, /\.phase-control-wing \.shop-card > strong,[\s\S]*\.phase-control-wing \.bench-slot > small\s*{\s*display:\s*none;\s*}/);
  assert.match(app, /hudValueElements\('gold'\)\.forEach/);
  assert.match(app, /button\.setAttribute\('aria-label', `Level \$\{slot\.level \?\? 1\} \$\{info\.name\}\. Tap for details or drag to place\.`\);/);
  assert.match(app, /\$\('#mobile-tutorial'\)\?\.addEventListener\('click', startTutorial\)/);
  assert.match(app, /\$\('#mobile-settings'\)\?\.addEventListener\('click'/);
});

test('mobile shop cats stand directly on their compact card edge', () => {
  assert.match(css, /@media \(max-width: 880px\)[\s\S]*\.phase-control-wing \.shop-slot\s*{\s*gap:\s*0;\s*}/s);
  assert.match(css, /@media \(max-width: 880px\)[\s\S]*\.phase-control-wing \.shop-card\s*{[^}]*padding:\s*4px 2px 0;/s);
  assert.match(css, /@media \(max-width: 880px\)[\s\S]*\.phase-control-wing \.shop-card\s*{[^}]*overflow:\s*hidden;/s);
  assert.match(css, /@media \(max-width: 880px\)[\s\S]*\.phase-control-wing \.shop-card canvas\s*{\s*margin-bottom:\s*-3px;\s*}/s);
});

test('mobile preserves the battlefield while the command wing shrinks first', () => {
  assert.match(css, /\.field-house-layout\s*{[^}]*grid-template-columns:\s*5fr 6fr;[^}]*aspect-ratio:\s*11 \/ 14;/s);
  assert.match(css, /@media \(max-width: 880px\)[\s\S]*\.field-house-layout\s*{[^}]*grid-template-columns:\s*4fr 6fr;[^}]*width:\s*min\(100%, 820px, calc\(\(100vh - 200px\) \* 10 \/ 14\)\);[^}]*aspect-ratio:\s*10 \/ 14;/s);
  assert.match(css, /\.mobile-status-plank\s*{[^}]*width:\s*min\(100%, 820px, calc\(\(100vh - 200px\) \* 10 \/ 14\)\);/s);
});

test('Cat Workbench omits the redundant capacity counter', () => {
  assert.match(html, /<h2>Cat Workbench<\/h2>/);
  assert.doesNotMatch(html, /id="bench-count"|Cat Workbench\s*<small>0\/3<\/small>/);
  assert.doesNotMatch(app, /bench-count/);
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

test('the Adoption Box appears 1.5 battlefield cells higher at 75% opacity and scales up as the cat approaches', () => {
  assert.doesNotMatch(html, /<section id="adoption-box"/);
  assert.match(html, /<div id="board"[\s\S]*<aside id="next-wave-zone"[\s\S]*<section id="next-wave-adoption"/);
  assert.match(app, /closest\?\.\('\.next-wave-adoption'\)/);
  assert.match(app, /querySelectorAll\('\.cell, \.worker-slot, \.bench-slot, \.next-wave-adoption'\)/);
  assert.doesNotMatch(css, /^\.adoption-box\s*\{/m);
  assert.match(css, /\.next-wave-adoption\s*{[^}]*bottom:\s*calc\(10px \+ 15%\);[^}]*opacity:\s*\.75;[^}]*transform:\s*scale\(var\(--adoption-scale, \.75\)\);/s);
  assert.match(app, /function updateAdoptionBoxProximity\(clientX, clientY\)[\s\S]*adoptionBoxScaleForPointer\([\s\S]*panel\.style\.setProperty\('--adoption-scale', scale\.toFixed\(3\)\);/s);
  assert.match(app, /positionDragVisual\(event\.clientX, event\.clientY\);\s*updateAdoptionBoxProximity\(event\.clientX, event\.clientY\);\s*updateDragHover/);
  assert.doesNotMatch(css, /body\.cat-sell-dragging \.next-wave-zone \.next-wave-adoption\s*{[^}]*opacity:\s*\.34/s);
  assert.match(css, /body\.cat-sell-dragging \.next-wave-adoption\.drag-over\s*{[^}]*box-shadow:[^}]*0 0 24px 10px[^}]*transform:\s*scale\(1\);/s);
});

test('the Next Wave button toggles the incoming dogs over the current battlefield dogs', () => {
  assert.match(html, /<button id="next-wave-toggle"[^>]*aria-pressed="false"[^>]*>[\s\S]*Tap here to see[\s\S]*NEXT WAVE[\s\S]*<\/button>/);
  assert.match(html, /<div id="dog-preview-grid" class="dog-preview-grid" hidden><\/div>/);
  assert.doesNotMatch(html, /id="preview-round"|NEXT WAVE\s*<small>ROUND/);
  assert.match(app, /let nextWaveVisible = false;/);
  assert.match(app, /dogPreviewEl\.hidden = !nextWaveVisible;/);
  assert.match(app, /board\?\.classList\.toggle\('showing-next-wave', nextWaveVisible\);/);
  assert.match(app, /nextWaveVisible = !nextWaveVisible;\s*if \(nextWaveVisible\) completeTutorialTipForAction\('view-next-wave'\);\s*renderDogPreview\(\);\s*renderBoard\(\);/);
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
  assert.doesNotMatch(html, /RESERVE · MERGE · DEPLOY/);
  assert.match(css, /\.planning-panel\s*{[^}]*flex:\s*0 1 auto;/s);
});

test('the Cat Field has one permanent two-slot interactive Supplies tray', () => {
  assert.match(html, /class="board-frame"[\s\S]*id="board"[\s\S]*id="supplies"[^>]*aria-label="Supplies"[\s\S]*id="inventory"[\s\S]*<\/section>\s*<\/div>/);
  assert.match(css, /\.planning-inventory-grid\s*{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/s);
  assert.match(css, /\.board-frame\s*{[^}]*z-index:\s*2;[^}]*align-self:\s*start;[^}]*aspect-ratio:\s*6 \/ 14;/s);
  assert.match(css, /\.field-supplies-panel\s*{[^}]*z-index:\s*1;[^}]*top:\s*100%;[^}]*left:\s*0;[^}]*width:\s*100%;/s);
  assert.match(css, /\.house-wing\s*{[^}]*z-index:\s*5;/s);
  assert.match(app, /function syncFieldSuppliesLayout\(\)[\s\S]*supplies\.parentElement !== boardFrame\) boardFrame\.append\(supplies\);/);
  assert.match(app, /const visiblePlanningCats = game\.shop\.filter\(Boolean\)\.length \+ game\.workers\.filter\(Boolean\)\.length;\s*fieldLayout\.classList\.toggle\('is-crowded-mobile', visiblePlanningCats >= 7\);/);
  assert.match(app, /hideUnitTooltip\(\);\s*syncFieldSuppliesLayout\(\);\s*renderShop\(\);/);
  assert.match(css, /@media \(max-width: 880px\)[\s\S]*\.field-house-layout\.is-crowded-mobile\s*{\s*margin-top:\s*0;\s*}[\s\S]*\.field-house-layout\.is-crowded-mobile::before\s*{\s*display:\s*none;\s*}/s);
  assert.match(css, /@media \(max-width: 880px\)[\s\S]*\.field-house-layout\.is-crowded-mobile \.house-wing\s*{\s*transform:\s*translateY\(16px\);\s*}/s);
  assert.match(app, /slot\.className = `planning-inventory-item \$\{item \? 'filled' : 'empty'\}`;/);
  assert.match(app, /bindPetDrag\(slot, 'item', \{ \.\.\.item, inventoryIndex: index \}\);/);
  assert.match(app, /<strong>×\$\{item\.quantity\}<\/strong>/);
  assert.doesNotMatch(html, /id="planning-(?:supplies|inventory)"|tactics-supplies|HOUSE SUPPLIES/);
  assert.doesNotMatch(app, /syncPlanningSupplies/);
});

test('collected Production House items float into their exact Supplies slot', () => {
  assert.match(app, /destination\?\.type === 'storage'[\s\S]*inventoryEl\?\.querySelector\(`\[data-inventory-index="\$\{destination\.index\}"\]`\)/);
  assert.match(app, /const sourceRect = outputHost\.getBoundingClientRect\(\);\s*const targetRect = collectionTargetRect\(destination\);\s*window\.setTimeout\(\(\) => flyCollectedOutput\(output, sourceRect, targetRect\)/);
  assert.match(app, /render\(\);\s*showCollectionArrival\(destination, output\.quantity\);/);
  assert.match(css, /\.planning-inventory-item\.collection-arrival,[\s\S]*animation:\s*collection-arrival/);
  assert.doesNotMatch(app, /destination\.type === 'gold'\)\s*{[\s\S]*flyCollectedOutput/);
});

test('mobile coin collection ends on the rendered gold number without spilling into lives', () => {
  assert.match(app, /function visibleHudValueRect\(kind\)[\s\S]*range\.selectNodeContents\(textNode\);[\s\S]*return rect\.width && rect\.height \? rect : value\.getBoundingClientRect\(\);/);
  assert.match(app, /function collectionTargetRect\(destination\)\s*{\s*if \(destination\?\.type === 'gold'\) return visibleHudValueRect\('gold'\);/);
  assert.match(app, /scale\(\.28\) rotate\(360deg\)`, filter: 'none', opacity: \.12, offset: 1/);
});

test('mobile scoreboard centers each icon and value together', () => {
  assert.match(css, /\.mobile-hud-stat strong\s*{[^}]*display:\s*inline-flex;[^}]*justify-content:\s*center;[^}]*gap:\s*5px;[^}]*font-size:\s*20px;[^}]*text-align:\s*center;/s);
  assert.match(css, /\.mobile-hud-stat\.gold strong::before\s*{\s*content:\s*'●';\s*color:\s*#c48808;/);
  assert.match(css, /\.mobile-hud-stat\.lives strong::before\s*{\s*content:\s*'♥';\s*color:\s*#d84a45;/);
});

test('mobile scoreboard omits labels and Tutorial omits the question mark', () => {
  assert.match(css, /\.mobile-hud-stat small\s*{\s*display:\s*none;\s*}/);
  assert.match(html, /id="mobile-tutorial"[^>]*>TUTORIAL<\/button>/);
  assert.doesNotMatch(html, /id="mobile-tutorial"[^>]*>[\s\S]*?\?[\s\S]*?<\/button>/);
  assert.match(css, /\.mobile-tutorial-button\s*{[^}]*font-family:\s*var\(--px\);[^}]*font-size:\s*6px;/s);
});

test('mobile wave announcements scale and wrap inside the battlefield width', () => {
  assert.match(css, /@media \(max-width: 880px\)[\s\S]*\.wave-banner\s*{[^}]*width:\s*max-content;[^}]*max-width:\s*calc\(100% - 20px\);[^}]*font-size:\s*clamp\(8px, 2\.75vw, 12px\);[^}]*text-align:\s*center;[^}]*white-space:\s*normal;[^}]*overflow-wrap:\s*anywhere;/s);
});

test('mobile battlefield hides level badges so pet artwork stays visible', () => {
  assert.match(css, /@media \(max-width: 880px\)[\s\S]*\.board \.unit-badge\s*{\s*display:\s*none;\s*}/s);
  assert.doesNotMatch(css, /\n\s*\.unit-badge\s*{\s*display:\s*none;\s*}/);
});

test('successful shop spending animates the coin number and plays its spend sound', () => {
  assert.match(app, /function showCoinSpendFeedback\(\)[\s\S]*playCoinSpend\(\)[\s\S]*classList\.add\('coin-spent'\)/);
  assert.match(app, /const goldBefore = game\.gold;[\s\S]*if \(changed && game\.gold < goldBefore\) showCoinSpendFeedback\(\);/);
  assert.match(app, /id === 'refresh'[\s\S]*if \(game !== previousGame\) showCoinSpendFeedback\(\);/);
  assert.match(css, /\.coin-spent\s*{[^}]*animation:\s*coin-spent \.4s steps\(5\)/);
  assert.match(css, /@keyframes coin-spent\s*{[\s\S]*scale\(\.82\)[\s\S]*scale\(1\.16\)/);
});

test('empty production slots do not show plus signs', () => {
  assert.doesNotMatch(app, /class="empty-plus">\+<\/span>/);
  assert.match(app, /slot\.setAttribute\('aria-label', `Empty production slot \$\{index \+ 1\}`\);/);
});

test('empty Cat Workbench slots stay visually blank', () => {
  assert.doesNotMatch(html, /Hold, merge, then deploy\./);
  assert.doesNotMatch(app, /<span class="empty-plus">\+<\/span><small>RESERVE<\/small>/);
  assert.match(app, /slot\.setAttribute\('aria-label', `Empty Cat Workbench slot \$\{index \+ 1\}`\);/);
});

test('Workbench and Production sprites keep square integer pixel scales', () => {
  assert.match(css, /\.worker-slot\s*{[^}]*--slot-sprite-size:\s*64px;[^}]*--slot-sprite-half:\s*32px;/s);
  assert.match(css, /\.worker-slot > canvas\.slot-cat,\s*\.worker-slot > canvas\.slot-station\s*{[^}]*width:\s*var\(--slot-sprite-size\);[^}]*height:\s*var\(--slot-sprite-size\);/s);
  assert.match(css, /\.bench-slot > canvas\s*{[^}]*width:\s*64px;[^}]*height:\s*64px;/s);
  assert.match(css, /\.bench-slot \.unit > canvas\s*{\s*width:\s*64px;\s*height:\s*64px;/);
  assert.match(css, /@media \(max-width: 880px\)[\s\S]*\.worker-slot\s*{[^}]*--slot-sprite-size:\s*32px;[^}]*--slot-sprite-half:\s*16px;[\s\S]*\.bench-slot > canvas\s*{[^}]*width:\s*32px;[^}]*height:\s*32px;/s);
});

test('tutorial selectors follow the relocated planning, scout, adoption, and tactics UI', () => {
  assert.match(html, /id="planning-panel"[\s\S]*id="shop"[\s\S]*id="workbench"/);
  assert.match(html, /id="board"[\s\S]*id="dog-preview-grid"/);
  assert.match(html, /id="tactics-panel"/);
  assert.doesNotMatch(html, /class="dog-preview-wing/);
});

test('the Tactics panel only presents its title and live ability state', () => {
  assert.match(html, /id="tactics-panel"[^>]*aria-label="Tactics"[\s\S]*<h2>Tactics<\/h2>[\s\S]*id="active-abilities"/);
  assert.doesNotMatch(html, /Tactics Window|tactics-kicker|tactics-help|between combat exchanges/i);
  assert.doesNotMatch(app, /BETWEEN COMBAT EXCHANGES|Move each cat once, drag supplies|Watch the fight\. Movement/);
  assert.match(app, /No active-ability cats deployed\./);
});

test('the permanent Cat Cart information panel keeps the title and a single row of status chips', () => {
  assert.match(html, /id="phase-control-wing"[\s\S]*class="phase-status-panel"[\s\S]*<h1>CATS <span>VS<\/span> DOGS<\/h1>[\s\S]*id="tutorial"[\s\S]*id="settings"[\s\S]*class="phase-hud"[\s\S]*id="gold"[\s\S]*id="lives"[\s\S]*id="round"[\s\S]*id="planning-panel"/);
  assert.equal((html.match(/phase-hud-chip/g) ?? []).length, 3);
  assert.doesNotMatch(html, /id="squad-count"|id="speed-toggle"|id="pause-toggle"/);
  assert.match(css, /\.phase-hud\s*{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);/s);
  assert.match(css, /\.phase-hud-chip\.hud-chip\s*{[^}]*border-width:\s*2px;[^}]*box-shadow:\s*2px 2px 0 var\(--ink\);/s);
  assert.match(html, /id="tutorial"[^>]*aria-label="Start a new tutorial"[^>]*>TUTORIAL<\/button>/);
  assert.match(app, /\$\('#tutorial'\)\?\.addEventListener\('click', startTutorial\);/);
  assert.doesNotMatch(html, /id="restart"/);
});

test('the command wing and supporting UI use the large readable type scale', () => {
  assert.match(css, /\.field-house-layout\s*{[^}]*grid-template-columns:\s*5fr 6fr;[^}]*aspect-ratio:\s*11 \/ 14;/s);
  assert.match(css, /\/\* Large-type interface scale\./);
  assert.match(css, /\.phase-titlebar h1\s*{\s*font-size:\s*14px;/);
  assert.match(css, /\.phase-hud-chip\.hud-chip strong\s*{\s*font-size:\s*18px;/);
  assert.match(css, /\.phase-control-wing \.shop-grid\s*{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(css, /\.phase-control-wing \.shop-card strong\s*{[^}]*white-space:\s*normal;[^}]*text-overflow:\s*clip;/s);
  assert.match(css, /\.phase-control-wing \.tactics-heading h2\s*{[^}]*font-size:\s*17px;/);
  assert.doesNotMatch(html, /id="message"|class="message"/);
  assert.doesNotMatch(css, /\.message\s*{/);
  assert.match(css, /\.tutorial-bubble p\s*{[^}]*font-size:\s*18px;/);
  assert.match(css, /\.glossary-entry\s*{\s*height:\s*max-content;\s*min-height:\s*224px;/);
  assert.match(html, /id="done-label">READY<\/span><\/button>/);
  assert.doesNotMatch(html, /START ROUND|Spend every coin · Clear every dog to win/);
  assert.match(app, /\$\('#done-label'\)\.textContent = 'READY';/);
});

test('the Cat Cart wing and fence align with the left wood rail', () => {
  assert.match(css, /\.field-house-layout::before\s*{[^}]*left:\s*-16px;/s);
  assert.match(css, /\.phase-control-wing\s*{[^}]*width:\s*calc\(100% \+ 16px\);[^}]*margin-left:\s*-16px;[^}]*box-shadow:\s*inset 0 0 0 2px #75905e;/s);
  assert.match(css, /\.phase-control-wing\.is-battle\s*{[^}]*box-shadow:\s*inset 0 0 0 2px #54849c,/s);
});

test('wood paneling encloses only the Production House', () => {
  assert.match(css, /\.house-wing \.production-grid::before\s*{[^}]*left:\s*-16px;[^}]*right:\s*0;[^}]*bottom:\s*-16px;[^}]*height:\s*16px;/s);
  assert.match(css, /\.house-wing\s*{[^}]*transform:\s*translateY\(-16px\);/s);
  assert.match(css, /\.phase-control-wing\.is-battle \.phase-action\s*{[^}]*margin-bottom:\s*6px;/s);
  assert.match(css, /\.house-wing::after\s*{[^}]*left:\s*-16px;[^}]*top:\s*0;/s);
  assert.match(css, /\.house-wing \.production-grid::after\s*{[^}]*right:\s*0;[^}]*top:\s*0;[^}]*bottom:\s*0;[^}]*width:\s*16px;/s);
  assert.doesNotMatch(css, /\.field-house-layout::after/);
  assert.doesNotMatch(css, /\.board-frame::after/);
  const houseRoof = css.match(/\.house-wing::before\s*{([\s\S]*?)\n}/)?.[1] ?? '';
  assert.doesNotMatch(houseRoof, /repeating-linear-gradient\(180deg/);
});

test('the glossary opens from Cat Cart and Settings', () => {
  assert.match(html, /class="cart-actions"[\s\S]*id="cart-info"[\s\S]*id="refresh"/);
  assert.match(html, /id="settings-glossary"[\s\S]*Cat &amp; Dog Glossary/);
  assert.match(app, /\$\('#cart-info'\)\?\.addEventListener\('click',[\s\S]*completeTutorialTipForAction\('open-glossary'\);[\s\S]*openGlossary\(\$\('#cart-info'\)\);/);
  assert.match(app, /\$\('#settings-glossary'\)\?\.addEventListener\('click'/);
});

test('stable game progress is restored and saved locally', () => {
  assert.match(app, /const GAME_SAVE_KEY = 'cvd-game-save-v1';/);
  assert.match(app, /return restoreGame\(saved\.game, Math\.random\);/);
  assert.match(app, /if \(playing \|\| !\['prep', 'tactics'\]\.includes\(game\.phase\)\) return;/);
  assert.match(app, /if \(tutorialActive\) syncTutorial\(\);/);
  assert.match(app, /saveGameProgress\(\);\s*}/);
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
