// ============================================
// Rafeeqi Al-Dhikr - Enhanced Service Worker (PWA)
// GitHub Pages Compatible Version
// ============================================

const CACHE_VERSION = 'v4';
const CACHE_NAME = `rafeeqi-dhikr-${CACHE_VERSION}`;
const STATIC_CACHE = `azkar-static-${CACHE_VERSION}`;
const IMAGE_CACHE = `azkar-images-${CACHE_VERSION}`;
const DATA_CACHE = `azkar-data-${CACHE_VERSION}`;

// ============================================
// Dynamic Base URL Detection
// يكتشف تلقائياً المسار سواء على GitHub Pages أو localhost
// ============================================
const BASE_URL = self.registration.scope;

// Build asset URLs relative to the service worker scope
// هذا يحل مشكلة GitHub Pages Organization repositories
function asset(path) {
  // Remove leading slash if present, then prepend scope
  const cleanPath = path.replace(/^\//, '');
  return BASE_URL + cleanPath;
}

// Assets to cache on install - using dynamic base URL
const STATIC_ASSETS = [
  BASE_URL,
  asset('index.html'),
  asset('css/style.css'),
  asset('js/data.js'),
  asset('js/app.js'),
  asset('manifest.json')
];

const IMAGE_ASSETS = [
  asset('images/Al-Amir.png'),
  asset('images/AlShaarawi.png'),
  asset('images/icons/icon-72x72.png'),
  asset('images/icons/icon-96x96.png'),
  asset('images/icons/icon-128x128.png'),
  asset('images/icons/icon-144x144.png'),
  asset('images/icons/icon-152x152.png'),
  asset('images/icons/icon-192x192.png'),
  asset('images/icons/icon-384x384.png'),
  asset('images/icons/icon-512x512.png')
];

// ============================================
// INSTALL - Pre-cache static assets
// ============================================
self.addEventListener('install', (event) => {
  console.log('[رفيقي الذكر SW] Installing... Scope:', BASE_URL);

  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then(cache => {
        console.log('[رفيقي الذكر SW] Caching static assets:', STATIC_ASSETS);
        return cache.addAll(STATIC_ASSETS).catch(err => {
          console.warn('[رفيقي الذكر SW] Some static assets failed to cache:', err);
          // Cache individually to avoid one failure blocking all
          return Promise.allSettled(
            STATIC_ASSETS.map(url => cache.add(url).catch(e => console.warn('Failed:', url, e)))
          );
        });
      }),
      caches.open(IMAGE_CACHE).then(cache => {
        console.log('[رفيقي الذكر SW] Caching image assets');
        return Promise.allSettled(
          IMAGE_ASSETS.map(url => cache.add(url).catch(e => console.warn('Failed img:', url, e)))
        );
      })
    ]).then(() => {
      console.log('[رفيقي الذكر SW] Install complete');
      return self.skipWaiting();
    }).catch(err => {
      console.error('[رفيقي الذكر SW] Install failed:', err);
      return self.skipWaiting();
    })
  );
});

// ============================================
// ACTIVATE - Clean old caches
// ============================================
self.addEventListener('activate', (event) => {
  console.log('[رفيقي الذكر SW] Activating...');

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => {
            return (name.startsWith('azkar-') || name.startsWith('rafeeqi-')) &&
                   !name.includes(CACHE_VERSION);
          })
          .map(name => {
            console.log('[رفيقي الذكر SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[رفيقي الذكر SW] Claiming clients');
      return self.clients.claim();
    })
  );
});

// ============================================
// FETCH - Advanced caching strategies
// ============================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http schemes
  if (!url.protocol.startsWith('http')) return;

  // Skip cross-origin requests (fonts, external APIs)
  if (url.origin !== self.location.origin) return;

  // Strategy: Cache First for static assets (HTML, CSS, JS, JSON)
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Strategy: Cache First for images
  if (isImage(request)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // Strategy: Stale While Revalidate for everything else
  event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
});

// ============================================
// Caching Strategies
// ============================================

// Cache First - Serve from cache, fallback to network
// إذا لم يوجد في الكاش، يجلب من الشبكة ويخزن
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    // Refresh cache in background (don't wait)
    fetch(request).then(response => {
      if (response && response.ok) cache.put(request, response.clone());
    }).catch(() => {});
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Return offline fallback: serve index.html for navigation requests
    if (request.destination === 'document' || request.mode === 'navigate') {
      const fallback = await caches.match(BASE_URL + 'index.html') ||
                       await caches.match(BASE_URL);
      if (fallback) return fallback;
    }
    return new Response('Offline - No cached version', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

// Stale While Revalidate - Serve cache, update in background
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(response => {
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);

  return cached || fetchPromise;
}

// ============================================
// Helpers
// ============================================
function isStaticAsset(url) {
  const staticExts = ['.html', '.css', '.js', '.json'];
  return staticExts.some(ext => url.pathname.endsWith(ext));
}

function isImage(request) {
  return request.destination === 'image' ||
         /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(request.url);
}

// ============================================
// Message handling from main thread
// ============================================
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }

  if (event.data === 'getVersion') {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage(CACHE_VERSION);
    }
  }

  if (event.data === 'clearCache') {
    event.waitUntil(
      caches.keys().then(names => {
        return Promise.all(names.map(name => caches.delete(name)));
      }).then(() => {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage('Cache cleared');
        }
      })
    );
  }
});

// ============================================
// Push Notifications
// ============================================
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const options = {
    body: data.body || 'تذكير بقراءة الأذكار',
    icon: asset('images/icons/icon-192x192.png'),
    badge: asset('images/icons/icon-72x72.png'),
    dir: 'rtl',
    lang: 'ar',
    vibrate: [100, 50, 100],
    data: data.url || BASE_URL,
    actions: [
      { action: 'open', title: 'فتح التطبيق' },
      { action: 'close', title: 'إغلاق' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'رفيقي الذكر', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow(event.notification.data || BASE_URL)
    );
  }
});

console.log('[رفيقي الذكر SW] Service Worker loaded. Scope:', BASE_URL);
