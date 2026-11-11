// Karate-Ka Companion service worker: makes the app installable and lets it open with bad signal.
// Your notes live in your Google Sheet; only the app's own files are cached here.
// Bump the version when you change files so phones pick up the update.
const CACHE = 'karateka-companion-v13';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './favicon-64.png', './badge-96.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

// Network first for the app's own files, falling back to the saved copy offline.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html')))
  );
});

/* ---------- notifications ---------- */
// The sheet sends these through the app's push sender (functions/push). Payload: { title, body, tag, link }
// link: 'now' · 'new' (write today's notes) · 'a:<assignment id>' · 'review:YYYY-MM'
self.addEventListener('push', (e) => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch (err) { p = { title: 'Karate-Ka Companion', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(p.title || 'Karate-Ka Companion', {
    body: p.body || '',
    tag: p.tag || undefined,
    icon: 'icon-192.png',
    badge: 'badge-96.png',
    data: { link: p.link || 'now' },
  }));
});

// Tapping a notification brings the app forward on the right screen.
self.addEventListener('notificationclick', (e) => {
  const link = (e.notification.data && e.notification.data.link) || 'now';
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const c = list.find((x) => new URL(x.url).origin === self.location.origin);
    if (c) { c.postMessage({ open: link }); return c.focus(); }
    return self.clients.openWindow('./#open=' + encodeURIComponent(link));
  }));
});
