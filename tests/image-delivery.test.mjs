import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import Fastify from 'fastify';import sharp from 'sharp';import {localRoutes} from '../dist/api/routes/local.route.js';import {saveArtifact,readArtifact,verifyImageOutput} from '../dist/services/chat-artifacts.service.js';
const app=Fastify();await app.register(localRoutes);const headers={host:'localhost:3040',origin:'http://localhost:3040'};const chat='delivery-'+Date.now(),bytes=await sharp({create:{width:16,height:16,channels:3,background:'blue'}}).png().toBuffer(),a=saveArtifact(chat,'output.png','image/png',bytes);
try{
 await verifyImageOutput(bytes);await assert.rejects(verifyImageOutput(Buffer.from('not an image')),/chưa lưu tệp/);
 assert.equal(readArtifact(a.id,chat).record.delivery,undefined);
 for(const status of ['failed','loaded']){const r=await app.inject({method:'POST',url:'/local-artifact-delivery',headers,payload:{chat,id:a.id,status}});assert.equal(r.statusCode,200);assert.equal(readArtifact(a.id,chat).record.delivery,status);}
 const other=await app.inject({method:'POST',url:'/local-artifact-delivery',headers,payload:{chat:'other',id:a.id,status:'loaded'}});assert.ok(other.statusCode>=400);
 const fetched=await app.inject({method:'GET',url:a.url+'&inline=1',headers});assert.equal(fetched.statusCode,200);assert.deepEqual(fetched.rawPayload,bytes);
 console.log('PASS: valid pixels verified, invalid image rejected, saved differs from browser-loaded, failure can recover, delivery scoped, exact file served');
}finally{await app.close();fs.rmSync(path.resolve('data/chat-artifacts',a.id),{recursive:true,force:true})}
