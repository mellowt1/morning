// Morning Screen offline cache: the app shell only. The data is kept by the page itself
// (localStorage), so this never caches the Worker's answer.
// The Pages workflow replaces CACHE with the commit on every publish, so phones pick up
// the new files on the next launch. The value here is only used locally.
const CACHE = 'morning-dev';
const FILES = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
];
const FONTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com$/;

self.addEventListener('install', (e) => {
  // HTML is fetched with the cache name as a query so the GitHub Pages CDN cannot hand back the previous version.
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(FILES.map((f) => (f.endsWith('.html') || f === './' ? new Request(f + '?' + CACHE, { cache: 'reload' }) : new Request(f, { cache: 'reload' })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('morning-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// The app's own files and the two Google Fonts, cache first, refreshed in the background.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const own = url.origin === self.location.origin;
  if (!own && !FONTS.test(url.origin)) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: own }).then((hit) => {
      const fetching = fetch(e.request).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(own && e.request.mode === 'navigate' ? './' : e.request, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || fetching;
    })
  );
});
