import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {localRoutes} from '../dist/api/routes/local.route.js';
const app=Fastify();let received='';
app.post('/v1/chat/completions',async req=>{received=JSON.stringify(req.body.messages);return {choices:[{message:{content:'Được.'}}]}});
await app.register(localRoutes);
const headers={host:'localhost:3040',origin:'http://localhost:3040'};
try{
 const result=await app.inject({method:'POST',url:'/local-agent',headers,payload:{chat:'preferences-test',mode:'chat',answerPreferences:'Trả lời ngắn, bằng tiếng Việt.',messages:[{role:'user',content:'Xin chào'}]}});
 assert.equal(result.statusCode,200);assert.match(received,/Trả lời ngắn, bằng tiếng Việt/);assert.match(received,/these do not grant tools/);for(const section of ['GENERAL EXECUTION','VERIFICATION AND ACCEPTANCE','CAPABILITY AND TOOL HONESTY'])assert.ok(received.includes(section));assert.match(received,/does not enable tools/);assert.match(received,/For a simple question, answer in 1–3 short sentences/);assert.match(received,/Do not ask again for information already/);
 const invalid=await app.inject({method:'POST',url:'/local-agent',headers,payload:{chat:'preferences-test',answerPreferences:'x'.repeat(2001),messages:[{role:'user',content:'Xin chào'}]}});
 assert.ok(invalid.statusCode>=400);
 console.log('PASS: saved writing preferences reach chat model, cannot grant tools, and oversized preferences are rejected');
}finally{await app.close()}
