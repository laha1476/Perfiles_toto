// sw.js — guarda la aplicación en el teléfono para usarla sin internet.
// Cambia VERSION cada vez que publiques cambios para que los teléfonos descarguen la nueva versión.
const VERSION='camino-v2';
const FILES=['./','index.html','app.js','delivery.js','topo.js','projects-manage.js','stations.js','slope-core.js','slope.js','pwa.js','extras.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
// Red primero (para recibir actualizaciones); si no hay conexión, usa la copia guardada.
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;
 e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(VERSION).then(c=>c.put(e.request,copy))}return r})
  .catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match('index.html'))))});
