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
  assert.equal(requests.length, 2);
  assert.ok(requests.every(url => url.includes('units=metric')));
  assert.ok(requests.every(url => url.includes('lat=-1.2864') && url.includes('lon=36.8172')));

  requests.length = 0;
  context.setUnit('imperial');
  context.fetchWeatherByCoords(-1.2864, 36.8172, 'Nairobi', 'KE', false);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests.length, 2);
  assert.ok(requests.every(url => url.includes('units=imperial')));
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
  assert.equal(metric.windSpeed, 45);
});

test('alert threshold conversion leaves values unchanged when units match', () => {
  const limits = { highTemp: 30, lowTemp: 5, windSpeed: 20, rainProbability: 60 };
  assert.deepEqual(utils.convertAlertLimits(limits, 'metric', 'metric'), limits);
});
