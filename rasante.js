// rasante.js — rasante propuesta, sección típica y movimiento de tierras (corte y relleno).
// data.design = {vertices:[{d,z}], bombeo:%, talCorte:H/V, talRelleno:H/V}
// Se carga después de sections.js.

const DESIGN_DEFAULTS={bombeo:2,talCorte:1,talRelleno:1.5};
const DS_STEP=0.02,DS_MAX_SLOPE=200;
let dsDraft=null;

/* ---------- Datos ---------- */
const designParams=()=>({...DESIGN_DEFAULTS,...(data.design||{})});
function designVertices(){const v=data.design?.vertices;return Array.isArray(v)&&v.length>=2?[...v].sort((a,b)=>a.d-b.d):null}
function defaultVertices(){const p=sortedPoints();return p.length>=2?[{d:p[0].d,z:roundTo(p[0].z,2)},{d:p.at(-1).d,z:roundTo(p.at(-1).z,2)}]:[]}

/* ---------- Cálculo de una sección ---------- */
// Terreno de la sección como función de la distancia al eje; se prolonga horizontal fuera de lo medido.
function terrainFn(pts){
 return o=>{if(o<=pts[0].o)return pts[0].z;if(o>=pts.at(-1).o)return pts.at(-1).z;
  for(let i=1;i<pts.length;i++)if(o<=pts[i].o){const a=pts[i-1],b=pts[i],h=b.o-a.o;return h>0?a.z+(b.z-a.z)*(o-a.o)/h:b.z}return pts.at(-1).z}}
// Calcula la sección típica sobre el terreno: áreas de corte y relleno (m²) y puntos de chaflán.
function designSection(p,xs=p.xs,zr=lineAt(designVertices(),p.d)){
 if(zr===null)return null;
 const prm=designParams(),b=(Number(prm.bombeo)||0)/100,tc=Math.max(Number(prm.talCorte)||0,0.01),tr=Math.max(Number(prm.talRelleno)||0,0.01);
 const pts=sectionPoints(p,xs),g=terrainFn(pts),assumedFlat=pts.length===1;
 // Plantilla en cada lado: calzada con bombeo y talud de corte o de relleno desde el borde.
 const side=(sign,E)=>{
  const ze=zr-b*E,cut=g(sign*E)>ze,t=a=>a<=E?zr-b*a:(cut?ze+(a-E)/tc:ze-(a-E)/tr);
  let a=E;while(a<E+DS_MAX_SLOPE){const n=a+DS_STEP;if(cut?t(n)>=g(sign*n):t(n)<=g(sign*n)){a=n;break}a=n}
  return{t,catchAt:a,ze,cut}};
 const Ls=side(-1,Number(p.l)||0),Rs=side(1,Number(p.r)||0);
 const tmpl=o=>o<0?Ls.t(-o):Rs.t(o);
 const o0=-Ls.catchAt,o1=Rs.catchAt,samples=[];let cut=0,fill=0;
 for(let o=o0;o<=o1+1e-9;o+=DS_STEP){const zt=tmpl(o),zg=g(o);samples.push({o,zt,zg})}
 for(let i=1;i<samples.length;i++){const a=samples[i-1],c=samples[i],h=c.o-a.o,da=a.zt-a.zg,dc=c.zt-c.zg;
  fill+=h*(Math.max(da,0)+Math.max(dc,0))/2;cut+=h*(Math.max(-da,0)+Math.max(-dc,0))/2}
 const measured=pts.length>1?[pts[0].o,pts.at(-1).o]:[0,0],extended=!assumedFlat&&(o0<measured[0]-1e-6||o1>measured[1]+1e-6);
 const line=[{o:o0,z:tmpl(o0)},{o:-(Number(p.l)||0),z:Ls.ze},{o:0,z:zr},{o:Number(p.r)||0,z:Rs.ze},{o:o1,z:tmpl(o1)}];
 return{zr,dz:zr-p.z,cut,fill,o0,o1,line,samples,assumedFlat,extended}}

/* ---------- Movimiento de tierras ---------- */
function earthwork(){
 const v=designVertices();if(!v)return null;
 let prev=null,totC=0,totF=0;
 const rows=sortedPoints().map(p=>{const s=designSection(p);let vc=null,vf=null;
  if(s&&prev){const h=p.d-prev.p.d;vc=(prev.s.cut+s.cut)/2*h;vf=(prev.s.fill+s.fill)/2*h;totC+=vc;totF+=vf}
  if(s)prev={p,s};return{p,s,vc,vf,accC:totC,accF:totF}});
 return{rows,totC,totF}}

