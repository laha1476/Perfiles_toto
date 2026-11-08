// pwa.js — funcionamiento sin conexión y protección del almacenamiento.
(function(){
 const status=document.getElementById('offline-status');
 if('serviceWorker' in navigator&&location.protocol!=='file:'){
  navigator.serviceWorker.register('sw.js').then(()=>{if(status)status.textContent='Lista para usarse sin internet. Agrégala a la pantalla de inicio para que el navegador no borre tus datos.'}).catch(()=>{});
 }
 // Pide al navegador que no borre los proyectos guardados cuando falte espacio.
 if(navigator.storage&&navigator.storage.persist)navigator.storage.persisted().then(p=>p||navigator.storage.persist()).catch(()=>{});
})();
