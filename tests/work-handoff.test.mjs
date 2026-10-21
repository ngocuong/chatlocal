import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {localRoutes} from '../dist/api/routes/local.route.js';
const headers={host:'localhost:3040',origin:'http://localhost:3040'};

async function chat(reply,mode='chat'){
 const app=Fastify();let prompt='';
 app.post('/v1/chat/completions',async req=>{prompt=JSON.stringify(req.body.messages);return {choices:[{message:{content:reply}}]}});
 await app.register(localRoutes,{planner:async()=>({mode:'chat',task:'answer',allowedTools:[]})});
 try{const r=await app.inject({method:'POST',url:'/local-agent',headers,payload:{mode,chat:'handoff-'+Date.now(),messages:[{role:'user',content:'Viết cho tôi một webapp lập lá số tử vi'}]}});return {r,prompt};}
 finally{await app.close();}
}

test('chat mode flags requests that need Công việc and strips the marker',async()=>{
 const {r,prompt}=await chat('[[SUGGEST_WORK]]\nYêu cầu này cần chế độ Công việc.');
 assert.equal(r.statusCode,200);
 assert.match(prompt,/WORK HANDOFF/);
 assert.equal(r.json().suggestWork,true);
 assert.equal(r.json().choices[0].message.content,'Yêu cầu này cần chế độ Công việc.');
});

test('ordinary chat answers carry no handoff flag',async()=>{
 const {r}=await chat('Tử vi là một môn huyền học phương Đông.');
 assert.equal(r.json().suggestWork,undefined);
 assert.equal(r.json().choices[0].message.content,'Tử vi là một môn huyền học phương Đông.');
});

test('work mode never asks for the handoff',async()=>{
 const {r,prompt}=await chat('[[SUGGEST_WORK]] lạc đề','work');
 assert.doesNotMatch(prompt,/WORK HANDOFF/);
 assert.equal(r.json().suggestWork,undefined);
});

test('the handoff button switches to Công việc and resends the same request',async()=>{
 const fs=await import('node:fs'),vm=await import('node:vm');
 const html=fs.readFileSync('web/index.html','utf8');
 const start=html.indexOf('function offerWorkMode('),end=html.indexOf('\n',start);
 const parent={children:[],append(...items){this.children.push(...items)}},reply={parentElement:parent};
 const calls=[],input={value:''};
 const nodes={'#workTab':{click(){calls.push('work')}},'#form':{requestSubmit(){calls.push('submit:'+input.value)}}};
 const context=vm.createContext({busy:false,input,document:{createElement:()=>({}),querySelector:s=>nodes[s]}});
 vm.runInContext(html.slice(start,end),context);
 vm.runInContext('offerWorkMode',context)(reply,'Viết webapp tử vi');
 const button=parent.children[0];
 assert.equal(button.textContent,'Chuyển sang Công việc và làm luôn');
 button.onclick();
 assert.deepEqual(calls,['work','submit:Viết webapp tử vi']);
 assert.equal(button.disabled,true);
});
