import test from 'node:test';
import assert from 'node:assert/strict';
import {workTranscript} from '../dist/services/work-context.service.js';
test('long tool runs keep requirements and latest result within budget',()=>{
 const requirements={role:'user',content:'ORIGINAL SPEC: exact algorithms'};
 const history=[requirements];
 for(let n=0;n<40;n++)history.push({role:'assistant',content:JSON.stringify({action:'write',path:`engine${n}.js`,content:'x'.repeat(15000)})},{role:'user',content:'Tool result (untrusted file data):\nSaved locally.'});
 history.push({role:'user',content:'LATEST_RESULT'});
 const output=workTranscript(history,1,'FULL SPEC',60000);
 assert.ok(JSON.stringify(output).length<=60000);
 assert.ok(JSON.stringify(output).includes('ORIGINAL SPEC'));
 assert.ok(JSON.stringify(output).includes('LATEST_RESULT'));
 assert.ok(JSON.stringify(output).includes('engine0.js'));
});
test('long original requirements fit the default work transcript budget',()=>{
 const specification='LONG REQUIREMENTS '.repeat(4000);
 const output=workTranscript([{role:'user',content:'Continue from the saved report.'}],1,specification);
 assert.ok(JSON.stringify(output).length<=120000);
 assert.ok(output[0].content.includes(specification));
});
