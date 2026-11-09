#!/usr/bin/env node
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {upsellerLogin} from '../mcp/src/tools/login.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
function flag(name){const i=args.indexOf(name);return i>=0?args[i+1]:undefined;}
const timeoutMs=flag('--timeout-ms')?Number(flag('--timeout-ms')):undefined;
const envPath=flag('--env')||path.join(root,'mcp','.env');
try{
  const out=await upsellerLogin({timeoutMs,envPath,headless:false});
  process.stdout.write(JSON.stringify(out,null,2)+'\n');
  if(!out.ok)process.exitCode=1;
}catch(e){
  process.stderr.write(String(e.message||e)+'\n');
  process.exitCode=1;
}
