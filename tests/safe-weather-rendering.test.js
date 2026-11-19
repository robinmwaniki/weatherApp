const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

function section(start, end) {
  const from = app.indexOf(start);
  const to = app.indexOf(end, from);
  assert.notEqual(from, -1, 'Missing renderer: ' + start);
  assert.notEqual(to, -1, 'Missing renderer boundary: ' + end);
  return app.slice(from, to);
}

test('autocomplete renders API-provided location labels as text', () => {
  const renderer = section('function showSuggestions(list)', 'function closeSuggestions()');
  assert.doesNotMatch(renderer, /\.innerHTML\\s*=\\s*`/);
  assert.match(renderer, /name\.textContent = label/);
  assert.match(renderer, /div\.append\(pin, name\)/);
});

test('hourly forecast uses text nodes for API-derived values', () => {
  const renderer = section('function renderHourly(list)', '// ============================\\n//  5-DAY FORECAST');
  assert.doesNotMatch(renderer, /\.innerHTML\\s*=\\s*`/);
  assert.match(renderer, /temperature\.textContent/);
  assert.match(renderer, /div\.append\(time, icon, temperature, rain\)/);
});

test('daily forecast treats API descriptions as text and sets bar width as a style property', () => {
  const renderer = section('function renderForecast(list)', '// ============================\\n//  WIND COMPASS CANVAS');
  assert.doesNotMatch(renderer, /\.innerHTML\\s*=\\s*`/);
  assert.match(renderer, /description\.textContent = desc/);
  assert.match(renderer, /fill\.style\.width = `\$\{barW\}%`/);
});

test('autocomplete ignores responses for an outdated search query', () => {
  const loader = section('async function loadSuggestions(q)', 'function showSuggestions(list)');
  assert.match(loader, /input.*value.*trim\(\) !== q/s);
  assert.match(loader, /input.*value.*trim\(\) === q/s);
});
