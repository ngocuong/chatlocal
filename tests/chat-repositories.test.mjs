import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';import Fastify from 'fastify';import {localRoutes} from '../dist/api/routes/local.route.js';
const names=['test--chat-alpha','test--chat-beta'];const root=path.resolve('data/workspaces');
const git=(cwd,...args)=>execFileSync('git',['-C',cwd,...args],{stdio:'pipe',encoding:'utf8'});
for(const name of names){const dir=path.join(root,name);assert.ok(!fs.existsSync(dir));fs.mkdirSync(dir,{recursive:true});execFileSync('git',['init','-q','-b','main',dir]);git(dir,'config','user.name','Test');git(dir,'config','user.email','test@example.invalid');git(dir,'remote','add','origin',`https://github.com/test/${name}.git`);fs.writeFileSync(path.join(dir,'file.txt'),name);git(dir,'add','.');git(dir,'commit','-qm','initial');}
const app=Fastify();let actions=[];app.post('/v1/chat/completions',async()=>({choices:[{message:{content:JSON.stringify(actions.shift())}}]}));await app.register(localRoutes,{planner:async()=>({mode:'task',task:'Execute the explicit fixture request',allowedTools:['read','write','terminal','job_status','job_stop','web','preview','git_status','git_commit','git_push','import_attachment','add_skill']})});const headers={host:'localhost:3040',origin:'http://localhost:3040'};
async function edit(workspace,content){actions=[{action:'write',path:'file.txt',content},{action:'final',content:'done'}];const r=await app.inject({method:'POST',url:'/local-agent',headers,payload:{mode:'work',workspace,messages:[{role:'user',content:'Sửa file file.txt'}]}});assert.equal(r.statusCode,200);}
try{
 await edit(names[0],'alpha edited');assert.equal(fs.readFileSync(path.join(root,names[1],'file.txt'),'utf8'),names[1]);
 await edit(names[1],'beta edited');assert.equal(fs.readFileSync(path.join(root,names[0],'file.txt'),'utf8'),'alpha edited');
 await edit(names[0],'alpha reopened');assert.equal(fs.readFileSync(path.join(root,names[1],'file.txt'),'utf8'),'beta edited');
 const previews=[];for(const name of names){const r=await app.inject({method:'GET',url:'/local-git-preview?workspace='+name,headers});assert.equal(r.statusCode,200);previews.push(r.json());}
 let r=await app.inject({method:'POST',url:'/local-commit',headers,payload:{mode:'work',workspace:names[0],snapshot:previews[0].snapshot,message:'commit alpha'}});assert.equal(r.statusCode,200);assert.ok(git(path.join(root,names[0]),'branch','--show-current').startsWith('local-chat/'));assert.equal(git(path.join(root,names[1]),'branch','--show-current').trim(),'main');
 r=await app.inject({method:'GET',url:'/local-git-preview',headers});assert.notEqual(r.statusCode,200);
 await edit(null,'must not write');assert.equal(fs.readFileSync(path.join(root,names[0],'file.txt'),'utf8'),'alpha reopened');
 console.log('PASS: chat A/B edits isolated, reopening A preserves B, commit scoped to A, no implicit repo');
}finally{await app.close();for(const name of names)fs.rmSync(path.join(root,name),{recursive:true,force:true});}
