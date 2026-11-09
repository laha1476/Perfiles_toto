// slope.js — medición de pendientes con el teléfono y ajustes de interfaz
// Se carga al final, después de app.js, topo.js, projects-manage.js y stations.js.
const slState={on:false,bound:false,beta:null,heading:null,sink:null,lastPaint:0};
let slCur={ida:null,vuelta:null},slCal={r1:null};
const SL_TIMING={SETTLE_MS:1000,MEASURE_MS:3000};
let slWakeLock=null;
// Mantiene la pantalla encendida mientras los sensores están activos (si el navegador lo permite).
async function slKeepAwake(){try{if(slState.on&&document.visibilityState==='visible'&&!slWakeLock&&navigator.wakeLock){slWakeLock=await navigator.wakeLock.request('screen');slWakeLock.addEventListener('release',()=>{slWakeLock=null})}}catch{}}
document.addEventListener('visibilitychange',slKeepAwake);
let slAudio=null;
// Pitido corto (funciona también en iPhone, donde no hay vibración). ok=false: dos tonos graves.
function slBeep(ok){try{slAudio=slAudio||new (window.AudioContext||window.webkitAudioContext)();if(slAudio.state==='suspended')slAudio.resume();const t=slAudio.currentTime;(ok?[[880,0]]:[[330,0],[330,.22]]).forEach(([f,dt])=>{const o=slAudio.createOscillator(),g=slAudio.createGain();o.frequency.value=f;g.gain.setValueAtTime(.25,t+dt);g.gain.exponentialRampToValueAtTime(.001,t+dt+.18);o.connect(g).connect(slAudio.destination);o.start(t+dt);o.stop(t+dt+.2)})}catch{}}
const slBuzz=ms=>{slBeep(!Array.isArray(ms));try{navigator.vibrate?.(ms)}catch{}};
const slWait=ms=>new Promise(r=>setTimeout(r,ms));
const isSlope=()=>data.method==='slope';
const slSet=(id,t)=>{const el=$(id);if(el)el.textContent=t};
const slSigned=(v,n=2)=>(v>0?'+':v<0?'−':'')+Math.abs(v).toFixed(n);
projectsState.projects.forEach(p=>{if(!p.method)p.method='gps'});

/* ---------- Sensores ---------- */
function slOnOrientation(e){
 if(typeof e.beta!=='number')return;
 let h=null;
 if(typeof e.webkitCompassHeading==='number'&&Number.isFinite(e.webkitCompassHeading))h=e.webkitCompassHeading;
 else if(e.absolute===true&&typeof e.alpha==='number')h=(360-e.alpha)%360;
 slState.beta=e.beta;if(h!==null)slState.heading=h;
 if(slState.sink)slState.sink(e.beta,h);
 const t=performance.now();
 if(t-slState.lastPaint>250){slState.lastPaint=t;slSet('slope-live','Inclinación del eje largo: '+slSigned(e.beta)+'°'+(slState.heading!==null?' · Rumbo magnético: '+Math.round(slState.heading)+'°':' · Sin brújula'))}}
async function slEnable(){
 try{slAudio=slAudio||new (window.AudioContext||window.webkitAudioContext)();slAudio.resume?.()}catch{}
 try{
  if(typeof DeviceOrientationEvent==='undefined')throw Error('Este navegador no entrega datos de orientación.');
  if(typeof DeviceOrientationEvent.requestPermission==='function'){
   const r=await DeviceOrientationEvent.requestPermission();
   if(r!=='granted')throw Error('Permiso de movimiento y orientación denegado. En iPhone: Ajustes › Safari › Movimiento y orientación.')}
  if(!slState.bound){window.addEventListener('deviceorientationabsolute',slOnOrientation,true);window.addEventListener('deviceorientation',slOnOrientation,true);slState.bound=true}
  slState.on=true;slKeepAwake();$('sensor-btn').textContent='Sensores activos';slSet('slope-live','Sensores activados. Esperando datos…');
  for(const id of ['read-ida','read-vuelta','cal1','cal2'])$(id).disabled=false;
  setTimeout(()=>{if(slState.beta===null)slSet('slope-live','No llegan datos del sensor. Abre la página con HTTPS en el teléfono y revisa los permisos.')},2500)
 }catch(err){slSet('slope-live',err.message)}}
