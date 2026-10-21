import assert from 'node:assert/strict';import {EventEmitter} from 'node:events';import {PassThrough} from 'node:stream';import Fastify from 'fastify';
import {completeWithCodex,codexModelSlug} from '../dist/services/codex-completion.service.js';import {localRoutes} from '../dist/api/routes/local.route.js';
assert.equal(codexModelSlug('gpt-6.1-sol-wm'),'gpt-6.1-sol');assert.equal(codexModelSlug('auto'),null);
let flags,stdin,killCount=0;
function spawnProcess(_exe,args,options){flags=args;assert.equal(options.env.OPENAI_API_KEY,undefined);const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.exitCode=null;child.stdin={on(){},end(text){stdin=text;setImmediate(()=>{child.stdout.write(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'{"action":"final","content":"ok"}'}})+'\n');child.exitCode=0;child.emit('close',0)})}};child.kill=()=>{killCount++;return true};return child;}
const content=await completeWithCodex([{role:'user',content:'Reply JSON'}],'gpt-6.1-sol-wm',{spawnProcess});assert.match(content,/"content":"ok"/);assert.ok(flags.includes('read-only'));assert.ok(flags.includes('--ignore-user-config'));assert.ok(flags.includes('shell_tool'));assert.ok(flags.includes('multi_agent'));assert.match(stdin,/Use NO native tools/);assert.equal(killCount,0);
const app=Fastify();let legacyCalls=0,codexCalls=0;app.post('/v1/chat/completions',async()=>{legacyCalls++;throw Error('WM must not use the ChatGPT conversation connector')});
await app.register(localRoutes,{marketData:async()=>null,codexComplete:async(messages,model)=>{codexCalls++;assert.equal(model,'gpt-6.1-sol-wm');if(messages[0].content.includes('intent and permission planner'))return JSON.stringify({mode:'task',task:'Show existing demo for review',allowedTools:['preview'],skillIds:[],sourceMessageIndices:[],verificationRequired:false});return JSON.stringify({action:'final',content:'Đã hiểu yêu cầu xem demo trước.'});}});
const headers={host:'localhost:3040',origin:'http://localhost:3040'};
try{const r=await app.inject({method:'POST',url:'/local-agent',headers,payload:{mode:'work',model:'gpt-6.1-sol-wm',chat:'native-codex-test',messages:[{role:'user',content:'bây giờ mở demo tôi kiểm tra trước rồi tiếp tục làm'}]}});assert.equal(r.statusCode,400);assert.equal(r.json().error.code,'model_disabled');assert.equal(legacyCalls,0);assert.equal(codexCalls,0);}finally{await app.close()}
console.log('PASS: Codex model alias uses authenticated local Codex, no legacy WM conversation requests, read-only/tools-disabled invocation, planner and worker share the correct connector');

let timedOutKill=false;
function pendingProcess(){const c=new EventEmitter();c.stdout=new PassThrough();c.stderr=new PassThrough();c.stdin={on(){},end(){}};c.exitCode=null;c.kill=()=>{timedOutKill=true;return true};return c;}
await assert.rejects(()=>completeWithCodex([{role:'user',content:'pending'}],'gpt-6.1-sol-wm',{spawnProcess:pendingProcess,timeoutMs:10}),e=>e.statusCode===504);assert.equal(timedOutKill,true);
const signal=new AbortController();signal.abort();await assert.rejects(()=>completeWithCodex([],'gpt-6.1-sol-wm',{signal:signal.signal,spawnProcess:()=>{throw Error('Must not spawn')}}),e=>e.statusCode===499);

function recoveringProcess(){const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.exitCode=null;child.stdin={on(){},end(){setImmediate(()=>{for(const event of [{type:'error',message:'Reconnecting 1/5: temporary disconnect'},{type:'item.completed',item:{type:'agent_message',text:'Recovered successfully'}},{type:'turn.completed'}])child.stdout.write(JSON.stringify(event)+'\n');child.exitCode=0;child.emit('close',0)})}};child.kill=()=>true;return child;}
assert.equal(await completeWithCodex([],'gpt-6.1-sol-wm',{spawnProcess:recoveringProcess}),'Recovered successfully');
console.log('PASS: a temporary error followed by a successful completed turn is not reported as failure');

let capacityAttempts=0,retries=0;
function capacityProcess(){capacityAttempts++;if(capacityAttempts>=3)return recoveringProcess();const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.exitCode=null;child.stdin={on(){},end(){setImmediate(()=>{child.stdout.write(JSON.stringify({type:'turn.failed',error:{message:'Selected model is at capacity. Please try a different model.'}})+'\n');child.exitCode=1;child.emit('close',1)})}};child.kill=()=>true;return child;}
assert.equal(await completeWithCodex([],'gpt-6.1-sol-wm',{spawnProcess:capacityProcess,retryDelaysMs:[1,1],onRetry:()=>retries++}),'Recovered successfully');assert.equal(capacityAttempts,3);assert.equal(retries,2);
console.log('PASS: capacity errors wait and retry the same model, with visible progress, then return recovered output');
