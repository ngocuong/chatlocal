import {randomUUID} from 'node:crypto';
export type BackgroundTask={id:string;chat:string;state:'running'|'done'|'error';progress:string;started:number;result?:unknown;error?:string};
export class BackgroundTasks{
 private tasks=new Map<string,BackgroundTask>();
 cancel(chat:string){let count=0;for(const task of this.tasks.values())if(task.chat===chat&&task.state==='running'){task.state='error';task.error='Đã hủy công việc của chat này.';task.result={error:{message:task.error}};count++;}return count;}
 start(chat:string,run:(id:string)=>Promise<{statusCode:number;result:any}>){
  if(typeof chat!=='string'||!chat||chat.length>100)throw Error('Chat không hợp lệ.');
  if([...this.tasks.values()].some(t=>t.chat===chat&&t.state==='running'))throw Object.assign(Error('Chat này đang có công việc chạy. Hãy theo dõi tác vụ hiện tại.'),{statusCode:409});
  if([...this.tasks.values()].filter(t=>t.state==='running').length>=8)throw Object.assign(Error('Đang có quá nhiều công việc chạy.'),{statusCode:409});
  for(const [id,t] of this.tasks)if(t.state!=='running'&&(this.tasks.size>=200||Date.now()-t.started>86400000))this.tasks.delete(id);
  const task:BackgroundTask={id:randomUUID(),chat,state:'running',progress:'Đã nhận yêu cầu, đang xác định công việc…',started:Date.now()};this.tasks.set(task.id,task);
  setImmediate(async()=>{if(task.state!=='running')return;try{const response=await run(task.id);if(task.state!=='running')return;task.result=response.result;if(response.statusCode>=400){task.state='error';task.error=response.result?.error?.message||'Công việc chưa hoàn thành.';}else task.state='done';}catch{if(task.state!=='running')return;task.state='error';task.error='Server đang dừng hoặc đã khởi động lại. Các tệp đã lưu vẫn được giữ; chưa xác nhận hoàn thành.';} });
  return {id:task.id,chat};
 }
 get(id:string,chat:string){const task=this.tasks.get(id);if(!task||task.chat!==chat)throw Object.assign(Error('Không tìm thấy tác vụ của chat này. Server có thể đã khởi động lại; các tệp đã lưu vẫn được giữ.'),{statusCode:404});return {...task};}
 update(id:string|undefined,progress:string){const task=id?this.tasks.get(id):undefined;if(task?.state==='running')task.progress=progress;}
}
