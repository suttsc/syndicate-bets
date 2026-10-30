// Service worker: lets Syndicate Bets install as an app, open fast and still show the last scores offline.
//
// - Pages, scripts and styles: network first, so a deploy shows up straight away; the cache is the offline fallback.
// - Fonts and images: cache first (they rarely change), refreshed in the background.
// - Scores (GET /api/…): always live; the last good answer is kept and served, labelled, when offline.
// - Anything else (saving in admin, other sites' images): passed straight through, never cached.

const VERSION = 'v2';
const CACHE = `syndicate-bets-${VERSION}`;
const OFFLINE_NOTE = "You're offline: showing the last scores this phone saw";

// The app shell, cached on install so the app opens even if the first launch is offline.
const SHELL = [
  '/',
  '/history',
  '/leaderboard',
  '/admin',
  '/assets/app.css',
  '/fonts/inter-latin-wght-normal.woff2',
  '/fonts/space-grotesk-latin-wght-normal.woff2',
  '/fonts/oswald-latin-wght-normal.woff2',
  '/img/logo.png',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('syndicate-bets-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    // The admin's match picker always needs fresh fixtures; there's nothing useful to show offline.
    if (url.pathname.startsWith('/api/fixtures')) return;
    event.respondWith(scores(request));
  } else if (request.mode === 'navigate') {
    event.respondWith(page(request));
  } else if (/\.(woff2|png|svg|webmanifest)$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(networkFirst(request));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

/** A page: network first, then the cached page; round pages (/round/2026-27/9) fall back to the Live page. */
async function page(request) {
  try {
    return await networkFirst(request);
  } catch (error) {
    const cache = await caches.open(CACHE);
    const fallback = await cache.match('/');
    if (fallback) return fallback;
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached ?? refresh;
}

/** Live scores; offline, the last copy this phone saw, with a note the Live page shows under the cards. */
async function scores(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (!cached) throw error;

    const data = await cached.json();
    const labelled = data && typeof data === 'object' && !Array.isArray(data) && 'round' in data ? { ...data, warning: OFFLINE_NOTE } : data;
    return new Response(JSON.stringify(labelled), { headers: { 'content-type': 'application/json', 'x-served-from': 'offline-cache' } });
  }
}
