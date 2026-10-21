import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';
import {gitPreview,commitLocal,pushLocal} from '../dist/services/local-git.service.js';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'empty-repo-'));
const git=(...args)=>execFileSync('git',['-C',root,...args],{encoding:'utf8',stdio:'pipe'});
try{
 git('init','-q','-b','main');git('config','user.name','Test');git('config','user.email','test@example.invalid');git('remote','add','origin','https://github.com/test/fixture.git');
 let preview=await gitPreview(root);assert.equal(preview.head,'');assert.equal(preview.hasChanges,false);
 await assert.rejects(pushLocal(root,'','main'),/commit/);
 fs.writeFileSync(path.join(root,'README.md'),'hello');preview=await gitPreview(root);assert.match(preview.diff,/hello/);
 fs.writeFileSync(path.join(root,'README.md'),'updated');await assert.rejects(commitLocal(root,preview.snapshot,'first'),/Code đã thay đổi/);
 preview=await gitPreview(root);const committed=await commitLocal(root,preview.snapshot,'first');assert.match(committed.branch,/^local-chat\//);assert.equal((await gitPreview(root)).hasChanges,false);
 console.log('PASS: empty repo preview, stale first commit rejected, first commit on local-chat branch');
}finally{fs.rmSync(root,{recursive:true,force:true});}