/* ---------- Dibujo en las secciones ---------- */
function xsDesignOpts(p,xs){
 const s=designSection(p,xs);if(!s)return{};
 return{extra:s.line,overlay:(x,y)=>{
  // Sombrea corte (ocre) y relleno (azul) entre la plantilla y el terreno.
  let polys='',run=[],kind=null;
  const flush=()=>{if(run.length>1){polys+=`<polygon points="${[...run.map(a=>x(a.o).toFixed(1)+','+y(a.zt).toFixed(1)),...run.slice().reverse().map(a=>x(a.o).toFixed(1)+','+y(a.zg).toFixed(1))].join(' ')}" fill="${kind==='c'?'#e8b96a':'#8fb4ef'}" fill-opacity=".55"/>`}run=[]};
  s.samples.forEach(a=>{const k=a.zt>a.zg+1e-4?'f':a.zt<a.zg-1e-4?'c':null;if(k!==kind){flush();kind=k}if(k)run.push(a)});flush();
  return polys+`<polyline points="${s.line.map(a=>x(a.o).toFixed(1)+','+y(a.z).toFixed(1)).join(' ')}" fill="none" stroke="#2d6cdf" stroke-width="2.2" stroke-linejoin="round"/>`}}}
function xsDesignLabel(p){const s=designSection(p);return s?`<p class="preview-meta" style="margin:6px 0 0">Rasante ${s.zr.toFixed(2)} m · ${s.dz>=0?'relleno':'corte'} en eje ${Math.abs(s.dz).toFixed(2)} m · <span style="color:#a06d0c">Corte ${s.cut.toFixed(2)} m²</span> · <span style="color:#2d6cdf">Relleno ${s.fill.toFixed(2)} m²</span>${s.extended?' · terreno prolongado (mide más ancho)':''}</p>`:''}

/* ---------- Panel ---------- */
const fmt=(v,n=2)=>v===null||v===undefined?'—':v.toLocaleString('es-GT',{minimumFractionDigits:n,maximumFractionDigits:n});
function renderDesign(){
 const el=$('ds-body');if(!el)return;
 const pts=sortedPoints();
 if(pts.length<2){el.innerHTML='<p class="empty">Registra al menos dos estaciones para proponer la rasante.</p>';$('ds-summary').innerHTML='';return}
 const ew=earthwork();
 if(!ew){el.innerHTML='<p class="empty">Aún no hay rasante. Pulsa <b>Definir rasante</b>: se propone una recta del inicio al final que puedes ajustar.</p>';$('ds-summary').innerHTML='';return}
 const v=designVertices(),grades=v.slice(1).map((b,i)=>(b.z-v[i].z)/((b.d-v[i].d)||1)*100),gmax=grades.reduce((m,g)=>Math.abs(g)>Math.abs(m)?g:m,0);
 const flat=ew.rows.filter(r=>r.s?.assumedFlat).length,ext=ew.rows.filter(r=>r.s?.extended).length,out=ew.rows.filter(r=>!r.s).length,net=ew.totC-ew.totF;
 const prm=designParams();
 $('ds-summary').innerHTML=`<div class="cards ds-cards"><div class="stat"><span>CORTE</span><b style="color:#a06d0c">${fmt(ew.totC,1)} m³</b></div><div class="stat"><span>RELLENO</span><b style="color:#2d6cdf">${fmt(ew.totF,1)} m³</b></div><div class="stat"><span>${net>=0?'SOBRANTE (CORTE − RELLENO)':'FALTANTE (RELLENO − CORTE)'}</span><b>${fmt(Math.abs(net),1)} m³</b></div></div>
 <p class="preview-meta">Pendiente máxima de la rasante: <b style="color:${gradeColor(gmax)}">${gmax>0?'+':''}${gmax.toFixed(1)} %</b> · ${v.length} vértices · Bombeo ${prm.bombeo} % · Talud de corte ${prm.talCorte}:1 · Talud de relleno ${prm.talRelleno}:1 (horizontal:vertical)</p>
 ${flat||ext||out?`<p class="note">${flat?flat+(flat===1?' estación sin sección transversal: se supuso terreno plano a la cota del eje. ':' estaciones sin sección transversal: se supuso terreno plano a la cota del eje. '):''}${ext?ext+(ext===1?' sección no alcanza':' secciones no alcanzan')+' el pie del talud: se prolongó el terreno horizontal; mide más ancho. ':''}${out?out+(out===1?' estación queda':' estaciones quedan')+' fuera de la rasante y no se cuentan.':''}</p>`:''}`;
 el.innerHTML=`<div class="scroll"><table><thead><tr><th>Estación</th><th>Terreno (m)</th><th>Rasante (m)</th><th>Eje</th><th>Área corte (m²)</th><th>Área relleno (m²)</th><th>Vol. corte (m³)</th><th>Vol. relleno (m³)</th></tr></thead><tbody>${ew.rows.map(r=>`<tr><td><b>${station(r.p.d)}</b>${r.s?.assumedFlat?' <span title="Sin sección: terreno supuesto plano">*</span>':''}</td><td>${fmt(r.p.z)}</td><td>${r.s?fmt(r.s.zr):'—'}</td><td>${r.s?`<span style="color:${r.s.dz>=0?'#2d6cdf':'#a06d0c'}">${r.s.dz>=0?'R':'C'} ${fmt(Math.abs(r.s.dz))}</span>`:'fuera'}</td><td>${r.s?fmt(r.s.cut):'—'}</td><td>${r.s?fmt(r.s.fill):'—'}</td><td>${fmt(r.vc,1)}</td><td>${fmt(r.vf,1)}</td></tr>`).join('')}</tbody><tfoot><tr><th>Total</th><th></th><th></th><th></th><th></th><th></th><th>${fmt(ew.totC,1)}</th><th>${fmt(ew.totF,1)}</th></tr></tfoot></table></div>`}

