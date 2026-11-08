// extras.js — respaldo de todos los proyectos, aviso de respaldo pendiente y resumen de pendientes.
// Se carga después de slope.js.

/* ---------- Validación de proyectos importados ---------- */
function validProject(v){
 return v&&Array.isArray(v.points)&&v.points.every(p=>['d','z','l','r'].every(k=>Number.isFinite(p[k]))&&p.d>=0&&p.l>=0&&p.r>=0&&(p.lat==null||Number.isFinite(p.lat))&&(p.lon==null||Number.isFinite(p.lon))&&(p.u==null||Number.isFinite(p.u)))&&new Set(v.points.map(p=>p.d)).size===v.points.length}
function importProject(v){
 const imported=Object.assign(blankProject(),v,{id:crypto.randomUUID(),name:String(v.name||'Camino importado'),draft:{},method:v.method||'gps'});
 imported.points=imported.points.map(p=>({...p,id:crypto.randomUUID(),lat:p.lat??null,lon:p.lon??null,u:p.u??null}));
 projectsState.projects.push(imported);return imported}

/* ---------- Respaldo ---------- */
function markBackedUp(projects){const now=new Date().toISOString();projects.forEach(p=>p.backupAt=now);save()}
backup=function(){settings();markBackedUp([data]);download(JSON.stringify(data,null,2),projectFilename('respaldo.json'),'application/json')};
function backupAll(){
 storeCurrentProject();markBackedUp(projectsState.projects);
 const content=JSON.stringify({type:'camino-respaldo-completo',version:1,createdAt:new Date().toISOString(),projects:projectsState.projects},null,2);
 const date=new Date().toISOString().slice(0,10);
 download(content,'camino-todos-los-proyectos-'+date+'.json','application/json')}

// Importa un proyecto individual o un respaldo completo (varios proyectos).
$('import').onchange=async e=>{
 const file=e.target.files[0];e.target.value='';if(!file)return;
 let v;try{v=JSON.parse(await file.text())}catch{return alert('No se pudo leer el archivo. Verifica que sea un respaldo .json de esta aplicación.')}
 const list=Array.isArray(v?.projects)?v.projects:[v],ok=list.filter(validProject),bad=list.length-ok.length;
 if(!ok.length)return alert('No se pudo abrir el respaldo. Verifica el archivo.');
 if(list.length>1&&!confirm('El archivo contiene '+list.length+' proyectos'+(bad?' ('+bad+' con errores, se omitirán)':'')+'. Se agregarán como proyectos nuevos; los actuales no se modifican. ¿Continuar?'))return;
 storeCurrentProject();let last=null;for(const p of ok)last=importProject(p);
 activateProject(last.id);
 $('status').textContent=ok.length>1?ok.length+' proyectos importados.':'Proyecto importado: '+last.name+'.'};

/* ---------- Aviso de respaldo pendiente ---------- */
function backupNotice(p){
 const since=p.backupAt?Date.parse(p.backupAt):null;
 const pending=p.points.filter(a=>!since||!a.time||Date.parse(a.time)>since||(a.editedAt&&Date.parse(a.editedAt)>since)).length;
 if(!p.points.length)return{text:'',warn:false};
 if(!since)return{text:'Este proyecto nunca se ha respaldado.',warn:true};
 const days=Math.floor((Date.now()-since)/864e5),when=days<1?'hoy':days===1?'ayer':'hace '+days+' días';
 return pending?{text:'Último respaldo '+when+' · '+pending+(pending===1?' estación nueva o editada':' estaciones nuevas o editadas')+' sin respaldar.',warn:true}:{text:'Respaldado '+when+'.',warn:false}}
const exBaseProjectOptions=renderProjectOptions;
renderProjectOptions=function(){exBaseProjectOptions();const el=$('project-count');if(!el)return;const n=backupNotice(data);el.textContent=projectsState.projects.length+' proyectos en este navegador'+(n.text?' · '+n.text:'');el.classList.toggle('warn',n.warn)};

/* ---------- Resumen de pendientes del perfil ---------- */
function renderGradeSummary(){
 const el=$('grade-summary');if(!el)return;const segs=gradeSegments(data.points);
 if(!segs.length){el.textContent='';return}
 const steep=segs.reduce((m,s)=>Math.abs(s.grade)>Math.abs(m.grade)?s:m),warn=segs.filter(s=>Math.abs(s.grade)>GRADE_LIMITS.WARN&&Math.abs(s.grade)<=GRADE_LIMITS.MAX).length,over=segs.filter(s=>Math.abs(s.grade)>GRADE_LIMITS.MAX);
 const p=data.points.length?[...data.points].sort((a,b)=>a.d-b.d):[],rise=p.length>1?p.at(-1).z-p[0].z:0;
 el.innerHTML='Pendiente máxima: <b style="color:'+gradeColor(steep.grade)+'">'+(steep.grade>0?'+':'')+steep.grade.toFixed(1)+' %</b> entre '+station(steep.from.d)+' y '+station(steep.to.d)+
  ' · Desnivel total: '+(rise>0?'+':'')+rise.toFixed(2)+' m'+
  (over.length?' · <b style="color:#c0392b">'+over.length+(over.length===1?' tramo':' tramos')+' sobre '+GRADE_LIMITS.MAX+' %</b> ('+over.slice(0,4).map(s=>station(s.from.d)).join(', ')+(over.length>4?'…':'')+')':'')+
  (warn?' · '+warn+(warn===1?' tramo':' tramos')+' entre '+GRADE_LIMITS.WARN+' y '+GRADE_LIMITS.MAX+' %':'')}
const exBaseRender=render;
render=function(){exBaseRender();renderGradeSummary()};

render();
