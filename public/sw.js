/* Trove service worker — installs the app as a PWA and keeps the shell working offline.
   Strategy: network-first for navigations + API (always prefer fresh, fall back to cache),
   cache-first for static assets and fonts. The owned memory store lives on the server, so a
   cold reopen still reaches real, persisted data when online; offline shows the last shell. */
const CACHE = 'trove-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isStatic = /\.(png|jpg|jpeg|svg|webp|ico|woff2?|css|js)$/i.test(url.pathname) || url.origin.includes('fonts.g');

  if (isStatic) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => hit)),
    );
    return;
  }

  // navigations + API: network-first, fall back to cache
  e.respondWith(
    fetch(req).then((res) => {
      if (url.origin === self.location.origin && req.mode === 'navigate') {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || caches.match('/'))),
  );
});
