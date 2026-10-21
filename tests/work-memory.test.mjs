import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {WorkMemoryStore,workSystemPrompt} from '../dist/services/work-memory.service.js';
test('memory survives restart, isolates chat/repo, detects external edits, and separates new goals',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'work-memory-')),repo=path.join(root,'repo');fs.mkdirSync(repo);const file=path.join(repo,'app.js');fs.writeFileSync(file,'first');
 try{
  const store=new WorkMemoryStore(path.join(root,'states'));
  const state=store.begin('chat-a',repo,'CURRENT GOAL','EXACT SPEC','latest');
  store.record(state,'write','app.js','saved',{full:file,relative:'app.js'});
  store.checkpoint(state,{nextStep:'Wire browser bundle',remaining:['Run browser test'],notes:'Node test alone is insufficient'});
  store.finish(state,'interrupted');
  const restarted=new WorkMemoryStore(path.join(root,'states'));
  const restored=restarted.load('chat-a',repo);assert.equal(restored.nextStep,'Wire browser bundle');assert.equal(restored.status,'interrupted');
  assert.equal(restarted.load('chat-b',repo),undefined);assert.equal(restarted.load('chat-a',root),undefined);
  fs.writeFileSync(file,'external edit');assert.equal(JSON.parse(restarted.context(restored)).files[0].current,false);
  const resumed=restarted.begin('chat-a',repo,'ignored replacement','EXACT SPEC plus latest','continue',true);assert.equal(resumed.id,state.id);assert.equal(resumed.goal,'CURRENT GOAL');
  const next=restarted.begin('chat-a',repo,'NEW GOAL','NEW SPEC','new goal',false);assert.notEqual(next.id,state.id);assert.equal(next.events.length,0);assert.equal(next.nextStep.includes('Inspect'),true);
  assert.match(workSystemPrompt,/Historical goals/);assert.match(workSystemPrompt,/no fixed tool-step/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
