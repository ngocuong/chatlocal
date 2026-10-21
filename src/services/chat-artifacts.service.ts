import {resolveLocalImageModel,generateLocalImage,localImageStatus} from './local-image.service.js';
import fs from 'node:fs';import path from 'node:path';import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {createDocument,editDocument,type DocumentSpec} from './document-files.service.js';
import {attachmentBytes,getAttachment} from './attachments.service.js';
const root=path.resolve('data/chat-artifacts');
export type Artifact={imageVerified?:boolean;delivery?:'loaded'|'failed';deliveryAt?:string;editMode?:'preserve'|'reference';imageModel?:string;generationSeconds?:number;id:string;chat:string;name:string;mime:string;bytes:number;url:string};
export function saveArtifact(chat:string,name:string,mime:string,buffer:Buffer,details:Pick<Artifact,'imageModel'|'generationSeconds'|'editMode'|'imageVerified'>={}):Artifact{
 if(typeof chat!=='string'||!chat||chat.length>100)throw Error('Chat không hợp lệ.');if(!buffer.length||buffer.length>50*1024*1024)throw Error('Kết quả vượt giới hạn 50 MB.');
 const id=randomUUID();name=path.basename(name).replace(/[\r\n]/g,'').slice(0,180);const folder=path.join(root,id);fs.mkdirSync(folder,{recursive:true,mode:0o700});fs.writeFileSync(path.join(folder,'content'),buffer,{mode:0o600});
 const record={...details,id,chat,name,mime,bytes:buffer.length,url:'/local-artifact?id='+id+'&chat='+encodeURIComponent(chat)};fs.writeFileSync(path.join(folder,'metadata.json'),JSON.stringify(record),{mode:0o600});return record;
}
export function listArtifacts(chat:string):Artifact[]{
 if(!chat||!fs.existsSync(root))return [];
 const records:Array<{record:Artifact;time:number}>=[];
 for(const id of fs.readdirSync(root)){if(!/^[a-f0-9-]{36}$/.test(id))continue;try{const file=path.join(root,id,'metadata.json'),record=JSON.parse(fs.readFileSync(file,'utf8')) as Artifact;if(record.chat===chat&&record.id===id&&fs.existsSync(path.join(root,id,'content')))records.push({record,time:fs.statSync(path.join(root,id,'content')).mtimeMs});}catch{}}
 return records.sort((a,b)=>a.time-b.time).map(item=>item.record);
}
export function readArtifact(id:string,chat:string){if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Tệp không hợp lệ.');const record=JSON.parse(fs.readFileSync(path.join(root,id,'metadata.json'),'utf8')) as Artifact;if(record.chat!==chat)throw Error('Tệp thuộc chat khác.');return {record,buffer:fs.readFileSync(path.join(root,id,'content'))};}
export function recordArtifactDelivery(id:string,chat:string,status:'loaded'|'failed'){
 const {record}=readArtifact(id,chat);
 if(!record.mime.startsWith('image/'))throw Error('Tệp không phải ảnh.');
 record.delivery=status;record.deliveryAt=new Date().toISOString();
 fs.writeFileSync(path.join(root,id,'metadata.json'),JSON.stringify(record),{mode:0o600});
 return {id,status};
}
export async function verifyImageOutput(buffer:Buffer){
 try{const decoded=await sharp(buffer,{limitInputPixels:40e6,failOn:'error'}).raw().toBuffer({resolveWithObject:true});if(!decoded.info.width||!decoded.info.height||!decoded.data.length)throw Error('empty');}
 catch{throw Error('Công cụ chưa tạo được ảnh đầu ra hợp lệ; chưa lưu tệp ảnh. Hãy thử lại hoặc chọn model khác.');}
}
export async function documentArtifact(chat:string,spec:DocumentSpec){
 if(!spec||typeof spec.title!=='string'||!spec.title.trim()||JSON.stringify(spec).length>200000)throw Error('Nội dung tài liệu không hợp lệ.');
 if(spec.format==='pdf'&&spec.attachment)throw Error('Chưa hỗ trợ sửa trực tiếp PDF; hãy tạo PDF mới từ nội dung.');
 let source:Buffer|undefined;if(spec.attachment){let name:string;try{const record=getAttachment(spec.attachment,chat);name=record.name;source=attachmentBytes(record.id,chat)}catch{const artifact=readArtifact(spec.attachment,chat);name=artifact.record.name;source=artifact.buffer}if(path.extname(name).toLowerCase()!=='.'+spec.format)throw Error('Định dạng nguồn không khớp.');}
 const buffer=source?await editDocument(spec,source):await createDocument(spec);
 const mime=spec.format==='pdf'?'application/pdf':spec.format==='docx'?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':spec.format==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'application/vnd.openxmlformats-officedocument.presentationml.presentation';return saveArtifact(chat,spec.title+'.'+spec.format,mime,buffer);
}
export function imageStatus(){return {local:localImageStatus()};}
function sourceImage(id:string,chat:string){try{const record=getAttachment(id,chat);if(record.type!=='image')throw Error('Tệp nguồn không phải ảnh.');return {name:record.name,mime:record.mime,buffer:attachmentBytes(id,chat)}}catch{const artifact=readArtifact(id,chat);if(!['image/png','image/jpeg','image/webp'].includes(artifact.record.mime))throw Error('Tệp nguồn không phải ảnh.');return {name:artifact.record.name,mime:artifact.record.mime,buffer:artifact.buffer}}}
export async function imageArtifact(chat:string,a:{kind:'generate'|'edit'|'transform';editMode?:'preserve'|'reference';provider?:string;localModel?:string;prompt?:string;attachment?:string;referenceAttachment?:string;width?:number;height?:number;rotate?:number;name?:string;transparent?:boolean;crop?:{left:number;top:number;width:number;height:number};flip?:boolean;flop?:boolean;grayscale?:boolean;blur?:number;brightness?:number;saturation?:number;format?:'png'|'jpeg'|'webp';quality?:number;text?:{content:string;fontSize?:number;color?:string;position?:'north'|'south'|'center'}},onProgress?:(text:string)=>void){
 if(a.referenceAttachment!==undefined){
  if(a.kind!=='edit'||!a.attachment)throw Error('Cần ảnh gốc cần sửa và ảnh tham chiếu riêng để đổi khuôn mặt.');
  if(a.referenceAttachment===a.attachment)throw Error('Ảnh gốc và ảnh tham chiếu khuôn mặt phải là hai ảnh khác nhau.');
  sourceImage(a.attachment,chat);sourceImage(a.referenceAttachment,chat);

 }
 let buffer:Buffer,details:Pick<Artifact,'imageModel'|'generationSeconds'|'editMode'|'imageVerified'>={};
 if(a.kind==='transform'){
  if(!a.attachment)throw Error('Cần đính kèm ảnh nguồn.');
  if(a.width!==undefined&&(!Number.isInteger(a.width)||a.width<1||a.width>4096)||a.height!==undefined&&(!Number.isInteger(a.height)||a.height<1||a.height>4096)||a.rotate!==undefined&&![0,90,180,270].includes(a.rotate))throw Error('Kích thước hoặc góc xoay không hợp lệ.');
  if(a.format!==undefined&&!['png','jpeg','webp'].includes(a.format)||a.quality!==undefined&&(!Number.isInteger(a.quality)||a.quality<1||a.quality>100)||a.blur!==undefined&&(!Number.isFinite(a.blur)||a.blur<.3||a.blur>100)||a.brightness!==undefined&&(!Number.isFinite(a.brightness)||a.brightness<0||a.brightness>10)||a.saturation!==undefined&&(!Number.isFinite(a.saturation)||a.saturation<0||a.saturation>10))throw Error('Thông số chỉnh ảnh không hợp lệ.');
  let pipeline=sharp(sourceImage(a.attachment,chat).buffer,{limitInputPixels:40e6}).autoOrient();
  if(a.crop){const c=a.crop;if(![c.left,c.top,c.width,c.height].every(Number.isInteger)||c.left<0||c.top<0||c.width<1||c.height<1)throw Error('Vùng cắt không hợp lệ.');pipeline=pipeline.extract(c);pipeline=sharp(await pipeline.toBuffer(),{limitInputPixels:40e6});}
  pipeline=pipeline.rotate(a.rotate||0);if(a.flip)pipeline=pipeline.flip();if(a.flop)pipeline=pipeline.flop();if(a.width||a.height)pipeline=pipeline.resize({width:a.width,height:a.height,fit:'inside',withoutEnlargement:true});
  if(a.grayscale)pipeline=pipeline.grayscale();if(a.blur!==undefined)pipeline=pipeline.blur(a.blur);if(a.brightness!==undefined||a.saturation!==undefined)pipeline=pipeline.modulate({...(a.brightness!==undefined?{brightness:a.brightness}:{}),...(a.saturation!==undefined?{saturation:a.saturation}:{})});if(a.text){
   const t=a.text;if(typeof t.content!=='string'||!t.content.trim()||t.content.length>500||t.fontSize!==undefined&&(!Number.isInteger(t.fontSize)||t.fontSize<8||t.fontSize>200)||t.color!==undefined&&!/^#[0-9a-f]{6}$/i.test(t.color)||t.position!==undefined&&!['north','south','center'].includes(t.position))throw Error('Thông số chữ trên ảnh không hợp lệ.');
   const base=await pipeline.png().toBuffer(),meta=await sharp(base).metadata();const w=meta.width!,h=meta.height!,size=t.fontSize||Math.max(8,Math.min(48,Math.floor(w/15)));const y=t.position==='north'?Math.min(h*.5,size*1.5):t.position==='center'?h*.5:h-Math.min(h*.3,size*.6);
   const content=t.content.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
   const overlay=Buffer.from(`<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><text x="50%" y="${y}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${size}" fill="${t.color||'#ffffff'}" stroke="#000000" stroke-width="1" paint-order="stroke">${content}</text></svg>`);
   pipeline=sharp(base).composite([{input:overlay}]);
  }buffer=await pipeline.toFormat(a.format||'png',{quality:a.quality||85}).toBuffer();
 }else{
  if(a.provider!==undefined&&a.provider!=='local')throw Error('Chỉ hỗ trợ tạo và chỉnh ảnh trên máy. Dịch vụ ảnh OpenAI đã được gỡ.');
  if(!['generate','edit'].includes(a.kind)||typeof a.prompt!=='string'||!a.prompt.trim()||a.prompt.length>20000)throw Error('Yêu cầu ảnh không hợp lệ.');
  if(a.transparent)throw Error('Model local hiện chưa hỗ trợ ảnh trong suốt.');
  if(a.editMode!==undefined&&!['preserve','reference'].includes(a.editMode))throw Error('Chế độ chỉnh ảnh không hợp lệ.');
  if(a.kind==='edit'&&!a.attachment)throw Error('Cần ảnh nguồn để chỉnh.');
  const generated=await generateLocalImage(a.prompt,a.kind==='edit'?sourceImage(a.attachment!,chat).buffer:undefined,a.localModel,chat,a.editMode||'preserve',onProgress,a.referenceAttachment?sourceImage(a.referenceAttachment,chat).buffer:undefined);buffer=generated.buffer;details={imageModel:generated.model,generationSeconds:generated.seconds,...(a.kind==='edit'?{editMode:a.editMode||'preserve'}:{})};
 }
 await verifyImageOutput(buffer);
 const format=a.kind==='transform'?(a.format||'png'):'png';return saveArtifact(chat,(a.name?path.parse(a.name).name:'hinh-anh')+'.'+format,'image/'+format,buffer,{...details,imageVerified:true});
}
