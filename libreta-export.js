// libreta-export.js — tabla topográfica (libreta) en Excel .xlsx y en texto con columnas alineadas.
// El .xlsx se arma aquí mismo (sin librerías externas) para que funcione sin internet.
// Se carga después de export-text.js.

/* ---------- Escritor mínimo de .xlsx ---------- */
const XL_CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function xlCrc(b){let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=XL_CRC[(c^b[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0}
// ZIP sin compresión (método "store"): suficiente para Excel y muy simple.
function xlZip(files){
 const enc=new TextEncoder(),parts=[],central=[];let offset=0;
 const u16=v=>[v&255,(v>>>8)&255],u32=v=>[v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];
 for(const f of files){
  const name=enc.encode(f.name),data=enc.encode(f.data),crc=xlCrc(data);
  const local=[...u32(0x04034b50),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0x21),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0)];
  parts.push(new Uint8Array(local),name,data);
  central.push(new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0x21),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset)]),name);
  offset+=local.length+name.length+data.length}
 const cdSize=central.reduce((s,a)=>s+a.length,0);
 const end=new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(cdSize),...u32(offset),...u16(0)]);
 const all=[...parts,...central,end],out=new Uint8Array(all.reduce((s,a)=>s+a.length,0));let p=0;for(const a of all){out.set(a,p);p+=a.length}return out}
