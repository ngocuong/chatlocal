import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { chromium, type Browser, type Page } from 'playwright';
const jobs=new Map<string,{cwd:string;chat:string;turnId:string;process:ChildProcess;command:string;output:string;exit:number|null}>();
const pages=new Map<string,Page>();
let browser:Browser|undefined;
export function jobStatus(cwd:string,id?:string,chat?:string,turnId?:string){return [...jobs].filter(([key,j])=>j.cwd===cwd&&(chat===undefined||j.chat===chat)&&(turnId===undefined||j.turnId===turnId)&&(!id||key===id)).map(([id,j])=>({id,turnId:j.turnId,command:j.command,output:j.output,exit:j.exit,running:j.process.exitCode===null&&j.process.signalCode===null}));}
export async function terminal(cwd:string,command:string,chat='',turnId=''){
 if(typeof command!=='string'||!command.trim()||command.length>20000)throw Error('Lệnh terminal không hợp lệ.');
 if([...jobs.values()].filter(j=>j.process.exitCode===null&&j.process.signalCode===null).length>=8)throw Error('Đang có 8 tiến trình. Hãy dừng tiến trình cũ.');
 const id=randomUUID(),env:NodeJS.ProcessEnv={};
 for(const key of ['PATH','HOME','TMPDIR','LANG','SHELL'])if(process.env[key])env[key]=process.env[key];
 env.GIT_TERMINAL_PROMPT='0';env.CI='1';
 const child=spawn('/bin/zsh',['-c',command],{cwd,env,detached:true,stdio:['ignore','pipe','pipe']});
 const job={cwd,chat,turnId,process:child,command,output:'',exit:null as number|null};jobs.set(id,job);
 const append=(data:Buffer)=>{job.output=(job.output+data.toString()).slice(-40000)};
 child.stdout?.on('data',append);child.stderr?.on('data',append);
 child.on('error',e=>{job.output+=e.message;job.exit=-1});child.on('close',code=>{job.exit=code});
 await new Promise<void>(resolve=>{const timer=setTimeout(resolve,1200);child.once('close',()=>{clearTimeout(timer);resolve()});child.once('error',()=>{clearTimeout(timer);resolve()})});
 return jobStatus(cwd,id)[0];
}
export function stopJob(cwd:string,id:string,chat?:string,turnId?:string){const job=jobs.get(id);if(!job||job.cwd!==cwd||(chat!==undefined&&job.chat!==chat)||(turnId!==undefined&&job.turnId!==turnId))throw Error('Không tìm thấy tiến trình của thư mục này.');if(job.process.pid&&job.process.exitCode===null&&job.process.signalCode===null){try{process.kill(-job.process.pid,'SIGTERM')}catch{job.process.kill()}}return {ok:true};}
export async function webTool(cwd:string,a:{kind:string;url?:string;selector?:string;text?:string;key?:string},chat=''){
 const session=JSON.stringify([cwd,chat]);
 let page=pages.get(session);
 if(!page||page.isClosed()){
  browser??=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext();
  // The application contains local credentials; keep it outside test-browser access.
  await context.route('**/*',route=>{const u=new URL(route.request().url());return u.port==='3040'?route.abort():route.continue()});
  page=await context.newPage();page.setDefaultTimeout(10000);pages.set(session,page);
  const errors:string[]=[];page.on('pageerror',e=>{errors.push(e.message);if(errors.length>20)errors.shift()});
  (page as Page&{testErrors:string[]}).testErrors=errors;
 }
 if(a.kind==='open'){const url=new URL(a.url||'');if(!['http:','https:'].includes(url.protocol)||url.port==='3040')throw Error('URL không được phép.');await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:20000})}
 else if(a.kind==='click')await page.locator(a.selector||'').first().click();
 else if(a.kind==='fill')await page.locator(a.selector||'').first().fill(String(a.text||''));
 else if(a.kind==='key')await page.keyboard.press(a.key||'Enter');
 else if(a.kind!=='observe')throw Error('Thao tác web không hợp lệ.');
 return {url:page.url(),title:await page.title(),text:(await page.locator('body').innerText()).slice(0,25000),elements:await page.locator('a,button,input,textarea,select').evaluateAll(nodes=>nodes.slice(0,100).map(n=>({tag:n.tagName,id:n.id,text:n.textContent?.slice(0,160),name:n.getAttribute('name'),type:n.getAttribute('type'),placeholder:n.getAttribute('placeholder'),href:n.getAttribute('href')}))),errors:(page as Page&{testErrors:string[]}).testErrors};
}
export async function closeDevelopment(){for(const [id,j] of jobs)stopJob(j.cwd,id);await browser?.close();browser=undefined;pages.clear();}
