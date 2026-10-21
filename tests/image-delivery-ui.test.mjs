import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
class Node{constructor(tag){this.tag=tag;this.children=[];this.style={}}append(...nodes){for(const n of nodes){if(n.parent)n.parent.children=n.parent.children.filter(c=>c!==n);n.parent=this;this.children.push(n)}}replaceChildren(){this.children=[]}querySelector(selector){return this.children.find(n=>selector==='button'?n.tag==='button':n.id===selector.slice(1))||null}setAttribute(){}}
const thread=new Node('section'),calls=[],a={id:'test',chat:'chat',url:'/local-artifact?id=test&chat=chat',name:'test.png',mime:'image/png'};
const html=fs.readFileSync('web/index.html','utf8'),source=html.slice(html.indexOf('function showArtifacts(){'),html.indexOf("document.querySelector('#startFreeMedia')"));
const context={thread,chatOutputs:[a],document:{createElement:tag=>new Node(tag)},localRequest:async(url,payload)=>calls.push({url,payload}),Date};vm.createContext(context);vm.runInContext(source+';showArtifacts()',context);
const box=thread.children[0],row=box.children[1],image=row.children.find(n=>n.tag==='img'),status=row.children[0];
assert.match(status.textContent,/đang tải/);assert.equal(calls.length,0);
image.onerror();assert.match(status.textContent,/chưa tải được/);assert.equal(calls.at(-1).payload.status,'failed');const retry=row.querySelector('button');assert.ok(retry);retry.onclick();assert.match(image.src,/retry=/);
image.naturalWidth=16;image.onload();assert.match(status.textContent,/ảnh đã tải/);assert.equal(calls.at(-1).payload.status,'loaded');
console.log('PASS: image load confirms delivery; error reports failure and retry; saved alone never claims loaded');
