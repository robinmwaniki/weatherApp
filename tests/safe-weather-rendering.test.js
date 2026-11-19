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
  assert.equal(renderer.includes('.innerHTML = `'), false);
  assert.ok(renderer.includes('name.textContent = label'));
  assert.ok(renderer.includes('div.append(pin, name)'));
});

test('hourly forecast uses text nodes for API-derived values', () => {
  const renderer = section('function renderHourly(list)', 'function renderForecast(list)');
  assert.equal(renderer.includes('.innerHTML = `'), false);
  assert.ok(renderer.includes('temperature.textContent'));
  assert.ok(renderer.includes('div.append(time, icon, temperature, rain)'));
});

test('daily forecast treats API descriptions as text and sets bar width as a style property', () => {
  const renderer = section('function renderForecast(list)', 'function renderWindCompass(deg, speed)');
  assert.equal(renderer.includes('.innerHTML = `'), false);
  assert.ok(renderer.includes('description.textContent = desc'));
  assert.ok(renderer.includes('fill.style.width ='));
});

test('autocomplete ignores responses for an outdated search query', () => {
  const loader = section('async function loadSuggestions(q)', 'function showSuggestions(list)');
  assert.ok(loader.includes("value.trim() !== q"));
  assert.ok(loader.includes("value.trim() === q"));
});
