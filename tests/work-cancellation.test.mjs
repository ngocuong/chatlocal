import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import Fastify from 'fastify';import {localRoutes} from '../dist/api/routes/local.route.js';
const cwd=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'cancel-work-')));const app=Fastify();let currentReply,resume,started;let blocked=true;
app.addHook('onRequest',async(req,reply)=>{if(req.url==='/local-agent')currentReply=reply});
app.post('/v1/chat/completions',async()=>{if(!blocked)return {choices:[{message:{content:JSON.stringify({action:'final',content:'done'})}}]};started?.();return new Promise(resolve=>resume=resolve)});
await app.register(localRoutes,{agentTimeoutMs:500,planner:async()=>({mode:'task',task:'Read fixture',allowedTools:['read']})});const headers={host:'localhost:3040',origin:'http://localhost:3040'};
try{
 const folder=await app.inject({method:'POST',url:'/local-folder',headers,payload:{folder:cwd}});const workspace=folder.json().workspace;
 let signal;const ready=new Promise(resolve=>signal=resolve);started=signal;
 const first=app.inject({method:'POST',url:'/local-agent',headers,payload:{mode:'work',workspace,messages:[{role:'user',content:'Read fixture'}]}}).catch(()=>null);await ready;
 currentReply.raw.emit('close');await new Promise(resolve=>setTimeout(resolve,10));
 blocked=false;
 const second=await app.inject({method:'POST',url:'/local-agent',headers,payload:{mode:'work',workspace,messages:[{role:'user',content:'Read fixture'}]}});
 resume({choices:[{message:{content:JSON.stringify({action:'write',path:'late.txt',content:'must not execute'})}}]});await first;
 assert.equal(second.statusCode,200,'Disconnected work must release its lock before the model responds');
 await new Promise(resolve=>setTimeout(resolve,10));assert.ok(!fs.existsSync(path.join(cwd,'late.txt')));
 console.log('PASS: disconnected task cancels, next task starts, late model output cannot mutate files');
}finally{await app.close();fs.rmSync(cwd,{recursive:true,force:true});const file='data/local-folders.json';const folders=JSON.parse(fs.readFileSync(file));for(const [key,value] of Object.entries(folders))if(value===cwd)delete folders[key];fs.writeFileSync(file,JSON.stringify(folders));}
