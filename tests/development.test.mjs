import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import Fastify from 'fastify';
import {localRoutes} from '../dist/api/routes/local.route.js';
import {terminal,jobStatus,stopJob,webTool,closeDevelopment} from '../dist/services/development.service.js';
const cwd=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'local-dev-')));
const headers={host:'localhost:3040',origin:'http://localhost:3040'};
const app=Fastify();let actions=[];
app.post('/v1/chat/completions',async()=>({choices:[{message:{content:JSON.stringify(actions.shift())}}]}));
await app.register(localRoutes,{planner:async()=>({mode:'task',task:'Execute the explicit fixture request',allowedTools:['read','write','terminal','job_status','job_stop','web','preview','git_status','git_commit','git_push','import_attachment','add_skill']})});await app.ready();
try{
 let r=await app.inject({method:'POST',url:'/local-folder',headers,payload:{folder:cwd}});assert.equal(r.statusCode,200);const {workspace}=r.json();
 actions=[{action:'write',path:'direct.txt',content:'written directly'},{action:'final',content:'done'}];
 r=await app.inject({method:'POST',url:'/local-agent',headers,payload:{mode:'work',workspace,messages:[{role:'user',content:'tạo file direct.txt'}]}});assert.equal(r.statusCode,200);assert.equal(fs.readFileSync(path.join(cwd,'direct.txt'),'utf8'),'written directly');
 actions=[{action:'terminal',command:'touch blocked.txt'},{action:'final',content:'disabled'}];
 await app.inject({method:'POST',url:'/local-agent',headers,payload:{mode:'work',workspace,messages:[{role:'user',content:'chạy terminal node để kiểm thử'}]}});assert.ok(!fs.existsSync(path.join(cwd,'blocked.txt')));
 await app.inject({method:'POST',url:'/local-tools',headers,payload:{mode:'work',workspace,enabled:true}});
 actions=[{action:'terminal',command:"node -e \"console.log('terminal-works')\""},{action:'final',content:'done'}];
 r=await app.inject({method:'POST',url:'/local-agent',headers,payload:{mode:'work',workspace,messages:[{role:'user',content:'chạy terminal node để kiểm thử'}]}});assert.equal(r.statusCode,200);assert.match(jobStatus(cwd).at(-1).output,/terminal-works/);
 const running=await terminal(cwd,"node -e \"setInterval(()=>{},1000)\"");assert.equal(running.running,true);assert.throws(()=>stopJob('/wrong',running.id));stopJob(cwd,running.id);
 r=await app.inject({method:'POST',url:'/local-folder',headers:{...headers,origin:'https://evil.test'},payload:{folder:cwd}});assert.equal(r.statusCode,403);
 if(process.env.TEST_BROWSER){
  const html=`<h1>Browser fixture</h1><input id="name"><button id="go">Go</button><script>document.querySelector('#go').onclick=()=>document.querySelector('h1').textContent=document.querySelector('#name').value</script>`;
  fs.writeFileSync(path.join(cwd,'server.cjs'),"require('http').createServer((q,r)=>{r.setHeader('Content-Type','text/html');r.end("+JSON.stringify(html)+")}).listen(43871,'127.0.0.1')");
  const server=await terminal(cwd,'node server.cjs');
  let page=await webTool(cwd,{kind:'open',url:'http://127.0.0.1:43871'});assert.match(page.text,/Browser fixture/);
  await webTool(cwd,{kind:'fill',selector:'#name',text:'browser works'});page=await webTool(cwd,{kind:'click',selector:'#go'});assert.match(page.text,/browser works/);stopJob(cwd,server.id);
 }
 console.log('PASS: direct folder writes, terminal enable/disable, process logs/stop, browser actions, origin protection');
}finally{
 await app.close();await closeDevelopment();fs.rmSync(cwd,{recursive:true,force:true});
 const file='data/local-folders.json';const folders=JSON.parse(fs.readFileSync(file));for(const [key,value] of Object.entries(folders))if(value===cwd)delete folders[key];fs.writeFileSync(file,JSON.stringify(folders));
}
