import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const html=fs.readFileSync('web/index.html','utf8');
class Element{constructor(tag='div'){this.tag=tag;this.children=[];this.dataset={};this.style={};this.classList={add(){}};this.value='';this.checked=false;this.scrollHeight=100;this.isConnected=true;}append(...items){for(const item of items){item.parentElement=this;this.children.push(item)}}replaceChildren(){this.children=[]}setAttribute(){}remove(){}focus(){}}
const nodes=new Map();const document={createElement:t=>new Element(t),querySelector:s=>{if(!nodes.has(s))nodes.set(s,new Element());return nodes.get(s)}};
const thread=new Element(),input=new Element(),send=new Element();input.value='Thêm chữ vào ảnh này';
const image={id:'image-123',name:'Ảnh Việt Nam.png',type:'image'};let request;
let copied='';const session={id:'chat-1'};
const context=vm.createContext({document,thread,input,send,crypto:{randomUUID:()=> 'turn-1'},directImageRequest:null,busy:false,history:[],activeId:'chat-1',activeRepo:null,workRepo:null,workFile:null,desktopChat:null,conversationMode:'chat',chatAttachments:[image],pendingAttachments:[image],chatOutputs:[],sessions:[session],capabilitiesReady:Promise.resolve(),saveHistory(){},renderRepo(){},requestedImageModel:()=>null,answerPreferences:{},runningChats:new Set(),liveReplies:new Map(),storeSessions(){},openSession(){},syncComposer(){},sendToRunningTask:async()=>{},setInterval:()=>1,clearInterval(){},Date,AbortSignal,navigator:{clipboard:{writeText:async text=>{copied=text}}},setTimeout:()=>1,fetch:async(url,options)=>{request=JSON.parse(options.body);return {ok:true,json:async()=>({choices:[{message:{content:'Đã nhận ảnh.'}}]})}}});
vm.runInContext(html.slice(html.indexOf('const copyIcon='),html.indexOf("document.querySelector('#new').onclick")),context);
vm.runInContext(html.slice(html.indexOf('function renderAttachments()'),html.indexOf("document.querySelector('#attach').onclick")),context);
vm.runInContext(html.slice(html.indexOf("document.querySelector('#form').onsubmit="),html.indexOf('\n\nasync function loadCapabilities')),context);
vm.runInContext('renderAttachments()',context);assert.equal(nodes.get('#attachments').children.length,2);
await nodes.get('#form').onsubmit({preventDefault(){}});
assert.equal(nodes.get('#attachments').children.length,0,'Composer should clear after sending');
const message=thread.children[0],preview=message.children.find(c=>c.className==='message-attachment');assert.ok(preview);assert.equal(preview.children[0].tag,'img');assert.match(preview.children[0].src,/image-123/);assert.match(preview.href,/chat=chat-1/);
assert.equal(request.attachments[0],image.id,'Server still gets image for follow-up edits');
const history=vm.runInContext('history',context);assert.equal(history[0].attachments[0].id,image.id);assert.equal(vm.runInContext('chatAttachments.length',context),1);assert.equal(vm.runInContext('pendingAttachments.length',context),0);
thread.replaceChildren();context.restored=JSON.parse(JSON.stringify(history[0]));vm.runInContext('add(restored.role,restored.content,false,restored.turnId,restored.workspace,restored.attachments)',context);assert.equal(thread.children[0].children.find(c=>c.className==='message-attachment').children[0].tag,'img');
console.log('PASS: sending clears attachment composer, embeds image in user message, persists per-message uploads, restores preview, retains server access for follow-ups');

const assistant=thread.children.find(c=>c.className==='message assistant');
// Restore a completed answer and exercise its actual copy handler.
const answer=vm.runInContext("add('assistant','**Xin chào**')",context);await answer.copyButton.onclick();assert.equal(copied,'**Xin chào**');assert.equal(answer.copyButton.title,'Đã sao chép');assert.match(answer.copyButton.innerHTML,/<svg/);context.answer=answer;vm.runInContext("showThinking(answer,'Đang chờ ChatGPT xử lý bước tiếp theo…')",context);assert.equal(answer.textContent,'Đang suy nghĩ…');assert.equal(answer.copyButton.hidden,true);vm.runInContext("renderAssistant(answer,'Hoàn tất')",context);assert.equal(answer.copyButton.hidden,false);console.log('PASS: waiting label becomes Đang suy nghĩ; copy button copies answer and is hidden while processing');
