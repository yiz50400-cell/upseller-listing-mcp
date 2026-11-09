import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
let runtime;try{runtime=await import('../../scripts/lib/runtime.mjs');}catch{}
test('runtime accepts the supported Node floor and refuses older runtimes',()=>{assert.ok(runtime,'deployment runtime module must exist');assert.doesNotThrow(()=>runtime.assertNodeVersion('22.12.0'));assert.doesNotThrow(()=>runtime.assertNodeVersion('26.8.1'));assert.throws(()=>runtime.assertNodeVersion('22.11.0'),/22.12/);assert.throws(()=>runtime.assertNodeVersion('20.20.0'),/22.12/);});
test('environment loading preserves caller values and ignores unrelated executable settings',()=>{assert.ok(runtime);const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mcp-env-'));try{const f=path.join(dir,'配置 file.env');fs.writeFileSync(f,'UPSELLER_COOKIE="file-cookie"\nUPSELLER_DEVICE_ID="device"\nNODE_OPTIONS="--require malicious.js"\n');const env=runtime.loadEnvironment(f,{UPSELLER_COOKIE:'existing',PATH:'safe'});assert.equal(env.UPSELLER_COOKIE,'existing');assert.equal(env.UPSELLER_DEVICE_ID,'device');assert.equal(env.NODE_OPTIONS,undefined);assert.equal(env.PATH,'safe');assert.equal(runtime.loadEnvironment(f,{UPSELLER_COOKIE:''}).UPSELLER_COOKIE,'');}finally{fs.rmSync(dir,{recursive:true,force:true});}});
test('launcher help does not need authentication or perform business operations',()=>{const r=spawnSync(process.execPath,['scripts/launch.mjs','--help'],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/mcp.*listing.*doctor/s);assert.ok(!r.stdout.includes('file-cookie'));});
test('explicit proxy settings fail closed on unsupported runtimes and do not leak credentials',()=>{
 assert.ok(runtime);assert.deepEqual(runtime.configureProxy({PATH:'safe'},false),{PATH:'safe'});
 assert.equal(runtime.configureProxy({HTTPS_PROXY:'http://127.0.0.1:7897'},true).NODE_USE_ENV_PROXY,'1');
 assert.equal(runtime.configureProxy({HTTPS_PROXY:'http://127.0.0.1:7897',NODE_USE_ENV_PROXY:'0'},false).NODE_USE_ENV_PROXY,'0');
 assert.throws(()=>runtime.configureProxy({HTTPS_PROXY:'http://user:private@127.0.0.1:7897'},false),e=>/proxy|代理/i.test(e.message)&&!e.message.includes('private'));
});
test('generated MCP configuration uses absolute paths and contains no credentials',()=>{
 const r=spawnSync(process.execPath,['scripts/launch.mjs','config'],{encoding:'utf8',env:{...process.env,UPSELLER_COOKIE:'SECRET_SENTINEL',UPSELLER_DEVICE_ID:'PRIVATE_SENTINEL'}});
 assert.equal(r.status,0,r.stderr);const cfg=JSON.parse(r.stdout).mcpServers['upseller-listing'];
 assert.equal(cfg.command,process.execPath);assert.ok(path.isAbsolute(cfg.args[0]));assert.equal(cfg.args[1],'mcp');assert.ok(!r.stdout.includes('SENTINEL'));
});
test('offline doctor reports presence not values and fails for missing authentication',()=>{
 const r=spawnSync(process.execPath,['scripts/launch.mjs','doctor'],{encoding:'utf8',env:{...process.env,UPSELLER_COOKIE:'',UPSELLER_DEVICE_ID:'PRIVATE_SENTINEL',NODE_USE_ENV_PROXY:'0'}});
 assert.equal(r.status,1);const d=JSON.parse(r.stdout);assert.equal(d.ok,false);assert.equal(d.auth.cookiePresent,false);assert.equal(d.auth.deviceIdPresent,true);assert.ok(!r.stdout.includes('SENTINEL'));
});
test('MCP launcher keeps stdio clean even when installed in a Unicode directory with spaces',async()=>{
 const {Client}=await import('@modelcontextprotocol/sdk/client/index.js');const {StdioClientTransport}=await import('@modelcontextprotocol/sdk/client/stdio.js');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'商品 MCP '));
 try{
  fs.cpSync('scripts',path.join(dir,'scripts'),{recursive:true});fs.cpSync('mcp/src',path.join(dir,'mcp/src'),{recursive:true});fs.copyFileSync('package.json',path.join(dir,'package.json'));
  fs.symlinkSync(path.resolve('node_modules'),path.join(dir,'node_modules'),process.platform==='win32'?'junction':'dir');
  const transport=new StdioClientTransport({command:process.execPath,args:[path.join(dir,'scripts/launch.mjs'),'mcp'],env:{PATH:process.env.PATH,UPSELLER_COOKIE:'',UPSELLER_DEVICE_ID:'',NODE_USE_ENV_PROXY:'0'},stderr:'pipe'});
  const client=new Client({name:'portable-launch-smoke',version:'1.0'},{capabilities:{}});
  try{await client.connect(transport);const list=await client.listTools();assert.equal(list.tools.length,7);const r=await client.callTool({name:'upseller_get_draft',arguments:{draftId:'1'}});assert.equal(r.isError,true);assert.match(r.content[0].text,/Missing Cookie/);}finally{await client.close();}
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('release builder exports only allowlisted files with matching checksums',async()=>{
 const {createHash}=await import('node:crypto');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'MCP release ')),out=path.join(dir,'交付 包');
 try{
  const r=spawnSync(process.execPath,['scripts/build-mcp-release.mjs',out],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
  const manifest=JSON.parse(fs.readFileSync(path.join(out,'MANIFEST.json'),'utf8'));
  assert.ok(manifest.files.length>20);
  for(const f of manifest.files){assert.ok(!/(^|\/)(artifacts|desktop|node_modules|tasks)(\/|$)/.test(f.path));assert.ok(!f.path.endsWith('/.env'));assert.equal(createHash('sha256').update(fs.readFileSync(path.join(out,f.path))).digest('hex'),f.sha256);}
  assert.ok(fs.existsSync(path.join(out,'mcp/.env.example')));assert.ok(!fs.existsSync(path.join(out,'mcp/.env')));
  const again=spawnSync(process.execPath,['scripts/build-mcp-release.mjs',out],{encoding:'utf8'});assert.notEqual(again.status,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test('config emits portable stdio for Claude-style JSON and Codex TOML without credentials or Cursor lock-in',()=>{
 const r=spawnSync(process.execPath,['scripts/launch.mjs','config'],{encoding:'utf8',env:{...process.env,UPSELLER_COOKIE:'SECRET_SENTINEL',UPSELLER_DEVICE_ID:'PRIVATE_SENTINEL'}});
 assert.equal(r.status,0,r.stderr);const out=JSON.parse(r.stdout);
 assert.equal(out.mcpServers['upseller-listing'].command,process.execPath);
 assert.ok(path.isAbsolute(out.mcpServers['upseller-listing'].args[0]));
 assert.equal(out.stdio.command,process.execPath);
 assert.deepEqual(out.stdio.args,out.mcpServers['upseller-listing'].args);
 assert.match(out.codexToml,/\[mcp_servers\.upseller-listing\]/);
 assert.match(out.codexToml,/command\s*=/);
 assert.match(out.codexToml,/args\s*=/);
 assert.equal(out.hosts.requiresCursor,false);
 assert.match(out.hosts.claudeDesktopConfigNote,/claude_desktop_config|Claude/i);
 assert.match(out.hosts.codexConfigNote,/config\.toml|Codex/i);
 assert.ok(!r.stdout.includes('SENTINEL'));
 assert.ok(!/Cursor 必|必须使用 Cursor|requires Cursor/i.test(r.stdout));
});

test('delivery guide documents Windows and macOS install start config doctor troubleshooting and non-Cursor MCP hosts',()=>{
 const doc=fs.readFileSync('docs/MCP-DELIVERY.md','utf8');
 assert.match(doc,/##\s*Windows/);
 assert.match(doc,/##\s*macOS/);
 assert.match(doc,/install-mcp\.cmd/);
 assert.match(doc,/install-mcp\.sh/);
 assert.match(doc,/run-mcp\.cmd|scripts\\\\run-mcp\.cmd/);
 assert.match(doc,/run-mcp\.sh/);
 assert.match(doc,/launch\.mjs config|scripts\/launch\.mjs config/);
 assert.match(doc,/doctor|check-mcp/);
 assert.match(doc,/排错|故障/);
 assert.match(doc,/Codex/);
 assert.match(doc,/Claude/);
 assert.match(doc,/mcp_servers/);
 assert.match(doc,/不依赖.*Cursor|不必使用 Cursor|非强制 Cursor|不要求 Cursor/i);
 assert.ok(!/必须安装 Cursor|只能用 Cursor/.test(doc));
 assert.match(doc,/客户.*本机.*凭据|各自.*凭据|UPSELLER_COOKIE/);
});

test('zip packer builds a whitelist-only archive matching MANIFEST without credentials or env files',async()=>{
 const {createHash}=await import('node:crypto');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mcp-zip-'));
 const release=path.join(dir,'upseller-mcp-fixture');
 const zipPath=path.join(dir,'upseller-mcp-fixture.zip');
 try{
  // minimal release tree
  fs.mkdirSync(path.join(release,'scripts'),{recursive:true});
  fs.mkdirSync(path.join(release,'mcp'),{recursive:true});
  fs.writeFileSync(path.join(release,'package.json'),'{"name":"upseller-listing-toolkit","version":"0.3.0"}\n');
  fs.writeFileSync(path.join(release,'mcp/.env.example'),'UPSELLER_COOKIE=""\n');
  fs.writeFileSync(path.join(release,'scripts/launch.mjs'),'console.log(1)\n');
  fs.writeFileSync(path.join(release,'secret.env'),'UPSELLER_COOKIE=leak\n'); // must NOT be packed even if present beside tree? packer only packs MANIFEST list
  const files=['package.json','mcp/.env.example','scripts/launch.mjs'];
  const manifest={name:'upseller-listing-mcp',version:'0.3.0',createdAt:new Date().toISOString(),files:files.map(f=>({path:f,sha256:createHash('sha256').update(fs.readFileSync(path.join(release,f))).digest('hex')}))};
  fs.writeFileSync(path.join(release,'MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n');
  const r=spawnSync(process.execPath,['scripts/pack-mcp-zip.mjs',release,zipPath],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr+r.stdout);
  assert.ok(fs.existsSync(zipPath));
  const listed=spawnSync('zipinfo',['-1',zipPath],{encoding:'utf8'});
  assert.equal(listed.status,0,listed.stderr);
  const names=listed.stdout.trim().split(/\n/).filter(Boolean).map(n=>n.replace(/\/$/,'')).sort();
  assert.deepEqual(names,[...files,'MANIFEST.json'].sort());
  assert.ok(!names.some(n=>n.endsWith('.env')&&!n.endsWith('.env.example')));
  assert.ok(!names.includes('secret.env'));
  const summary=JSON.parse(r.stdout);
  assert.equal(summary.ok,true);
  assert.equal(summary.credentialsIncluded,false);
  assert.ok(summary.sha256);
  assert.equal(summary.sha256,createHash('sha256').update(fs.readFileSync(zipPath)).digest('hex'));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
