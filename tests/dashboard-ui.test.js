const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
const ui = fs.readFileSync(path.join(__dirname, '..', 'features', 'dashboard-ui.js'), 'utf8');

test('renders sidebar navigation with dedicated page routes', () => {
  for (const id of ['appSidebar', 'mainContent', 'currentCard', 'hourlyForecast', 'fiveDayForecast', 'featurePanels']) {
    assert.ok(html.includes('id="' + id + '"'), 'Missing navigation target: ' + id);
  }
  for (const page of ['overview', 'current', 'hourly', 'forecast', 'saved', 'history', 'compare', 'alerts', 'share', 'notifications', 'install', 'settings']) {
    assert.match(html, new RegExp('data-page-link="' + page + '"'));
    assert.match(html, new RegExp('href="\\?page=' + page + '"'));
  }
});

test('renders compact header actions with accessible labels', () => {
  for (const id of ['themeToggle', 'headerNotifications', 'headerInstall']) {
    assert.ok(html.includes('id="' + id + '"'), 'Missing header action: ' + id);
  }
  assert.match(html, /aria-label="Switch to light theme"/);
  assert.match(html, /aria-label="Enable weather notifications"/);
  assert.match(html, /aria-label="Install Skyline"/);
});

test('theme toggle persists and synchronizes with the existing Appearance preference', () => {
  assert.match(ui, /localStorage\.setItem\('skyline:settings'/);
  assert.match(ui, /theme:\s*next/);
  assert.match(ui, /settingTheme/);
  assert.match(ui, /theme-light/);
});

test('header install and notification controls delegate to the existing feature controls', () => {
  assert.match(ui, /headerInstall[\s\S]*?installAppButton/);
  assert.match(ui, /headerNotifications[\s\S]*?enableWeatherNotifications/);
  assert.match(ui, /MutationObserver/);
});

test('sidebar collapses into a horizontally scrollable mobile navigation', () => {
  assert.match(css, /\.sidebar\s*\{[^}]*position:\s*fixed/s);
  assert.match(css, /@media\s*\(max-width:\s*760px\)\s*\{[\s\S]*?\.sidebar\s*\{[^}]*position:\s*static[^}]*overflow-x:\s*auto/s);
  assert.match(css, /@media\s*\(max-width:\s*480px\)/);
});
