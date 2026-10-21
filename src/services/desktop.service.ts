import { spawn } from 'node:child_process';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
export type DesktopAction={kind:'click'|'type'|'key'|'scroll';element?:number;text?:string;key?:string;command?:boolean;shift?:boolean;amount?:number};
type Observation={app:string;bundle:string;elements:Array<{id:number;description:string}>};
export async function nativeDesktop(request:Record<string,unknown>):Promise<any>{
 return new Promise((resolve,reject)=>{
  const child=spawn(path.resolve('data/Chat Local Helper.app/Contents/MacOS/ChatLocalDesktop'),[],{stdio:['pipe','pipe','pipe']});let output='';
  const timeout=setTimeout(()=>{child.kill();reject(new Error('Không nhận được phản hồi từ macOS.'));},15000);
  child.stdout.on('data',data=>{output+=data;if(output.length>300000)child.kill()});child.stderr.resume();
  child.on('error',()=>{clearTimeout(timeout);reject(new Error('Chưa build Chat Local Helper.'))});
  child.on('close',()=>{clearTimeout(timeout);try{const result=JSON.parse(output);if(result.error)reject(new Error(result.error));else resolve(result)}catch{reject(new Error('Chat Local Helper không trả về dữ liệu hợp lệ.'))}});
  child.stdin.end(JSON.stringify(request));
 });
}
export class DesktopController{
 private sessions=new Map<string,{bundle:string;observation?:Observation;pending?:{id:string;action:DesktopAction;expected?:string}}>();
 constructor(private run:typeof nativeDesktop=nativeDesktop){}
 async enable(chat:string,bundle:string){if(!chat||!bundle)throw new Error('Hãy chọn chat và ứng dụng.');const status=await this.run({action:'status'});if(!status.accessibility)throw new Error('Bạn cần cấp quyền Trợ năng cho Chat Local Helper trước.');this.sessions.set(chat,{bundle});return {enabled:true};}
 stop(chat:string){this.sessions.delete(chat);return {enabled:false};}
 enabled(chat:string){return this.sessions.has(chat)}
 async observe(chat:string){const session=this.sessions.get(chat);if(!session)throw new Error('Điều khiển đã tắt.');const observation=await this.run({action:'observe',bundle:session.bundle}) as Observation;if(this.sessions.get(chat)!==session)throw new Error('Điều khiển đã dừng.');session.observation=observation;return observation;}
 propose(chat:string,action:DesktopAction){const session=this.sessions.get(chat);if(!session||!session.observation)throw new Error('Cần quan sát ứng dụng trước.');if(!['click','type','key','scroll'].includes(action.kind))throw new Error('Thao tác không hợp lệ.');if(action.kind==='type'&&(typeof action.text!=='string'||action.text.length>5000))throw new Error('Nội dung nhập quá dài.');const element=session.observation.elements.find(e=>e.id===action.element);if(action.kind==='click'&&!element)throw new Error('Không tìm thấy phần tử.');const pending={id:randomUUID(),action,expected:element?.description};session.pending=pending;return {id:pending.id,app:session.observation.app,action,target:element?.description};}
 async execute(chat:string,id:string){const session=this.sessions.get(chat),pending=session?.pending;if(!session||!pending||pending.id!==id)throw new Error('Thao tác đã hết hiệu lực hoặc đã dừng.');delete session.pending;const a=pending.action;return this.run({action:a.kind,bundle:session.bundle,approved:true,element:a.element,expected:pending.expected,text:a.text,key:a.key,command:a.command,shift:a.shift,amount:a.amount});}
}
export const desktop=new DesktopController();
