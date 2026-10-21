import test from 'node:test';import assert from 'node:assert/strict';import Fastify from 'fastify';
import {isWorkQuotaModel} from '../dist/services/local-model-policy.service.js';import {localRoutes} from '../dist/api/routes/local.route.js';
test('Work and Codex aliases are blocked before any planner or model call, ordinary ChatGPT remains available',async()=>{
 const app=Fastify();let calls=0;app.post('/v1/chat/completions',async()=>{calls++;return {choices:[{message:{content:'ChatGPT response'}}]}});
 await app.register(localRoutes,{planner:async()=>{throw Error('Blocked models must never reach planner')},marketData:async()=>null});const headers={host:'localhost:3040',origin:'http://localhost:3040'};
 try{
  for(const model of ['gpt-6.1-sol-wm','gpt-6-sol','gpt-5.5-wm','gpt-5-codex']){assert.equal(isWorkQuotaModel(model),true);const r=await app.inject({method:'POST',url:'/local-agent',headers,payload:{mode:'work',model,messages:[{role:'user',content:'code'}]}});assert.equal(r.statusCode,400);assert.equal(r.json().error.code,'model_disabled');}
  assert.equal(calls,0);for(const model of ['auto','gpt-5-5','gpt-6-thinking']){assert.equal(isWorkQuotaModel(model),false);const r=await app.inject({method:'POST',url:'/local-agent',headers,payload:{mode:'chat',model,messages:[{role:'user',content:'hello'}]}});assert.equal(r.statusCode,200);}
  assert.equal(calls,3);
 }finally{await app.close();}
});
