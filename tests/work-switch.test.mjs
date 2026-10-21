import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const html=fs.readFileSync('web/index.html','utf8');
class Element{constructor(){this.children=[];this.dataset={};this.style={};this.value='';this.classList={contains:name=>(this.className||'').split(' ').includes(name),add(){},remove(){}};}append(...items){for(const item of items){item.parentElement=this;item.previousElementSibling=this.children.at(-1);this.children.push(item)}}setAttribute(){}remove(){}focus(){}}
const nodes=new Map(),thread=new Element(),input=new Element();let submitted=0,mode='chat';
const document={querySelector:s=>{if(!nodes.has(s))nodes.set(s,new Element());return nodes.get(s)},createElement:()=>new Element()};nodes.set('#form',{requestSubmit(){submitted++}});
const context=vm.createContext({document,thread,input,activeId:'chat-A',busy:false,conversationMode:'chat',setConversationMode(value){mode=value},renderAttachments(){},saveHistory(){}});
vm.runInContext(html.slice(html.indexOf('const copyIcon='),html.indexOf("document.querySelector('#new').onclick")),context);
vm.runInContext("add('user','Tạo file Word đơn xin nghỉ học');add('assistant','Bạn có thể chuyển sang Công việc (Work) để mình tạo file.')",context);
const reply=thread.children[1].children.find(e=>e.workButton);assert.ok(reply.workButton);reply.workButton.onclick();assert.equal(mode,'work');assert.equal(input.value,'Tạo file Word đơn xin nghỉ học');assert.equal(submitted,1);
input.value='Bản nháp đang gõ';reply.workButton.onclick();assert.equal(input.value,'Bản nháp đang gõ');assert.equal(submitted,1);
vm.runInContext("add('assistant','Đây là câu trả lời bình thường.')",context);assert.equal(thread.children.at(-1).children.some(e=>e.className==='switch-work'),false);
console.log('PASS: contextual Work button switches and submits the preceding request; preserves unsent drafts; ordinary answers have no button');

input.value='';vm.runInContext("add('user','Tạo ảnh Eun Nanjo');add('assistant','Bạn chuyển sang **Ảnh và tài liệu → Tạo ảnh trên máy**, chọn Q4 rồi dùng prompt này.')",context);const imageReply=thread.children.at(-1).children.find(e=>e.workButton);assert.ok(imageReply?.workButton);imageReply.workButton.onclick();assert.equal(input.value,'Tạo ảnh Eun Nanjo');assert.equal(submitted,2);console.log('PASS: local-image redirect also offers Work switch and resubmits the original image request');
