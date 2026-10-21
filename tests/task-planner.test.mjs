import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import Fastify from 'fastify';
import {decodePlan,planTask,taskSpecification} from '../dist/services/task-planner.service.js';import {localRoutes} from '../dist/api/routes/local.route.js';
assert.throws(()=>decodePlan('{"mode":"chat","task":"praise","allowedTools":["write"]}'));
assert.throws(()=>decodePlan('{"mode":"task","task":"task","allowedTools":["unknown"]}'));
let count=0;await assert.rejects(()=>planTask([{role:'user',content:'giỏi'}],async()=>{count++;return 'invalid'}));assert.equal(count,3);
let prompt;const plan=await planTask([{role:'user',content:'viết prompt xây webapp'},{role:'assistant',content:'Here is the prompt'},{role:'user',content:'triển khai nó đi'}],async text=>{prompt=text;return JSON.stringify({mode:'task',task:'Implement the referenced webapp',allowedTools:['read','write']})});assert.equal(plan.mode,'task');assert.match(prompt,/triển khai nó đi/);assert.match(prompt,/viết prompt xây webapp/);
const cwd=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'semantic-task-')));fs.writeFileSync(path.join(cwd,'index.html'),'original');
const app=Fastify();let chosen={mode:'task',task:'Read the existing page only',allowedTools:['read']},actions=[];
app.post('/v1/chat/completions',async()=>({choices:[{message:{content:actions.shift()}}]}));await app.register(localRoutes,{planner:async()=>chosen,marketData:async()=>null});const headers={host:'localhost:3040',origin:'http://localhost:3040'};
try{
 let r=await app.inject({method:'POST',url:'/local-folder',headers,payload:{folder:cwd}});const {workspace}=r.json();
 actions=[JSON.stringify({action:'write',path:'index.html',content:'unauthorized'}),JSON.stringify({action:'read',path:'index.html'}),JSON.stringify({action:'final',content:'original'})];
 r=await app.inject({method:'POST',url:'/local-agent',headers,payload:{mode:'work',workspace,messages:[{role:'user',content:'Nó đang ghi gì vậy?'}]}});assert.equal(r.statusCode,200);assert.equal(fs.readFileSync(path.join(cwd,'index.html'),'utf8'),'original');assert.deepEqual(r.json().journal,['Đọc index.html (ký tự 0–8)']);
 chosen={mode:'chat',task:'Acknowledge praise',allowedTools:[]};actions=['Cảm ơn bạn.'];
 r=await app.inject({method:'POST',url:'/local-agent',headers,payload:{mode:'work',workspace:'missing--workspace',messages:[{role:'user',content:'giỏi'}]}});assert.equal(r.statusCode,200);assert.deepEqual(r.json().journal,[]);
 console.log('PASS: contextual planner schema, invalid planning fails closed, executor blocks unauthorized writes, praise in Work remains conversational');
}finally{await app.close();fs.rmSync(cwd,{recursive:true,force:true});const file='data/local-folders.json';const folders=JSON.parse(fs.readFileSync(file));for(const [key,value] of Object.entries(folders))if(value===cwd)delete folders[key];fs.writeFileSync(file,JSON.stringify(folders));}

const original='PROMPT: giữ nguyên yêu cầu tứ hóa khâm thiên, phi tinh lương phái và manh phái; không thay bằng form giả.';
const messages=[{role:'assistant',content:original},{role:'user',content:'Triển khai đúng prompt đó'}];
const specification=JSON.parse(taskSpecification({mode:'task',task:'generic app summary',allowedTools:['write'],sourceMessageIndices:[0]},messages));
assert.equal(specification[0].verbatim,original);assert.equal(specification[1].verbatim,messages[1].content);
assert.throws(()=>taskSpecification({mode:'task',task:'task',allowedTools:['write'],sourceMessageIndices:[99]},messages));
console.log('PASS: original referenced prompt is preserved verbatim, never replaced by the planner summary');

assert.equal(decodePlan('Kế hoạch: ```json\n{"mode":"task","task":"Open preview","allowedTools":["preview"],"skillIds":[]}\n```').allowedTools[0],'preview');
assert.deepEqual(decodePlan('{"mode":"task","task":"Implement","allowedTools":["write"],"skillIds":["mattpocock-skills:codebase-design","karpathy-guidelines"]}').skillIds,['codebase-design','karpathy']);
