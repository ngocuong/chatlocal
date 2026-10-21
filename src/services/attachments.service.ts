import {extractDocument} from './document-files.service.js';
import fs from 'node:fs';import path from 'node:path';import {randomUUID} from 'node:crypto';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
const exec=promisify(execFile);const root=path.resolve('data/chat-attachments');
export type Attachment={id:string;chat:string;name:string;type:'image'|'text'|'document';bytes:number;text:string;mime:string};
const textExt=new Set(['.txt','.md','.json','.csv','.tsv','.html','.css','.js','.mjs','.cjs','.ts','.tsx','.jsx','.py','.go','.rs','.java','.c','.cpp','.h','.sql','.yaml','.yml','.toml','.xml','.svg','.sh','.swift']);
export function getAttachment(id:string,chat:string):Attachment{if(!/^[a-f0-9-]{36}$/.test(id))throw new Error('Tệp không hợp lệ.');const record=JSON.parse(fs.readFileSync(path.join(root,id,'metadata.json'),'utf8')) as Attachment;if(record.chat!==chat)throw new Error('Tệp thuộc cuộc trò chuyện khác.');return record;}
export function attachmentBytes(id:string,chat:string){getAttachment(id,chat);return fs.readFileSync(path.join(root,id,'content'));}
export async function saveAttachment(chat:string,name:string,buffer:Buffer):Promise<Attachment>{
 if(!chat||chat.length>100)throw new Error('Chat không hợp lệ.');if(!buffer.length||buffer.length>8*1024*1024)throw new Error('Mỗi tệp tối đa 8 MB.');
 name=path.basename(name).slice(0,180);const ext=path.extname(name).toLowerCase();let mime='text/plain',type:'image'|'text'|'document'='text';
 if(buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){mime='image/png';type='image'}
 else if(buffer[0]===255&&buffer[1]===216&&buffer[2]===255){mime='image/jpeg';type='image'}
 else if(buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP'){mime='image/webp';type='image'}
 else if(['.pdf','.docx','.pptx','.xlsx'].includes(ext)){type='document';mime=ext==='.xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':ext==='.pdf'?'application/pdf':ext==='.docx'?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'application/vnd.openxmlformats-officedocument.presentationml.presentation';}
 else if(!textExt.has(ext)||buffer.includes(0))throw new Error('Hỗ trợ PNG/JPEG/WebP và tệp mã nguồn/văn bản. Hỗ trợ thêm PDF, DOCX, XLSX và PPTX.');
 if(type==='text'&&buffer.length>300000)throw new Error('Tệp văn bản tối đa 300 KB.');
 const id=randomUUID(),folder=path.join(root,id);fs.mkdirSync(folder,{recursive:true,mode:0o700});const location=path.join(folder,'content');fs.writeFileSync(location,buffer,{mode:0o600});
 let text=type==='text'?buffer.toString('utf8'):'';
 if(type==='document'){try{text=await extractDocument(name,buffer)}catch(e){fs.rmSync(folder,{recursive:true,force:true});throw Error('Không đọc được tài liệu: '+(e as Error).message)}}
 if(type==='image'){try{const result=await exec(path.resolve('data/bin/ImageText'),[location],{timeout:30000,maxBuffer:1024*1024});text=JSON.parse(result.stdout).text||''}catch{}}
 const record:Attachment={id,chat,name,type,bytes:buffer.length,text:text.length>60000?text.slice(0,60000)+'\n[Nội dung đã cắt ở 60000 ký tự; phần còn lại chưa được đọc]':text,mime};fs.writeFileSync(path.join(folder,'metadata.json'),JSON.stringify(record),{mode:0o600});return record;
}
