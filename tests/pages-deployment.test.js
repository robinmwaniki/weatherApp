const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('uses relative paths so the project site works below /weatherApp/', () => {
  const html = read('index.html');
  const css = read('style.css');
  const scripts = [
    'app.js', 'weather-api.js', 'feature-utils.js', 'sw.js',
    'features/settings.js', 'features/favourites.js',
    'features/recent-history.js', 'features/city-comparison.js',
    'features/weather-alerts.js', 'features/share-report.js',
    'features/pwa.js', 'features/notifications.js'
  ];

  assert.doesNotMatch(html, /(?:src|href)=["']\/(?!\/)/i);
  assert.doesNotMatch(css, /url\(\s*\/(?!\/)/i);
  for (const file of scripts) {
    assert.doesNotMatch(read(file), /(?:fetch|register|openWindow)\(\s*["']\/(?!\/)/i, file);
  }
});

test('PWA manifest and service worker use a project-relative scope', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  const pwa = read('features/pwa.js');
  const worker = read('sw.js');

  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.match(pwa, /register\('\.\/sw\.js',\s*\{scope:'\.\/'\}\)/);
  assert.match(worker, /new URL\(path, self\.registration\.scope\)/);
  assert.match(worker, /isSameOriginAsset\(request\.url, self\.location\.origin\)/);
});

test('all service-worker precache entries exist in the repository', () => {
  const worker = read('sw.js');
  const assetList = worker.match(/const CORE_ASSETS = \[([\s\S]*?)\];/);
  assert.ok(assetList, 'Service worker must declare its core asset list');

  const assets = [...assetList[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
  assert.ok(assets.length > 0, 'Precache list must not be empty');
  for (const asset of assets) {
    if (asset === './') continue;
    assert.ok(fs.existsSync(path.join(root, asset.replace(/^\.\//, ''))), `Missing precache asset: ${asset}`);
  }
});


test('Pages deployment runs the test suite before artifact upload', () => {
  const workflow = read('.github/workflows/deploy-pages.yml');
  const testStep = workflow.indexOf('run: npm test');
  const uploadStep = workflow.indexOf('uses: actions/upload-pages-artifact@v3');
  const deployStep = workflow.indexOf('uses: actions/deploy-pages@v4');

  assert.notEqual(testStep, -1, 'Deployment workflow must run npm test');
  assert.ok(testStep < uploadStep, 'Tests must pass before the artifact is uploaded');
  assert.ok(uploadStep < deployStep, 'Artifact upload must happen before deployment');
});

test('Pages artifact includes the .nojekyll marker', () => {
  const workflow = read('.github/workflows/deploy-pages.yml');
  assert.match(workflow, /cp\\s+\.nojekyll\\s+_site\\/\.nojekyll/);
  assert.match(workflow, /test\\s+-f\\s+_site\\/\.nojekyll/);
});
