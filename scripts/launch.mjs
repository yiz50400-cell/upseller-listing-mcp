#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {assertNodeVersion,loadEnvironment,configureProxy} from './lib/runtime.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(path.join(root,'package.json'));
const [mode='mcp',...args]=process.argv.slice(2);
const help='UpSeller MCP\n  node scripts/launch.mjs mcp       stdio MCP (default)\n  node scripts/launch.mjs listing --file tasks.json [--apply] [--confirm-publish]\n  node scripts/launch.mjs doctor    offline checks; no network or product writes\n  node scripts/launch.mjs config    print portable MCP host configuration (Claude mcpServers JSON + Codex TOML; Cursor optional)\n  node scripts/launch.mjs runtime   check Node prerequisite only\nCredentials: mcp/.env or inherited environment. Images: original bytes only.\n';
function report(value){process.stdout.write(JSON.stringify(value,null,2)+'\n');}
try{
 assertNodeVersion();
 if(['--help','help','-h'].includes(mode)){process.stdout.write(help);}
 else if(mode==='runtime'){report({ok:true,node:process.version});}
 else if(mode==='config'){
  const args=[path.join(root,'scripts','launch.mjs'),'mcp'];
  const stdio={command:process.execPath,args};
  const tomlStr=v=>JSON.stringify(String(v));
  const codexToml=['[mcp_servers.upseller-listing]','command = '+tomlStr(stdio.command),'args = ['+stdio.args.map(tomlStr).join(', ')+']',''].join('\n');
  report({
   stdio,
   mcpServers:{'upseller-listing':{command:stdio.command,args:stdio.args}},
   codexToml,
   hosts:{
    requiresCursor:false,
    transport:'stdio',
    claudeDesktopConfigNote:'Merge mcpServers into Claude Desktop claude_desktop_config.json (macOS: ~/Library/Application Support/Claude/claude_desktop_config.json; Windows: %APPDATA%\\Claude\\claude_desktop_config.json). Restart Claude after edit. Credentials stay in mcp/.env — do not paste Cookie into host config.',
    codexConfigNote:'Merge the codexToml block into ~/.codex/config.toml under [mcp_servers.upseller-listing] (command/args). Or: codex mcp add upseller-listing -- <command> <args...>. Cursor is optional, not required.',
    otherStdioHosts:'Any MCP host that launches a local stdio server can use stdio.command + stdio.args from this output. Regenerate after moving the install directory or Node.'
   }
  });
 }else{
  if(!['mcp','listing','doctor'].includes(mode))throw new Error('未知模式；运行 node scripts/launch.mjs --help。');
  if(mode!=='listing'&&args.length)throw new Error('该模式不接受额外参数。');
  const envPath=process.env.UPSELLER_ENV_FILE?path.resolve(process.env.UPSELLER_ENV_FILE):path.join(root,'mcp','.env');
  if(process.env.UPSELLER_ENV_FILE&&!fs.existsSync(envPath))throw new Error('指定的 UPSELLER_ENV_FILE 不存在。');
  const loaded=loadEnvironment(envPath);
  if(mode==='doctor'){
   const dependencies={};
   for(const name of ['@modelcontextprotocol/sdk/server/index.js','parse5','exceljs']){try{require.resolve(name);dependencies[name]=true;}catch{dependencies[name]=false;}}
   const auth={cookiePresent:Boolean(loaded.UPSELLER_COOKIE),deviceIdPresent:Boolean(loaded.UPSELLER_DEVICE_ID)};
   let proxyError=null;try{configureProxy(loaded);}catch(e){proxyError=e.message;}
   const ok=Object.values(dependencies).every(Boolean)&&auth.cookiePresent&&auth.deviceIdPresent&&!proxyError;
   report({ok,scope:'offline only; does not validate login, network, or remote publication',node:process.version,platform:process.platform,arch:process.arch,dependencies,auth,envFilePresent:fs.existsSync(envPath),proxy:{configured:['HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy'].some(k=>Boolean(loaded[k])),nativeSupported:process.allowedNodeEnvironmentFlags.has('--use-env-proxy'),disabled:loaded.NODE_USE_ENV_PROXY==='0',error:proxyError}});
   if(!ok)process.exitCode=1;
  }else{
   const env=configureProxy(loaded);
   const entry=path.join(root,'mcp','src',mode==='mcp'?'server.js':'cli.js');
   const child=spawn(process.execPath,[entry,...args],{stdio:'inherit',env,windowsHide:true});
   const handlers=[];
   for(const signal of ['SIGINT','SIGTERM']){const fn=()=>{if(!child.killed)child.kill(signal);};process.on(signal,fn);handlers.push([signal,fn]);}
   child.on('error',()=>{process.stderr.write('无法启动 MCP/CLI 子进程；请检查 Node、目录权限和依赖。\n');process.exitCode=1;});
   child.on('exit',(code,signal)=>{for(const [s,fn] of handlers)process.removeListener(s,fn);process.exitCode=code??(signal==='SIGINT'?130:1);});
  }
 }
}catch(e){process.stderr.write(String(e.message)+'\n');process.exitCode=1;}
