import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
class Element{constructor(){this.children=[];this.style={};this.value='';this.classList={add(){},remove(){},toggle(){},contains(){return false}};this.dataset={};}append(...items){this.children.push(...items)}replaceChildren(...items){this.children=items}setAttribute(){}remove(){}focus(){}addEventListener(){}querySelectorAll(){return []}querySelector(){return null}}
const nodes=new Map();const document={addEventListener(){},querySelector:selector=>{if(!nodes.has(selector))nodes.set(selector,new Element());return nodes.get(selector)},querySelectorAll:()=>[],createElement:()=>new Element()};
const key='local-chat-conversations-v1';const store=new Map([[key,JSON.stringify([{id:'A',title:'Chat A',repo:{workspace:'owner--A',url:'https://github.com/owner/A'},messages:[{role:'user',content:'edit A'}]},{id:'B',title:'Chat B',repo:{workspace:'owner--B',url:'https://github.com/owner/B'},messages:[{role:'user',content:'edit B'}]}])]]);
let confirms=true;const requests=[];const context=vm.createContext({document,localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},crypto:{randomUUID:()=> 'C'},confirm:()=>confirms,alert(){},MutationObserver:class{observe(){}disconnect(){}},setTimeout,AbortSignal,fetch:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>url==='/local-capabilities'?{skills:[],defaultFolder:'/Users/demo/Projects',repositories:[{workspace:'local--70c8c12dca853d4b',url:'',folder:'/Users/demo/Projects'}]}:url==='/local-connect'?{workspace:'owner--C',url:'https://github.com/owner/C'}:{models:[]}}}});
vm.runInContext(fs.readFileSync('web/index.html','utf8').match(/<script>([\s\S]*)<\/script>/)[1],context);
await vm.runInContext('loadCapabilities()',context);
assert.equal(vm.runInContext('activeRepo?.folder',context),'/Users/demo/Projects','The authorized local folder must be selected on page load');
nodes.get('#new').onclick();
assert.equal(vm.runInContext('activeRepo?.folder',context),'/Users/demo/Projects','New chats must retain the default folder');
assert.equal(nodes.get('#developmentTools').checked,true,'The previously authorized local development tools must be enabled');
const list=nodes.get('#historyList');list.children.find(row=>row.children[0].title.includes('edit A')).children[0].onclick();
assert.equal(vm.runInContext('activeRepo.workspace',context),'owner--A','An explicitly selected repo must not be replaced');
console.log('PASS: default local workspace on load/new chat, development tools, explicit repository preserved');