/* ---------- Editor de rasante ---------- */
function openDesign(){
 if(sortedPoints().length<2)return alert('Registra al menos dos estaciones primero.');
 const prm=designParams();
 dsDraft={vertices:(designVertices()||defaultVertices()).map(a=>({...a})),bombeo:prm.bombeo,talCorte:prm.talCorte,talRelleno:prm.talRelleno};
 $('ds-bombeo').value=dsDraft.bombeo;$('ds-tc').value=dsDraft.talCorte;$('ds-tr').value=dsDraft.talRelleno;
 $('ds-status').textContent='';renderDsRows();$('ds-dialog').showModal()}
function terrainAt(d){return lineAt(sortedPoints().map(p=>({d:p.d,z:p.z})),d)}
function renderDsRows(){
 const v=dsDraft.vertices;
 $('ds-rows').innerHTML='<div class="ds-row ds-head"><span>Distancia (m)</span><span>Cota (m)</span><span>Pendiente (%)</span><span>Terreno</span><span></span></div>'+v.map((a,i)=>{const g=i?(a.z-v[i-1].z)/((a.d-v[i-1].d)||1)*100:null,t=terrainAt(a.d);
  return `<div class="ds-row"><input type="number" step="0.01" min="0" aria-label="Vértice ${i+1}: distancia" value="${a.d??''}" data-i="${i}" data-k="d"><input type="number" step="0.01" aria-label="Vértice ${i+1}: cota" value="${a.z??''}" data-i="${i}" data-k="z"><input type="number" step="0.1" aria-label="Vértice ${i+1}: pendiente desde el anterior" ${i?`value="${Number.isFinite(g)?g.toFixed(2):''}"`:'disabled placeholder="—"'} data-i="${i}" data-k="g"><span class="preview-meta">${t===null?'—':t.toFixed(2)+(Number.isFinite(a.z)?` <b style="color:${a.z-t>=0?'#2d6cdf':'#a06d0c'}">${a.z-t>=0?'R':'C'} ${Math.abs(a.z-t).toFixed(2)}</b>`:'')}</span><button type="button" class="danger" onclick="removeDsRow(${i})" ${v.length<=2?'disabled':''} aria-label="Quitar vértice ${i+1}">✕</button></div>`}).join('');
 drawDs()}
function drawDs(){
 const pts=sortedPoints(),ok=dsValid();
 $('ds-draw').innerHTML=pts.length>=2?profileSvg(pts,ok?dsDraft.vertices:null):'';}
