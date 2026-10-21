import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
process.env.TZ='Asia/Ho_Chi_Minh';
const html=fs.readFileSync('web/index.html','utf8');class FixedDate extends Date{constructor(...args){super(...(args.length?args:['2026-10-17T06:10:00Z']))}}
const parent={children:[],append(item){this.children.push(item)}};const content={parentElement:parent};
const context=vm.createContext({Date:FixedDate,document:{createElement:()=>({})},content});vm.runInContext(html.slice(html.indexOf('function stampMessage('),html.indexOf('function normalizeAssistantText(')),context);
vm.runInContext('stampMessage(content,undefined)',context);assert.equal(parent.children.length,0,'Old messages must not get fabricated timestamps');
context.sentAt=Date.parse('2026-10-17T06:05:00Z');vm.runInContext('stampMessage(content,sentAt)',context);assert.equal(content.timeElement.textContent,'13:05');assert.equal(content.timeElement.dateTime,'2026-10-17T06:05:00.000Z');assert.ok(content.timeElement.title.includes('2026'));
context.sentAt=Date.parse('2026-10-16T02:15:00Z');vm.runInContext('stampMessage(content,sentAt)',context);assert.match(content.timeElement.textContent,/16\/10\/2026 · 09:15/);assert.equal(parent.children.length,1,'Update existing time element instead of duplicating it');
console.log('PASS: local Vietnamese time, date for prior days, stable ISO timestamp, no invented times for old history');
