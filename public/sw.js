// Minimal service worker — blocks all push notifications and external ad events
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});
// Block any push notifications (prevents ad networks from firing popups)
self.addEventListener('push', (e) => { e.stopImmediatePropagation(); });
self.addEventListener('notificationclick', (e) => { e.notification.close(); });
