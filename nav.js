// nav.js — organiza la app en pestañas con una barra de menú (abajo en teléfono, arriba en computadora).
// Solo mueve los paneles existentes a cada pestaña: no cambia su funcionamiento.
// Se carga después de libreta-export.js.

const NAV_TABS=[
 {id:'campo',icon:'📍',label:'Campo'},
 {id:'perfil',icon:'📈',label:'Perfil'},
 {id:'libreta',icon:'📋',label:'Libreta'},
 {id:'diseno',icon:'🛣️',label:'Diseño'},
 {id:'exportar',icon:'⬇️',label:'Exportar'}];

(function buildTabs(){
 const main=document.querySelector('main'),footer=main.querySelector('footer');
 const sectionOf=id=>document.getElementById(id)?.closest('section');
 const hero=main.querySelector(':scope>.top'),heroActions=hero?.querySelector('.actions');
 const cards=main.querySelector(':scope>.cards'),layout=main.querySelector(':scope>.layout');
 const profilePanel=sectionOf('chart'),stationsPanel=sectionOf('table');

 const pages={};
 for(const t of NAV_TABS){const d=document.createElement('div');d.className='tab-page';d.id='page-'+t.id;d.dataset.page=t.id;d.setAttribute('role','tabpanel');d.setAttribute('aria-labelledby','tab-'+t.id);pages[t.id]=d;main.insertBefore(d,footer)}

 // Campo: título, resumen, configuración, nueva estación y método de campo.
 pages.campo.append(hero,cards,layout);
 // Perfil: perfil longitudinal y libreta de estaciones.
 pages.perfil.append(profilePanel,stationsPanel);
 // Libreta topográfica.
 pages.libreta.append(document.getElementById('topo-panel'));
 // Diseño: copia del perfil, rasante y secciones.
 const mini=document.createElement('section');mini.className='panel';mini.id='ds-profile-panel';
 mini.innerHTML='<div class="eyebrow">PERFIL CON RASANTE</div><div class="chart" id="ds-chart"></div><p class="swipe-hint">↔ Desliza el perfil con el dedo para verlo completo.</p>';
 pages.diseno.append(mini,document.getElementById('ds-panel'),document.getElementById('xs-panel'));
 // Exportar: proyectos, respaldos y archivos de texto.
 const backupPanel=document.createElement('section');backupPanel.className='panel';backupPanel.id='backup-panel';
 backupPanel.innerHTML='<div class="eyebrow">RESPALDOS</div><h2 style="margin-top:8px">Guardar y recuperar proyectos</h2><p>Los proyectos viven solo en este teléfono. Respalda al terminar cada jornada y guarda el archivo en otro lugar (correo, WhatsApp o Drive).</p>';
 if(heroActions)backupPanel.append(heroActions);
 pages.exportar.append(document.querySelector('.project-bar'),backupPanel,document.getElementById('tx-panel'));

 // Barra de menú.
 const nav=document.createElement('nav');nav.className='tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Secciones de la aplicación');
 nav.innerHTML=NAV_TABS.map(t=>`<button type="button" role="tab" id="tab-${t.id}" data-go="${t.id}" aria-controls="page-${t.id}"><span class="tab-icon" aria-hidden="true">${t.icon}</span><span class="tab-label">${t.label}</span></button>`).join('');
 document.querySelector('header').after(nav);
 nav.addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(b)showTab(b.dataset.go,true)});

 // Nombre del proyecto activo en el encabezado; al tocarlo abre Exportar (proyectos).
 const badge=document.querySelector('header .badge');
 if(badge){const btn=document.createElement('button');btn.type='button';btn.className='badge project-chip';btn.id='hdr-project';btn.title='Cambiar de proyecto';btn.addEventListener('click',()=>showTab('exportar',true));badge.replaceWith(btn)}
})();

function showTab(id,user=false){
 if(!NAV_TABS.some(t=>t.id===id))id='campo';
 document.querySelectorAll('.tab-page').forEach(p=>p.hidden=p.dataset.page!==id);
 document.querySelectorAll('nav.tabs [data-go]').forEach(b=>{const on=b.dataset.go===id;b.classList.toggle('active',on);b.setAttribute('aria-selected',on)});
 try{localStorage.setItem('camino-tab',id)}catch{}
 if(user)window.scrollTo({top:0});
 if(id==='diseno')navCopyProfile()}
const navCurrent=()=>document.querySelector('nav.tabs .active')?.dataset.go;

/* ---------- Integración ---------- */
function navCopyProfile(){const src=$('chart'),dst=$('ds-chart');if(src&&dst)dst.innerHTML=src.innerHTML}
function navHeader(){const b=$('hdr-project');if(b)b.textContent='▾ '+(data.name||'Camino sin nombre')}
const navBaseRender=render;
render=function(){navBaseRender();navCopyProfile();navHeader()};
const navBaseActivate=activateProject;
activateProject=function(id){navBaseActivate(id);navHeader()};

// Los mensajes de estado están en Campo; si estás en otra pestaña se muestran como aviso flotante.
const navToast=document.createElement('div');navToast.className='toast';navToast.setAttribute('role','status');document.body.append(navToast);
let navToastTimer=null;
new MutationObserver(()=>{const t=$('status').textContent.trim();if(!t||navCurrent()==='campo')return;navToast.textContent=t;navToast.classList.add('show');clearTimeout(navToastTimer);navToastTimer=setTimeout(()=>navToast.classList.remove('show'),4000)}).observe($('status'),{childList:true,characterData:true,subtree:true});

let navStart='campo';try{navStart=localStorage.getItem('camino-tab')||'campo'}catch{}
showTab(navStart);render();
