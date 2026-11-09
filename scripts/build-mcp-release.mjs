import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
const output=path.resolve(process.argv[2]||path.join(root,'releases','upseller-mcp-'+version));
const include=['package.json','package-lock.json','mcp/src','mcp/README.md','mcp/.env.example','docs/MCP-DELIVERY.md','docs/BATCH-CAPACITY.md','scripts/lib','scripts/launch.mjs','scripts/check-syntax.mjs','scripts/test.mjs','scripts/build-mcp-release.mjs','scripts/pack-mcp-zip.mjs',...['run-mcp','listing','check-mcp','install-mcp','login-upseller'].flatMap(n=>['scripts/'+n+'.sh','scripts/'+n+'.cmd']), 'scripts/login-upseller.mjs',...['deployment','client-reliability','original-image-upload','mcp-smoke','batch-tool','coordinator','login'].map(n=>'mcp/test/'+n+'.test.js')];
const files=[];
function collect(relative){const full=path.join(root,relative),st=fs.lstatSync(full);if(st.isSymbolicLink())throw new Error('Refusing symbolic link: '+relative);if(st.isDirectory())for(const entry of fs.readdirSync(full).sort())collect(relative+'/'+entry);else if(st.isFile())files.push(relative);else throw new Error('Unsupported release entry');}
try{
 if(fs.existsSync(output))throw new Error('Release directory already exists; choose a new directory.');
 for(const entry of include)collect(entry);
 const staging=output+'.partial-'+process.pid;if(fs.existsSync(staging))throw new Error('Staging directory already exists.');fs.mkdirSync(staging,{recursive:true});
 try{
  for(const file of files){const dest=path.join(staging,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,file),dest);if(file.endsWith('.sh'))fs.chmodSync(dest,0o755);}
  fs.copyFileSync(path.join(root,'docs/MCP-DELIVERY.md'),path.join(staging,'README.md'));files.push('README.md');
  const manifest={name:'upseller-listing-mcp',version,createdAt:new Date().toISOString(),files:files.sort().map(file=>({path:file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(staging,file))).digest('hex')}))};
  fs.writeFileSync(path.join(staging,'MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n');fs.renameSync(staging,output);
  console.log(JSON.stringify({ok:true,output,fileCount:files.length,credentialsIncluded:false}));
 }catch(e){fs.rmSync(staging,{recursive:true,force:true});throw e;}
}catch(e){console.error(e.message);process.exitCode=1;}
