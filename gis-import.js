// gis-import.js — importa puntos del eje (GIS Cloud, Google Earth, GPX o CSV) y crea un proyecto.
// Cada punto es una estación con coordenadas, anchos y observaciones. La distancia y el azimut de cada
// tramo salen de las coordenadas (aproximados): después se completan la cinta y el ángulo en campo.
// Se carga después de nav.js.

let gisData=null;

/* ---------- Lectura de archivos ---------- */
const gisKey=k=>String(k).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');
const gisNum=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(String(v).trim().replace(',','.'));return Number.isFinite(n)?n:null};
const gisPick=(props,names)=>{for(const n of names)if(props[n]!==undefined&&props[n]!==null&&String(props[n]).trim()!=='')return props[n];return null};
// Web Mercator (EPSG:3857) a latitud/longitud, por si el archivo no viene en grados.
function gisToLonLat(x,y){if(Math.abs(x)<=180&&Math.abs(y)<=90)return[x,y];const R=6378137;return[x/R*180/Math.PI,(2*Math.atan(Math.exp(y/R))-Math.PI/2)*180/Math.PI]}
function gisProps(o){const out={};for(const [k,v] of Object.entries(o||{}))out[gisKey(k)]=v;return out}

function parseGeoJSON(text){
 const j=JSON.parse(text),feats=j.type==='FeatureCollection'?j.features:j.type==='Feature'?[j]:j.type?[{type:'Feature',geometry:j,properties:{}}]:[];
 const points=[],lines=[];
 for(const f of feats||[]){const g=f?.geometry;if(!g)continue;const props=gisProps(f.properties);
  const pt=c=>{const [lon,lat]=gisToLonLat(Number(c[0]),Number(c[1]));return{lat,lon,props}};
  if(g.type==='Point')points.push(pt(g.coordinates));
  else if(g.type==='MultiPoint')g.coordinates.forEach(c=>points.push(pt(c)));
  else if(g.type==='LineString')lines.push({coords:g.coordinates.map(c=>pt(c)),props});
  else if(g.type==='MultiLineString')g.coordinates.forEach(l=>lines.push({coords:l.map(c=>pt(c)),props}))}
 return{points,lines}}
function parseXmlGeo(text){
 const doc=new DOMParser().parseFromString(text,'application/xml');
 if(doc.querySelector('parsererror'))throw Error('El archivo no es un KML o GPX válido.');
 const points=[],lines=[],txt=(el,sel)=>el.querySelector(sel)?.textContent?.trim()??'';
 const coordList=s=>s.trim().split(/\s+/).map(t=>t.split(',').map(Number)).filter(c=>c.length>=2&&c.every(Number.isFinite)).map(([lon,lat])=>({lat,lon}));
 // KML
 doc.querySelectorAll('Placemark').forEach(pm=>{
  const props={name:txt(pm,'name'),description:txt(pm,'description')};
  pm.querySelectorAll('ExtendedData Data').forEach(d=>props[d.getAttribute('name')]=txt(d,'value'));
  pm.querySelectorAll('ExtendedData SimpleData').forEach(d=>props[d.getAttribute('name')]=d.textContent.trim());
  const p=gisProps(props);
  pm.querySelectorAll('Point coordinates').forEach(c=>coordList(c.textContent).forEach(q=>points.push({...q,props:p})));
  pm.querySelectorAll('LineString coordinates').forEach(c=>lines.push({coords:coordList(c.textContent).map(q=>({...q,props:p})),props:p}))});
 // GPX
 doc.querySelectorAll('wpt').forEach(w=>points.push({lat:Number(w.getAttribute('lat')),lon:Number(w.getAttribute('lon')),props:gisProps({name:txt(w,'name'),description:txt(w,'desc')})}));
 doc.querySelectorAll('trkseg,rte').forEach(s=>{const pts=[...s.querySelectorAll('trkpt,rtept')].map(w=>({lat:Number(w.getAttribute('lat')),lon:Number(w.getAttribute('lon')),props:{}}));if(pts.length>1)lines.push({coords:pts,props:{}})});
 return{points,lines}}
