importScripts('./feature-utils.js');
const CACHE_NAME = 'skyline-shell-v1';
const CORE_ASSETS = [
  './', './index.html', './style.css', './app.js', './feature-utils.js',
  './features/favourites.js', './features/recent-history.js',
  './features/city-comparison.js', './features/weather-alerts.js',
  './features/settings.js', './features/share-report.js',
  './features/pwa.js', './manifest.webmanifest', './offline.html',
  './assets/icon-192.svg', './assets/icon-512.svg'
];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_ASSETS.map(path => new URL(path, self.registration.scope).href));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('skyline-shell-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // OpenWeatherMap and all other cross-origin API requests are deliberately network-only.
  if (!self.SkylineUtils.isSameOriginAsset(request.url, self.location.origin)) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        return response;
      } catch {
        return (await caches.match(request)) || (await caches.match(new URL('./index.html', self.registration.scope))) || (await caches.match(new URL('./offline.html', self.registration.scope)));
      }
    })());
    return;
  }
  if (!CORE_ASSETS.some(path => new URL(path, self.registration.scope).href === request.url)) return;
  event.respondWith((async () => (await caches.match(request)) || fetch(request))());
});

self.addEventListener('notificationclick', event => { event.notification.close(); event.waitUntil((async () => { const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true }); for (const client of windows) { if ('focus' in client) return client.focus(); } if (self.clients.openWindow) return self.clients.openWindow('./'); })()); });
