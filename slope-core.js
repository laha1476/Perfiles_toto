// slope-core.js — cálculo de cotas por pendiente medida (sin interfaz, probable en Node)
const SLOPE_LIMITS={MAX_ANGLE:60,SD_WARN:0.2,SD_REJECT:0.5,ZERO_WARN:2,TIE_WARN:0.5};
const SLOPE_RAD=Math.PI/180;
const roundTo=(v,n)=>Math.round(v*10**n)/10**n;
function median(a){const s=[...a].sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2}
function stdev(a){if(a.length<2)return 0;const m=a.reduce((s,v)=>s+v,0)/a.length;return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/(a.length-1))}
function circularMean(degs){const x=degs.reduce((s,d)=>s+Math.cos(d*SLOPE_RAD),0),y=degs.reduce((s,d)=>s+Math.sin(d*SLOPE_RAD),0);return(Math.atan2(y,x)/SLOPE_RAD+360)%360}
// Ida apunta de la estación anterior a la nueva; vuelta, de la nueva a la anterior (mide -θ).
// Con ambas, el error de cero del teléfono se cancela: ida = θ+b, vuelta = -θ+b.
function combineAngle(ida,vuelta,offset=0){
 if(ida&&vuelta)return{deg:(ida.deg-vuelta.deg)/2,bias:(ida.deg+vuelta.deg)/2,kind:'ida y vuelta'};
 if(ida)return{deg:ida.deg-offset,bias:null,kind:'una lectura'};
 if(vuelta)return{deg:-(vuelta.deg-offset),bias:null,kind:'solo vuelta'};
 return null}
// L = distancia con cinta. 'inclinada': cinta sobre el terreno; 'horizontal': cinta nivelada.
function segment(L,deg,mode){const t=deg*SLOPE_RAD;return mode==='horizontal'?{h:L,dz:L*Math.tan(t)}:{h:L*Math.cos(t),dz:L*Math.sin(t)}}
function headingToAzimuth(heading,declination){return heading===null||heading===undefined?null:(((heading+Number(declination||0))%360)+360)%360}
// Recalcula distancia horizontal acumulada (d), cota (z) y pendiente (slope) de cada estación.
// El orden lo da p.seq (orden de captura); la primera estación toma d0 y z0 del proyecto.
function recalcSlope(project){
 const out={segments:0,incomplete:0,both:0,maxTie:0};
 if(!project||project.method!=='slope')return out;
 const pts=[...project.points].sort((a,b)=>(a.seq??0)-(b.seq??0)),off=Number(project.zeroOffset)||0,step=Number(project.step)||10;
 pts.forEach((p,i)=>{
  if(!i){p.d=roundTo(Number(project.d0)||0,2);p.z=roundTo(Number(project.z0)||0,3);p.dz=null;p.slope=null;p.incomplete=false;return}
  const prev=pts[i-1],ok=Number.isFinite(p.tape)&&p.tape>0&&Number.isFinite(p.angle)&&Math.abs(p.angle)<=SLOPE_LIMITS.MAX_ANGLE;
  const s=ok?segment(p.tape,p.angle,project.tapeMode):{h:step,dz:0};
  const h=roundTo(s.h,2),dz=roundTo(s.dz,3);
  p.d=roundTo(prev.d+h,2);p.z=roundTo(prev.z+dz,3);p.dz=dz;p.slope=h?dz/h*100:null;p.incomplete=!ok;
  out.segments++;if(!ok)out.incomplete++;
  const r=p.readings;if(r&&r.ida&&r.vuelta){out.both++;out.maxTie=Math.max(out.maxTie,Math.abs((r.ida.deg+r.vuelta.deg)/2-off))}
 });
 return out}
function niceStep(range,target=5){if(!(range>0))return 1;const raw=range/target,pow=10**Math.floor(Math.log10(raw)),f=raw/pow;return(f<1.5?1:f<3.5?2:f<7.5?5:10)*pow}
// Perfil longitudinal con rejilla, cotas rotuladas y exageración vertical explícita.
function profileSvg(points){
 const p=[...points].sort((a,b)=>a.d-b.d),W=690,H=270,L=60,R=24,T=28,B=46,d0=p[0].d,d1=p[p.length-1].d,span=d1-d0||1;
 const zs=p.map(a=>a.z),zmin=Math.min(...zs),zmax=Math.max(...zs),pad=Math.max((zmax-zmin)*.18,.3),lo=zmin-pad,hi=zmax+pad;
 const x=d=>L+(d-d0)/span*(W-L-R),y=z=>H-B-(z-lo)/(hi-lo)*(H-T-B);
 const zStep=niceStep(hi-lo,5),dStep=niceStep(span,7),dec=Math.max(0,-Math.floor(Math.log10(zStep)));
 let grid='';
 for(let k=Math.ceil(lo/zStep);k*zStep<=hi+1e-9;k++){const z=k*zStep;grid+=`<line x1="${L}" x2="${W-R}" y1="${y(z).toFixed(1)}" y2="${y(z).toFixed(1)}" stroke="#dfe7d9"/><text x="${L-6}" y="${(y(z)+3).toFixed(1)}" text-anchor="end">${z.toFixed(dec)}</text>`}
 for(let k=Math.ceil(d0/dStep);k*dStep<=d1+1e-9;k++){const d=k*dStep;grid+=`<line x1="${x(d).toFixed(1)}" x2="${x(d).toFixed(1)}" y1="${T}" y2="${H-B}" stroke="#eef2ea"/><text x="${x(d).toFixed(1)}" y="${H-B+15}" text-anchor="middle">${Number(d.toFixed(2))}</text>`}
 const line=p.map(a=>x(a.d).toFixed(1)+','+y(a.z).toFixed(1)).join(' '),every=Math.ceil(p.length/14);
 const exag=((H-T-B)/(hi-lo))/((W-L-R)/span);
 const labels=p.map((a,i)=>i%every===0?`<text x="${x(a.d).toFixed(1)}" y="${(y(a.z)-8).toFixed(1)}" text-anchor="middle" fill="#18392e">${a.z.toFixed(2)}</text>`:'').join('');
 return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Perfil longitudinal, cotas en metros"><g font-size="10" fill="#6b7c65">${grid}<text x="${L}" y="16" fill="#24634d" font-size="11">PERFIL LONGITUDINAL · cota (m) / distancia horizontal (m)</text><text x="${W-R}" y="16" text-anchor="end">${exag<1.2?'sin exageración vertical':'exageración vertical ×'+exag.toFixed(1)}</text><text x="${(L+W-R)/2}" y="${H-6}" text-anchor="middle">distancia horizontal (m)</text></g><path d="M${L} ${T}V${H-B}H${W-R}" fill="none" stroke="#b8c7af"/><polygon points="${x(d0).toFixed(1)},${H-B} ${line} ${x(d1).toFixed(1)},${H-B}" fill="#dde9d1"/><polyline points="${line}" fill="none" stroke="#366b48" stroke-width="2.5"/>${p.map(a=>`<circle cx="${x(a.d).toFixed(1)}" cy="${y(a.z).toFixed(1)}" r="3.5" fill="#366b48"><title>${a.d.toFixed(2)} m: ${a.z.toFixed(2)} m</title></circle>`).join('')}<g font-size="9">${labels}</g></svg>`}
