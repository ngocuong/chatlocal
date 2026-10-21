import test from 'node:test';import assert from 'node:assert/strict';import Fastify from 'fastify';
import {responseAnchor,asksToContinueResponse,removeRepeatedResponse,previousResponseParts} from '../dist/services/response-continuation.service.js';
import {localRoutes} from '../dist/api/routes/local.route.js';
test('continuation anchor is exactly displayed text, errors and uncertain boundaries are rejected',()=>{
 const messages=[{role:'user',content:'Explain'},{role:'assistant',content:'Phần 1\nCâu đang viết dở vì'},{role:'user',content:'viết tiếp'}];
 assert.equal(responseAnchor(messages),'Phần 1\nCâu đang viết dở vì');assert.ok(asksToContinueResponse('hãy viết tiếp đi'));assert.equal(asksToContinueResponse('tiếp tục code trang web'),false);
 assert.equal(responseAnchor(messages,{status:'error',text:'',messageIndex:-1}),undefined);
 assert.equal(responseAnchor(messages,{status:'complete',text:'different',messageIndex:1}),undefined);
 assert.equal(responseAnchor([...messages,{role:'user',content:'tiếp tục'}]),undefined);
});
test('duplicate prefix and prose paragraphs are removed without deleting structural code',()=>{
 const paragraph='Đây là một đoạn văn đã xuất hiện đầy đủ trong câu trả lời trước.';
 assert.equal(removeRepeatedResponse(paragraph,paragraph+'\n\nĐoạn mới.'),'Đoạn mới.');
 assert.equal(removeRepeatedResponse('Mở đầu. '+paragraph,paragraph+'\n\nĐoạn mới.'),'Đoạn mới.');
 assert.equal(removeRepeatedResponse(paragraph,'Đoạn mới.\n\n'+paragraph).trim(),'Đoạn mới.');
 assert.equal(removeRepeatedResponse('a sentence cut in the middle','middle of a new example'),'middle of a new example');
 const code='```js\n'+paragraph+'\n```';assert.equal(removeRepeatedResponse(paragraph,code),code);
 const messages=[{role:'user',content:'write'},{role:'assistant',content:'Phần 1'},{role:'user',content:'tiếp tục'},{role:'assistant',content:'Phần 2'},{role:'user',content:'viết tiếp'}];assert.equal(previousResponseParts(messages,'Phần 2'),'Phần 1\n\nPhần 2');
});
test('chat route continues at the exact boundary, removes duplicates, and asks instead of invoking model on missing boundary',async()=>{
 const app=Fastify();let prompt,calls=0;const original='Phần 1\nĐoạn đã hiển thị trước, gồm các yêu cầu cần thiết để triển khai.';
 app.post('/v1/chat/completions',async req=>{calls++;prompt=req.body.messages.at(-1).content;return {choices:[{message:{content:original+'\n\nPhần 2\nNội dung mới.'}}]};});await app.register(localRoutes,{marketData:async()=>null});
 const headers={host:'localhost:3040',origin:'http://localhost:3040'};
 try{
  const messages=[{role:'user',content:'Write article'},{role:'assistant',content:original},{role:'user',content:'tiếp tục'}];
  const response=await app.inject({method:'POST',url:'/local-agent',headers,payload:{mode:'chat',messages,responseCursor:{status:'complete',text:original,messageIndex:1}}});assert.equal(response.statusCode,200);assert.equal(response.json().choices[0].message.content,'Phần 2\nNội dung mới.');assert.match(prompt,/EXACT PREVIOUSLY DISPLAYED ANSWER/);assert.match(prompt,/Phần 2/);
  const missing=await app.inject({method:'POST',url:'/local-agent',headers,payload:{mode:'chat',messages,responseCursor:{status:'error',text:'',messageIndex:-1}}});assert.match(missing.json().choices[0].message.content,/1–2 câu cuối/);assert.equal(calls,1);
 }finally{await app.close();}
});
