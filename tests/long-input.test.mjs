import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {boundedHistory} from '../dist/services/prompt-budget.service.js';
import {localRoutes} from '../dist/api/routes/local.route.js';
const headers={host:'localhost:3040',origin:'http://localhost:3040'};
const filler=n=>'Phân tích chiến lược thị trường y tế số Việt Nam. '.repeat(Math.ceil(n/50)).slice(0,n);

test('planner history clips only the long latest message instead of failing',()=>{
 const long=filler(30000)+'CUỐI';
 assert.throws(()=>boundedHistory([{role:'user',content:long}]),/quá dài/);
 const clipped=boundedHistory([{role:'user',content:long}],12000,true);
 assert.ok(JSON.stringify(clipped).length<=12000);
 assert.match(clipped[0].content,/lược \d+ ký tự ở giữa/);
 assert.ok(clipped[0].content.endsWith('CUỐI'));
});

test('long work requests stay under the prompt cap and can be paged from the server',async()=>{
 const text=filler(60000)+'MỐC_GIỮA_BÀI'+filler(60000);
 const app=Fastify();let offset=0,found=false,steps=0,largest=0;
 app.post('/v1/chat/completions',async req=>{
  const body=JSON.stringify(req.body.messages);largest=Math.max(largest,Buffer.byteLength(body));
  if(body.includes('intent and permission planner'))return {choices:[{message:{content:JSON.stringify({mode:'task',task:'Write report',allowedTools:['document'],sourceMessageIndices:[0]})}}]};
  if(body.includes('Source text')&&body.includes('MỐC_GIỮA_BÀI'))found=true;
  if(found||steps++>10)return {choices:[{message:{content:JSON.stringify({action:'final',content:'ok'})}}]};
  offset=offset?offset+16000:8000;
  return {choices:[{message:{content:JSON.stringify({action:'source',name:'request',offset,length:16000})}}]};
 });
 await app.register(localRoutes,{memoryRoot:'/private/tmp/long-input-test-memory'});
 try{
  const r=await app.inject({method:'POST',url:'/local-agent',headers,payload:{mode:'work',chat:'long-input-'+Date.now(),messages:[{role:'user',content:text}]}});
  assert.equal(r.statusCode,200,r.body);
  assert.ok(found,'the middle of the request must be readable through the source action');
  assert.ok(largest<=90000,'prompt bytes '+largest);
 }finally{await app.close();}
});
