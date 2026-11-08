// sections.js — secciones transversales por estación.
// Cada estación guarda p.xs = {L:[{tape,angle}], R:[{tape,angle}]}: tramos medidos desde el eje hacia
// afuera, en orden. Con cada tramo se calcula la distancia horizontal al eje y la cota del punto,
// igual que en el perfil: cinta × cos/sen(ángulo) según el modo de cinta del proyecto.
// Se carga después de extras.js.

const XS_SIDES={L:'Izquierda',R:'Derecha'};
let xsPointId=null,xsProjectId=null,xsDraft={L:[],R:[]};

/* ---------- Cálculo ---------- */
const xsValid=r=>Number.isFinite(r.tape)&&r.tape>0&&Number.isFinite(r.angle)&&Math.abs(r.angle)<=SLOPE_LIMITS.MAX_ANGLE;
const xsCount=p=>(p.xs?.L?.length||0)+(p.xs?.R?.length||0);
// Puntos del terreno ordenados de izquierda a derecha; o = distancia al eje (negativa a la izquierda).
function sectionPoints(p,xs=p.xs,mode=data.tapeMode){
 const out=[{o:0,z:p.z,axis:true}];
 for(const side of ['L','R']){let o=0,z=p.z;(xs?.[side]||[]).forEach((r,i)=>{if(!xsValid(r))return;const s=segment(r.tape,r.angle,mode);o+=s.h;z+=s.dz;out.push({o:side==='L'?-o:o,z,side,n:i+1})})}
 return out.sort((a,b)=>a.o-b.o)}

