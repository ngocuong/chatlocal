import assert from 'node:assert/strict';import Fastify from 'fastify';import {localRoutes} from '../dist/api/routes/local.route.js';
const app=Fastify();let result='Câu trả lời bình thường';let received;
app.post('/v1/chat/completions',async req=>{received=req.body;return {choices:[{message:{content:result}}]}});await app.register(localRoutes,{planner:async()=>{throw Error("Chat must not invoke the work planner")},marketData:async()=>null});
const headers={host:'localhost:3040',origin:'http://localhost:3040'};
try{
 for(const content of ['giỏi','hỏi về giá vàng thế giới','giờ tạo cho tao 1 prompt với 1 nhà huyền học hơn 30 năm kinh nghiệm muốn viết 1 webapp có tử vi','tao chỉ yêu cầu mày lập prompt cho tao thôi mà']){
  const response=await app.inject({method:'POST',url:'/local-agent',headers,payload:{workspace:'nonexistent--workspace',desktop:true,chat:'test',toolsEnabled:true,messages:[{role:'user',content:'Tạo website và mở preview'},{role:'assistant',content:'Đã sửa index.html và mở preview'},{role:'user',content}]}});
  assert.equal(response.statusCode,200,content);assert.equal(response.json().choices[0].message.content,result);assert.deepEqual(response.json().journal,[]);assert.equal(response.json().previews,undefined);assert.ok(!received.messages.at(-1).content.includes('controllerInstructions'));
 }
 result=JSON.stringify({action:'write',path:'index.html',content:'unwanted code'});
 const response=await app.inject({method:'POST',url:'/local-agent',headers,payload:{workspace:'nonexistent--workspace',messages:[{role:'user',content:'giỏi'}]}});
 assert.equal(response.statusCode,200);assert.deepEqual(response.json().journal,[]);assert.match(response.json().choices[0].message.content,/chưa thực hiện thao tác/);
 console.log('PASS: gold questions, acknowledgments, prompt writing and corrections bypass workspace/desktop/tools; even model tool output is never executed');
}finally{await app.close()}