const xlEsc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'');
const xlCol=i=>{let s='';i++;while(i){const m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26)}return s};
// Celda: valor simple, o {v, s} con s = estilo: 1 negrita, 2 número 0.00, 3 título, 4 encabezado, 5 número 0.00 en negrita.
function xlsxBook(sheetName,rows,widths,merges=[]){
 const sheetRows=rows.map((r,ri)=>`<row r="${ri+1}">${r.map((c,ci)=>{if(c===null||c===undefined||c==='')return'';const cell=typeof c==='object'?c:{v:c},ref=xlCol(ci)+(ri+1),s=cell.s?` s="${cell.s}"`:'';
  return typeof cell.v==='number'&&Number.isFinite(cell.v)?`<c r="${ref}"${s}><v>${cell.v}</v></c>`:`<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xlEsc(cell.v)}</t></is></c>`}).join('')}</row>`).join('');
 const cols=widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('');
 const mergeXml=merges.length?`<mergeCells count="${merges.length}">${merges.map(m=>`<mergeCell ref="${m}"/>`).join('')}</mergeCells>`:'';
 const X='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
 return xlZip([
  {name:'[Content_Types].xml',data:X+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'},
  {name:'_rels/.rels',data:X+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
  {name:'xl/workbook.xml',data:X+`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xlEsc(sheetName.slice(0,31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`},
  {name:'xl/_rels/workbook.xml.rels',data:X+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'},
  {name:'xl/styles.xml',data:X+'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEDF2E8"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFB6C3B4"/></left><right style="thin"><color rgb="FFB6C3B4"/></right><top style="thin"><color rgb="FFB6C3B4"/></top><bottom style="thin"><color rgb="FFB6C3B4"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="2" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="2" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'},
  {name:'xl/worksheets/sheet1.xml',data:X+`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><cols>${cols}</cols><sheetData>${sheetRows}</sheetData>${mergeXml}<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`}])}

/* ---------- Tabla topográfica ---------- */
const LB_HEAD=['LADO','DISTANCIA (m)','AZIMUT','ESTACIÓN','DISTANCIA ACUMULADA (m)','ANCHO (m)','ELEVACIÓN (m)'];
function libretaData(){
 if(!data.points.length){alert('Registra estaciones primero.');return null}
 const rows=topoRows(),last=rows.at(-1),length=last?last.p.d-rows[0].p.d:0;
 const missing=rows.filter(r=>r.i&&r.az===null).length;
 return{rows,length,area:last?.area||0,missing,
  cells:rows.map(r=>[r.side,r.distance,r.i?(r.az===null?'Sin azimut':dms(r.az)):'------',station(r.p.d),r.p.d,r.p.l+r.p.r,r.p.z])}}
function libretaMeta(){return[(data.name||'Camino sin nombre'),'Fecha: '+new Date().toLocaleDateString('es-GT')+' · Método: '+(data.method==='slope'?'cinta y pendiente medida con teléfono':'GPS del teléfono')+' · '+data.points.length+' estaciones']}
function topoXlsx(){
 const L=libretaData();if(!L)return;const [title,meta]=libretaMeta();
 const rows=[[{v:'LIBRETA TOPOGRÁFICA — '+title,s:3}],[meta],[],LB_HEAD.map(h=>({v:h,s:4})),
  ...L.cells.map(c=>[{v:c[0],s:6},{v:roundTo(c[1],2),s:2},{v:c[2],s:6},{v:c[3],s:6},{v:roundTo(c[4],2),s:2},{v:roundTo(c[5],2),s:2},{v:roundTo(c[6],3),s:2}]),[],
  [{v:'LONGITUD LEVANTADA (m)',s:1},'','','',{v:roundTo(L.length,2),s:5}],[{v:'ÁREA ESTIMADA DEL CAMINO (m²)',s:1},'','','',{v:roundTo(L.area,2),s:5}],[{v:'ANCHO',s:1},'','','','VARIABLE'],[],
  ['El ancho y la elevación de cada fila corresponden a la estación de llegada. Cotas y azimuts preliminares; verificar antes del diseño.']];
 if(L.missing)rows.push([L.missing+(L.missing===1?' tramo sin azimut.':' tramos sin azimut.')]);
 const t=4+L.cells.length+2,merges=['A1:G1','A2:G2',`A${t}:D${t}`,`A${t+1}:D${t+1}`,`A${t+2}:D${t+2}`,`A${t+4}:G${t+4}`];if(L.missing)merges.push(`A${t+5}:G${t+5}`);
 const bytes=xlsxBook('Libreta topográfica',rows,[14,14,16,13,16,11,14],merges);
 showTopoExport('Libreta topográfica · Excel',`<p class="preview-meta">Archivo de Excel (.xlsx) con números editables, encabezados y totales.</p>${previewTable(LB_HEAD,L.cells.map(c=>[c[0],c[1].toFixed(2),c[2],c[3],c[4].toFixed(2),c[5].toFixed(2),c[6].toFixed(2)]))}<p class="preview-meta">Longitud: ${L.length.toFixed(2)} m · Área estimada: ${L.area.toFixed(2)} m²</p>`,
  ()=>download(bytes,projectFilename('libreta-topografica.xlsx'),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),true)}
// Texto con columnas alineadas (fuente de ancho fijo).
topoText=function(){
 const L=libretaData();if(!L)return;const [title,meta]=libretaMeta();
 const head=['LADO','DISTANCIA','AZIMUT','ESTACION','DIST.ACUM.','ANCHO','ELEVACION'],right=[false,true,false,false,true,true,true];
 const body=L.cells.map(c=>[c[0],c[1].toFixed(2),c[2],c[3],c[4].toFixed(2),c[5].toFixed(2),c[6].toFixed(2)]);
 const w=head.map((h,i)=>Math.max(h.length,...body.map(r=>r[i].length)));
 const line=r=>r.map((v,i)=>right[i]?v.padStart(w[i]):v.padEnd(w[i])).join('   ').trimEnd(),rule='-'.repeat(line(head).length);
 const content=['LIBRETA TOPOGRAFICA - '+title,meta,'',line(head),rule,...body.map(line),rule,'LONGITUD LEVANTADA: '+L.length.toFixed(2)+' m','AREA ESTIMADA DEL CAMINO: '+L.area.toFixed(2)+' m2','ANCHO: VARIABLE','','Distancias, anchos y elevaciones en metros. El ancho y la elevacion de cada fila corresponden a la estacion de llegada.','Cotas y azimuts preliminares; verificar antes del diseno.'+(L.missing?' '+L.missing+(L.missing===1?' tramo sin azimut.':' tramos sin azimut.'):'')].join('\r\n')+'\r\n';
 showTopoExport('Libreta topográfica · TXT',content,()=>download(content,projectFilename('libreta-topografica.txt'),'text/plain;charset=utf-8'))};