/* ---------- Dibujo ---------- */
function sectionSvg(p,xs=p.xs,opts={}){
 const W=opts.w||520,H=opts.h||230,L=50,R=16,T=opts.title===false?14:30,B=34;
 const pts=sectionPoints(p,xs),edges=[-(p.l||0),p.r||0];
 const extra=opts.extra||[],os=[...pts.map(a=>a.o),...edges,...extra.map(a=>a.o)],zs=[...pts.map(a=>a.z),...extra.map(a=>a.z)];
 let o0=Math.min(...os,-1),o1=Math.max(...os,1);const oPad=(o1-o0)*.06;o0-=oPad;o1+=oPad;
 let z0=Math.min(...zs),z1=Math.max(...zs);const zPad=Math.max((z1-z0)*.25,.4);z0-=zPad;z1+=zPad;
 // Misma escala en ambos ejes si cabe; si no, exageración vertical rotulada.
 const sx=(W-L-R)/(o1-o0);let sz=(H-T-B)/(z1-z0);
 if(sz>sx){const mid=(z0+z1)/2,half=(H-T-B)/sx/2;z0=mid-half;z1=mid+half;sz=sx}
 const x=o=>L+(o-o0)*sx,y=z=>H-B-(z-z0)*sz,exag=sz/sx;
 const zStep=niceStep(z1-z0,4),oStep=niceStep(o1-o0,6),dec=Math.max(0,-Math.floor(Math.log10(zStep)));
 let grid='';
 for(let k=Math.ceil(z0/zStep);k*zStep<=z1+1e-9;k++){const z=k*zStep;grid+=`<line x1="${L}" x2="${W-R}" y1="${y(z).toFixed(1)}" y2="${y(z).toFixed(1)}" stroke="#e3eadd"/><text x="${L-5}" y="${(y(z)+3).toFixed(1)}" text-anchor="end">${z.toFixed(dec)}</text>`}
 for(let k=Math.ceil(o0/oStep);k*oStep<=o1+1e-9;k++){const o=k*oStep;grid+=`<text x="${x(o).toFixed(1)}" y="${H-B+13}" text-anchor="middle">${Number(o.toFixed(2))}</text>`}
 const line=pts.map(a=>x(a.o).toFixed(1)+','+y(a.z).toFixed(1)).join(' ');
 const first=pts[0],last=pts[pts.length-1];
 const edgeMarks=edges.map((o,i)=>o?`<line x1="${x(o).toFixed(1)}" x2="${x(o).toFixed(1)}" y1="${T}" y2="${H-B}" stroke="#c98a12" stroke-dasharray="3 3"/><text x="${x(o).toFixed(1)}" y="${T+9}" text-anchor="middle" fill="#a06d0c">borde</text>`:'').join('');
 const title=opts.title===false?'':`<text x="${L}" y="16" fill="#24634d" font-size="11">SECCIÓN ${station(p.d)} · cota eje ${p.z.toFixed(2)} m</text><text x="${W-R}" y="16" text-anchor="end">${exag<1.05?'escala 1:1':'exageración vertical ×'+exag.toFixed(1)}</text>`;
 return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Sección transversal en ${station(p.d)}"><g font-size="9" fill="#6b7c65">${grid}${title}<text x="${(L+W-R)/2}" y="${H-4}" text-anchor="middle">← izquierda · distancia al eje (m) · derecha →</text></g>${pts.length>1?`<polygon points="${x(first.o).toFixed(1)},${H-B} ${line} ${x(last.o).toFixed(1)},${H-B}" fill="#dde9d1"/><polyline points="${line}" fill="none" stroke="#366b48" stroke-width="2.5" stroke-linejoin="round"/>`:''}${opts.overlay?opts.overlay(x,y):''}<g font-size="9">${edgeMarks}</g><line x1="${x(0).toFixed(1)}" x2="${x(0).toFixed(1)}" y1="${T}" y2="${H-B}" stroke="#24634d" stroke-dasharray="5 4"/><text x="${x(0).toFixed(1)}" y="${T-3}" text-anchor="middle" font-size="9" fill="#24634d">EJE</text>${pts.map(a=>`<circle cx="${x(a.o).toFixed(1)}" cy="${y(a.z).toFixed(1)}" r="${a.axis?4:3}" fill="${a.axis?'#24634d':'#366b48'}"><title>${a.axis?'Eje':(XS_SIDES[a.side]+' '+a.n)}: ${a.o.toFixed(2)} m, cota ${a.z.toFixed(2)} m</title></circle>`).join('')}</svg>`}

/* ---------- Diálogo de edición ---------- */
function openSection(id){
 const p=data.points.find(p=>p.id===id);if(!p)return;
 xsPointId=id;xsProjectId=data.id;
 xsDraft={L:(p.xs?.L||[]).map(r=>({...r})),R:(p.xs?.R||[]).map(r=>({...r}))};
 const i=sortedPoints().findIndex(q=>q.id===id);
 $('xs-title').textContent='Sección transversal · E-'+(i+1)+' · '+station(p.d);
 $('xs-status').textContent='';renderXsRows();$('xs-dialog').showModal()}
function renderXsRows(){
 for(const side of ['L','R']){
  const rows=xsDraft[side];
  $('xs-'+side).innerHTML=rows.length?'<div class="xs-row xs-head"><span></span><span>Cinta (m)</span><span>Ángulo (°)</span></div>'+rows.map((r,i)=>`<div class="xs-row"><span class="xs-n">${i+1}</span><input type="number" step="0.01" min="0" aria-label="${XS_SIDES[side]} ${i+1}: cinta (m)" placeholder="Cinta m" value="${r.tape??''}" data-side="${side}" data-i="${i}" data-k="tape"><input type="number" step="0.01" aria-label="${XS_SIDES[side]} ${i+1}: ángulo (°)" placeholder="Ángulo °" value="${r.angle??''}" data-side="${side}" data-i="${i}" data-k="angle"><button type="button" onclick="measureXs('${side}',${i})" aria-label="Medir ángulo ${XS_SIDES[side]} ${i+1}">Medir</button><button type="button" class="danger" onclick="removeXsRow('${side}',${i})" aria-label="Quitar punto ${XS_SIDES[side]} ${i+1}">✕</button></div>`).join(''):'<p class="preview-meta">Sin puntos.</p>'}
 drawXs()}
function drawXs(){
 const p=data.points.find(p=>p.id===xsPointId);if(!p)return;
 $('xs-draw').innerHTML=sectionSvg(p,xsDraft,typeof xsDesignOpts==='function'?xsDesignOpts(p,xsDraft):{});
 const bad=['L','R'].flatMap(s=>xsDraft[s].map((r,i)=>[s,i,r])).filter(([,,r])=>!xsValid(r)).length;
 const pts=sectionPoints(p,xsDraft),lo=pts[0],hi=pts[pts.length-1];
 $('xs-summary').textContent=(pts.length>1?'Ancho levantado: '+(hi.o-lo.o).toFixed(2)+' m ('+Math.abs(lo.o).toFixed(2)+' m izq. · '+hi.o.toFixed(2)+' m der.) · Cota mín. '+Math.min(...pts.map(a=>a.z)).toFixed(2)+' / máx. '+Math.max(...pts.map(a=>a.z)).toFixed(2)+' m':'Agrega puntos a cada lado del eje.')+(bad?' · '+bad+(bad===1?' punto incompleto (no se dibuja).':' puntos incompletos (no se dibujan).'):'')}
function addXsRow(side){
 const rows=xsDraft[side],prev=rows[rows.length-1];
 rows.push({tape:prev?.tape??null,angle:null});renderXsRows();
 const inputs=$('xs-'+side).querySelectorAll('input[data-k="angle"]');inputs[inputs.length-1]?.focus()}
function removeXsRow(side,i){xsDraft[side].splice(i,1);renderXsRows()}
for(const side of ['L','R'])$('xs-'+side).addEventListener('input',e=>{
 const t=e.target;if(!t.dataset.k)return;const v=t.value===''?null:Number(t.value);
 xsDraft[t.dataset.side][Number(t.dataset.i)][t.dataset.k]=Number.isFinite(v)?v:null;drawXs()});
async function measureXs(side,i){
 const btns=$('xs-dialog').querySelectorAll('button');btns.forEach(b=>b.disabled=true);
 try{
  if(!slState.on){await slEnable();if(!slState.on)throw Error($('slope-live').textContent||'No se pudieron activar los sensores.')}
  $('xs-status').textContent='Suelta el teléfono: mide en 1 segundo y dura 3 segundos…';
  const r=await slRead(),angle=roundTo(r.deg-(Number(data.zeroOffset)||0),2);
  xsDraft[side][i].angle=angle;renderXsRows();
  $('xs-status').textContent=XS_SIDES[side]+' '+(i+1)+': '+slSigned(angle)+'° (±'+r.sd.toFixed(2)+'°)'+(r.sd>SLOPE_LIMITS.SD_WARN?'. Variación alta: conviene repetir.':'.')
 }catch(err){slBuzz([80,60,80]);$('xs-status').textContent=err.message}
 finally{btns.forEach(b=>b.disabled=false)}}
$('xs-form').onsubmit=e=>{
 e.preventDefault();
 if(xsProjectId!==data.id){$('xs-status').textContent='El proyecto activo cambió. Cierra y vuelve a abrir la sección.';return}
 const p=data.points.find(p=>p.id===xsPointId);if(!p){$('xs-status').textContent='La estación ya no existe.';return}
 const clean=side=>xsDraft[side].filter(r=>r.tape!==null||r.angle!==null);
 const xs={L:clean('L'),R:clean('R')};
 if([...xs.L,...xs.R].some(r=>!xsValid(r))){$('xs-status').textContent='Completa cinta (mayor que 0) y ángulo (entre −'+SLOPE_LIMITS.MAX_ANGLE+'° y +'+SLOPE_LIMITS.MAX_ANGLE+'°) en todos los puntos, o quita los que sobren.';return}
 p.xs=xs.L.length||xs.R.length?xs:null;p.editedAt=new Date().toISOString();
 save();render();$('xs-dialog').close();$('status').textContent='Sección de '+station(p.d)+' guardada.'};
$('xs-L-add').onclick=()=>addXsRow('L');$('xs-R-add').onclick=()=>addXsRow('R');

/* ---------- Panel de secciones ---------- */
function renderSections(){
 const el=$('xs-list');if(!el)return;
 const pts=sortedPoints(),withXs=pts.filter(p=>xsCount(p));
 $('xs-count').textContent=pts.length?withXs.length+' de '+pts.length+' estaciones con sección.':'';
 el.innerHTML=withXs.length?withXs.map(p=>`<div class="xs-card"><div class="xs-card-head"><b>E-${pts.indexOf(p)+1} · ${station(p.d)}</b><button class="no-print" onclick="openSection('${p.id}')">Editar</button></div>${sectionSvg(p,p.xs,{w:360,h:190,...(typeof xsDesignOpts==='function'?xsDesignOpts(p,p.xs):{})})}${typeof xsDesignLabel==='function'?xsDesignLabel(p):''}</div>`).join(''):'<p class="empty">Aún no hay secciones. Usa el botón <b>Sección</b> en la libreta de estaciones.</p>'}
function sectionRows(){
 const rows=[];sortedPoints().forEach(p=>{sectionPoints(p).forEach(a=>{
  const r=a.axis?null:p.xs[a.side][a.n-1];
  rows.push([station(p.d),a.axis?'Eje':XS_SIDES[a.side],a.axis?0:a.n,Number(a.o.toFixed(3)),Number(a.z.toFixed(3)),Number((a.z-p.z).toFixed(3)),r?r.tape:'',r?r.angle:''])})});
 return rows}
function sectionsCsv(){
 const withXs=sortedPoints().filter(p=>xsCount(p));if(!withXs.length)return alert('Registra al menos una sección primero.');
 const headers=['Estacion','Lado','Punto','Distancia al eje m (- izq / + der)','Cota m','Desnivel respecto al eje m','Cinta m','Angulo grados'];
 const cells=sectionRows().filter(r=>withXs.some(p=>station(p.d)===r[0]));
 const content='﻿'+[headers,...cells].map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');
 showTopoExport('Secciones transversales · CSV',previewTable(headers,cells),()=>download(content,projectFilename('secciones.csv'),'text/csv;charset=utf-8'),true)}

/* ---------- Integración ---------- */
const xsBaseRender=render;
render=function(){xsBaseRender();renderSections()};
render();
