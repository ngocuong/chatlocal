import assert from 'node:assert/strict';import Fastify from 'fastify';
import {localRoutes} from '../dist/api/routes/local.route.js';
const app=Fastify();let resume;
app.post('/v1/chat/completions',()=>new Promise(resolve=>{resume=resolve}));
await app.register(localRoutes,{agentTimeoutMs:40});await app.ready();
const headers={host:'localhost:3040',origin:'http://localhost:3040'};
try{
 const pending=app.inject({method:'POST',url:'/local-agent',headers,payload:{messages:[]}});
 const response=await Promise.race([pending,new Promise(resolve=>setTimeout(()=>resolve(null),250))]);
 if(!response){resume({choices:[{message:{content:'{"action":"final","content":"late"}'}}]});await pending;assert.fail('A stalled model request must time out and release the busy lock');}
 assert.equal(response.statusCode,504);
 const retry=await app.inject({method:'POST',url:'/local-connect',headers,payload:{url:'invalid'}});assert.notEqual(retry.statusCode,409,'busy lock must be released');
 resume({choices:[{message:{content:'{"action":"final","content":"late"}'}}]});
 console.log('PASS: stalled model request times out, subsequent operations are unblocked');
}finally{await app.close();}
