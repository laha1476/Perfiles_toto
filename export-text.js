// export-text.js — archivos de texto para importar en programas de presupuesto o de dibujo.
// Perfil (estación, cota), puntos PNEZD con coordenadas locales, secciones y cantidades de obra.
// Se carga después de rasante.js.

const TX_SEPS={coma:',',tab:'\t',puntoycoma:';'};
const txSep=()=>TX_SEPS[$('tx-sep').value]||',';
const txNum=(v,n=3)=>v===null||v===undefined||!Number.isFinite(v)?'':v.toFixed(n);
// Quita el separador y saltos de línea de los textos para no romper las columnas.
const txText=v=>String(v??'').replace(/[\r\n]+/g,' ').split(txSep()).join(' ').trim();
const txJoin=rows=>rows.map(r=>r.join(txSep())).join('\r\n')+'\r\n';
function txOrigin(){const e=Number($('tx-e').value),n=Number($('tx-n').value);return{e:Number.isFinite(e)?e:0,n:Number.isFinite(n)?n:0}}
function txSaveSettings(){data.textExport={sep:$('tx-sep').value,header:$('tx-header').checked,e:$('tx-e').value,n:$('tx-n').value};save()}
function txLoadSettings(){const s=data.textExport||{};$('tx-sep').value=s.sep||'coma';$('tx-header').checked=s.header!==false;$('tx-e').value=s.e??'1000';$('tx-n').value=s.n??'1000'}

/* ---------- Geometría en planta ---------- */
// Coordenadas del eje y dirección en cada estación. Si falta algún azimut, se supone eje recto hacia el norte.
function txAxis(){
 const rows=topoRows(),complete=rows.length>1&&rows.every(r=>r.x!==null&&r.y!==null),o=txOrigin();
 return{straight:!complete,list:rows.map((r,i)=>{
  const azIn=i?rows[i].az:null,azOut=i<rows.length-1?rows[i+1].az:null;
  let az=0;if(complete){const a=azIn??azOut,b=azOut??azIn;
   // Promedio de las direcciones de llegada y salida (para que la sección quede perpendicular).
   const sx=Math.sin(a*Math.PI/180)+Math.sin(b*Math.PI/180),sy=Math.cos(a*Math.PI/180)+Math.cos(b*Math.PI/180);az=(Math.atan2(sx,sy)*180/Math.PI+360)%360}
  return{p:r.p,e:o.e+(complete?r.x:0),n:o.n+(complete?r.y:r.p.d-rows[0].p.d),az}})}}

/* ---------- Archivos ---------- */
function txProfile(){
 const v=typeof designVertices==='function'?designVertices():null;
 const body=sortedPoints().map(p=>[station(p.d),txNum(p.d,2),txNum(p.z),v?txNum(lineAt(v,p.d)):'',typeof p.slope==='number'?txNum(p.slope,2):'']);
 return{name:'perfil.txt',head:['ESTACION','DISTANCIA_M','COTA_TERRENO_M','COTA_RASANTE_M','PENDIENTE_TERRENO_%'],body,
  note:'Una fila por estación: distancia acumulada y cota del terreno en el eje'+(v?', y cota de la rasante.':'. Define la rasante para incluir su cota.')}}
function txPoints(){
 const ax=txAxis(),body=[];let n=1;
 ax.list.forEach(({p,e,n:nn,az},i)=>{
  body.push([n++,txNum(nn),txNum(e),txNum(p.z),txText('EJE '+station(p.d))]);
  // Puntos de sección, perpendiculares al eje (a la derecha: azimut + 90°).
  const r=(az+90)*Math.PI/180;
  sectionPoints(p).filter(a=>!a.axis).forEach(a=>body.push([n++,txNum(nn+a.o*Math.cos(r)),txNum(e+a.o*Math.sin(r)),txNum(a.z),txText((a.side==='L'?'IZQ':'DER')+a.n+' '+station(p.d))]));
 });
 return{name:'puntos-pnezd.txt',head:['PUNTO','NORTE','ESTE','COTA','DESCRIPCION'],body,
  note:'Formato PNEZD (punto, norte, este, cota, descripción) para crear la superficie del terreno. Coordenadas locales desde el inicio indicado.'+(ax.straight?' Faltan azimuts: se supuso el eje recto hacia el norte.':'')}}
