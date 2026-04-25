const VERSION = 'v8';
const CACHE = `orientacion-${VERSION}`;

const ARCHIVOS = [
  './',
  './index.html',
  './css/app.css',
  './js/app.js',
  './js/config.js',
  './js/state.js',
  './js/router.js',
  './js/nav.js',
  './js/api.js',
  './js/utils.js',
  './js/pdf.js',
  './js/views/inicio.js',
  './js/views/login.js',
  './js/views/reporte.js',
  './js/views/panel.js',
  './js/views/caso.js',
  './js/views/admin.js',
  './lib/supabase.js',
  './lib/jspdf.umd.min.js',
  './lib/xlsx.full.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ARCHIVOS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll())
      .then(clients => clients.forEach(c => c.postMessage({ type: 'SW_UPDATED', version: VERSION })))
  );
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('supabase.co')) return;
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request).then(cached => {
        const network = fetch(e.request).then(res => {
          cache.put(e.request, res.clone());
          return res;
        });
        return cached || network;
      })
    )
  );
});
