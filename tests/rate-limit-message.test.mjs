import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {localRoutes} from '../dist/api/routes/local.route.js';
import {RATE_LIMIT_MESSAGE} from '../dist/services/openai-backend.service.js';
const headers={host:'localhost:3040',origin:'http://localhost:3040'};

test('the hourly ChatGPT limit reaches the user as a Vietnamese 429',async()=>{
 assert.match(RATE_LIMIT_MESSAGE,/hết lượt nhắn trong giờ này/);
 const app=Fastify();
 app.post('/v1/chat/completions',async(req,reply)=>reply.status(429).send({error:{message:RATE_LIMIT_MESSAGE,type:'upstream_error',code:'rate_limited'}}));
 await app.register(localRoutes);
 try{
  const r=await app.inject({method:'POST',url:'/local-agent',headers,payload:{mode:'chat',chat:'rate-limit-'+Date.now(),messages:[{role:'user',content:'Xin chào'}]}});
  assert.equal(r.statusCode,429);
  assert.equal(r.json().error.message,RATE_LIMIT_MESSAGE);
 }finally{await app.close();}
});
