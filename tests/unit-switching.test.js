const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const utils = require('../feature-utils.js');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

function createAppContext(requestJson = async () => { throw new Error('mock weather request'); }) {
  const requests = [];
  const elements = new Map();
  const getElement = id => {
    if (!elements.has(id)) {
      elements.set(id, {
        style: {},
        textContent: '',
        classList: { toggle() {}, add() {}, remove() {} }
      });
    }
    return elements.get(id);
  };
  const storage = new Map();
  const window = {
    SkylinePreferences: { unit: 'metric' },
    SkylineWeatherApi: {
      createRequestGate() {
        let latest = 0;
        return { next() { return ++latest; }, isLatest(id) { return id === latest; } };
      },
      buildForecastUrl(lat, lon, units) {
        const url = new URL('https://api.open-meteo.com/v1/forecast');
        url.searchParams.set('latitude', String(lat));
        url.searchParams.set('longitude', String(lon));
        url.searchParams.set('temperature_unit', units === 'imperial' ? 'fahrenheit' : 'celsius');
        return url.toString();
      },
      async requestJson(url) {
        requests.push(url);
        return requestJson(url);
      }
    },
    addEventListener() {}
  };
  const context = {
    window,
    document: { addEventListener() {}, getElementById: getElement },
    localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, value); }
    },
    console,
    URL,
    setTimeout,
    clearTimeout,
    performance: { now: () => 0 },
    requestAnimationFrame() {},
    CustomEvent: function CustomEvent() {}
  };
  vm.createContext(context);
  vm.runInContext(appSource, context, { filename: 'app.js' });
  context.showLoading = () => {};
  context.showError = () => {};
  return { context, requests, storage };
}

test('unit changes refresh the same coordinates without adding a history entry', () => {
  const { context } = createAppContext();
  vm.runInContext(`
    currentLat = -1.2864;
    currentLon = 36.8172;
    currentData = { cur: { name: 'Nairobi', sys: { country: 'KE' } }, fore: { list: [] } };
  `, context);
  const refreshes = [];
  context.fetchWeatherByCoords = (...args) => refreshes.push(args);

  context.setUnit('imperial');
  assert.equal(vm.runInContext('unit', context), 'imperial');
  assert.deepEqual(refreshes, [[-1.2864, 36.8172, 'Nairobi', 'KE', false]]);

  context.setUnit('imperial');
  assert.equal(refreshes.length, 1, 'Selecting the already active unit must not refetch');

  context.setUnit('metric');
  assert.equal(refreshes.length, 2);
  assert.equal(refreshes[1][4], false, 'A unit-only refresh must not be recorded as a city search');
});

test('coordinate weather requests use the currently selected API units', async () => {
  const { context, requests } = createAppContext();
  context.fetchWeatherByCoords(-1.2864, 36.8172, 'Nairobi', 'KE', false);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests.length, 1);
  assert.ok(requests[0].includes('temperature_unit=celsius'));
  assert.ok(requests[0].includes('latitude=-1.2864') && requests[0].includes('longitude=36.8172'));

  requests.length = 0;
  context.setUnit('imperial');
  context.fetchWeatherByCoords(-1.2864, 36.8172, 'Nairobi', 'KE', false);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests.length, 1);
  assert.ok(requests[0].includes('temperature_unit=fahrenheit'));
});

test('weather alert temperature and wind thresholds convert in both directions', () => {
  const imperial = utils.convertAlertLimits({
    highTemp: 35,
    lowTemp: 0,
    windSpeed: 45,
    rainProbability: 75
  }, 'metric', 'imperial');
  assert.equal(imperial.highTemp, 95);
  assert.equal(imperial.lowTemp, 32);
  assert.equal(imperial.windSpeed, 28);
  assert.equal(imperial.rainProbability, 75);

  const metric = utils.convertAlertLimits(imperial, 'imperial', 'metric');
  assert.equal(metric.highTemp, 35);
  assert.equal(metric.lowTemp, 0);
  assert.equal(metric.windSpeed, 45.1);
});

test('alert threshold conversion leaves values unchanged when units match', () => {
  const limits = { highTemp: 30, lowTemp: 5, windSpeed: 20, rainProbability: 60 };
  assert.deepEqual(utils.convertAlertLimits(limits, 'metric', 'metric'), limits);
});


test('wind speed formatting respects provider response units', () => {
  const { context } = createAppContext();
  assert.equal(context.cvtSpd(10), 36, 'Metric wind speed is returned in metres per second');
  context.setUnit('imperial');
  assert.equal(context.cvtSpd(10), 10, 'Imperial wind speed is already returned in miles per hour');
});


test('visibility formatting follows the selected distance units', () => {
  const { context } = createAppContext();
  assert.equal(context.formatVisibility(1609.344), '1.6 km');
  context.setUnit('imperial');
  assert.equal(context.formatVisibility(1609.344), '1.0 mi');
  assert.equal(context.formatVisibility(0), '0.0 mi');
  assert.equal(context.formatVisibility(null), '—');
});