function slCollect(ms){return new Promise((resolve,reject)=>{
 if(!slState.on)return reject(Error('Activa los sensores primero.'));
 const betas=[],heads=[],t0=performance.now();
 slState.sink=(b,h)=>{betas.push(b);if(h!==null)heads.push(h)};
 const tick=()=>{const left=ms-(performance.now()-t0);if(left<=0){slState.sink=null;resolve({betas,heads})}else{slSet('slope-live','Midiendo… mantén el teléfono quieto ('+Math.ceil(left/1000)+' s)');setTimeout(tick,150)}};tick()})}
async function slRead(){
 if(!slState.on)throw Error('Activa los sensores primero.');
 // Pausa para que el teléfono deje de moverse después de pulsar el botón.
 for(let left=SL_TIMING.SETTLE_MS;left>0;left-=250){slSet('slope-live','Suelta el teléfono… la medición empieza enseguida');await slWait(Math.min(250,left))}
 const {betas,heads}=await slCollect(SL_TIMING.MEASURE_MS);slBuzz(150);
 if(betas.length<8)throw Error('El teléfono no envió suficientes lecturas del sensor. Repite la medición.');
 const deg=median(betas),sd=stdev(betas);
 if(Math.abs(deg)>SLOPE_LIMITS.MAX_ANGLE)throw Error('Inclinación fuera de rango ('+slSigned(deg,1)+'°). Coloca el teléfono boca arriba o sobre su canto, con el borde largo hacia la siguiente estación.');
 if(sd>SLOPE_LIMITS.SD_REJECT)throw Error('Lectura inestable (±'+sd.toFixed(2)+'°). Apoya el teléfono sin moverlo y repite.');
 return{deg,sd,n:betas.length,heading:heads.length?circularMean(heads):null}}
function slBusy(b){for(const id of ['read-ida','read-vuelta','cal1','cal2','sensor-btn'])$(id).disabled=b||(!slState.on&&id!=='sensor-btn')}
async function slMeasure(kind){
 slBusy(true);
 try{slCur[kind]=await slRead();slApplyReadings();slSet('slope-live',(kind==='ida'?'Ida':'Vuelta')+' registrada: '+slSigned(slCur[kind].deg)+'° (±'+slCur[kind].sd.toFixed(2)+'°, '+slCur[kind].n+' lecturas).'+(slCur[kind].sd>SLOPE_LIMITS.SD_WARN?' Variación alta: conviene repetir.':''))}
 catch(err){slBuzz([80,60,80]);slSet('slope-live',err.message)}finally{slBusy(false)}}
function slApplyReadings(){
 const comb=combineAngle(slCur.ida,slCur.vuelta,Number(data.zeroOffset)||0),f=r=>r?slSigned(r.deg)+'° (±'+r.sd.toFixed(2)+')':'—';
 if(comb){$('angle').value=comb.deg.toFixed(2);$('angle').dispatchEvent(new Event('input'))}
 slSet('read-summary',comb?'Ida: '+f(slCur.ida)+' · Vuelta: '+f(slCur.vuelta)+' · Ángulo usado: '+slSigned(comb.deg)+'° ('+comb.kind+')'+(comb.bias!==null?' · Error de cero implícito: '+slSigned(comb.bias)+'°':''):'')}
function slClearReadings(){slCur={ida:null,vuelta:null};slSet('read-summary','')}
async function slCalibrate(step){
 slBusy(true);
 try{const r=await slRead();
  if(step===1){slCal.r1=r.deg;slSet('cal-status','Lectura 1: '+slSigned(r.deg)+'°. Gira el teléfono 180° sobre la misma superficie y mide la lectura 2.')}
  else{if(slCal.r1===null)throw Error('Haz primero la lectura 1.');const off=roundTo((slCal.r1+r.deg)/2,2);data.zeroOffset=off;slCal.r1=null;save();slSync();slApplyReadings();slSet('cal-status','Error de cero: '+slSigned(off)+'°.'+(Math.abs(off)>SLOPE_LIMITS.ZERO_WARN?' Es grande: revisa que la superficie sea estable y sin funda irregular.':' Se restará de las lecturas de una sola dirección.'))}
 }catch(err){slSet('cal-status',err.message)}finally{slBusy(false)}}

/* ---------- Configuración y modo ---------- */
function slSync(){
 $('method').value=data.method||'gps';$('method').disabled=data.points.length>0;
 $('z0').value=data.z0??100;$('d0').value=data.d0??0;$('tapemode').value=data.tapeMode||'inclinada';
 $('declination').value=data.declination??0;$('zerooffset').value=(Number(data.zeroOffset)||0).toFixed(2)}
