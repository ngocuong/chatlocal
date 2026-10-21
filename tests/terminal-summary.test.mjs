import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const html=fs.readFileSync('web/index.html','utf8');
class Element{
 constructor(tag='div'){this.tag=tag;this.children=[];this.dataset={};this.hidden=true;this.open=false;this.textContent='';this.scrollTop=0;this.scrollHeight=100;this.clientHeight=100;}
 append(child){this.children.push(child)}setAttribute(){}scrollIntoView(){}
 querySelector(s){const match=el=>s.startsWith('.')?el.className===s.slice(1):el.tag===s;for(const c of this.children){if(match(c))return c;const found=c.querySelector(s);if(found)return found;}return null;}
}
const nodes=new Map();const messages=[new Element(),new Element()];messages[0].dataset.turnId='turn-1';messages[1].dataset.turnId='turn-2';
const thread={querySelectorAll:()=>messages,querySelector:()=>messages[1].querySelector('.turn-terminal')};
const document={createElement:tag=>new Element(tag),querySelector:s=>{if(!nodes.has(s))nodes.set(s,new Element());return nodes.get(s)}};
let jobs=[{id:'install',turnId:'turn-1',command:'npm install docx',running:true,exit:null,output:'FIRST LOG'}];
const sessions=[{id:'chat-A'}];const context=vm.createContext({document,thread,sessions,history:[],URLSearchParams,activeRepo:{workspace:'shared--repo'},activeId:'chat-A',localRequest:async()=>({jobs}),saveHistory(){},add(){}});
vm.runInContext(html.slice(html.indexOf('let terminalScope='),html.indexOf("fetch('/local-github-status')")),context);
await vm.runInContext('refreshTerminal()',context);
const first=messages[0].querySelector('.turn-terminal');assert.ok(first);assert.equal(first.open,false);assert.match(first.querySelector('summary').textContent,/Đang cài công cụ/);assert.equal(messages[1].querySelector('.turn-terminal'),null);
first.open=true;jobs[0].running=false;jobs[0].exit=0;jobs.push({id:'dev',turnId:'turn-2',command:'npm run dev',running:true,exit:null,output:'SECOND LOG'});
await vm.runInContext('refreshTerminal()',context);
const second=messages[1].querySelector('.turn-terminal');assert.ok(second);assert.equal(second.open,false);assert.equal(first.open,true);assert.match(first.querySelector('summary').textContent,/Đã cài công cụ/);assert.match(second.querySelector('summary').textContent,/Đang chạy lệnh/);
assert.match(first.querySelector('pre').textContent,/FIRST LOG/);assert.doesNotMatch(first.querySelector('pre').textContent,/SECOND LOG/);assert.doesNotMatch(second.querySelector('pre').textContent,/FIRST LOG/);assert.equal(nodes.get('#terminalPanel').hidden,true);
assert.equal(sessions[0].terminalTurns['turn-1'].jobs[0].output,'FIRST LOG');
messages[0].children=[];vm.runInContext("renderTerminalJobs('turn-1','shared--repo',sessions[0].terminalTurns['turn-1'].jobs)",context);assert.match(messages[0].querySelector('.turn-terminal').querySelector('pre').textContent,/FIRST LOG/);
console.log('PASS: each user message owns its collapsed terminal, outputs never merge, existing open state is preserved, cached logs restore');
