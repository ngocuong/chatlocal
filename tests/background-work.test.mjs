import assert from 'node:assert/strict';import Fastify from 'fastify';import {localRoutes} from '../dist/api/routes/local.route.js';
const app=Fastify();let resume,started;const ready=new Promise(r=>started=r);let calls=0;
app.post('/v1/chat/completions',async()=>{calls++;started();return new Promise(resolve=>resume=resolve)});
await app.register(localRoutes,{planner:async()=>({mode:'task',task:'Open demo',allowedTools:['preview']})});const headers={host:'localhost:3040',origin:'http://localhost:3040'},payload={mode:'work',chat:'background-chat-A',messages:[{role:'user',content:'Mở demo trước rồi tiếp tục'}]};
try{
 const begin=await app.inject({method:'POST',url:'/local-task-start',headers,payload});assert.equal(begin.statusCode,202);const {id}=begin.json();await ready;
 const running=await app.inject({url:'/local-task-status?id='+id+'&chat='+payload.chat,headers});assert.equal(running.json().state,'running');
 const duplicate=await app.inject({method:'POST',url:'/local-task-start',headers,payload});assert.equal(duplicate.statusCode,409);assert.equal(calls,1);
 const foreign=await app.inject({url:'/local-task-status?id='+id+'&chat=background-chat-B',headers});assert.equal(foreign.statusCode,404);
 resume({choices:[{message:{content:'{"action":"final","content":"Demo ready"}'}}]});
 let done;for(let i=0;i<50;i++){done=(await app.inject({url:'/local-task-status?id='+id+'&chat='+payload.chat,headers})).json();if(done.state!=='running')break;await new Promise(r=>setTimeout(r,10));}
 assert.equal(done.state,'done');assert.equal(done.result.choices[0].message.content,'Demo ready');assert.equal(calls,1);
 console.log('PASS: work starts asynchronously, polling is chat-scoped, repeated submit cannot duplicate work, finished result is recoverable');
}finally{await app.close()}
