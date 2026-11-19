const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('current browser source contains no OpenWeatherMap key or credential parameter', () => {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const api = fs.readFileSync(path.join(root, 'weather-api.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

  for (const source of [app, api, html]) {
    assert.doesNotMatch(source, /openweathermap\\.org/i);
    assert.doesNotMatch(source, /API_KEY|appid=/i);
  }
});

test('README documents the keyless provider and attribution', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  assert.match(readme, /Open-Meteo Forecast API/i);
  assert.match(readme, /Open-Meteo Geocoding API/i);
  assert.ok(readme.includes('CC BY 4.0'));
  assert.match(readme, /GeoNames/i);
});
