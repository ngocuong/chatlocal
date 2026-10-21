import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import Fastify from 'fastify';
import {localRoutes} from '../dist/api/routes/local.route.js';
const headers={host:'localhost:3040',origin:'http://localhost:3040'};
test('route checkpoints persist after model failure and are supplied to the resumed worker, not a new goal',async()=>{
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'memory-route-'))),memoryRoot=path.join(root,'memory'),repo=path.join(root,'repo');fs.mkdirSync(repo);
 let workspace;
 const make=async(resume=false)=>{
  const app=Fastify();let n=0;
  app.post('/v1/chat/completions',async(req,reply)=>{
   const prompt=req.body.messages[0].content;
   if(resume){assert.match(prompt,/Wire the existing browser engine/);assert.match(prompt,/CURRENT TASK STATE/);assert.match(prompt,/Exact original feature/);return {choices:[{message:{content:'{"action":"final","content":"Still needs work"}'}}]};}
   if(n++===0)return {choices:[{message:{content:JSON.stringify({action:'write',path:'index.html',content:'saved'})}}]};
   if(n===2)return {choices:[{message:{content:JSON.stringify({action:'checkpoint',nextStep:'Wire the existing browser engine',remaining:['UI test'],notes:'Do not redo setup'})}}]};
   return reply.code(502).send({error:{message:'simulated model disconnect'}});
  });
  await app.register(localRoutes,{memoryRoot,planner:async(messages,complete,saved)=>{if(resume)assert.match(saved,/Wire the existing browser engine/);return {mode:'task',task:resume?'resume':'Exact original feature',allowedTools:['write'],resumeTask:resume};}});return app;
 };
 try{
  const app=await make();workspace=(await app.inject({method:'POST',url:'/local-folder',headers,payload:{folder:repo}})).json().workspace;
  const response=await app.inject({method:'POST',url:'/local-agent',headers,payload:{mode:'work',chat:'memory-test',workspace,messages:[{role:'user',content:'Exact original feature'}]}});assert.equal(response.statusCode,502);await app.close();
  const app2=await make(true);
  const state=(await app2.inject({url:'/local-work-memory?chat=memory-test&workspace='+workspace,headers})).json().state;assert.equal(state.status,'interrupted');assert.equal(state.files[0].current,true);
  assert.equal((await app2.inject({url:'/local-work-memory?chat=other&workspace='+workspace,headers})).json().state,null);
  const resumed=await app2.inject({method:'POST',url:'/local-agent',headers,payload:{mode:'work',chat:'memory-test',workspace,messages:[{role:'user',content:'Continue this work'}]}});assert.equal(resumed.statusCode,200);await app2.close();
 }finally{fs.rmSync(root,{recursive:true,force:true});const file='data/local-folders.json',folders=JSON.parse(fs.readFileSync(file));delete folders[workspace];fs.writeFileSync(file,JSON.stringify(folders));}
});
