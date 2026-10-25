const CACHE_NAME = 'zenith-pwa-v2.0.0';
const PROFILE_CACHE_NAME = 'zenith-user-profile-cache-v1';
const BASE_PATH = '/zenith';

const PRECACHE_URLS = [
  '/zenith',
  '/zenith/manifest.json',
  '/zenith/logo.png',
  '/zenith/icon-192.png',
  '/zenith/icon-512.png'
];

function toCleanResponse(res) {
  if (!res || !res.redirected) return Promise.resolve(res);
  return res.blob().then(
    (body) =>
      new Response(body, {
        status: res.status || 200,
        statusText: res.statusText || 'OK',
        headers: res.headers
      })
  );
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        PRECACHE_URLS.map((url) =>
          fetch(url, { cache: 'no-store', redirect: 'follow' })
            .then((res) => toCleanResponse(res))
            .then((cleanRes) => {
              if (cleanRes && cleanRes.status === 200) {
                if (url === '/zenith') {
                  cache.put('/zenith/', cleanRes.clone());
                  cache.put('/zenith/index.html', cleanRes.clone());
                }
                return cache.put(url, cleanRes);
              }
            })
            .catch(() => {})
        )
      )
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (name) =>
                name.startsWith('workbox-precache') ||
                (name.startsWith('zenith-pwa-') && name !== CACHE_NAME)
            )
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
      .then(() =>
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) =>
          Promise.all(
            windowClients.map((client) => {
              try {
                const clientUrl = new URL(client.url);
                if (
                  (clientUrl.pathname === '/zenith' || clientUrl.pathname.startsWith('/zenith/')) &&
                  'navigate' in client
                ) {
                  return client.navigate(client.url);
                }
              } catch {
                // Ignore navigation errors
              }
              return Promise.resolve();
            })
          )
        )
      )
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || request.headers.has('range')) return;

  const url = new URL(request.url);

  // Handle requests within /zenith or /zenith/*
  if (
    url.origin === self.location.origin &&
    url.pathname !== BASE_PATH &&
    !url.pathname.startsWith(`${BASE_PATH}/`)
  ) {
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

  // Network-first for HTML / navigation requests so updates appear immediately without redirect errors
  if (
    request.mode === 'navigate' ||
    url.pathname === '/zenith' ||
    url.pathname === '/zenith/' ||
    url.pathname.endsWith('/index.html')
  ) {
    event.respondWith(
      fetch('/zenith', { cache: 'no-store', redirect: 'follow' })
        .then((networkResponse) => toCleanResponse(networkResponse))
        .then((cleanResponse) => {
          if (cleanResponse && cleanResponse.status === 200) {
            const clone1 = cleanResponse.clone();
            const clone2 = cleanResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put('/zenith', clone1);
              cache.put('/zenith/index.html', clone2);
            });
          }
          return cleanResponse;
        })
        .catch(() =>
          caches
            .match('/zenith')
            .then((res) => res || caches.match('/zenith/index.html'))
        )
    );
    return;
  }

  // Network-first for JS/CSS bundles and manifest so new deployments load immediately
  event.respondWith(
    fetch(request, { redirect: 'follow' })
      .then((networkResponse) => toCleanResponse(networkResponse))
      .then((cleanResponse) => {
        if (cleanResponse && cleanResponse.status === 200) {
          const responseClone = cleanResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }
        return cleanResponse;
      })
      .catch(() => caches.match(request))
  );
});
