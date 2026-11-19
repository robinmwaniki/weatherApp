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
