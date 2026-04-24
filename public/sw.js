// Service worker — no-op, prevents ad network SW from running
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
