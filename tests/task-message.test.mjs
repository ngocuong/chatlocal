import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {localRoutes} from '../dist/api/routes/local.route.js';
const headers={host:'localhost:3040',origin:'http://localhost:3040'};

test('messages sent during a running Công việc turn reach the next model step',async()=>{
 const app=Fastify(),chat='task-message-'+Date.now();let step=0,sawMessage=false,delivery;
 app.post('/v1/chat/completions',async req=>{
  const body=JSON.stringify(req.body.messages);
  if(body.includes('intent and permission planner'))return {choices:[{message:{content:JSON.stringify({mode:'task',task:'Build app',allowedTools:['document'],sourceMessageIndices:[0]})}}]};
  step++;
  if(step===1){
   // The human writes while the first step is still in flight.
   delivery=await app.inject({method:'POST',url:'/local-task-message',headers,payload:{chat,text:'Chọn Nam Phái và Khâm Thiên'}});
   return {choices:[{message:{content:JSON.stringify({action:'terminal',command:'ls'})}}]};
  }
  if(body.includes('Chọn Nam Phái và Khâm Thiên'))sawMessage=true;
  return {choices:[{message:{content:JSON.stringify({action:'final',content:'Xong'})}}]};
 });
 await app.register(localRoutes,{memoryRoot:'/private/tmp/task-message-test-memory'});
 try{
  const r=await app.inject({method:'POST',url:'/local-agent',headers,payload:{mode:'work',chat,messages:[{role:'user',content:'Viết webapp tử vi'}]}});
  assert.equal(r.statusCode,200,r.body.slice(0,200));
  assert.equal(delivery.statusCode,200,delivery.body);
  assert.ok(sawMessage,'the next step must include the new message');
  assert.ok(r.json().journal.includes('Nhận tin nhắn mới trong lúc làm'));
  const late=await app.inject({method:'POST',url:'/local-task-message',headers,payload:{chat,text:'muộn'}});
  assert.equal(late.statusCode,409,'no inbox once the turn has finished');
 }finally{await app.close();}
});

test('the composer stays usable during a Công việc turn and forwards messages',async()=>{
 const fs=await import('node:fs'),vm=await import('node:vm');
 const html=fs.readFileSync('web/index.html','utf8');
 const slice=name=>{const asyncAt=html.indexOf('async function '+name+'('),start=asyncAt>=0?asyncAt:html.indexOf('function '+name+'(');return html.slice(start,html.indexOf('\n',start))};
 const stop={hidden:true},note={textContent:''},send={disabled:true},input={value:'Chọn Nam Phái',placeholder:'Mô tả công việc cần thực hiện trên máy…',dataset:{},style:{}};
 const thread={children:[],append(x){this.children.push(x)},scrollHeight:0},pending={parentElement:{id:'pending'}};
 const added=[],requests=[];
 const context=vm.createContext({busy:true,activeId:'c1',activeRepo:null,history:[{role:'user',content:'Viết webapp'}],sessions:[{id:'c1',taskId:'t1'}],runningChats:new Set(['c1']),liveReplies:new Map([['c1',pending]]),send,input,thread,crypto:{randomUUID:()=>'turn-2'},Date,
  document:{querySelector:s=>({'#stopResponse':stop,'#note':note})[s]},localRequest:async(route,body)=>{requests.push([route,body]);return {delivered:true}},add:(role,text)=>{added.push([role,text])},saveHistory(){}});
 vm.runInContext(slice('syncComposer')+'\n'+slice('sendToRunningTask'),context);
 vm.runInContext('syncComposer()',context);
 assert.equal(send.disabled,false,'send stays enabled for a running work task');
 assert.equal(stop.hidden,false,'stop button is visible');
 assert.equal(input.placeholder,'Nhắn thêm cho tác vụ đang chạy…');
 await vm.runInContext("sendToRunningTask('Chọn Nam Phái')",context);
 assert.equal(JSON.stringify(requests),JSON.stringify([['/local-task-message',{chat:'c1',text:'Chọn Nam Phái'}]]));
 assert.deepEqual(added,[['user','Chọn Nam Phái']]);
 assert.equal(thread.children.at(-1),pending.parentElement,'the thinking reply moves below the new message');
 assert.equal(vm.runInContext('history.length',context),2);
 context.busy=false;vm.runInContext('syncComposer()',context);
 assert.equal(stop.hidden,true);assert.equal(input.placeholder,'Mô tả công việc cần thực hiện trên máy…');
});
