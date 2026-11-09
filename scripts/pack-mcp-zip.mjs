#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const release=path.resolve(process.argv[2]||path.join(root,'releases','upseller-mcp-'+JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version));
const zipPath=path.resolve(process.argv[3]||release+'.zip');

function fail(msg){process.stderr.write(msg+'\n');process.exitCode=1;}

try{
 if(!fs.existsSync(release)||!fs.statSync(release).isDirectory())throw new Error('Release directory not found: '+release);
 const manifestPath=path.join(release,'MANIFEST.json');
 if(!fs.existsSync(manifestPath))throw new Error('MANIFEST.json missing in release directory');
 const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 if(!Array.isArray(manifest.files)||manifest.files.length<1)throw new Error('MANIFEST.json has no files');
 const names=[];
 for(const entry of manifest.files){
  if(!entry?.path||typeof entry.path!=='string')throw new Error('Invalid MANIFEST entry');
  if(/(^|\/)\.env$/.test(entry.path))throw new Error('Refusing to pack credential file: '+entry.path);
  if(entry.path==='MANIFEST.json')continue;
  const full=path.join(release,entry.path);
  if(!fs.existsSync(full)||!fs.statSync(full).isFile())throw new Error('Missing release file: '+entry.path);
  if(fs.lstatSync(full).isSymbolicLink())throw new Error('Refusing symbolic link: '+entry.path);
  const sha=crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
  if(sha!==entry.sha256)throw new Error('MANIFEST sha256 mismatch: '+entry.path);
  names.push(entry.path);
 }
 names.push('MANIFEST.json');
 names.sort();
 if(fs.existsSync(zipPath))throw new Error('Zip already exists; choose a new path: '+zipPath);
 const staging=zipPath+'.partial-'+process.pid+'.zip';
 if(fs.existsSync(staging))fs.rmSync(staging);
 const z=spawnSync('zip',['-r','-X',staging,...names],{cwd:release,encoding:'utf8'});
 if(z.status!==0)throw new Error('zip failed: '+(z.stderr||z.stdout||'unknown'));
 fs.renameSync(staging,zipPath);
 const sha256=crypto.createHash('sha256').update(fs.readFileSync(zipPath)).digest('hex');
 fs.writeFileSync(zipPath+'.sha256',sha256+'  '+path.basename(zipPath)+'\n');
 process.stdout.write(JSON.stringify({ok:true,release,zip:zipPath,fileCount:names.length,sha256,credentialsIncluded:false,manifestVersion:manifest.version})+'\n');
}catch(e){
 try{const staging=zipPath+'.partial-'+process.pid+'.zip';if(fs.existsSync(staging))fs.rmSync(staging);}catch{}
 fail(e.message||String(e));
}