function txSections(){
 const v=typeof designVertices==='function'?designVertices():null,body=[];
 sortedPoints().forEach(p=>{const s=v&&typeof designSection==='function'?designSection(p):null;
  sectionPoints(p).forEach(a=>body.push([station(p.d),txNum(p.d,2),txNum(a.o),txNum(a.z),a.axis?'EJE':(a.side==='L'?'IZQ':'DER')+a.n,s?txNum(lineAt(s.line.map(q=>({d:q.o,z:q.z})),a.o)):'']))});
 return{name:'secciones.txt',head:['ESTACION','DISTANCIA_M','DESPLAZAMIENTO_M','COTA_TERRENO_M','PUNTO','COTA_PROYECTO_M'],body,
  note:'Puntos de cada sección: desplazamiento desde el eje (negativo a la izquierda) y cota. Las estaciones sin sección solo tienen el punto del eje.'}}
function txQuantities(){
 const pts=sortedPoints(),rows=topoRows(),len=pts.length>1?pts.at(-1).d-pts[0].d:0,area=rows.at(-1)?.area||0;
 const ew=typeof earthwork==='function'?earthwork():null,withXs=pts.filter(p=>xsCount(p)).length;
 const body=[['LONGITUD DEL CAMINO','m',txNum(len,2)],['ANCHO PROMEDIO','m',txNum(pts.length?pts.reduce((s,p)=>s+p.l+p.r,0)/pts.length:0,2)],['AREA DE RODADURA (ANCHO x LONGITUD)','m2',txNum(area,2)],['ESTACIONES','u',String(pts.length)],['ESTACIONES CON SECCION','u',String(withXs)]];
 if(ew){body.push(['EXCAVACION (CORTE)','m3',txNum(ew.totC,2)],['RELLENO','m3',txNum(ew.totF,2)],[ew.totC>=ew.totF?'MATERIAL SOBRANTE (CORTE - RELLENO)':'MATERIAL FALTANTE (RELLENO - CORTE)','m3',txNum(Math.abs(ew.totC-ew.totF),2)])}
 return{name:'cantidades.txt',head:['CONCEPTO','UNIDAD','CANTIDAD'],body,
  note:'Cantidades de obra para el presupuesto, sin precios. Los volúmenes son geométricos: aplica tus factores de abundamiento y compactación.'+(ew?'':' Define la rasante para incluir corte y relleno.')}}

const TX_FILES={perfil:txProfile,puntos:txPoints,secciones:txSections,cantidades:txQuantities};
function exportText(kind){
 if(!data.points.length)return alert('Registra estaciones primero.');
 txSaveSettings();const f=TX_FILES[kind]();
 const content=txJoin($('tx-header').checked?[f.head,...f.body]:f.body);
 const sepName={coma:'coma',tab:'tabulador',puntoycoma:'punto y coma'}[$('tx-sep').value];
 showTopoExport('Archivo de texto · '+f.name,'<p class="preview-meta">'+esc(f.note)+' Separador: '+sepName+'. Decimales con punto.</p>'+previewTable(f.head,f.body.slice(0,200))+(f.body.length>200?'<p class="preview-meta">Vista previa de 200 de '+f.body.length+' filas. El archivo incluye todas.</p>':''),()=>download(content,projectFilename(f.name),'text/plain;charset=utf-8'),true)}

/* ---------- Integración ---------- */
for(const id of ['tx-sep','tx-header','tx-e','tx-n'])$(id).addEventListener('change',txSaveSettings);
const txBaseActivate=activateProject;
activateProject=function(id){txBaseActivate(id);txLoadSettings()};
txLoadSettings();
