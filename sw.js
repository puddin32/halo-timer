const CACHE = 'halo1-timer-v3';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './img/rockets.png',
  './img/powerups.png',
  './audio/Spawn.mp3',
  './audio/american_female/0_american_50.mp3',
  './audio/american_female/1_american_40.mp3',
  './audio/american_female/2_american_30.mp3',
  './audio/american_female/3_american_20.mp3',
  './audio/american_female/4_american_powerups.mp3',
  './audio/american_female/5_american_rockets.mp3',
  './audio/australian_female/0_au_50.mp3',
  './audio/australian_female/1_au_40.mp3',
  './audio/australian_female/2_au_30.mp3',
  './audio/australian_female/3_au_20.mp3',
  './audio/australian_female/4_au_power_ups.mp3',
  './audio/australian_female/5_au_rockets.mp3',
  './audio/british_female/0_british_50.mp3',
  './audio/british_female/1_british_40.mp3',
  './audio/british_female/2_british_30.mp3',
  './audio/british_female/3_british_20.mp3',
  './audio/british_female/4_british_power_ups.mp3',
  './audio/british_female/5_british_rockets.mp3',
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
