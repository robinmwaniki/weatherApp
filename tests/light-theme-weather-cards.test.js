const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');

test('light theme overrides the later hard-coded dark dashboard card gradients', () => {
  assert.match(css, /body\.theme-light \.weather-content > \.card\s*\{[^}]*background:\s*#ffffff/s);
  assert.match(css, /body\.theme-light \.weather-content > \.current-card\s*\{[^}]*linear-gradient\(125deg, #ffffff/s);
  assert.match(css, /body\.theme-light \.current-card::before\s*\{/);
});

test('light theme gives hourly forecast tiles and the current-hour tile light surfaces', () => {
  assert.match(css, /body\.theme-light \.weather-content \.hour-item\s*\{[^}]*background:\s*#f3f7fa/s);
  assert.match(css, /body\.theme-light \.weather-content \.hour-item\.now\s*\{[^}]*background:\s*#e4f3fa/s);
  assert.match(css, /body\.theme-light \.weather-content \.hour-item:hover\s*\{[^}]*background:\s*#eaf5fa/s);
});

test('light theme styles five-day forecast rows, labels and precipitation tracks', () => {
  assert.match(css, /body\.theme-light \.weather-content \.forecast-row:hover\s*\{[^}]*background:\s*#f1f7fa/s);
  assert.match(css, /body\.theme-light \.weather-content \.fc-bar\s*\{[^}]*background:\s*#dce6ed/s);
  assert.match(css, /body\.theme-light \.weather-content \.fc-lo-t/);
});

test('light theme covers secondary weather cards and nested statistic tiles', () => {
  for (const selector of ['.stat-item', '.atm-item', '.map-wrap', '.wind-big', '.gauge-val', '.last-updated']) {
    assert.ok(css.includes('body.theme-light .weather-content ' + selector), 'Missing light theme selector for ' + selector);
  }
});

test('all new weather surface overrides are scoped to light mode', () => {
  const section = css.slice(css.lastIndexOf('/* ===== LIGHT THEME: FINAL WEATHER DASHBOARD SURFACES ====='));
  assert.ok(section.length > 0);
  assert.match(section, /body\.theme-light/);
  assert.doesNotMatch(section, /(^|\n)\s*\.weather-content > \.card\s*\{/);
});
