const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const html = read('index.html');
const css = read('style.css');
const router = read('features/page-router.js');

test('removes provider connection status and the requested footer attribution', () => {
  assert.doesNotMatch(html, /Open-Meteo connected/i);
  assert.doesNotMatch(html, /Weather data by/i);
  assert.doesNotMatch(html, /Location data by/i);
  assert.doesNotMatch(html, /Built By Robin/i);
});

test('provides a distinct navigable route for each weather and utility feature', () => {
  const pages = ['overview','current','hourly','forecast','environment','saved','history','compare','alerts','share','notifications','install','settings'];
  for (const page of pages) {
    assert.match(html, new RegExp('data-page-link="' + page + '"'));
    assert.match(router, new RegExp(page + ':'));
  }
  assert.match(router, /history\.pushState/);
  assert.match(router, /popstate/);
});

test('routes dynamically rendered feature panels to their own views', () => {
  for (const label of ['saved places','recent searches','compare cities','weather advisories','share weather','weather notifications','install skyline','preferences']) {
    assert.ok(router.toLowerCase().includes(label), 'Missing feature route for ' + label);
  }
  assert.match(router, /MutationObserver/);
});

test('light mode covers search, inputs, feature cards, suggestions, and controls', () => {
  for (const selector of ['.search-wrapper','.search-input','.suggestions','.feature-panel','.feature-action','.settings-grid select','.settings-grid input','.weather-alert','.comparison-table']) {
    assert.ok(css.includes('body.theme-light ' + selector), 'Missing light theme selector for ' + selector);
  }
  assert.match(css, /color-scheme:\s*light/);
});

test('keeps all page navigation links relative for GitHub Pages', () => {
  assert.doesNotMatch(html, /href=["']\/(?!\/)/i);
  assert.doesNotMatch(router, /location\.origin\s*\+\s*["']\//);
});
