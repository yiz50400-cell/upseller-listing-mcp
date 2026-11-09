import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {upsellerUploadMedia} from '../src/tools/upload_media.js';
import {runListing} from '../src/pipeline/runner.js';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const suffix of ['.png','.jpg'])test('original '+suffix+' upload preserves exact bytes, format and local file',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'original-upload-'));
 try{const file=path.join(root,'原图 test'+suffix),original=Buffer.concat([Buffer.from(suffix==='\.png'?[137,80,78,71,13,10,26,10]:[255,216,255,224]),Buffer.from(Array.from({length:1024},(_,i)=>i%256))]);fs.writeFileSync(file,original);
 const calls=[];let uploaded;
 const client={postJson:async(endpoint,body)=>{calls.push({endpoint,body});return{ok:true,status:200,json:{code:0,data:endpoint.includes('generate-sign')?{fileKey:'original-file',sign:'https://upload.example/object',url:'https://cdn.example/original'+suffix}:{id:'upload-receipt'}}};},putBinary:async(url,bytes,contentType)=>{uploaded=Buffer.from(bytes);assert.equal(contentType,'omit');return{ok:true,status:200};}};
 const result=await upsellerUploadMedia(client,{filePath:file,dryRun:false});assert.equal(digest(uploaded),digest(original));assert.deepEqual(uploaded,original);assert.deepEqual(fs.readFileSync(file),original);assert.equal(calls[0].body.suffix,suffix);assert.equal(calls[0].body.fileName,path.basename(file));assert.equal(result.size,original.length);assert.equal(calls[1].body.size,original.length);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('continuous MCP rejects the withdrawn image optimization option before network activity',async()=>{
 let calls=0;const client={get:async()=>{calls++;throw new Error('network must not be called');}};
 await assert.rejects(runListing(client,{taskId:'original-only',sourceInternalId:'123',targetShopId:'456',images:[],optimizeImages:true},{dryRun:false}),/原图/);assert.equal(calls,0);
});
