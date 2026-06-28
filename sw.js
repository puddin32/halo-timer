importScripts('voices.js');                // VOICES + allClipPaths()

const CACHE = 'halo1-timer-v7';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './voices.js',
  './timer-core.js',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './img/rockets.png',
  './img/powerups.png',
  ...allClipPaths(),                        // every voice-pack clip + the spawn beep
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Audio/image/icon files never change -> serve cache-first (fast, offline).
// The app shell (HTML/CSS/JS/manifest) -> network-first, so code updates
// show up on a normal reload and fall back to cache when offline.
const isImmutable = (path) => /\.(mp3|wav|png|ico)$/i.test(path);

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const path = new URL(e.request.url).pathname;

  if (isImmutable(path)) {
    e.respondWith(
      caches.match(e.request).then((cached) => cached || fetch(e.request).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return resp;
      }))
    );
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return resp;
      })
      .catch(() => caches.match(e.request).then((cached) => cached || caches.match('./index.html')))
  );
});
