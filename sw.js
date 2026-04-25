const VERSION = 'v10';
const CACHE = `orientacion-${VERSION}`;

// Solo cachear assets estáticos que no cambian frecuentemente
const CACHE_STATIC = [
  './css/app.css',
  './lib/supabase.js',
  './lib/jspdf.umd.min.js',
  './lib/xlsx.full.min.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(CACHE_STATIC))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Solo manejar requests http/https
  if (!url.startsWith('http')) return;

  // Nunca interceptar llamadas a Supabase
  if (url.includes('supabase.co')) return;

  // Los archivos JS SIEMPRE van a la red (nunca al caché)
  if (url.includes('.js')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Para el resto: red primero, caché como respaldo
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
