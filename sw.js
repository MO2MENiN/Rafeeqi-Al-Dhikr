// ============================================
// Rafeeqi Al-Dhikr - Enhanced Service Worker (PWA)
// ============================================

const CACHE_VERSION = 'v2';
const CACHE_NAME = `rafeeqi-dhikr-${CACHE_VERSION}`;
const STATIC_CACHE = `azkar-static-${CACHE_VERSION}`;
const IMAGE_CACHE = `azkar-images-${CACHE_VERSION}`;
const DATA_CACHE = `azkar-data-${CACHE_VERSION}`;

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/data.js',
  '/js/app.js',
  '/manifest.json'
];

const IMAGE_ASSETS = [
  '/images/Al-Amir.png',
  '/images/AlShaarawi.png',
  '/images/icons/icon-72x72.png',
  '/images/icons/icon-96x96.png',
  '/images/icons/icon-128x128.png',
  '/images/icons/icon-144x144.png',
  '/images/icons/icon-152x152.png',
  '/images/icons/icon-192x192.png',
  '/images/icons/icon-384x384.png',
  '/images/icons/icon-512x512.png'
];

// ============================================
// INSTALL - Pre-cache static assets
// ============================================
self.addEventListener('install', (event) => {
  console.log('[رفيقي الذكر SW] Installing...');

  event.waitUntil(
    Promise.all([
      // Cache static files
      caches.open(STATIC_CACHE).then(cache => {
        console.log('[رفيقي الذكر SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      }),
      // Cache images
      caches.open(IMAGE_CACHE).then(cache => {
        console.log('[رفيقي الذكر SW] Caching image assets');
        return cache.addAll(IMAGE_ASSETS);
      })
    ]).then(() => {
      console.log('[رفيقي الذكر SW] Install complete');
      return self.skipWaiting();
    }).catch(err => {
      console.error('[رفيقي الذكر SW] Install failed:', err);
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
            return name.startsWith('azkar-') && 
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

  // Strategy: Cache First for static assets
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Strategy: Cache First for images
  if (isImage(request)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // Strategy: Network First for data/API
  if (isDataRequest(url)) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  // Strategy: Stale While Revalidate for everything else
  event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
});

// ============================================
// Caching Strategies
// ============================================

// Cache First - Serve from cache, fallback to network
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    // Refresh cache in background
    fetch(request).then(response => {
      if (response.ok) cache.put(request, response.clone());
    }).catch(() => {});
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Return offline fallback for HTML
    if (request.destination === 'document') {
      return caches.match('/index.html');
    }
    return new Response('Offline - No cached version', { 
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

// Network First - Try network, fallback to cache
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;

    return new Response('Offline', { 
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
    if (response.ok) {
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
         request.url.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i);
}

function isDataRequest(url) {
  return url.pathname.includes('/api/') || 
         url.pathname.endsWith('.json');
}

// ============================================
// Background Sync (for future features)
// ============================================
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-favorites') {
    event.waitUntil(syncFavorites());
  }
});

async function syncFavorites() {
  // Future: sync favorites with server
  console.log('[رفيقي الذكر SW] Syncing favorites...');
}

// ============================================
// Push Notifications (for future features)
// ============================================
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const options = {
    body: data.body || 'تذكير بقراءة الأذكار',
    icon: '/images/icons/icon-192x192.png',
    badge: '/images/icons/icon-72x72.png',
    dir: 'rtl',
    lang: 'ar',
    vibrate: [100, 50, 100],
    data: data.url || '/',
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
      clients.openWindow(event.notification.data || '/')
    );
  }
});

// ============================================
// Message handling from main thread
// ============================================
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }

  if (event.data === 'getVersion') {
    event.ports[0].postMessage(CACHE_VERSION);
  }

  if (event.data === 'clearCache') {
    event.waitUntil(
      caches.keys().then(names => {
        return Promise.all(names.map(name => caches.delete(name)));
      }).then(() => {
        event.ports[0].postMessage('Cache cleared');
      })
    );
  }
});

console.log('[رفيقي الذكر SW] Service Worker loaded');
