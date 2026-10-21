import assert from 'node:assert/strict';
import { collectConversationText } from '../dist/protocol/conversation.protocol.js';
const backend={async *streamConversation(){for(const text of ['Xin chào bạn','Xin chào!']) yield JSON.stringify({message:{author:{role:'assistant'},content:{parts:[text]}}});}};
assert.equal(await collectConversationText(backend,[]),'Xin chào!');
console.log('PASS: replacement snapshots do not repeat the answer');

const variants=[{message:{author:{role:'assistant'},content:'Direct text'}},{message:{author:{role:'assistant'},content:{parts:[{type:'text',text:'Structured text'}]}}},{p:'/message/content/parts',o:'replace',v:['Parts snapshot']},{p:'/message/content',o:'replace',v:{text:'Content snapshot'}},{p:'/message',o:'replace',v:{author:{role:'assistant'},content:{parts:['Message snapshot']}}}];
for(const [i,event] of variants.entries()){const upstream={async *streamConversation(){yield JSON.stringify(event)}};assert.equal(await collectConversationText(upstream,[]),['Direct text','Structured text','Parts snapshot','Content snapshot','Message snapshot'][i]);}
console.log('PASS: direct/structured content and full message/content/parts patches do not produce false empty responses');