function slApplyMode(){
 const s=isSlope(),first=!data.points.length;
 document.querySelectorAll('.legacy-only').forEach(el=>el.hidden=s);
 document.querySelectorAll('.slope-only').forEach(el=>el.hidden=!s);
 document.querySelectorAll('.slope-segment').forEach(el=>el.hidden=!s||first);
 document.querySelectorAll('.slope-first').forEach(el=>el.hidden=!s||!first);
 for(const id of ['alt','distance','edit-alt','edit-height'])$(id).required=!s;
 $('gps').textContent=s?'◎ Capturar coordenadas (para Google Earth)':'◎ Capturar ubicación y elevación';
 $('method').disabled=data.points.length>0;
 if(s&&$('tape').value==='')$('tape').value=data.step}
for(const [id,key,parse] of [['z0','z0',Number],['d0','d0',Number],['tapemode','tapeMode',String],['declination','declination',Number]])
 $(id).onchange=()=>{const v=parse($(id).value);if(typeof v==='number'&&!Number.isFinite(v)){slSync();return}data[key]=v;save();render()};
$('method').onchange=()=>{
 if(data.points.length){slSync();return}
 data.method=$('method').value;data.reference=data.method==='slope'?'Cota manual · referencia local':'Teléfono · referencia sin verificar';
 $('reference').value=data.reference;save();render()};

/* ---------- Render ---------- */
const slBaseRender=render;
render=function(){
 const q=isSlope()?recalcSlope(data):null;
 slApplyMode();slBaseRender();
 const pts=[...data.points].sort((a,b)=>a.d-b.d);
 if(pts.length>=2){$('chart').innerHTML=profileSvg(pts,typeof designVertices==='function'?designVertices():null);$('topo-profile').innerHTML=$('chart').innerHTML}
 slSet('slope-quality',q&&q.segments?q.segments+(q.segments===1?' tramo · ':' tramos · ')+q.both+' con ida y vuelta'+(q.incomplete?' · '+q.incomplete+' sin ángulo o cinta (se tomaron como planos; edítalos)':'')+(q.maxTie>SLOPE_LIMITS.TIE_WARN?' · Atención: error de cero implícito de hasta '+q.maxTie.toFixed(2)+'°; repite esas lecturas':'')+'.':'')};

/* ---------- Agregar estación en modo pendiente ---------- */
const slBaseSubmit=$('form').onsubmit;
$('form').onsubmit=function(e){
 if(!isSlope())return slBaseSubmit.call(this,e);
 e.preventDefault();settings();
 const first=!data.points.length;let tape=null,angle=null;
 if(!first){
  tape=num('tape');angle=num('angle');
  if(!(tape>0))return alert('Escribe la distancia medida con la cinta desde la estación anterior.');
  if(angle===null||!Number.isFinite(angle)||Math.abs(angle)>SLOPE_LIMITS.MAX_ANGLE)return alert('Escribe o mide el ángulo del tramo (entre −'+SLOPE_LIMITS.MAX_ANGLE+'° y +'+SLOPE_LIMITS.MAX_ANGLE+'°).')}
 const lat=num('lat'),lon=num('lon');
 if((lat===null)!==(lon===null))return alert('Ingresa ambas coordenadas o deja ambas vacías.');
 const typed=$('azimuth').value.trim()?parseAzimuth($('azimuth').value):null;
 if($('azimuth').value.trim()&&typed===null)return alert('Azimut inválido: usa grados de 0 a menos de 360, o grados, minutos y segundos válidos.');
 let azimuth=typed,azSource=typed!==null?'Ingresado manualmente':null;
 if(!first&&azimuth===null){
  const h=slCur.ida?.heading??(slCur.vuelta&&slCur.vuelta.heading!==null?(slCur.vuelta.heading+180)%360:null),az=headingToAzimuth(h,data.declination);
  if(az!==null){azimuth=az;azSource='Brújula del teléfono · aproximado'}}
 const comb=combineAngle(slCur.ida,slCur.vuelta,Number(data.zeroOffset)||0),fromSensor=!first&&comb&&Math.abs(comb.deg-angle)<0.005;
 const seq=data.points.reduce((m,p)=>Math.max(m,p.seq??0),0)+1;
 data.points.push({id:crypto.randomUUID(),seq,d:0,z:0,alt:null,height:null,tape,angle,angleSource:first?null:(fromSensor?'Medido con el teléfono · '+comb.kind:'Ingresado manualmente'),
  readings:fromSensor?{ida:slCur.ida,vuelta:slCur.vuelta}:null,heading:slCur.ida?.heading??null,l:num('left'),r:num('right'),lat,lon,u:null,notes:$('notes').value,
  azimuth:first?null:azimuth,azSource:first?null:azSource,reference:data.reference,source:'Pendiente medida con el teléfono',time:new Date().toISOString()});
 data.draft={};save();render();
 const keepL=$('left').value,keepR=$('right').value;for(const id of ['angle','lat','lon','notes','azimuth'])$(id).value='';$('tape').value=data.step;$('left').value=keepL;$('right').value=keepR;saveDraft();
 slClearReadings();gpsSource='manual';
 $('status').textContent='Estación guardada. Mide el siguiente tramo. Los anchos se copiaron de esta estación: cámbialos si varían.'};

