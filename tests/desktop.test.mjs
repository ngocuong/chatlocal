import assert from 'node:assert/strict';import {DesktopController} from '../dist/services/desktop.service.js';
const calls=[];const controller=new DesktopController(async request=>{calls.push(request);if(request.action==='status')return {accessibility:true};if(request.action==='observe')return {app:'Test App',bundle:request.bundle,elements:[{id:0,description:'AXButton Save'}]};return {ok:true}});
await assert.rejects(controller.observe('chat-a'),/tắt/);await controller.enable('chat-a','test.app');await controller.observe('chat-a');let proposal=controller.propose('chat-a',{kind:'click',element:0});assert.equal(calls.filter(r=>r.approved).length,0);
await assert.rejects(controller.execute('chat-b',proposal.id),/hết hiệu lực/);await controller.execute('chat-a',proposal.id);assert.equal(calls.at(-1).bundle,'test.app');assert.equal(calls.at(-1).expected,'AXButton Save');await assert.rejects(controller.execute('chat-a',proposal.id),/hết hiệu lực/);
proposal=controller.propose('chat-a',{kind:'key',key:'enter'});controller.stop('chat-a');await assert.rejects(controller.execute('chat-a',proposal.id),/hết hiệu lực/);
const denied=new DesktopController(async()=>({accessibility:false}));await assert.rejects(denied.enable('chat-a','test.app'),/Trợ năng/);
console.log('PASS: actions require proposal and confirmation; per-chat binding; single use; stop cancels; permissions enforced');
