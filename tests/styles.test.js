import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

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
