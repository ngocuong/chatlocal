import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import Fastify from 'fastify';
import {localRoutes} from '../dist/api/routes/local.route.js';
const headers={host:'localhost:3040',origin:'http://localhost:3040'};
const code=n=>'// Ứng dụng quản lý kho hàng\nfunction tinhTon(kho){return kho.reduce((a,b)=>a+b.soLuong,0)}\n'.repeat(Math.ceil(n/90)).slice(0,n);

test('multi-step app building keeps every step and the review under the prompt cap',async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'large-app-'));
 const actions=[
  {action:'write',path:'app.js',content:code(150000)},
  {action:'read',path:'app.js',offset:0,length:16000},
  {action:'write',path:'styles.css',content:'body{color:#123}\n'.repeat(5000)},
  {action:'terminal',command:'node -e "for(let i=0;i<3000;i++)console.log(\'log kiểm thử dòng \'+i)"'},
  {action:'read',path:'app.js',offset:16000,length:16000},
  {action:'final',content:'Đã viết ứng dụng.'}
 ];
 const app=Fastify();let largest=0,steps=0;
 app.post('/v1/chat/completions',async req=>{
  const body=JSON.stringify(req.body.messages);largest=Math.max(largest,Buffer.byteLength(body));
  if(body.includes('intent and permission planner'))return {choices:[{message:{content:JSON.stringify({mode:'task',task:'Build inventory app',allowedTools:['read','write','terminal'],verificationRequired:true,sourceMessageIndices:[0]})}}]};
  if(body.includes('Independently review this coding task'))return {choices:[{message:{content:JSON.stringify({complete:false,issues:['stub review'],requirements:[{requirement:'x',satisfied:false,evidenceIds:[]}]})}}]};
  steps++;return {choices:[{message:{content:JSON.stringify(actions.length>1?actions.shift():actions[0])}}]};
 });
 await app.register(localRoutes,{memoryRoot:path.join(folder,'.memory')});
 try{
  const connected=await app.inject({method:'POST',url:'/local-folder',headers,payload:{folder}});const workspace=connected.json().workspace;
  await app.inject({method:'POST',url:'/local-tools',headers,payload:{workspace,enabled:true}});
  const r=await app.inject({method:'POST',url:'/local-agent',headers,payload:{mode:'work',chat:'large-app-'+Date.now(),workspace,messages:[{role:'user',content:'Viết ứng dụng quản lý kho hàng hoàn chỉnh. '.repeat(500)}]}});
  assert.equal(r.statusCode,200,r.body.slice(0,300));
  assert.ok(steps>=6,'steps '+steps);
  assert.ok(largest<=90000,'largest prompt '+largest+' bytes');console.log('PASS: '+steps+' model calls, largest prompt '+largest+' bytes');
 }finally{
  await app.close();fs.rmSync(folder,{recursive:true,force:true});
  const file='data/local-folders.json';if(fs.existsSync(file)){const folders=JSON.parse(fs.readFileSync(file));for(const [k,v] of Object.entries(folders))if(v===folder||path.basename(v)===path.basename(folder))delete folders[k];fs.writeFileSync(file,JSON.stringify(folders));}
 }
});

test('completion review shortens long logs to stay under the prompt cap',async()=>{
 const {reviewCompletion}=await import('../dist/services/completion-review.service.js');
 const log='npm test output dòng log kiểm thử ứng dụng '.repeat(200);let size=0,body='';
 await reviewCompletion({specification:'Viết ứng dụng quản lý kho. '.repeat(400),files:{'a.js':'x'.repeat(20000),'b.js':'y'.repeat(20000)},evidence:Array.from({length:25},(_,i)=>({id:i,tool:'terminal',output:{exit:0,running:false,log}})),skills:[],proposedAnswer:'Xong'},async prompt=>{size=Buffer.byteLength(JSON.stringify([{role:'user',content:prompt}]));body=prompt;return '{}'});
 assert.ok(size<=90000,'review prompt '+size+' bytes');
 assert.equal((body.match(/"tool":"terminal"/g)||[]).length,20,'keeps the 20 newest results, only shorter');
});
