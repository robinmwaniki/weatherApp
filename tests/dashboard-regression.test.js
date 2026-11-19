const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const settings = fs.readFileSync(path.join(root, 'features', 'settings.js'), 'utf8');

test('keeps the feature host before the main dashboard for existing feature modules', () => {
  const featureHost = html.indexOf('<div id="featurePanels" class="feature-panels"');
  const mainDashboard = html.indexOf('<main class="main-content" id="mainContent">');
  assert.notEqual(featureHost, -1, 'Feature panel host must exist');
  assert.notEqual(mainDashboard, -1, 'Main dashboard must exist');
  assert.ok(featureHost < mainDashboard, 'Feature host must precede the main dashboard');
  assert.equal((html.match(/id="featurePanels"/g) || []).length, 1, 'Feature host ID must be unique');
});

test('all browser scripts parse without syntax errors', () => {
  const scripts = [
    'app.js', 'weather-api.js', 'feature-utils.js',
    'features/settings.js', 'features/favourites.js',
    'features/recent-history.js', 'features/city-comparison.js',
    'features/weather-alerts.js', 'features/share-report.js',
    'features/pwa.js', 'features/notifications.js'
  ];
  for (const script of scripts) {
    assert.doesNotThrow(() => new vm.Script(fs.readFileSync(path.join(root, script), 'utf8'), { filename: script }), script);
  }
});

test('preferences can be reassigned when the user saves settings', () => {
  assert.match(settings, /let prefs\s*=\s*window\.SkylineUtils\.sanitizeSettings\(saved\)/);
  assert.match(settings, /prefs=\{unit:/);
  assert.doesNotMatch(settings, /const prefs\s*=\s*window\.SkylineUtils\.sanitizeSettings\(saved\)/);
});


test('settings panel saves preferences without a runtime error', () => {
  const documentListeners = {};
  const windowListeners = {};
  const elementListeners = {};
  const stored = new Map();
  const elements = {
    featurePanels: { append() {} },
    settingUnits: { value: 'metric' },
    settingTheme: { value: 'dark' },
    settingDefaultCity: { value: 'Nairobi' },
    savePreferences: { addEventListener(type, callback) { elementListeners[type] = callback; } },
    settingsFeedback: { textContent: '' }
  };
  const document = {
    body: { classList: { toggle() {} } },
    addEventListener(type, callback) { documentListeners[type] = callback; },
    createElement() { return { className: '', innerHTML: '' }; },
    getElementById(id) { return elements[id] || null; }
  };
  const window = {
    SkylineUtils: {
      sanitizeSettings(value) {
        return Object.assign({ unit: 'metric', theme: 'dark', defaultCity: 'Nairobi' }, value);
      }
    },
    addEventListener(type, callback) { windowListeners[type] = callback; },
    setUnit(value) { this.lastUnit = value; }
  };
  const localStorage = {
    getItem(key) { return stored.has(key) ? stored.get(key) : null; },
    setItem(key, value) { stored.set(key, value); }
  };

  vm.runInNewContext(settings, { window, document, localStorage });
  assert.equal(typeof documentListeners.DOMContentLoaded, 'function');
  documentListeners.DOMContentLoaded();

  elements.settingUnits.value = 'imperial';
  elements.settingTheme.value = 'light';
  elements.settingDefaultCity.value = 'Mombasa';
  assert.equal(typeof elementListeners.click, 'function');
  assert.doesNotThrow(() => elementListeners.click());

  assert.deepEqual(JSON.parse(stored.get('skyline:settings')), {
    unit: 'imperial',
    theme: 'light',
    defaultCity: 'Mombasa'
  });
  assert.equal(window.SkylinePreferences.defaultCity, 'Mombasa');
  assert.equal(window.lastUnit, 'imperial');
  assert.equal(elements.settingsFeedback.textContent,
    'Preferences saved. Your default city will load next time you open Skyline.');
});
