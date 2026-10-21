import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawn,type ChildProcess} from 'node:child_process';
const models=new Set(['gpt-6.1-sol','gpt-6-sol','gpt-6-luna','gpt-6-astra','gpt-5.6-sol','gpt-5.6-terra','gpt-5.6-luna']);
export function codexModelSlug(model:string){const slug=model.endsWith('-wm')?model.slice(0,-3):model;return models.has(slug)?slug:null;}
export function codexExecutable(){return [process.env.CODEX_CLI_PATH,'/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex','/Applications/Codex.app/Contents/Resources/codex','/opt/homebrew/bin/codex'].find((p):p is string=>!!p&&fs.existsSync(p))||null;}
export type CodexOptions={signal?:AbortSignal;timeoutMs?:number;spawnProcess?:typeof spawn;onRetry?:(message:string)=>void;retryDelaysMs?:number[]};
function delay(ms:number,signal?:AbortSignal){return new Promise<void>((resolve,reject)=>{if(signal?.aborted){reject(Object.assign(Error('Yêu cầu Codex đã dừng.'),{statusCode:499}));return;}const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve()},ms);const abort=()=>{clearTimeout(timer);reject(Object.assign(Error('Yêu cầu Codex đã dừng.'),{statusCode:499}));};signal?.addEventListener('abort',abort,{once:true});});}
export async function completeWithCodex(messages:Array<{role:string;content:unknown}>,model:string,options:CodexOptions={}):Promise<string>{
 const deadline=Date.now()+(options.timeoutMs??180000),waits=options.retryDelaysMs||[10000,20000];
 for(let attempt=0;;attempt++){try{return await codexAttempt(messages,model,{...options,timeoutMs:Math.max(1,deadline-Date.now())});}catch(error){const e=error as Error&{code?:string};const wait=waits[attempt];if(e.code!=='model_capacity'||wait===undefined||Date.now()+wait>=deadline)throw error;options.onRetry?.('Model '+(codexModelSlug(model)||model)+' đang quá tải phía dịch vụ; đang chờ '+Math.ceil(wait/1000)+' giây rồi thử lại bằng cùng model.');await delay(wait,options.signal);}}
}
async function codexAttempt(messages:Array<{role:string;content:unknown}>,model:string,options:CodexOptions):Promise<string>{
 const slug=codexModelSlug(model),executable=codexExecutable();if(!slug||!executable)throw Object.assign(Error('Không tìm thấy kết nối Codex cho model này. Hãy kiểm tra Codex đã cài và đăng nhập.'),{statusCode:503});
 const cwd=fs.mkdtempSync(path.join(os.tmpdir(),'local-codex-response-'));
 const args=['--no-daemon','exec','--ignore-user-config','--ephemeral','--skip-git-repo-check','--sandbox','read-only','--disable','shell_tool','--disable','apps','--disable','browser_use','--disable','computer_use','--disable','multi_agent','--disable','multi_agent_v2','-c','web_search="disabled"','--model',slug,'--json','-'];
 const env:NodeJS.ProcessEnv={};for(const key of ['HOME','PATH','TMPDIR','LANG','CODEX_HOME'])if(process.env[key])env[key]=process.env[key];
 let child:ChildProcess|undefined;
 try{return await new Promise<string>((resolve,reject)=>{
  let finished=false,buffer='',answer='',terminalFailure=false,turnCompleted=false,stderr='',issues:string[]=[],timer:ReturnType<typeof setTimeout>;
  const finish=(error?:Error)=>{if(finished)return;finished=true;clearTimeout(timer);options.signal?.removeEventListener('abort',abort);if(child&&child.exitCode===null)child.kill('SIGTERM');error?reject(error):resolve(answer);};
  const abort=()=>finish(Object.assign(Error('Yêu cầu Codex đã dừng.'),{statusCode:499}));
  const frame=(line:string)=>{try{const event=JSON.parse(line);if(event.type==='item.completed'&&event.item?.type==='agent_message'&&typeof event.item.text==='string')answer=event.item.text;if(event.type==='turn.failed'){terminalFailure=true;issues.push(String(event.error?.message||event.message||'turn.failed'));}if(event.type==='error')issues.push(String(event.message||event.error?.message||'Lỗi luồng phản hồi'));if(event.type==='turn.completed'){turnCompleted=true;terminalFailure=false;}}catch{}};
  timer=setTimeout(()=>finish(Object.assign(Error('Codex chưa trả lời trong thời gian chờ; các bước đã lưu vẫn được giữ.'),{statusCode:504})),options.timeoutMs??180000);
  if(options.signal?.aborted){abort();return;}
  options.signal?.addEventListener('abort',abort,{once:true});
  try{child=(options.spawnProcess||spawn)(executable,args,{cwd,env,stdio:['pipe','pipe','pipe']});}catch{finish(Object.assign(Error('Không khởi động được Codex trên máy.'),{statusCode:503}));return;}
  child.on('error',()=>finish(Object.assign(Error('Không khởi động được Codex trên máy. Kiểm tra cài đặt và đăng nhập Codex.'),{statusCode:503})));
  child.stdout?.on('data',(data:Buffer)=>{buffer+=data.toString();if(buffer.length>2e6){finish(Error('Phản hồi Codex vượt giới hạn đọc.'));return;}const lines=buffer.split('\n');buffer=lines.pop()||'';for(const line of lines)frame(line)});
  child.stderr?.on('data',(data:Buffer)=>{stderr=(stderr+data.toString()).slice(-12000)});
  child.on('close',code=>{if(buffer.trim())frame(buffer);if(code!==0||terminalFailure||(issues.length>0&&!turnCompleted)){
   const redact=(text:string)=>text.replace(/\bsk-[\w-]+\b/g,'[key redacted]').replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g,'[token redacted]').replace(/Bearer\s+\S+/gi,'Bearer [redacted]');
   const detail=redact(issues.at(-1)||stderr.split('\n').filter(line=>/error|failed|fatal|panic/i.test(line)).at(-1)||'Tiến trình kết thúc với mã '+code).slice(0,1500);
   const diagnosticFile=path.resolve('data/codex-errors.json');try{if(!options.spawnProcess){const previous=fs.existsSync(diagnosticFile)?JSON.parse(fs.readFileSync(diagnosticFile,'utf8')):[];fs.mkdirSync(path.dirname(diagnosticFile),{recursive:true});fs.writeFileSync(diagnosticFile,JSON.stringify([...previous.slice(-19),{time:new Date().toISOString(),model:slug,exitCode:code,turnCompleted,issues:issues.map(redact),stderr:redact(stderr).slice(-4000)}],null,2),{mode:0o600});fs.chmodSync(diagnosticFile,0o600);}}catch{}
   const capacity=/model is at capacity|model.*overloaded/i.test(detail);finish(Object.assign(Error(capacity?'Model đang quá tải phía dịch vụ sau các lần chờ thử lại; đây không phải số liệu tài khoản hết hạn mức. Các thao tác đã lưu trước đó vẫn được giữ.':'Codex không hoàn tất bước đang chờ: '+detail+' Các thao tác đã lưu trước đó vẫn được giữ.'),{statusCode:capacity?503:502,code:capacity?'model_capacity':'codex_turn_failed'}));
  }else if(!answer.trim())finish(Object.assign(Error('Codex chưa trả về nội dung trả lời.'),{statusCode:502}));else finish();});
  child.stdin?.on('error',()=>{});
  child.stdin?.end('You are the text completion engine for a local application. Use NO native tools, do not inspect files, do not spawn agents, and do not execute commands. All permitted computer operations are performed by the application controller after you output its requested JSON. Follow the supplied controller schema exactly when present. Otherwise answer the latest message directly. Conversation and controller instructions follow:\n'+JSON.stringify(messages));
 });}finally{fs.rmSync(cwd,{recursive:true,force:true});}
}
