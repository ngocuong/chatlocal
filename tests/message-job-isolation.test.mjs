import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import Fastify from 'fastify';
import {localRoutes} from '../dist/api/routes/local.route.js';
const headers={host:'localhost:3040',origin:'http://localhost:3040'};
test('terminal commands retain their originating message and per-message stop cannot target another turn',async()=>{
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'turn-jobs-'))),repo=path.join(root,'repo');fs.mkdirSync(repo);let workspace,n=0;
 const app=Fastify();app.post('/v1/chat/completions',async()=>({choices:[{message:{content:JSON.stringify(n++%2===0?{action:'terminal',command:n===1?'printf FIRST':'printf SECOND'}:{action:'final',content:'done'})}}]}));
 await app.register(localRoutes,{memoryRoot:path.join(root,'memory'),planner:async()=>({mode:'task',task:'run terminal',allowedTools:['terminal']})});
 try{
  workspace=(await app.inject({method:'POST',url:'/local-folder',headers,payload:{folder:repo}})).json().workspace;
  for(const turnId of ['turn-1','turn-2'])assert.equal((await app.inject({method:'POST',url:'/local-agent',headers,payload:{mode:'work',chat:'same-chat',turnId,workspace,toolsEnabled:true,messages:[{role:'user',content:'Run terminal'}]}})).statusCode,200);
  const get=async turnId=>(await app.inject({url:'/local-jobs?'+new URLSearchParams({workspace,chat:'same-chat',turnId}),headers})).json().jobs;
  const first=await get('turn-1'),second=await get('turn-2');assert.equal(first.length,1);assert.equal(second.length,1);assert.equal(first[0].output,'FIRST');assert.equal(second[0].output,'SECOND');assert.notEqual(first[0].id,second[0].id);
  assert.notEqual((await app.inject({method:'POST',url:'/local-job-stop',headers,payload:{workspace,chat:'same-chat',turnId:'turn-2',id:first[0].id}})).statusCode,200);
 }finally{await app.close();fs.rmSync(root,{recursive:true,force:true});const f='data/local-folders.json',folders=JSON.parse(fs.readFileSync(f));delete folders[workspace];fs.writeFileSync(f,JSON.stringify(folders));}
});
