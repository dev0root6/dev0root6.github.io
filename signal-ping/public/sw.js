// Signal Ping — service worker.
//
// Two jobs:
//   1. Cache the UI shell so the app opens instantly and works offline.
//   2. Receive Web Push and show the notification — this is what makes an alert
//      arrive when the app is closed.

const CACHE = 'signal-ping-v1';
const SHELL = ['./', './index.html', './styles.css', './app.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network-first for the shell, with the cache as the offline fallback. API calls
// are never cached — a stale alert log would be worse than none.
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return;
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html'))),
  );
});

// A push from the Worker: { kind, label, from, sentAt }.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { label: 'Signal Ping' };
  }

  const label = data.label || 'Signal Ping';
  const body =
    data.kind === 'partner_timer'
      ? `Timer from ${data.from || 'your partner'}`
      : data.kind === 'test'
        ? 'Test notification — delivery is working'
        : `${data.from || 'Your partner'} is signalling you`;

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(label, {
        body,
        // A fresh tag per kind: a live alert should never silently replace a
        // partner timer that just arrived.
        tag: `signal-ping-${data.kind || 'live'}`,
        renotify: true,
        requireInteraction: true,
        vibrate: [150, 70, 150],
        icon: './icons/icon-192.png',
        badge: './icons/icon-192.png',
        timestamp: (data.sentAt || Math.floor(Date.now() / 1000)) * 1000,
        data,
      });

      // If the app happens to be open, let it refresh its log inline.
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) client.postMessage({ type: 'alert-received', ...data });
    })(),
  );
});

// Tapping the notification focuses the app rather than opening a second copy.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow('./');
    })(),
  );
});
