// TW-CAD – Service Worker: offline arbeiten (Programmdateien im Cache, Seite zuerst aus dem Netz)
const CACHE = 'twcad-app-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', './index.html', './manifest.webmanifest', './img/icon-192.png', './img/icon-512.png']).catch(() => { }))); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener('message', (e) => {
  const d = e.data || {}; if (d.typ !== 'vorladen') return;
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // alte Programmstände (anderer ?v=) entfernen
    if (d.v) for (const r of await c.keys()) { const u = new URL(r.url); const v = u.searchParams.get('v'); if (v && v !== d.v) await c.delete(r); }
    for (const url of d.urls || []) { try { if (!(await c.match(url))) { const r = await fetch(url, { cache: 'no-cache' }); if (r.ok) await c.put(url, r); } } catch (err) { } }
  })());
});
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return; const url = new URL(req.url);
  if (url.origin !== location.origin || url.pathname.includes('/hilfe/videos/')) return; // Google, KI, Videos: immer direkt
  const istSeite = req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/');
  if (istSeite) { // Netz zuerst (neue Version), offline aus dem Cache
    e.respondWith(fetch(req).then(r => { if (r.ok) caches.open(CACHE).then(c => c.put(req, r.clone())); return r; }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
    return;
  }
  // Programmdateien mit Versionsstempel: Cache zuerst, sonst Netz und merken
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok && (url.searchParams.has('v') || /\/(lib|img|css|js)\//.test(url.pathname))) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return r; })));
});
