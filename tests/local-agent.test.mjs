import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';
import Fastify from 'fastify';
import {localRoutes} from '../dist/api/routes/local.route.js';
const workspace=path.resolve('data/workspaces/test--fixture');
assert.ok(!fs.existsSync(workspace),'Fixture must not already exist');
fs.mkdirSync(workspace,{recursive:true});fs.writeFileSync(path.join(workspace,'hello.txt'),'before');execFileSync('git',['init','-q',workspace]);execFileSync('git',['-C',workspace,'add','hello.txt']);
const app=Fastify();let actions=[];
app.post('/v1/chat/completions',async req=>{assert.equal(req.body.messages.length,1);assert.match(req.body.messages[0].content,/controllerInstructions/);assert.match(req.body.messages[0].content,/transcript/);return {choices:[{message:{content:JSON.stringify(actions.shift())}}]};});await app.register(localRoutes,{planner:async()=>({mode:'task',task:'Execute the explicit fixture request',allowedTools:['read','write','terminal','job_status','job_stop','web','preview','git_status','git_commit','git_push','import_attachment','add_skill']})});await app.ready();
const headers={host:'localhost:3040',origin:'http://localhost:3040'};
try{
 assert.equal((await app.inject({method:'POST',url:'/local-connect',headers,payload:{url:'https://github.com/test/fixture'}})).statusCode,200);
 actions=[{action:'read',path:'hello.txt'},{action:'write',path:'hello.txt',content:'after'},{action:'final',content:'done'}];
 let r=await app.inject({method:'POST',url:'/local-agent',headers,payload:{mode:'work',workspace:'test--fixture',messages:[{role:'user',content:'edit fixture'}]}});
 assert.equal(r.statusCode,200);assert.equal(fs.readFileSync(path.join(workspace,'hello.txt'),'utf8'),'after');assert.equal(r.json().journal.length,2);
 actions=[{action:'final',content:'Tôi không có quyền truy cập trực tiếp vào runtime local nên không thể tạo file.'},{action:'write',path:'bridge-check.txt',content:'bridge works'},{action:'final',content:'done'}];
 r=await app.inject({method:'POST',url:'/local-agent',headers,payload:{mode:'work',workspace:'test--fixture',messages:[{role:'user',content:'tạo file bridge-check.txt'}]}});
 assert.equal(r.statusCode,200);assert.equal(fs.readFileSync(path.join(workspace,'bridge-check.txt'),'utf8'),'bridge works','Model capability confusion must be corrected by the bridge');
 actions=[{action:'final',content:'Tôi đã nhận yêu cầu. Hiện tại tôi chưa có bộ điều khiển local JSON thực sự trong phiên này để ghi file trực tiếp vào repo `ngocuong--test`, nên không thể giả vờ tạo file hay chỉnh sửa repo.'},{action:'write',path:'exact-report.txt',content:'fixed'},{action:'final',content:'done'}];
 r=await app.inject({method:'POST',url:'/local-agent',headers,payload:{mode:'work',workspace:'test--fixture',messages:[{role:'user',content:'tạo file exact-report.txt'}]}});
 assert.equal(r.statusCode,200);assert.equal(fs.readFileSync(path.join(workspace,'exact-report.txt'),'utf8'),'fixed');
 actions=[{action:'write',path:'../escape.txt',content:'bad'},{action:'final',content:'blocked'}];
 await app.inject({method:'POST',url:'/local-agent',headers,payload:{mode:'work',workspace:'test--fixture',messages:[]}});assert.ok(!fs.existsSync(path.resolve(workspace,'../escape.txt')));
 r=await app.inject({method:'POST',url:'/local-agent',headers:{...headers,origin:'https://evil.example'},payload:{mode:'work',workspace:'test--fixture',messages:[]}});assert.equal(r.statusCode,403);
 actions=[{action:'final',content:'Tôi chưa có kết quả đọc file từ local controller trong phiên này nên không thể xác nhận dòng cuối cùng.'},{action:'read',path:'hello.txt'},{action:'final',content:'after'}];
 r=await app.inject({method:'POST',url:'/local-agent',headers,payload:{mode:'work',workspace:'test--fixture',messages:[{role:'user',content:'Đọc lại hello.txt và cho tôi biết nội dung.'}]}});
 assert.equal(r.statusCode,200);assert.deepEqual(r.json().journal,['Đọc hello.txt (ký tự 0–5)']);
 for(const final of ['Tôi chưa có bộ điều khiển local JSON để ghi file.','Tôi đã sẵn sàng thao tác với repo. Vui lòng gửi yêu cầu cụ thể.']){
  actions=[{action:'write',path:'receipt.txt',content:'actual write'},{action:'final',content:final}];
  r=await app.inject({method:'POST',url:'/local-agent',headers,payload:{mode:'work',workspace:'test--fixture',messages:[{role:'user',content:'tạo receipt.txt'}]}});
  assert.equal(r.statusCode,200);assert.match(r.json().choices[0].message.content,/Đã thực hiện trên repo test--fixture/);assert.doesNotMatch(r.json().choices[0].message.content,/chưa có|sẵn sàng/);
 }
 actions=Array.from({length:3},()=>({action:'final',content:'Tôi chưa có bộ điều khiển local JSON để ghi file.'}));
 r=await app.inject({method:'POST',url:'/local-agent',headers,payload:{mode:'work',workspace:'test--fixture',messages:[{role:'user',content:'tạo file missing.txt'}]}});
 assert.equal(r.statusCode,502);assert.match(r.json().error.message,/Repo đã kết nối/);assert.ok(!fs.existsSync(path.join(workspace,'missing.txt')));
 actions=[{action:'write',path:'prompt-implementation.txt',content:'executed from prompt'},{action:'final',content:'done'}];
 r=await app.inject({method:'POST',url:'/local-agent',headers,payload:{mode:'work',workspace:'test--fixture',messages:[{role:'user',content:'viết một prompt để tạo webapp'},{role:'assistant',content:'Prompt: tạo webapp và file prompt-implementation.txt'},{role:'user',content:'dùng prompt đó để bắt đầu viết WebApp trên máy của tôi'}]}});
 assert.equal(r.statusCode,200);assert.equal(fs.readFileSync(path.join(workspace,'prompt-implementation.txt'),'utf8'),'executed from prompt');
 console.log('PASS: repository read/write, traversal blocked, cross-origin blocked');
}finally{await app.close();fs.rmSync(workspace,{recursive:true,force:true});}
