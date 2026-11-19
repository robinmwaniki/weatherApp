const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'features', 'pwa.js'), 'utf8');

function createContext(options = {}) {
  const documentListeners = {};
  const windowListeners = {};
  const elements = {
    featurePanels: { append() {} },
    pwaStatus: { textContent: '' },
    installAppButton: {
      disabled: true,
      textContent: 'Install app',
      addEventListener() {}
    }
  };
  const navigator = { onLine: options.online !== false };
  if (options.serviceWorker !== false) {
    navigator.serviceWorker = {
      register: options.register || (() => Promise.resolve({ active: true })),
      ready: options.ready || Promise.resolve({ active: true })
    };
  }
  const document = {
    addEventListener(type, callback) { documentListeners[type] = callback; },
    getElementById(id) { return elements[id] || null; },
    createElement() { return { className: '', innerHTML: '' }; }
  };
  const window = {
    addEventListener(type, callback) { windowListeners[type] = callback; }
  };
  const context = { window, navigator, document, location: { protocol: 'https:' } };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'features/pwa.js' });
  return { documentListeners, windowListeners, elements, navigator };
}

test('does not report offline readiness before the service worker becomes active', async () => {
  const { documentListeners, elements } = createContext();
  documentListeners.DOMContentLoaded();
  assert.equal(elements.pwaStatus.textContent, 'Online · preparing offline support…');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(elements.pwaStatus.textContent, 'Online · app shell cached for offline use.');
});

test('explains when service workers are unsupported', () => {
  const { documentListeners, elements } = createContext({ serviceWorker: false });
  documentListeners.DOMContentLoaded();
  assert.match(elements.pwaStatus.textContent, /not available in this browser/i);
});

test('reports service-worker registration failures', async () => {
  const { documentListeners, elements } = createContext({
    register: () => Promise.reject(new Error('registration failed'))
  });
  documentListeners.DOMContentLoaded();
  await new Promise(resolve => setImmediate(resolve));
  assert.match(elements.pwaStatus.textContent, /could not be registered/i);
});

test('shows cached-shell status when offline after activation', async () => {
  const { documentListeners, windowListeners, elements, navigator } = createContext();
  documentListeners.DOMContentLoaded();
  await new Promise(resolve => setImmediate(resolve));
  navigator.onLine = false;
  windowListeners.offline();
  assert.match(elements.pwaStatus.textContent, /cached app shell is available/i);
});
