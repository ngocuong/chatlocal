type Message={role:string;content:string};
// Preserve the authoritative spec; old tool bodies can be read again from disk.
export function workTranscript(messages:Message[],initialCount:number,specification:string,budget=120000):Message[]{
 const compact=(m:Message):Message=>{
  if(m.role==='assistant'){
   try{const action=JSON.parse(m.content);if(action.action)return {role:m.role,content:JSON.stringify({action:action.action,path:action.path,command:action.command,summary:'Earlier controller command; use its result below. Re-read saved files when needed.'})};}catch{}
  }
  return {...m,content:m.content.length>1200?m.content.slice(0,600)+'\n[Older context abbreviated; re-read files or job logs for exact data.]\n'+m.content.slice(-400):m.content};
 };
 const header:Message={role:'user',content:'AUTHORITATIVE REQUIREMENTS (preserved):\n'+specification};
 const available=budget-JSON.stringify([header]).length-1;
 if(available<2000)throw new Error('Yêu cầu gốc quá dài cho một lượt xử lý. Hãy chia yêu cầu thành các phần; các tệp đã lưu vẫn được giữ.');
 const output=messages.map((m,i)=>compact(m));
 // Keep the most recent controller exchange exact, provided it fits.
 for(let i=Math.max(initialCount,messages.length-2);i<messages.length;i++)output[i]={...messages[i]};
 const size=()=>JSON.stringify(output).length;
 for(let i=0;i<output.length-2&&size()>available;i++)output[i]=compact(output[i]);
 if(size()>available){
  for(let i=initialCount;i<output.length&&size()>available;i++)output[i]=compact(output[i]);
 }
 if(size()>available){
  const receipts=output.slice(initialCount).map(m=>compact(m));
  while(receipts.length&&JSON.stringify([header,...receipts]).length>budget)receipts.shift();
  if(JSON.stringify([header,...receipts]).length>budget)throw new Error('Yêu cầu gốc quá dài cho một lượt xử lý. Hãy chia yêu cầu thành các phần; các tệp đã lưu vẫn được giữ.');
  return [header,...receipts];
 }
 return [header,...output];
}
