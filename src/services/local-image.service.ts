import {imageStepProgress} from './image-progress.service.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn,type ChildProcess} from 'node:child_process';
export type LocalImageModel='z-image-turbo-q8'|'flux2-klein-4b-q8';
const settingsFile=path.resolve('data/local-image-settings.json');
let running=false;
let active:{chat:string;child?:ChildProcess;cancelled:boolean;done:Promise<void>}|undefined;
export async function cancelLocalImage(chat?:string){const job=active;if(!job||chat!==undefined&&job.chat!==chat)return false;job.cancelled=true;job.child?.kill('SIGTERM');const force=setTimeout(()=>job.child?.kill('SIGKILL'),2000);try{await job.done;}finally{clearTimeout(force)}return true;}
export function resolveLocalImageModel(model?:string):LocalImageModel{
 if(model===undefined){try{model=JSON.parse(fs.readFileSync(settingsFile,'utf8')).model}catch{model='flux2-klein-4b-q8'}}
 if(model!=='z-image-turbo-q8'&&model!=='flux2-klein-4b-q8')throw Error('Model ảnh local không hợp lệ.');return model;
}
function zPath(){try{return String(JSON.parse(fs.readFileSync(path.resolve('data/q8-model.json'),'utf8')).modelPath||'')}catch{return ''}}
function fluxPath(){try{return String(JSON.parse(fs.readFileSync(path.resolve('data/flux2-model.json'),'utf8')).modelPath||'')}catch{return ''}}
function profiles(){return [
 {id:'flux2-klein-4b-q8' as const,label:'FLUX.2 Klein 4B Q8',size:1024,ready:!!fluxPath()&&['transformer','text_encoder','vae'].every(part=>fs.existsSync(path.join(fluxPath(),part,'model.safetensors.index.json')))&&fs.existsSync(path.resolve('data/flux2-ready.json'))},
 {id:'z-image-turbo-q8' as const,label:'Z-Image-Turbo Q8',size:1024,ready:!!zPath()&&['transformer','text_encoder','vae'].every(part=>fs.existsSync(path.join(zPath(),part,'model.safetensors.index.json')))&&fs.existsSync(path.resolve('data/q8-ready.json'))},
 ];}
export function localImageStatus(){const id=resolveLocalImageModel(),models=profiles(),selected=models.find(m=>m.id===id)!;return {ready:selected.ready,id,model:selected.label,free:true,models,error:selected.ready?'':selected.label+' chưa vượt kiểm tra chạy trên máy.'};}
export function saveLocalImageModel(model:string){if(typeof model!=='string')throw Error('Cần chọn model ảnh local.');const id=resolveLocalImageModel(model);if(!profiles().find(m=>m.id===id)!.ready)throw Error('Model chưa sẵn sàng. Kiểm tra cài đặt hoặc kết nối ổ chứa model.');fs.mkdirSync(path.dirname(settingsFile),{recursive:true});fs.writeFileSync(settingsFile,JSON.stringify({model:id}),{mode:0o600});return localImageStatus();}
export async function generateLocalImage(prompt:string,source?:Buffer,selected?:string,chat='',editMode:'preserve'|'reference'='preserve',onProgress?:(text:string)=>void,reference?:Buffer){
 const id=resolveLocalImageModel(selected),profile=profiles().find(m=>m.id===id)!;
 if(!profile.ready)throw Error(profile.label+' chưa sẵn sàng trên máy. Hãy kiểm tra cài đặt và ổ chứa model trong Model ảnh. Không cần OpenAI API key.');
 if(reference&&id==='z-image-turbo-q8')throw Error('Turbo Q8 chỉ nhận một ảnh nguồn; dùng Flux để chỉnh với ảnh gốc và ảnh tham chiếu riêng.');
 if(running)throw Error('Bộ tạo ảnh local đang xử lý một ảnh. Hãy chờ ảnh hiện tại hoàn tất.');
 let finish!:()=>void;const job={chat,cancelled:false,child:undefined as ChildProcess|undefined,done:new Promise<void>(resolve=>{finish=resolve})};active=job;running=true;const folder=fs.mkdtempSync(path.join(os.tmpdir(),'chatlocal-image-')),started=Date.now();
 try{
  const output=path.join(folder,'result.png'),input=source?path.join(folder,'source.png'):undefined;if(source)fs.writeFileSync(input!,source,{mode:0o600});
  const referencePath=reference?path.join(folder,'reference.png'):undefined;if(reference)fs.writeFileSync(referencePath!,reference,{mode:0o600});
  const runtime='mflux-runtime',script=id==='flux2-klein-4b-q8'?'local-image-flux2.py':'local-image-z.py';
  onProgress?.('Đang nạp model và chuẩn bị ảnh…');
  await new Promise<void>((resolve,reject)=>{
   const child=spawn(path.resolve('data',runtime,'bin/python'),[path.resolve('scripts',script)],{stdio:['pipe','pipe','pipe'],env:{...process.env,HF_HUB_OFFLINE:'1',HF_HUB_DISABLE_TELEMETRY:'1',MPLCONFIGDIR:path.resolve('data/matplotlib-cache')}});let diagnostic='',timedOut=false;job.child=child;if(job.cancelled)child.kill('SIGTERM');
   const timer=setTimeout(()=>{timedOut=true;child.kill('SIGTERM');},15*60*1000);
   child.stdout.on('data',()=>{});child.stderr.on('data',chunk=>{diagnostic=(diagnostic+chunk).slice(-3000);const status=imageStepProgress(diagnostic);if(status)onProgress?.(status)});
   child.on('error',()=>{clearTimeout(timer);reject(Error('Không chạy được bộ tạo ảnh local.'));});
   child.on('close',code=>{clearTimeout(timer);code===0?resolve():reject(Error(job.cancelled?'Đã hủy tác vụ tạo ảnh.':timedOut?'Tạo ảnh local quá thời gian chờ; chưa có ảnh hoàn tất.':'Bộ tạo ảnh local gặp lỗi: '+diagnostic.slice(-600)));});
   child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({prompt,output,source:input,reference:referencePath,sourceInfluence:editMode==='reference'?0.3:0.75,modelPath:id==='flux2-klein-4b-q8'?fluxPath():zPath()}));
  });
  return {buffer:fs.readFileSync(output),model:profile.label,seconds:Math.round((Date.now()-started)/1000)};
 }finally{running=false;active=undefined;fs.rmSync(folder,{recursive:true,force:true});finish();}
}
