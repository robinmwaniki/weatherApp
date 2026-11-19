const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');

test('keeps the feature panel host available before the primary dashboard', () => {
  const featureHost = html.indexOf('<div id="featurePanels" class="feature-panels"');
  const mainDashboard = html.indexOf('<main class="main-content" id="mainContent">');
  assert.notEqual(featureHost, -1);
  assert.notEqual(mainDashboard, -1);
  assert.ok(featureHost < mainDashboard);
  assert.equal((html.match(/id="featurePanels"/g) || []).length, 1);
});

test('retains the existing weather cards and statistics identifiers', () => {
  for (const id of ['currentCard', 'sHumidity', 'sWind', 'sFeels', 'sVis', 'sPress', 'sCloud', 'sunArc', 'hourlyScroll', 'forecastList', 'windCompass', 'humidityGauge', 'mapWrap']) {
    assert.ok(html.includes('id="' + id + '"'), 'Missing existing weather element: ' + id);
  }
});

test('preserves the established twelve-column weather grid', () => {
  assert.match(css, /\.weather-content\s*\{[^}]*grid-template-columns:\s*repeat\(12,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(css, /\.current-card\s*\{[^}]*grid-column:\s*1 \/ -1/s);
  assert.match(css, /\.sun-card\s*\{[^}]*grid-column:\s*span 6/s);
  assert.match(css, /\.hourly-card\s*\{[^}]*grid-column:\s*span 6/s);
  assert.match(css, /\.forecast-card\s*\{[^}]*grid-column:\s*span 7/s);
  assert.match(css, /\.wind-card\s*\{[^}]*grid-column:\s*span 5/s);
});

test('preserves the established tablet and phone breakpoints', () => {
  assert.match(css, /@media\s*\(max-width:\s*900px\)/);
  assert.match(css, /@media\s*\(max-width:\s*600px\)/);
  assert.match(css, /@media\s*\(max-width:\s*380px\)/);
  assert.match(css, /@media\s*\(max-width:\s*600px\)\s*\{[\s\S]*?\.weather-content\s*\{\s*grid-template-columns:\s*1fr/);
});

test('keeps feature panels styled and respects reduced motion', () => {
  assert.match(css, /\.feature-panels\s*\{[^}]*display:\s*grid/s);
  assert.match(css, /@media\s*\(max-width:\s*600px\)/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});
