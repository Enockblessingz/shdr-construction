// SHDR Service Worker — v1.0
const CACHE_NAME = 'shdr-cache-v1.0';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/shdr_logo.jpg'
];

// Install event — cache all essential assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app shell');
        return cache.addAll(ASSETS_TO_CACHE).catch(err => {
          console.log('[SW] Some assets failed to cache:', err);
        });
      })
      .then(() => {
        console.log('[SW] Install complete');
        return self.skipWaiting();
      })
  );
});

// Activate event — clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Activation complete');
      return self.clients.claim();
    })
  );
});

// Fetch event — serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // For navigation requests (HTML pages), use network-first strategy
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache the latest version
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Offline — serve from cache
          return caches.match(event.request);
        })
    );
    return;
  }

  // For assets (CSS, JS, images), use cache-first strategy
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        // Not in cache, fetch from network
        return fetch(event.request).then(response => {
          // Cache successful responses
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        });
      })
      .catch(() => {
        // Both cache and network failed
        console.log('[SW] Fetch failed:', event.request.url);
        // For image requests, could return a placeholder
        if (event.request.destination === 'image') {
          return new Response('', { status: 204 });
        }
      })
  );
});

// Handle push notifications (if needed later)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New update from SHDR',
    icon: '/shdr_logo.jpg',
    badge: '/shdr_logo.jpg',
    vibrate: [200, 100, 200],
    data: { url: '/' }
  };
  event.waitUntil(
    self.registration.showNotification('SHDR Construction', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});
