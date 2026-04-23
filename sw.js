// ══════════════════════════════════════════════
// File 1: public/manifest.json
// Makes the web app installable on iOS + Android
// ══════════════════════════════════════════════

/*
{
  "name": "88inf — Earn & Pay",
  "short_name": "88inf",
  "description": "Earn 88INF tokens and pay at local businesses",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#080808",
  "theme_color": "#080808",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icons/icon-72.png",
      "sizes": "72x72",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-96.png",
      "sizes": "96x96",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-128.png",
      "sizes": "128x128",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/earn.png",
      "sizes": "390x844",
      "type": "image/png",
      "label": "Earn 88INF"
    },
    {
      "src": "/screenshots/pay.png",
      "sizes": "390x844",
      "type": "image/png",
      "label": "Pay at stores"
    }
  ],
  "categories": ["finance", "utilities"],
  "lang": "he",
  "dir": "rtl"
}
*/

// ══════════════════════════════════════════════
// File 2: public/sw.js
// Service Worker — caches app for offline use
// ══════════════════════════════════════════════

const CACHE_NAME = "88inf-v1";

const STATIC_ASSETS = [
  "/",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

// Install: cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: delete old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for assets
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Always fetch API calls fresh
  if (url.pathname.startsWith("/api/")) {
    return; // let it fall through to network
  }

  // For everything else: try network, fallback to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful GET requests
        if (request.method === "GET" && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Push notifications (for reward alerts)
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();

  event.waitUntil(
    self.registration.showNotification(data.title || "88inf", {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-72.png",
      data: data.url,
      vibrate: [100, 50, 100],
      actions: [
        { action: "open", title: "פתח" },
        { action: "dismiss", title: "סגור" },
      ],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "open" || !event.action) {
    event.waitUntil(
      clients.openWindow(event.notification.data || "/")
    );
  }
});
