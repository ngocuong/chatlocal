type Message={role:string;content:string};
// clipLatest is for intent planning only: it may shorten the newest message, which callers must still send in full elsewhere.
export function boundedHistory<T extends Message>(messages:T[],budget=12000,clipLatest=false):T[]{
 const output=messages.map(m=>({...m}));
 let size=JSON.stringify(output).length;
 for(let i=0;i<output.length-1&&size>budget;i++){
  const m=output[i];if(m.content.length>800){m.content=m.content.slice(0,400)+'\n[Earlier context abbreviated to fit the model. Exact file contents must be read in ranges.]\n'+m.content.slice(-300);size=JSON.stringify(output).length;}
 }
 for(let i=0;i<output.length-1&&size>budget;i++){output[i].content='[Older turn omitted to fit input; do not invent its contents.]';size=JSON.stringify(output).length;}
 const last=output.at(-1);
 if(size>budget&&clipLatest&&last){
  const keep=Math.max(2000,last.content.length-(size-budget)-300),head=Math.floor(keep*.7);
  last.content=last.content.slice(0,head)+'\n[… lược '+(last.content.length-keep)+' ký tự ở giữa khi phân loại yêu cầu; nội dung đầy đủ vẫn được dùng khi thực hiện …]\n'+last.content.slice(-(keep-head));size=JSON.stringify(output).length;
 }
 if(size>budget)throw Error('Tin nhắn hoặc lịch sử còn quá dài cho một lượt. Hãy đính kèm nội dung thành tệp để đọc từng phần; chưa thực hiện thao tác mới.');
 return output;
}
export function replaceUniqueText(content:string,find:unknown,replacement:unknown){
 if(typeof find!=='string'||!find||typeof replacement!=='string')throw Error('Cần find và replacement dạng văn bản.');
 const index=content.indexOf(find);if(index<0||content.indexOf(find,index+1)>=0)throw Error('Đoạn cần sửa không khớp duy nhất. Đọc lại đúng vùng và chọn đoạn cụ thể hơn.');
 return content.slice(0,index)+replacement+content.slice(index+find.length);
}
