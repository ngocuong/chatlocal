import { githubEnv } from './github-local.service.js';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run=promisify(execFile);
async function git(cwd:string,args:string[]){return (await run('git',['-c','credential.interactive=false',...args],{cwd,env:githubEnv(),timeout:120000,maxBuffer:8*1024*1024})).stdout;}
export async function gitPreview(cwd:string){
 const status=await git(cwd,['status','--porcelain=v1','-z']);
 let head='';
 try{head=(await git(cwd,['rev-parse','--verify','HEAD'])).trim();}catch(error){if((error as {code?:number}).code!==128)throw error;}
 const diff=await git(cwd,['diff','--no-ext-diff','--no-textconv','--binary',...(head?['HEAD']:['--cached']),'--']);
 const untracked=(await git(cwd,['ls-files','--others','--exclude-standard','-z'])).split('\0').filter(Boolean);
 const digest=createHash('sha256').update(status).update(diff);
 const newFiles:string[]=[];
 for(const name of untracked){
  const full=path.join(cwd,name);const stat=fs.lstatSync(full);
  const content=stat.isSymbolicLink()?Buffer.from(fs.readlinkSync(full)):fs.readFileSync(full);
  digest.update(name).update(content);
  newFiles.push(`New file: ${name}\n${content.subarray(0,16000).toString('utf8')}${content.length>16000?'\n[truncated]':''}`);
 }
 digest.update(head);
 const branch=(await git(cwd,['branch','--show-current'])).trim();
 const remote=(await git(cwd,['remote','get-url','origin'])).trim();
 if(!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(?:\.git)?$/.test(remote))throw new Error('Remote GitHub không hợp lệ.');
 return {snapshot:digest.digest('hex'),head,branch,remote,hasChanges:!!status,diff:(diff+'\n'+newFiles.join('\n\n')).slice(0,150000),status:status.replaceAll('\0','\n')};
}
export async function commitLocal(cwd:string,snapshot:string,message:string){
 if(typeof message!=='string'||!message.trim()||message.length>500)throw new Error('Nhập lời nhắn commit (tối đa 500 ký tự).');
 const preview=await gitPreview(cwd);
 if(preview.snapshot!==snapshot)throw new Error('Code đã thay đổi. Hãy xem lại diff trước khi commit.');
 if(!preview.hasChanges)throw new Error('Không có thay đổi để commit.');
 if((await git(cwd,['ls-files','--unmerged'])).trim())throw new Error('Repo đang có xung đột Git.');
 let branch=preview.branch;
 if(!branch.startsWith('local-chat/')){
  branch=`local-chat/${Date.now()}-${randomBytes(3).toString('hex')}`;
  await git(cwd,['switch','-c',branch]);
 }
 await git(cwd,['add','--all']);
 await git(cwd,['-c','core.hooksPath=/dev/null','commit','-m',message.trim()]);
 return {branch,head:(await git(cwd,['rev-parse','HEAD'])).trim()};
}
export async function pushLocal(cwd:string,expectedHead:string,expectedBranch:string){
 const preview=await gitPreview(cwd);
 if(!preview.head)throw new Error('Repo chưa có commit. Hãy tạo commit trước khi push.');
 if(preview.head!==expectedHead||preview.branch!==expectedBranch)throw new Error('Nhánh hoặc commit đã đổi. Hãy xem lại trước khi push.');
 if(!preview.branch.startsWith('local-chat/'))throw new Error('Chỉ push nhánh local-chat; không đẩy trực tiếp main.');
 if(preview.hasChanges)throw new Error('Còn thay đổi chưa commit. Hãy commit trước khi push.');
 await git(cwd,['-c','core.hooksPath=/dev/null','push','--set-upstream','origin',`HEAD:refs/heads/${preview.branch}`]);
 return {branch:preview.branch,head:preview.head,url:preview.remote.replace(/\.git$/,'')+'/tree/'+preview.branch};
}
