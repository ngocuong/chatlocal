import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {execFileSync} from 'node:child_process';
import {gitPreview,commitLocal,pushLocal} from '../dist/services/local-git.service.js';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'local-git-test-'));const repo=path.join(root,'repo'),remote=path.join(root,'remote.git');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
try{
 git('init','--bare','-q',remote);git('init','-q','-b','main',repo);git('-C',repo,'config','user.name','Test');git('-C',repo,'config','user.email','test@example.invalid');
 git('-C',repo,'remote','add','origin','https://github.com/test/fixture.git');git('-C',repo,'config',`url.${remote}.insteadOf`,'https://github.com/test/fixture.git');
 fs.writeFileSync(path.join(repo,'hello.txt'),'before');git('-C',repo,'add','.');git('-C',repo,'commit','-qm','initial');
 // URL rewriting is private test transport. Keep the configured origin URL for validation.
 git('-C',repo,'config','--unset-all',`url.${remote}.insteadOf`);
 fs.writeFileSync(path.join(repo,'hello.txt'),'after');let preview=await gitPreview(repo);
 fs.writeFileSync(path.join(repo,'hello.txt'),'changed again');await assert.rejects(commitLocal(repo,preview.snapshot,'test'),/Code đã thay đổi/);
 preview=await gitPreview(repo);const result=await commitLocal(repo,preview.snapshot,'test edit');assert.ok(result.branch.startsWith('local-chat/'));assert.equal((await gitPreview(repo)).hasChanges,false);
 await assert.rejects(pushLocal(repo,'bad',result.branch),/commit đã đổi/);
 // Exercise actual push without touching GitHub by installing a temporary global URL rewrite.
 const isolatedConfig=path.join(root,'gitconfig');fs.writeFileSync(isolatedConfig,`[url "${remote}"]\n insteadOf = https://github.com/test/fixture.git\n`);process.env.GIT_CONFIG_GLOBAL=isolatedConfig;
 // get-url expands rewrites; use local service git shim to expose the configured URL only to get-url.
 const bin=path.join(root,'bin');fs.mkdirSync(bin);const real=git('--exec-path');
 const gitBinary=execFileSync('which',['git'],{encoding:'utf8'}).trim();
 fs.writeFileSync(path.join(bin,'git'),`#!/bin/sh\ncase "$*" in *"remote get-url origin"*) echo https://github.com/test/fixture.git ;; *) exec "${gitBinary}" "$@" ;; esac\n`,{mode:0o755});process.env.PATH=bin+path.delimiter+process.env.PATH;
 const pushed=await pushLocal(repo,result.head,result.branch);assert.equal(git('--git-dir',remote,'rev-parse','refs/heads/'+pushed.branch).trim(),result.head);
 console.log('PASS: stale diff rejected, branch commit, stale push rejected, push to local test remote');
}finally{fs.rmSync(root,{recursive:true,force:true});}
