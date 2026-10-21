import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import sharp from 'sharp';
import {saveArtifact,imageArtifact} from '../dist/services/chat-artifacts.service.js';
const chat='face-reference-'+Date.now();const bytes=await sharp({create:{width:20,height:20,channels:3,background:'red'}}).png().toBuffer();const base=saveArtifact(chat,'scene.png','image/png',bytes),reference=saveArtifact(chat,'face.png','image/png',bytes);
try{
 await assert.rejects(imageArtifact(chat,{kind:'edit',attachment:base.id,referenceAttachment:base.id,prompt:'Replace face'}),/hai ảnh khác nhau/);
 await assert.rejects(imageArtifact('other-chat',{kind:'edit',attachment:base.id,referenceAttachment:reference.id,prompt:'Replace face'}),/chat khác/);
 console.log('PASS: base and reference must be different images and belong to this chat; both checks run before any generation');
}finally{for(const a of [base,reference])fs.rmSync(path.resolve('data/chat-artifacts',a.id),{recursive:true,force:true})}
