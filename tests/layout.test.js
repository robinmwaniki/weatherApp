const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');

test('keeps the weather dashboard and secondary tools as separate sections', () => {
  assert.match(html, /<main class="main-content" id="mainContent">/);
  assert.match(html, /<section class="tools-section" aria-labelledby="toolsHeading">/);
  assert.ok(html.indexOf('</main>') < html.indexOf('<section class="tools-section"'));
  assert.match(html, /id="featurePanels" class="feature-panels"/);
});

test('retains the existing weather cards and statistics identifiers', () => {
  for (const id of ['currentCard', 'sHumidity', 'sWind', 'sFeels', 'sVis', 'sPress', 'sCloud', 'sunArc', 'hourlyScroll', 'forecastList', 'windCompass', 'humidityGauge', 'mapWrap']) {
    assert.ok(html.includes('id="' + id + '"'), 'Missing existing weather element: ' + id);
  }
});

test('defines desktop editorial placements for hero, sunrise and forecast cards', () => {
  assert.match(css, /\.current-card\s*\{[^}]*grid-column:\s*span 8/s);
  assert.match(css, /\.sun-card\s*\{[^}]*grid-column:\s*span 4/s);
  assert.match(css, /\.hourly-card\s*\{\s*grid-column:\s*1 \/ -1/s);
  assert.match(css, /\.forecast-card\s*\{\s*grid-column:\s*span 7/s);
  assert.match(css, /\.wind-card\s*\{\s*grid-column:\s*span 5/s);
});

test('provides tablet and mobile breakpoints with a single-column phone layout', () => {
  assert.match(css, /@media\s*\(max-width:\s*1050px\)/);
  assert.match(css, /@media\s*\(max-width:\s*700px\)/);
  assert.match(css, /@media\s*\(max-width:\s*480px\)/);
  assert.match(css, /@media\s*\(max-width:\s*340px\)/);
  assert.match(css, /@media\s*\(max-width:\s*480px\)\s*\{[\s\S]*?\.weather-content\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});

test('keeps feature tools responsive and respects reduced motion', () => {
  assert.match(css, /\.feature-panels\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/s);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});