/* ---------- Editar y eliminar estación en modo pendiente ---------- */
const slBaseEdit=editPoint;
editPoint=function(id){
 slBaseEdit(id);const p=data.points.find(p=>p.id===id);if(!p)return;
 $('edit-d').readOnly=isSlope();
 if(isSlope()){
  const firstId=[...data.points].sort((a,b)=>(a.seq??0)-(b.seq??0))[0].id;
  $('edit-d').readOnly=true;$('edit-z').value=Number.isFinite(p.z)?p.z.toFixed(2):'';
  $('edit-tape').value=p.tape??'';$('edit-angle').value=p.angle??'';
  $('edit-slope-row').hidden=p.id===firstId}}
const slBaseEditSubmit=$('station-form').onsubmit;
$('station-form').onsubmit=function(e){
 if(isSlope()){
  const p=data.points.find(p=>p.id===editingPointId);
  if(p&&!$('edit-slope-row').hidden){
   const t=$('edit-tape').value===''?null:Number($('edit-tape').value),a=$('edit-angle').value===''?null:Number($('edit-angle').value);
   if(!(t>0)||a===null||!Number.isFinite(a)||Math.abs(a)>SLOPE_LIMITS.MAX_ANGLE){e.preventDefault();$('station-error').textContent='Escribe la distancia con cinta y un ángulo entre −'+SLOPE_LIMITS.MAX_ANGLE+'° y +'+SLOPE_LIMITS.MAX_ANGLE+'°.';return}
   if(t!==p.tape||a!==p.angle){p.tape=t;p.angle=a;p.readings=null;p.angleSource='Ingresado manualmente (editado)'}}}
 return slBaseEditSubmit.call(this,e)};
const slBaseRemove=$('confirm-remove-station').onclick;
$('confirm-remove-station').onclick=function(){
 if(!isSlope()||pointProjectId!==data.id)return slBaseRemove.call(this);
 const sorted=[...data.points].sort((a,b)=>(a.seq??0)-(b.seq??0)),i=sorted.findIndex(p=>p.id===removingPointId),next=sorted[i+1];
 slBaseRemove.call(this);
 if(next&&i>0){next.tape=null;next.angle=null;next.readings=null;next.angleSource=null;next.azimuth=null;next.azSource=null;
  $('status').textContent='Estación eliminada. Vuelve a medir el tramo de '+station(next.d)+': su cinta y su ángulo ya no corresponden.'}
 save();render()};

/* ---------- Exportación ---------- */
exportRows=function(){
 const s=isSlope();
 return[['Camino','Estacion','Distancia horizontal m','Latitud','Longitud',s?'Distancia cinta m':'Elevacion telefono m',s?'Angulo grados':'Altura soporte m','Elevacion terreno m','Pendiente %','Ancho izquierdo m','Ancho derecho m','Ancho total m','Incertidumbre vertical m','Referencia','Fuente','Fecha','Observaciones'],
 ...data.points.map(p=>[data.name,station(p.d),p.d,p.lat,p.lon,s?p.tape:p.alt,s?p.angle:p.height,p.z,p.slope===undefined||p.slope===null?'':Number(p.slope.toFixed(2)),p.l,p.r,p.l+p.r,p.u,p.reference,p.source,p.time,p.notes])]};

/* ---------- Arranque ---------- */
draftFields.push('tape','angle');
for(const id of ['tape','angle'])$(id).addEventListener('input',saveDraft);
const slBaseActivate=activateProject;
activateProject=function(id){slBaseActivate(id);slClearReadings();slSync();slApplyMode()};
$('sensor-btn').onclick=slEnable;
$('read-ida').onclick=()=>slMeasure('ida');$('read-vuelta').onclick=()=>slMeasure('vuelta');
$('read-clear').onclick=()=>{slClearReadings();$('angle').value='';$('angle').dispatchEvent(new Event('input'))};
$('cal1').onclick=()=>slCalibrate(1);$('cal2').onclick=()=>slCalibrate(2);
for(const id of ['read-ida','read-vuelta','cal1','cal2'])$(id).disabled=true;
slSync();render();