function dsValid(){const v=dsDraft.vertices;return v.length>=2&&v.every(a=>Number.isFinite(a.d)&&Number.isFinite(a.z))&&v.every((a,i)=>!i||a.d>v[i-1].d)}
$('ds-rows').addEventListener('input',e=>{
 const t=e.target,k=t.dataset.k;if(!k)return;const i=Number(t.dataset.i),v=dsDraft.vertices,val=t.value===''?null:Number(t.value);
 if(k==='g'){if(i&&Number.isFinite(val)&&Number.isFinite(v[i-1].z)){v[i].z=roundTo(v[i-1].z+val/100*(v[i].d-v[i-1].d),3);const z=$('ds-rows').querySelector(`input[data-i="${i}"][data-k="z"]`);if(z)z.value=v[i].z}}
 else v[i][k]=Number.isFinite(val)?val:null;
 drawDs()});
// Al salir de un campo se reordena y se recalculan las pendientes mostradas.
$('ds-rows').addEventListener('change',()=>{dsDraft.vertices.sort((a,b)=>(a.d??0)-(b.d??0));renderDsRows()});
function addDsRow(){
 const v=dsDraft.vertices,pts=sortedPoints();
 // Nuevo vértice a mitad del tramo más largo, sobre la rasante actual.
 let best=1;for(let i=1;i<v.length;i++)if(v[i].d-v[i-1].d>v[best].d-v[best-1].d)best=i;
 const d=roundTo((v[best].d+v[best-1].d)/2,2),z=lineAt(v,d);
 v.splice(best,0,{d,z:roundTo(z??pts[0].z,2)});renderDsRows()}
function removeDsRow(i){if(dsDraft.vertices.length>2){dsDraft.vertices.splice(i,1);renderDsRows()}}
$('ds-add').onclick=addDsRow;
$('ds-reset').onclick=()=>{dsDraft.vertices=defaultVertices();renderDsRows()};
$('ds-form').onsubmit=e=>{
 e.preventDefault();
 const num=id=>$(id).value===''?NaN:Number($(id).value),b=num('ds-bombeo'),tc=num('ds-tc'),tr=num('ds-tr');
 if(!dsValid())return $('ds-status').textContent='Revisa los vértices: cada uno necesita distancia y cota, sin distancias repetidas.';
 if(!(b>=0&&b<=10))return $('ds-status').textContent='El bombeo debe estar entre 0 y 10 %.';
 if(!(tc>0&&tc<=10&&tr>0&&tr<=10))return $('ds-status').textContent='Los taludes deben ser mayores que 0 y hasta 10 (horizontal por 1 vertical).';
 data.design={vertices:dsDraft.vertices.map(a=>({d:roundTo(a.d,2),z:roundTo(a.z,3)})),bombeo:b,talCorte:tc,talRelleno:tr,updatedAt:new Date().toISOString()};
 save();render();$('ds-dialog').close();$('status').textContent='Rasante guardada.'};
function removeDesign(){if(!data.design)return;if(!confirm('¿Quitar la rasante de este proyecto? Las estaciones y secciones no se modifican.'))return;data.design=null;save();render()}

/* ---------- Exportación ---------- */
function designCsv(){
 const ew=earthwork();if(!ew)return alert('Define la rasante primero.');
 const headers=['Estacion','Distancia m','Cota terreno m','Cota rasante m','Corte(-)/Relleno(+) en eje m','Area corte m2','Area relleno m2','Volumen corte m3','Volumen relleno m3','Corte acumulado m3','Relleno acumulado m3','Terreno supuesto plano'];
 const cells=ew.rows.map(r=>[station(r.p.d),r.p.d,roundTo(r.p.z,3),r.s?roundTo(r.s.zr,3):'',r.s?roundTo(r.s.dz,3):'',r.s?roundTo(r.s.cut,3):'',r.s?roundTo(r.s.fill,3):'',r.vc===null?'':roundTo(r.vc,2),r.vf===null?'':roundTo(r.vf,2),roundTo(r.accC,2),roundTo(r.accF,2),r.s?.assumedFlat?'si':'']);
 cells.push(['TOTAL','','','','','','',roundTo(ew.totC,2),roundTo(ew.totF,2),'','','']);
 const content='﻿'+[headers,...cells].map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');
 showTopoExport('Rasante y movimiento de tierras · CSV',previewTable(headers,cells),()=>download(content,projectFilename('movimiento-tierras.csv'),'text/csv;charset=utf-8'),true)}

/* ---------- Integración ---------- */
const dsBaseRender=render;
render=function(){dsBaseRender();renderDesign()};
render();
