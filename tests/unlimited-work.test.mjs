import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import Fastify from 'fastify';
import {localRoutes} from '../dist/api/routes/local.route.js';
const cwd=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'unlimited-work-')));
const app=Fastify();let calls=0;
app.post('/v1/chat/completions',async()=>({choices:[{message:{content:JSON.stringify(calls++<70?{action:'write',path:'progress.txt',content:String(calls)}:{action:'final',content:'Done'})}}]}));
await app.register(localRoutes,{planner:async()=>({mode:'task',task:'write 70 steps',allowedTools:['write']})});
const headers={host:'localhost:3040',origin:'http://localhost:3040'};
try{
 const registration=await app.inject({method:'POST',url:'/local-folder',headers,payload:{folder:cwd}});
 const response=await app.inject({method:'POST',url:'/local-agent',headers,payload:{mode:'work',workspace:registration.json().workspace,messages:[{role:'user',content:'Execute all 70 writes'}]}});
 assert.equal(response.statusCode,200);assert.equal(calls,71);assert.equal(response.json().journal.length,70);assert.equal(fs.readFileSync(path.join(cwd,'progress.txt'),'utf8'),'70');
 console.log('PASS: 70 actual controller writes complete without the former 64-step cutoff');
}finally{await app.close();fs.rmSync(cwd,{recursive:true,force:true});const file='data/local-folders.json';const folders=JSON.parse(fs.readFileSync(file));for(const [id,folder] of Object.entries(folders))if(folder===cwd)delete folders[id];fs.writeFileSync(file,JSON.stringify(folders));}
