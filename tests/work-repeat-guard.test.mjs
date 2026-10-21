import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import Fastify from 'fastify';
import {localRoutes} from '../dist/api/routes/local.route.js';
const headers={host:'localhost:3040',origin:'http://localhost:3040'};
test('controller skips identical writes, refuses stale overwrite, and reuses successful commands',async()=>{
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'repeat-guard-'))),repo=path.join(root,'repo');fs.mkdirSync(repo);const file=path.join(repo,'a.txt');fs.writeFileSync(file,'initial');const originalTime=fs.statSync(file).mtimeMs;
 const command=`node -e "require('fs').appendFileSync('count.txt','x')"`;
 const actions=[{action:'read',path:'a.txt'},{action:'write',path:'a.txt',content:'initial'},{action:'write',path:'a.txt',content:'overwrite'},{action:'read',path:'a.txt'},{action:'terminal',command},{action:'terminal',command},{action:'final',content:'done'}];let n=0;const prompts=[];
 const app=Fastify();app.post('/v1/chat/completions',async req=>{prompts.push(req.body.messages[0].content);if(n===2){assert.equal(fs.statSync(file).mtimeMs,originalTime);fs.writeFileSync(file,'external edit');}return {choices:[{message:{content:JSON.stringify(actions[n++])}}]};});
 await app.register(localRoutes,{memoryRoot:path.join(root,'memory'),planner:async()=>({mode:'task',task:'edit and test',allowedTools:['read','write','terminal']})});let workspace;
 try{
  workspace=(await app.inject({method:'POST',url:'/local-folder',headers,payload:{folder:repo}})).json().workspace;
  const response=await app.inject({method:'POST',url:'/local-agent',headers,payload:{mode:'work',toolsEnabled:true,chat:'repeat',workspace,messages:[{role:'user',content:'Edit and test'}]}});
  assert.equal(response.statusCode,200);assert.equal(fs.readFileSync(file,'utf8'),'external edit');assert.equal(fs.readFileSync(path.join(repo,'count.txt'),'utf8'),'x');assert.ok(prompts.some(p=>p.includes('Skipped identical write')));assert.ok(prompts.some(p=>p.includes('File đã đổi từ lần đọc trước')));assert.ok(prompts.some(p=>p.includes('Already succeeded')));
 }finally{await app.close();fs.rmSync(root,{recursive:true,force:true});const f='data/local-folders.json',folders=JSON.parse(fs.readFileSync(f));delete folders[workspace];fs.writeFileSync(f,JSON.stringify(folders));}
});
