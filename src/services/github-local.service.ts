import fs from 'node:fs';
import path from 'node:path';
const tokenPath=path.resolve('data/github-token');
export function githubToken(){return fs.existsSync(tokenPath)?fs.readFileSync(tokenPath,'utf8').trim():'';}
export async function githubRequest(route:string,token=githubToken()){
 if(!token)throw Error('Hãy kết nối GitHub bằng token trong Repo và công cụ.');
 const response=await fetch('https://api.github.com'+route,{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error(`GitHub trả về lỗi ${response.status}. Kiểm tra quyền và hạn token.`);
 return response.json() as Promise<any>;
}
export async function saveGithubToken(token:string){if(typeof token!=='string'||!token.trim()||token.length>1000)throw Error('Token không hợp lệ.');const user=await githubRequest('/user',token.trim());fs.mkdirSync(path.dirname(tokenPath),{recursive:true});fs.writeFileSync(tokenPath,token.trim(),{mode:0o600});fs.chmodSync(tokenPath,0o600);return {login:user.login};}
export function githubEnv(){
 if(!githubToken())return {...process.env,GIT_TERMINAL_PROMPT:'0'};
 const helper=path.resolve('data/github-askpass.cjs');
 fs.writeFileSync(helper,`#!/usr/bin/env node\nconst fs=require('node:fs');const path=require('node:path');process.stdout.write(/username/i.test(process.argv[2]||'')?'x-access-token':fs.readFileSync(path.join(__dirname,'github-token'),'utf8').trim());\n`,{mode:0o700});fs.chmodSync(helper,0o700);
 return {...process.env,GIT_TERMINAL_PROMPT:'0',GIT_ASKPASS:helper};
}
