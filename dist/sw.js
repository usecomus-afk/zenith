const CACHE_NAME = 'zenith-pwa-v1.8.5';
const PROFILE_CACHE_NAME = 'zenith-user-profile-cache-v1';
const BASE_PATH = '/zenith/';

const PRECACHE_URLS = [
  BASE_PATH,
  `${BASE_PATH}index.html`,
  `${BASE_PATH}manifest.json`,
  `${BASE_PATH}logo.png`,
  `${BASE_PATH}icon-192.png`,
  `${BASE_PATH}icon-512.png`,
  `${BASE_PATH}zenith.mp4`
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        PRECACHE_URLS.map((url) =>
          fetch(url, { cache: 'no-cache' })
            .then((res) => {
              if (res && res.status === 200) {
                return cache.put(url, res);
              }
            })
            .catch(() => {})
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name.startsWith('zenith-pwa-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || request.headers.has('range')) return;

  const url = new URL(request.url);

  // Only handle requests within /zenith/ or same-origin assets to respect strict route isolation
  if (url.origin === self.location.origin && !url.pathname.startsWith(BASE_PATH)) {
    return;
  }

  // Serve persistent user profile & accounts from dedicated profile cache if requested
  if (url.pathname.endsWith('/__user_profile__.json') || url.pathname.endsWith('/__user_accounts__.json')) {
    event.respondWith(
      caches.open(PROFILE_CACHE_NAME).then((cache) => cache.match(request))
    );
    return;
  }

  // Network-first for geocoding API calls, fallback to cache
  if (url.hostname.includes('open-meteo.com') || url.hostname.includes('nominatim.openstreetmap.org')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Network-first for HTML / navigation requests so updates appear immediately
  if (
    request.mode === 'navigate' ||
    url.pathname === BASE_PATH ||
    url.pathname === '/zenith' ||
    url.pathname.endsWith('/index.html')
  ) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() =>
          caches.match(request).then((res) => res || caches.match(`${BASE_PATH}index.html`))
        )
    );
    return;
  }

  // Stale-while-revalidate for /zenith/ static assets
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
