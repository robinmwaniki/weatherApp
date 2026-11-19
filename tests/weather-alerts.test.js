const test = require('node:test');
const assert = require('node:assert/strict');
const { buildWeatherAlerts, validateAlertLimits } = require('../feature-utils.js');

const cur = (temp, wind = 2, id = 800) => ({
  main: { temp },
  wind: { speed: wind },
  weather: [{ id }]
});
const fore = pop => ({ list: [{ pop }] });

test('creates thunderstorm, heat, wind and rain advisories', () => {
  const alerts = buildWeatherAlerts(cur(38, 15, 211), fore(0.9), 'metric');
  assert.deepEqual(alerts.map(item => item.title), [
    'Thunderstorm conditions', 'Rain likely', 'Strong winds', 'High temperature'
  ]);
});

test('does not create alerts for mild weather', () => {
  assert.deepEqual(buildWeatherAlerts(cur(22), fore(0.1), 'metric'), []);
});

test('uses user thresholds', () => {
  const alerts = buildWeatherAlerts(cur(31, 2), fore(0.1), 'metric', {
    highTemp: 30, lowTemp: 0, windSpeed: 45, rainProbability: 75
  });
  assert.equal(alerts[0].title, 'High temperature');
});

test('uses imperial wind units and thresholds', () => {
  const alerts = buildWeatherAlerts(cur(20, 20), fore(0), 'imperial', {
    highTemp: 110, lowTemp: 32, windSpeed: 30, rainProbability: 75
  });
  assert.equal(alerts[0].title, 'Low temperature');
});

test('accepts valid advisory thresholds in metric and imperial units', () => {
  assert.equal(validateAlertLimits({ highTemp: 35, lowTemp: 0, windSpeed: 45 }, 'metric'), '');
  assert.equal(validateAlertLimits({ highTemp: 95, lowTemp: 32, windSpeed: 28 }, 'imperial'), '');
});

test('rejects empty and non-finite advisory thresholds', () => {
  assert.match(validateAlertLimits({ highTemp: '', lowTemp: 0, windSpeed: 20 }, 'metric'), /valid numbers/i);
  assert.match(validateAlertLimits({ highTemp: 'hot', lowTemp: 0, windSpeed: 20 }, 'metric'), /valid numbers/i);
  assert.match(validateAlertLimits({ highTemp: 35, lowTemp: 0, windSpeed: 'NaN' }, 'metric'), /valid numbers/i);
});

test('rejects inverted temperature thresholds and out-of-range values', () => {
  assert.match(validateAlertLimits({ highTemp: 10, lowTemp: 20, windSpeed: 20 }, 'metric'), /greater than low/i);
  assert.match(validateAlertLimits({ highTemp: 80, lowTemp: 0, windSpeed: 20 }, 'metric'), /outside the supported range/i);
  assert.match(validateAlertLimits({ highTemp: 95, lowTemp: 32, windSpeed: 250 }, 'imperial'), /wind threshold/i);
});

test('rejects zero or negative wind thresholds', () => {
  assert.match(validateAlertLimits({ highTemp: 35, lowTemp: 0, windSpeed: 0 }, 'metric'), /wind threshold/i);
  assert.match(validateAlertLimits({ highTemp: 35, lowTemp: 0, windSpeed: -2 }, 'metric'), /wind threshold/i);
});
