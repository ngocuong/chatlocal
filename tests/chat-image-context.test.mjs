import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Fastify from 'fastify';
import sharp from 'sharp';
import {saveAttachment} from '../dist/services/attachments.service.js';
import {localRoutes} from '../dist/api/routes/local.route.js';
const app=Fastify(),chat='image-context-'+Date.now();let prompt='';
app.post('/v1/chat/completions',async req=>{prompt=JSON.stringify(req.body.messages);if(prompt.includes('Plan the latest user request.'))plannerPrompt=prompt;return {choices:[{message:{content:'Ảnh đã đính kèm; chọn Công việc để chỉnh.'}}]}});
let plannerPrompt='';await app.register(localRoutes,{marketData:async()=>null,planner:async(messages,complete)=>{await complete('Plan the latest user request.');return {mode:'chat',task:'Clarify image edit',allowedTools:[]}}});
const image=await saveAttachment(chat,'no-ocr.png',await sharp({create:{width:20,height:20,channels:3,background:'#123456'}}).png().toBuffer());
try{const r=await app.inject({method:'POST',url:'/local-agent',headers:{host:'localhost:3040',origin:'http://localhost:3040'},payload:{mode:'chat',chat,attachments:[image.id],messages:[{role:'user',content:'thêm chữ Chatlocal vào ảnh này'}]}});assert.equal(r.statusCode,200);assert.match(prompt,/image asset is attached/);assert.match(prompt,new RegExp(image.id));assert.match(prompt,/not mean the attachment is missing/);const work=await app.inject({method:'POST',url:'/local-agent',headers:{host:'localhost:3040',origin:'http://localhost:3040'},payload:{mode:'work',chat,attachments:[image.id],messages:[{role:'user',content:'thêm chữ Chatlocal vào ảnh này'},{role:'assistant',content:'Chưa có ảnh, chuyển sang Work'},{role:'user',content:'tao gửi rồi đó'}]}});assert.equal(work.statusCode,200);assert.match(plannerPrompt,new RegExp(image.id));assert.match(plannerPrompt,/CURRENT ATTACHMENTS/);assert.match(prompt,/already in Công việc/);assert.doesNotMatch(prompt,/To modify it in Chat mode/);console.log('PASS: chat with OCR-empty image receives attachment ID, image type and explicit presence facts');}
finally{await app.close();fs.rmSync(path.resolve('data/chat-attachments',image.id),{recursive:true,force:true});}
