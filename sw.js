// ── CAMBIAR ESTE NÚMERO PARA FORZAR ACTUALIZACIÓN EN TODOS LOS USUARIOS ──
const VERSION = 'v6';

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

// ── Instalar: cachear todos los archivos ─────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ARCHIVOS))
      .then(() => self.skipWaiting())
  );
});

// ── Activar: eliminar cachés viejas ──────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: red primero, caché como respaldo ──────────────────
self.addEventListener('fetch', e => {
  // No interceptar llamadas a Supabase
  if (e.request.url.includes('supabase.co')) return;

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
