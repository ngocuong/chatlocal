import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import Fastify from 'fastify';
import {localRoutes} from '../dist/api/routes/local.route.js';
const headers={host:'localhost:3040',origin:'http://localhost:3040'};

test('re-reading the same unchanged range is refused on the third attempt',async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'read-loop-'));fs.writeFileSync(path.join(folder,'index.html'),'<h1>Tử vi</h1>'.repeat(100));
 const app=Fastify();let reads=0,refusedAfter=null;
 app.post('/v1/chat/completions',async req=>{
  const body=JSON.stringify(req.body.messages);
  if(body.includes('intent and permission planner'))return {choices:[{message:{content:JSON.stringify({mode:'task',task:'Fix page',allowedTools:['read','write'],sourceMessageIndices:[0]})}}]};
  if(body.includes('Refused: you have already read index.html')){refusedAfter??=reads;return {choices:[{message:{content:JSON.stringify({action:'final',content:'Dừng đọc lại.'})}}]};}
  reads++;if(reads>6)return {choices:[{message:{content:JSON.stringify({action:'final',content:'quá nhiều'})}}]};
  return {choices:[{message:{content:JSON.stringify({action:'read',path:'index.html',offset:0,length:500})}}]};
 });
 await app.register(localRoutes,{memoryRoot:path.join(folder,'.memory')});
 try{
  const connected=await app.inject({method:'POST',url:'/local-folder',headers,payload:{folder}});const workspace=connected.json().workspace;
  const r=await app.inject({method:'POST',url:'/local-agent',headers,payload:{mode:'work',chat:'read-loop-'+Date.now(),workspace,messages:[{role:'user',content:'Sửa trang tử vi'}]}});
  assert.equal(r.statusCode,200,r.body.slice(0,200));
  assert.equal(refusedAfter,3,'two real reads, the third is refused');
  assert.ok(r.json().journal.some(j=>j.startsWith('Đọc index.html (ký tự 0–500)')));
  assert.ok(r.json().journal.includes('Bỏ qua lần đọc lặp index.html'));
 }finally{
  await app.close();fs.rmSync(folder,{recursive:true,force:true});
  const file='data/local-folders.json';if(fs.existsSync(file)){const folders=JSON.parse(fs.readFileSync(file));for(const [k,v] of Object.entries(folders))if(v===folder||path.basename(v)===path.basename(folder))delete folders[k];fs.writeFileSync(file,JSON.stringify(folders));}
 }
});

test('reading an unchanged file with shifting offsets is refused after about two full passes',async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'read-loop-'));fs.writeFileSync(path.join(folder,'index.html'),'x'.repeat(20000));
 const app=Fastify();let reads=0,charsRead=0,refused=false;
 app.post('/v1/chat/completions',async req=>{
  const body=JSON.stringify(req.body.messages);
  if(body.includes('intent and permission planner'))return {choices:[{message:{content:JSON.stringify({mode:'task',task:'Fix page',allowedTools:['read','write'],sourceMessageIndices:[0]})}}]};
  if(body.includes('Stop reading it.')){refused=true;return {choices:[{message:{content:JSON.stringify({action:'final',content:'Dừng.'})}}]};}
  if(reads++>20)return {choices:[{message:{content:JSON.stringify({action:'final',content:'quá nhiều'})}}]};
  const offset=(reads*3001)%18000;charsRead+=Math.min(6000,20000-offset);
  return {choices:[{message:{content:JSON.stringify({action:'read',path:'index.html',offset,length:6000})}}]};
 });
 await app.register(localRoutes,{memoryRoot:path.join(folder,'.memory')});
 try{
  const connected=await app.inject({method:'POST',url:'/local-folder',headers,payload:{folder}});const workspace=connected.json().workspace;
  const r=await app.inject({method:'POST',url:'/local-agent',headers,payload:{mode:'work',chat:'read-volume-'+Date.now(),workspace,messages:[{role:'user',content:'Sửa trang'}]}});
  assert.equal(r.statusCode,200,r.body.slice(0,200));
  assert.ok(refused,'shifting reads must eventually be refused');
  assert.ok(reads<=9,'refused within about two passes, reads='+reads);
 }finally{
  await app.close();fs.rmSync(folder,{recursive:true,force:true});
  const file='data/local-folders.json';if(fs.existsSync(file)){const folders=JSON.parse(fs.readFileSync(file));for(const [k,v] of Object.entries(folders))if(v===folder||path.basename(v)===path.basename(folder))delete folders[k];fs.writeFileSync(file,JSON.stringify(folders));}
 }
});
