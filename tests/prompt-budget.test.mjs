import assert from 'node:assert/strict';import {boundedHistory,replaceUniqueText} from '../dist/services/prompt-budget.service.js';
const messages=Array.from({length:30},(_,i)=>({role:i%2?'assistant':'user',content:'a'.repeat(6000),index:i}));messages.push({role:'user',content:'Chỉ sửa hàm submit, giữ những phần khác.',index:30});
const result=boundedHistory(messages);assert.ok(JSON.stringify(result).length<=12000);assert.deepEqual(result.at(-1),messages.at(-1));assert.equal(result.length,messages.length);assert.deepEqual(result.map(m=>m.index),messages.map(m=>m.index));assert.equal(messages[0].content.length,6000);
assert.throws(()=>boundedHistory([{role:'user',content:'x'.repeat(60000)}]),/đính kèm/);
assert.equal(replaceUniqueText('head\nold\ntail','old','new'),'head\nnew\ntail');assert.throws(()=>replaceUniqueText('old old','old','new'),/duy nhất/);assert.throws(()=>replaceUniqueText('different','old','new'),/duy nhất/);
console.log('PASS: bounded history preserves latest request and planner indices; originals untouched; exact patches preserve surrounding text and reject stale/ambiguous edits');
