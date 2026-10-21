import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import AdmZip from 'adm-zip';
import mammoth from 'mammoth';
import ExcelJS from 'exceljs';
import {Document,Packer,Paragraph,HeadingLevel,Table,TableRow,TableCell,TextRun,Footer,PageNumber,AlignmentType,BorderStyle,ShadingType,WidthType,TableLayoutType} from 'docx';
import {createRequire} from 'node:module';
import {chromium} from 'playwright';
// PptxGenJS 4 exports an ESM .js entry without package type=module on Node 22.
const PptxGenJS=createRequire(import.meta.url)('pptxgenjs') as typeof import('pptxgenjs').default;
const exec=promisify(execFile);
function officeZip(buffer:Buffer){const zip=new AdmZip(buffer),entries=zip.getEntries();if(entries.length>3000||entries.reduce((n,e)=>n+e.header.size,0)>60*1024*1024)throw Error('Tài liệu giải nén quá lớn.');return zip;}
const decodeXML=(s:string)=>s.replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>String.fromCodePoint(n[0]==='x'?parseInt(n.slice(1),16):Number(n))).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
export async function extractDocument(name:string,buffer:Buffer):Promise<string>{
 const ext=path.extname(name).toLowerCase();
 if(ext==='.xlsx'){officeZip(buffer);const book=new ExcelJS.Workbook();await book.xlsx.load(buffer as any);let output='';for(const sheet of book.worksheets){output+='Sheet: '+sheet.name+'\n';sheet.eachRow(row=>{if(output.length<150000)output+=row.number+': '+Array.from({length:Math.min(row.cellCount,200)},(_,i)=>{const cell=row.getCell(i+1);return cell.address+'='+cell.text+(cell.formula?' [formula: '+cell.formula+']':'')}).join(' | ')+'\n'});}return output.slice(0,150000)+(output.length>150000?'\n[Nội dung đã cắt]':'');}
 if(ext==='.docx'){officeZip(buffer);return (await mammoth.extractRawText({buffer})).value;}
 if(ext==='.pptx'){const zip=officeZip(buffer);return zip.getEntries().filter(e=>/^ppt\/slides\/slide\d+\.xml$/.test(e.entryName)).sort((a,b)=>Number(a.entryName.match(/(\d+)\.xml$/)![1])-Number(b.entryName.match(/(\d+)\.xml$/)![1])).map((e,i)=>'Slide '+(i+1)+'\n'+[...e.getData().toString().matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map(m=>decodeXML(m[1])).join('\n')).join('\n\n');}
 if(ext!=='.pdf')throw Error('Định dạng tài liệu chưa hỗ trợ.');
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const pdf=await pdfjs.getDocument({data:new Uint8Array(buffer),useSystemFonts:true,isEvalSupported:false}).promise;
 const sections:string[]=[],temp=fs.mkdtempSync(path.join(os.tmpdir(),'local-pdf-'));
 try{for(let i=1;i<=Math.min(pdf.numPages,100);i++){
  const page=await pdf.getPage(i),content=await page.getTextContent();
  let text=content.items.map(item=>'str' in item?item.str+('hasEOL' in item&&item.hasEOL?'\n':' '):'').join('');
  if(!text.trim()&&fs.existsSync(path.resolve('data/bin/ImageText'))){try{const canvas=await import('@napi-rs/canvas');const view=page.getViewport({scale:1.5});const image=canvas.createCanvas(Math.ceil(view.width),Math.ceil(view.height));await page.render({canvas:image as any,canvasContext:image.getContext('2d') as any,viewport:view}).promise;const file=path.join(temp,i+'.png');fs.writeFileSync(file,image.toBuffer('image/png'));const ocr=await exec(path.resolve('data/bin/ImageText'),[file],{timeout:30000,maxBuffer:1024*1024});text=JSON.parse(ocr.stdout).text||'';}catch{text='[Trang ảnh: không đọc được OCR, cần kiểm tra trang gốc]';}}
  sections.push('Trang '+i+'\n'+(text||'[Không có văn bản trích xuất được]'));page.cleanup();
  if(sections.join('\n').length>150000){sections.push('[Nội dung vượt giới hạn đọc; chỉ có phần đầu tài liệu]');break;}
 }if(pdf.numPages>100)sections.push('[Chỉ đọc 100/'+pdf.numPages+' trang]');return sections.join('\n\n');
 }finally{await pdf.destroy();fs.rmSync(temp,{recursive:true,force:true});}
}
export type SheetValue=string|number|boolean|null|{formula:string;result?:number};
export type DocumentSpec={format:'docx'|'pptx'|'xlsx'|'pdf';title:string;attachment?:string;replacements?:Array<{find:string;replace:string}>;cells?:Array<{sheet:string;cell:string;value:SheetValue}>;sheets?:Array<{name:string;rows:SheetValue[][]}>;sections?:Array<{heading?:string;paragraphs?:string[];bullets?:string[];table?:string[][]}>;slides?:Array<{title:string;body?:string;bullets?:string[];notes?:string}>};
export async function createDocument(spec:DocumentSpec):Promise<Buffer>{
 if(!spec||typeof spec.title!=='string'||!spec.title.trim()||JSON.stringify(spec).length>200000)throw Error('Nội dung tài liệu không hợp lệ.');
 if(spec.format==='xlsx'){
  if(!Array.isArray(spec.sheets)||!spec.sheets.length||spec.sheets.length>50)throw Error('Excel cần 1–50 sheet.');
  const book=new ExcelJS.Workbook();book.creator='Chat trên máy';
  for(const item of spec.sheets){const sheet=book.addWorksheet(item.name);if(!Array.isArray(item.rows)||item.rows.length>10000)throw Error('Sheet tối đa 10000 hàng.');for(const row of item.rows){if(!Array.isArray(row)||row.length>200)throw Error('Hàng tối đa 200 ô.');row.forEach(validateSheetValue);sheet.addRow(row);}sheet.getRow(1).font={bold:true};sheet.columns.forEach(col=>col.width=22);}
  return Buffer.from(await book.xlsx.writeBuffer());
 }
 if(spec.format==='pdf')return createPdf(spec);
 if(spec.format==='docx'){
  if(!Array.isArray(spec.sections)||!spec.sections.length||spec.sections.length>200)throw Error('Word cần có nội dung sections.');
  return Packer.toBuffer(styledDocx(spec));
 }
 if(spec.format!=='pptx'||!Array.isArray(spec.slides)||!spec.slides.length||spec.slides.length>100)throw Error('PowerPoint cần 1–100 slide.');
 const pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';pptx.title=spec.title;pptx.author='Chat trên máy';pptx.subject=spec.title;
 for(const [index,item] of spec.slides.entries()){
  if(typeof item.title!=='string')throw Error('Slide cần có tiêu đề.');const slide=pptx.addSlide();slide.background={color:'F7F8FC'};
  slide.addText(item.title,{x:.6,y:.45,w:12.1,h:1.1,fontFace:'Arial',fontSize:30,bold:true,color:'172554',breakLine:false,fit:'shrink',margin:0});
  const lines=[...(item.body?[item.body]:[]),...(item.bullets||[]).map(t=>'• '+t)];
  slide.addText(lines.join('\n\n'),{x:.65,y:1.85,w:12,h:4.8,fontFace:'Arial',fontSize:22,color:'273244',valign:'top',fit:'shrink',margin:0,paraSpaceAfter:14});
  slide.addText(String(index+1),{x:12,y:7.05,w:.6,h:.2,fontSize:10,color:'64748B',align:'right'});if(item.notes)slide.addNotes(item.notes);
 }
 return Buffer.from(await pptx.write({outputType:'nodebuffer'}) as Buffer);
}

// Shares the PDF palette so Word and PDF exports of one report look alike.
const navy='172554',accent='1E3A8A',muted='64748B',rule='CBD5E1',zebra='F1F5F9';
function styledDocx(spec:DocumentSpec){
 const thin={style:BorderStyle.SINGLE,size:4,color:'E2E8F0'},none={style:BorderStyle.NONE,size:0,color:'FFFFFF'};
 const children:Array<Paragraph|Table>=[
  new Paragraph({heading:HeadingLevel.TITLE,children:[new TextRun({text:spec.title,bold:true,size:44,color:navy})],spacing:{after:80}}),
  new Paragraph({children:[new TextRun({text:new Date().toLocaleDateString('vi-VN'),size:18,color:muted})],border:{bottom:{style:BorderStyle.SINGLE,size:18,color:accent,space:8}},spacing:{after:360}})
 ];
 for(const section of spec.sections||[]){
  if(section.heading)children.push(new Paragraph({heading:HeadingLevel.HEADING_1,children:[new TextRun({text:section.heading,bold:true,size:28,color:accent})],border:{bottom:{style:BorderStyle.SINGLE,size:4,color:rule,space:4}},spacing:{before:360,after:160},keepNext:true}));
  for(const text of section.paragraphs||[])children.push(new Paragraph({children:[new TextRun(text)],alignment:AlignmentType.JUSTIFIED,spacing:{after:140}}));
  for(const text of section.bullets||[])children.push(new Paragraph({children:[new TextRun(text)],bullet:{level:0},spacing:{after:80}}));
  if(section.table?.length){
   const columns=Math.max(...section.table.map(row=>row.length)),cellWidth=Math.floor(9866/columns);
   children.push(new Table({width:{size:cellWidth*columns,type:WidthType.DXA},columnWidths:Array(columns).fill(cellWidth),layout:TableLayoutType.FIXED,borders:{top:none,bottom:thin,left:none,right:none,insideHorizontal:thin,insideVertical:none},rows:section.table.map((row,r)=>new TableRow({tableHeader:r===0,cantSplit:true,children:Array.from({length:columns},(_,c)=>new TableCell({
    width:{size:cellWidth,type:WidthType.DXA},
    shading:r===0?{type:ShadingType.CLEAR,color:'auto',fill:accent}:r%2===0?{type:ShadingType.CLEAR,color:'auto',fill:zebra}:undefined,
    margins:{top:80,bottom:80,left:110,right:110},
    children:[new Paragraph({spacing:{after:0,line:260},children:[new TextRun({text:row[c]??'',bold:r===0,color:r===0?'FFFFFF':undefined,size:20})]})]
   }))}))}),new Paragraph({spacing:{after:120},children:[]}));
  }
 }
 const footer=new Footer({children:[new Paragraph({alignment:AlignmentType.CENTER,children:[new TextRun({children:[PageNumber.CURRENT,' / ',PageNumber.TOTAL_PAGES],size:16,color:'94A3B8'})]})]});
 return new Document({creator:'Chat trên máy',title:spec.title,styles:{default:{document:{run:{font:'Arial',size:21,color:'1F2937'},paragraph:{spacing:{after:140,line:300}}}}},sections:[{properties:{page:{margin:{top:1134,bottom:1134,left:1020,right:1020}}},footers:{default:footer},children}]});
}
const escapeHTML=(s:unknown)=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const pdfStyle=`@page{size:A4;margin:20mm 18mm 22mm}*{box-sizing:border-box}body{margin:0;font-family:-apple-system,"Helvetica Neue",Arial,sans-serif;font-size:10.5pt;line-height:1.55;color:#1f2937}
header{border-bottom:3px solid #1e3a8a;padding-bottom:10pt;margin-bottom:18pt}h1{font-size:22pt;line-height:1.25;color:#172554;margin:0 0 4pt}header p{margin:0;color:#64748b;font-size:9pt}
section{margin-bottom:14pt}h2{font-size:14pt;color:#1e3a8a;margin:18pt 0 8pt;padding-bottom:4pt;border-bottom:1px solid #cbd5e1;break-after:avoid}p{margin:0 0 7pt;text-align:justify}
ul{margin:0 0 8pt;padding-left:16pt}li{margin-bottom:3pt}table{width:100%;border-collapse:collapse;margin:6pt 0 10pt;font-size:9.5pt;break-inside:auto}tr{break-inside:avoid}
th{background:#1e3a8a;color:#fff;text-align:left;font-weight:600;padding:5pt 6pt}td{padding:5pt 6pt;border-bottom:1px solid #e2e8f0;vertical-align:top}tbody tr:nth-child(even) td{background:#f1f5f9}`;
// Same section schema as DOCX, rendered by the installed Chrome for proper Vietnamese text shaping.
async function createPdf(spec:DocumentSpec):Promise<Buffer>{
 if(!Array.isArray(spec.sections)||!spec.sections.length||spec.sections.length>200)throw Error('PDF cần có nội dung sections.');
 const body=spec.sections.map(section=>{
  const [head,...rows]=section.table||[];
  const table=head?`<table><thead><tr>${head.map(c=>'<th>'+escapeHTML(c)+'</th>').join('')}</tr></thead><tbody>${rows.map(r=>'<tr>'+r.map(c=>'<td>'+escapeHTML(c)+'</td>').join('')+'</tr>').join('')}</tbody></table>`:'';
  const bullets=section.bullets?.length?'<ul>'+section.bullets.map(b=>'<li>'+escapeHTML(b)+'</li>').join('')+'</ul>':'';
  return `<section>${section.heading?'<h2>'+escapeHTML(section.heading)+'</h2>':''}${(section.paragraphs||[]).map(t=>'<p>'+escapeHTML(t)+'</p>').join('')}${bullets}${table}</section>`;
 }).join('');
 const html=`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${escapeHTML(spec.title)}</title><style>${pdfStyle}</style></head><body><header><h1>${escapeHTML(spec.title)}</h1><p>${new Date().toLocaleDateString('vi-VN')}</p></header>${body}</body></html>`;
 const browser=await chromium.launch({channel:'chrome',headless:true}).catch(()=>chromium.launch({headless:true})).catch(()=>{throw Error('Chưa tạo được PDF: cần Google Chrome trên máy.')});
 try{
  const context=await browser.newContext({javaScriptEnabled:false});await context.route('**/*',route=>route.request().url().startsWith('data:')?route.continue():route.abort());
  const page=await context.newPage();await page.setContent(html,{waitUntil:'load'});
  return Buffer.from(await page.pdf({format:'A4',printBackground:true,preferCSSPageSize:true,displayHeaderFooter:true,headerTemplate:'<span></span>',footerTemplate:'<div style="width:100%;font-size:8pt;color:#94a3b8;text-align:center;font-family:Arial"><span class="pageNumber"></span> / <span class="totalPages"></span></div>'}));
 }finally{await browser.close();}
}
function validateSheetValue(value:SheetValue){
 if(value===null||typeof value==='boolean'||typeof value==='string'&&value.length<=32767||typeof value==='number'&&Number.isFinite(value))return;
 if(value&&typeof value==='object'&&typeof value.formula==='string'&&value.formula.length<=8192&&(value.result===undefined||typeof value.result==='number'&&Number.isFinite(value.result)))return;
 throw Error('Giá trị ô Excel không hợp lệ.');
}
const encodeXML=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
// Replace within each paragraph, including text split into multiple formatting runs.
function replaceParagraph(xml:string,prefix:string,find:string,replacement:string){
 let count=0;
 const output=xml.replace(new RegExp('<'+prefix+':p(?:\\s[^>]*)?>[\\s\\S]*?</'+prefix+':p>','g'),paragraph=>{
  const nodes=[...paragraph.matchAll(new RegExp('<'+prefix+':t(?:\\s[^>]*)?>([\\s\\S]*?)</'+prefix+':t>','g'))];
  const values=nodes.map(n=>decodeXML(n[1])),starts:number[]=[];let text='';
  for(const value of values){starts.push(text.length);text+=value;}
  const matches:number[]=[];for(let at=text.indexOf(find);at!==-1;at=text.indexOf(find,at+find.length))matches.push(at);
  for(const at of matches.reverse()){
   const end=at+find.length;const first=starts.findIndex((start,i)=>at>=start&&at<start+decodeXML(nodes[i][1]).length);
   const last=starts.findIndex((start,i)=>end>start&&end<=start+decodeXML(nodes[i][1]).length);
   if(first<0||last<0)continue;
   if(first===last)values[first]=values[first].slice(0,at-starts[first])+replacement+values[first].slice(end-starts[first]);
   else{values[first]=values[first].slice(0,at-starts[first])+replacement;for(let i=first+1;i<last;i++)values[i]='';values[last]=values[last].slice(end-starts[last]);}
   count++;
  }
  if(!matches.length)return paragraph;
  for(let i=nodes.length-1;i>=0;i--){const n=nodes[i],at=n.index!;const tag=n[0].slice(0,n[0].indexOf('>')+1).replace(/ xml:space="[^"]*"/g,'').replace(/>$/,' xml:space="preserve">');paragraph=paragraph.slice(0,at)+tag+encodeXML(values[i])+'</'+prefix+':t>'+paragraph.slice(at+n[0].length);}
  return paragraph;
 });
 return {output,count};
}
export async function editDocument(spec:DocumentSpec,buffer:Buffer):Promise<Buffer>{
 const zip=officeZip(buffer);
 if(spec.format==='xlsx'){
  if(!Array.isArray(spec.cells)||!spec.cells.length||spec.cells.length>10000)throw Error('Cần 1–10000 ô cần sửa.');
  const book=new ExcelJS.Workbook();await book.xlsx.load(buffer as any);
  for(const change of spec.cells){const sheet=book.getWorksheet(change.sheet);if(!sheet)throw Error('Không có sheet: '+change.sheet);if(typeof change.cell!=='string'||!/^([A-Z]{1,3})([1-9]\d{0,6})$/.test(change.cell))throw Error('Địa chỉ ô không hợp lệ.');const match=change.cell.match(/^([A-Z]+)(\d+)$/)!;const column=[...match[1]].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0);if(column>16384||Number(match[2])>1048576)throw Error('Ô nằm ngoài giới hạn Excel.');validateSheetValue(change.value);sheet.getCell(change.cell).value=change.value;}
  return Buffer.from(await book.xlsx.writeBuffer());
 }
 if(!['docx','pptx'].includes(spec.format)||!Array.isArray(spec.replacements)||!spec.replacements.length||spec.replacements.length>200)throw Error('Cần danh sách replacements để sửa Word/PowerPoint.');
 const prefix=spec.format==='docx'?'w':'a';
 const parts=zip.getEntries().filter(e=>spec.format==='docx'?/^word\/(document|header\d+|footer\d+|footnotes|endnotes)\.xml$/.test(e.entryName):/^ppt\/(slides\/slide\d+|notesSlides\/notesSlide\d+)\.xml$/.test(e.entryName));
 if(!parts.length)throw Error('Nội dung không đúng định dạng Office đã chọn.');
 for(const change of spec.replacements){
  if(typeof change.find!=='string'||!change.find||change.find.length>20000||typeof change.replace!=='string'||change.replace.length>20000||/[\x00-\x08\x0B\x0C\x0E-\x1F\r\n\t]/.test(change.find+change.replace))throw Error('Nội dung thay thế không hợp lệ; mỗi thay thế nằm trong một đoạn văn.');
  let total=0;for(const part of parts){const result=replaceParagraph(zip.readAsText(part.entryName),prefix,change.find,change.replace);total+=result.count;if(result.count)zip.updateFile(part.entryName,Buffer.from(result.output));}
  if(!total)throw Error('Không tìm thấy nội dung cần thay: '+change.find.slice(0,100));
 }
 return zip.toBuffer();
}