function parseCsvRows(text){
 const first=text.split(/\r?\n/)[0]||'',sep=['\t',';',','].map(s=>[s,first.split(s).length]).sort((a,b)=>b[1]-a[1])[0][0];
 const rows=[];let row=[],cell='',q=false;
 for(let i=0;i<text.length;i++){const c=text[i];
  if(q){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++}else q=false}else cell+=c}
  else if(c==='"')q=true;else if(c===sep){row.push(cell);cell=''}
  else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell=''}else cell+=c}
 if(cell!==''||row.length){row.push(cell);rows.push(row)}
 return rows.filter(r=>r.some(c=>c.trim()!==''))}
function parseCsvGeo(text){
 const rows=parseCsvRows(text.replace(/^﻿/,''));if(rows.length<2)throw Error('El archivo CSV no tiene filas de datos.');
 const head=rows[0].map(gisKey),col=names=>head.findIndex(h=>names.includes(h));
 const iLat=col(['lat','latitud','latitude','y','coord_y','norte']),iLon=col(['lon','lng','long','longitud','longitude','x','coord_x','este']),iWkt=col(['wkt','geometry','geometria','the_geom','geom']);
 const points=[];
 for(const r of rows.slice(1)){const props={};head.forEach((h,i)=>props[h]=r[i]);
  let lat=iLat>=0?gisNum(r[iLat]):null,lon=iLon>=0?gisNum(r[iLon]):null;
  if((lat===null||lon===null)){const w=(iWkt>=0?r[iWkt]:r.join(' ')).match(/POINT\s*Z?\s*\(\s*([-\d.eE]+)\s+([-\d.eE]+)/i);if(w){lon=Number(w[1]);lat=Number(w[2])}}
  if(lat===null||lon===null)continue;[lon,lat]=gisToLonLat(lon,lat);points.push({lat,lon,props})}
 if(!points.length)throw Error('No encontré columnas de latitud y longitud (lat/lon, latitud/longitud, x/y) ni una columna WKT.');
 return{points,lines:[]}}
function parseGeoFile(text,name){
 const t=text.trim(),ext=(name.split('.').pop()||'').toLowerCase();
 if(ext==='geojson'||ext==='json'||t.startsWith('{'))return parseGeoJSON(t);
 if(ext==='kml'||ext==='gpx'||t.startsWith('<'))return parseXmlGeo(t);
 return parseCsvGeo(text)}

/* ---------- Estaciones ---------- */
const GIS_F={camino:['camino','nombre_camino','road','nombre'],estacion:['estacion','numero_estacion','no_estacion','station','est','numero','num','no'],
 izq:['ancho_izq','ancho_izquierdo','izq','izquierdo','left','l'],der:['ancho_der','ancho_derecho','der','derecho','right','r'],
 ancho:['ancho','ancho_total','width'],notas:['observaciones','observacion','notas','notes','description','descripcion','desc'],
 superficie:['superficie','surface','tipo_superficie'],precision:['precision_gps','precision','accuracy','acc']};
function gisDist(a,b){const R=6371008.8,r=Math.PI/180,dl=(b.lat-a.lat)*r,dn=(b.lon-a.lon)*r,h=Math.sin(dl/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
// Puntos cada `step` metros a lo largo de una línea (más el final), para trazos dibujados en Google Earth.
function gisResample(coords,step){
 const out=[coords[0]];let acc=0,next=step;
 for(let i=1;i<coords.length;i++){const a=coords[i-1],b=coords[i],L=gisDist(a,b);
  while(L>0&&next<=acc+L+1e-6){const f=(next-acc)/L;out.push({lat:a.lat+(b.lat-a.lat)*f,lon:a.lon+(b.lon-a.lon)*f,props:{}});next+=step}
  acc+=L}
 const last=coords.at(-1);if(gisDist(out.at(-1),last)>0.5)out.push(last);return out}
function gisCaminos(){return[...new Set(gisData.points.map(p=>String(gisPick(p.props,GIS_F.camino)??'').trim()).filter(Boolean))]}
function gisStations(){
 if(!gisData)return[];
 let pts;
 if(gisData.points.length){
  const c=$('gis-camino').value;pts=gisData.points.filter(p=>!c||String(gisPick(p.props,GIS_F.camino)??'').trim()===c);
  const nums=pts.map(p=>gisNum(gisPick(p.props,GIS_F.estacion)));
  if(nums.every(n=>n!==null))pts=pts.map((p,i)=>({p,n:nums[i],i})).sort((a,b)=>a.n-b.n||a.i-b.i).map(o=>o.p);
 }else if(gisData.lines.length){
  const line=gisData.lines.reduce((m,l)=>l.coords.length>m.coords.length?l:m);
  pts=gisResample(line.coords,Math.max(1,Number($('gis-step').value)||10));
 }else pts=[];
 // Quita puntos repetidos (a menos de 0.5 m del anterior).
 const out=[];for(const p of pts)if(Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&(!out.length||gisDist(out.at(-1),p)>=0.5))out.push(p);
 const dl=gisNum($('gis-left').value),dr=gisNum($('gis-right').value);let d=0;
 return out.map((p,i)=>{if(i)d+=gisDist(out[i-1],p);const total=gisNum(gisPick(p.props,GIS_F.ancho));
  const l=gisNum(gisPick(p.props,GIS_F.izq))??(total!==null?total/2:dl),r=gisNum(gisPick(p.props,GIS_F.der))??(total!==null?total/2:dr);
  const notes=[gisPick(p.props,GIS_F.superficie),gisPick(p.props,GIS_F.notas)].filter(v=>v!==null&&String(v).trim()).join(' · ');
  return{lat:p.lat,lon:p.lon,d,l,r,notes,acc:gisNum(gisPick(p.props,GIS_F.precision))}})}

/* ---------- Diálogo ---------- */
function openGisImport(){gisData=null;$('gis-file').value='';$('gis-options').hidden=true;$('gis-preview').innerHTML='';$('gis-status').textContent='';$('gis-create').disabled=true;$('gis-dialog').showModal()}
$('gis-file').onchange=async e=>{
 const f=e.target.files[0];if(!f)return;$('gis-status').textContent='';
 try{gisData=parseGeoFile(await f.text(),f.name);gisData.file=f.name}catch(err){gisData=null;$('gis-options').hidden=true;$('gis-create').disabled=true;$('gis-preview').innerHTML='';$('gis-status').textContent='No se pudo leer el archivo: '+err.message;return}
 if(!gisData.points.length&&!gisData.lines.length){$('gis-status').textContent='El archivo no tiene puntos ni líneas.';return}
 const caminos=gisCaminos();
 $('gis-camino').innerHTML=caminos.length?caminos.map(c=>`<option>${esc(c)}</option>`).join(''):'<option value="">Todos los puntos</option>';
 $('gis-camino-row').hidden=caminos.length<2;$('gis-step-row').hidden=!!gisData.points.length;
 $('gis-name').value=caminos[0]||f.name.replace(/\.[^.]+$/,'');gisLastCamino=caminos[0]||'';$('gis-options').hidden=false;gisPreview()};
function gisPreview(){
 const st=gisStations(),ok=st.length>=2;$('gis-create').disabled=!ok;
 if(!ok){$('gis-preview').innerHTML='<p class="note">Se necesitan al menos dos puntos del eje.</p>';return}
 const noWidth=st.filter(s=>s.l===null||s.r===null).length,acc=st.map(s=>s.acc).filter(v=>v!==null),len=st.at(-1).d;
 $('gis-preview').innerHTML=routeSketch(st)+`<p class="preview-meta"><b>${st.length} estaciones</b> · longitud aproximada ${len.toFixed(1)} m · tramo promedio ${(len/(st.length-1)).toFixed(1)} m`+
  (acc.length?` · precisión GPS promedio ±${(acc.reduce((s,v)=>s+v,0)/acc.length).toFixed(1)} m`:'')+(gisData.points.length?'':' · trazo convertido en estaciones')+'</p>'+
  (noWidth?`<p class="note">${noWidth} ${noWidth===1?'estación no trae':'estaciones no traen'} ancho: se usará el ancho por defecto${$('gis-left').value===''||$('gis-right').value===''?' (escríbelo abajo)':''}.</p>`:'');
 $('gis-create').disabled=!ok||(noWidth>0&&($('gis-left').value===''||$('gis-right').value===''))}
for(const id of ['gis-camino','gis-left','gis-right','gis-step'])$(id).addEventListener('input',gisPreview);
// Al elegir otro camino, el nombre del proyecto lo sigue (si no se cambió a mano).
let gisLastCamino='';$('gis-camino').addEventListener('change',()=>{if(!$('gis-name').value||$('gis-name').value===gisLastCamino)$('gis-name').value=$('gis-camino').value;gisLastCamino=$('gis-camino').value;gisPreview()});
$('gis-form').onsubmit=e=>{
 e.preventDefault();const st=gisStations();if(st.length<2)return;
 const dl=gisNum($('gis-left').value),dr=gisNum($('gis-right').value);
 storeCurrentProject();
 const p=blankProject(($('gis-name').value||'Camino importado').trim());
 p.step=Number($('gis-step').value)||10;p.method='slope';p.reference='Cota manual · referencia local';
 const now=new Date().toISOString(),src='Importado de '+(gisData.file||'archivo');
 p.points=st.map((s,i)=>{const prev=st[i-1],az=i?coordinateAzimuth(prev,s):null;
  return{id:crypto.randomUUID(),seq:i+1,d:0,z:0,alt:null,height:null,tape:i?roundTo(s.d-prev.d,2):null,angle:null,angleSource:null,readings:null,
   l:s.l??dl??0,r:s.r??dr??0,lat:s.lat,lon:s.lon,u:null,notes:s.notes,azimuth:az,azSource:i&&az!==null?'Coordenadas GIS · aproximado':null,
   tapeSource:i?'GPS · reemplazar con cinta':null,gpsAccuracy:s.acc,reference:p.reference,source:src,time:now}});
 projectsState.projects.push(p);activateProject(p.id);$('gis-dialog').close();
 if(typeof showTab==='function')showTab('perfil',true);
 $('status').textContent=`Proyecto creado con ${st.length} estaciones de ${gisData.file}. Las distancias y azimuts son del GPS: en campo mide la cinta y el ángulo de cada tramo con Editar.`};

/* ---------- Medir el ángulo al editar una estación ---------- */
let edCur={ida:null,vuelta:null};
async function edMeasure(kind){
 const btns=['edit-ida','edit-vuelta'].map($);btns.forEach(b=>b.disabled=true);
 try{
  if(!slState.on){await slEnable();if(!slState.on)throw Error($('slope-live').textContent||'No se pudieron activar los sensores.')}
  $('edit-measure-status').textContent='Suelta el teléfono: mide en 1 segundo y dura 3 segundos…';
  edCur[kind]=await slRead();
  const c=combineAngle(edCur.ida,edCur.vuelta,Number(data.zeroOffset)||0);
  $('edit-angle').value=c.deg.toFixed(2);
  $('edit-measure-status').textContent=`${kind==='ida'?'Ida':'Vuelta'}: ${slSigned(edCur[kind].deg)}° (±${edCur[kind].sd.toFixed(2)}°) · ángulo usado ${slSigned(c.deg)}° (${c.kind})`+(edCur[kind].sd>SLOPE_LIMITS.SD_WARN?'. Variación alta: conviene repetir.':'.')
 }catch(err){slBuzz([80,60,80]);$('edit-measure-status').textContent=err.message}
 finally{btns.forEach(b=>b.disabled=false)}}
$('edit-ida').onclick=()=>edMeasure('ida');$('edit-vuelta').onclick=()=>edMeasure('vuelta');
const gisBaseEdit=editPoint;
editPoint=function(id){edCur={ida:null,vuelta:null};$('edit-measure-status').textContent='';gisBaseEdit(id);
 const p=data.points.find(q=>q.id===id);if(p?.tapeSource&&String(p.tapeSource).startsWith('GPS'))$('edit-measure-status').textContent='La cinta de este tramo viene del GPS: reemplázala con la medida de la cinta.'};
// Al guardar una cinta editada, deja de marcarse como distancia del GPS.
$('station-form').addEventListener('submit',()=>{const p=data.points.find(q=>q.id===editingPointId);if(p&&p.tapeSource&&Number($('edit-tape').value)!==p.tape)p.tapeSource='Cinta'},true);
// Si el ángulo guardado es el medido con el teléfono, se registra así (con sus lecturas).
$('station-form').addEventListener('submit',()=>{const p=data.points.find(q=>q.id===editingPointId),c=combineAngle(edCur.ida,edCur.vuelta,Number(data.zeroOffset)||0);
 if(p&&c&&Math.abs(p.angle-Number(c.deg.toFixed(2)))<0.005){p.angleSource='Medido con el teléfono · '+c.kind;p.readings={ida:edCur.ida,vuelta:edCur.vuelta};save()}});
