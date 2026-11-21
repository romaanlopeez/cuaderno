/* Service worker · Cuaderno técnico
   Objetivo: que la app funcione sin conexión tras la primera carga.
   Los apuntes NO pasan por aquí: viven en localStorage del dispositivo.
   Si cambias algún archivo que no sea index.html, sube también el número de VERSION. */
const VERSION = 'v1';
const CACHE = 'cuaderno-tecnico-' + VERSION;
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('cuaderno-tecnico-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Red primero con límite de 3 s (así siempre llega la última versión si hay conexión);
   si falla o tarda, se sirve la copia guardada. */
function networkFirst(req) {
  return new Promise(resolve => {
    let done = false;
    const fromCache = () => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html'));
    const timer = setTimeout(() => {
      fromCache().then(r => { if (r && !done) { done = true; resolve(r); } });
    }, 3000);
    fetch(req).then(res => {
      clearTimeout(timer);
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      if (!done) { done = true; resolve(res); }
    }).catch(() => {
      clearTimeout(timer);
      fromCache().then(r => { if (!done) { done = true; resolve(r || Response.error()); } });
    });
  });
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // no tocamos nada externo

  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req));
    return;
  }
  // Resto de archivos propios: copia guardada primero, y se refresca en segundo plano
  event.respondWith(
    caches.match(req).then(cached => {
      const net = fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
