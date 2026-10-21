import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import Fastify from 'fastify';
import {localRoutes} from '../dist/api/routes/local.route.js';
const cwd=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'completion-gate-'))),app=Fastify();let calls=0,reviews=0;const workerPrompts=[];
app.post('/v1/chat/completions',async req=>{const prompt=req.body.messages[0].content;let value;
 if(prompt.includes('Independently review this coding task')){reviews++;const input=JSON.parse(prompt.slice(prompt.indexOf('\n{"specification"')+1));assert.equal(input.files['index.html'],'<p>placeholder</p>');assert.deepEqual(input.skills,['karpathy','codebase-design']);value={complete:false,issues:['The page has no requested algorithm'],requirements:[{requirement:'Real algorithm',satisfied:false,evidenceIds:[]}]};}
 else{workerPrompts.push(prompt);value=calls++===0?{action:'write',path:'index.html',content:'<p>placeholder</p>'}:{action:'final',content:'Đã hoàn thành đầy đủ thuật toán'};}
 return {choices:[{message:{content:JSON.stringify(value)}}]};});
await app.register(localRoutes,{planner:async()=>({mode:'task',task:'implement algorithm',allowedTools:['write'],skillIds:['karpathy','codebase-design'],verificationRequired:true})});const headers={host:'localhost:3040',origin:'http://localhost:3040'};
try{const registration=await app.inject({method:'POST',url:'/local-folder',headers,payload:{folder:cwd}});const {workspace}=registration.json();
 const response=await app.inject({method:'POST',url:'/local-agent',headers,payload:{mode:'work',workspace,messages:[{role:'user',content:'Implement the full algorithm using Matt Pocock and Karpathy'}]}});
 assert.equal(response.statusCode,200);assert.equal(reviews,3);assert.match(response.json().choices[0].message.content,/Chưa hoàn thành/);assert.doesNotMatch(response.json().choices[0].message.content,/Đã hoàn thành đầy đủ/);assert.match(workerPrompts[0],/SKILL karpathy/);assert.match(workerPrompts[0],/SKILL codebase-design/);assert.match(workerPrompts[2],/Completion review rejected/);
 console.log('PASS: real route loads both skills, rejected scaffold triggers repair, repeated false completion is replaced with an honest incomplete result');
}finally{await app.close();fs.rmSync(cwd,{recursive:true,force:true});const file='data/local-folders.json',folders=JSON.parse(fs.readFileSync(file));for(const [id,folder] of Object.entries(folders))if(folder===cwd)delete folders[id];fs.writeFileSync(file,JSON.stringify(folders));}
