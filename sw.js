const CACHE = 'freshfield-magnesium-chfa-v3';
const PAGE = new URL('./', self.registration.scope).href;
const PAGE_URL = new URL(PAGE);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add(PAGE)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('freshfield-magnesium-chfa-') && key !== CACHE).map(key => caches.delete(key)))),
    self.clients.claim()
  ]));
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.mode !== 'navigate' || url.origin !== PAGE_URL.origin || url.pathname !== PAGE_URL.pathname) return;
  event.respondWith((async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    try {
      const response = await fetch(event.request, {signal: controller.signal});
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then(cache => cache.put(PAGE, copy)));
      }
      return response;
    } catch (error) {
      const cached = await caches.open(CACHE).then(cache => cache.match(PAGE));
      if (cached) return cached;
      throw error;
    } finally {
      clearTimeout(timer);
    }
  })());
});
