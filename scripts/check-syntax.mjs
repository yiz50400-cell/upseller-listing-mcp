import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');let n=0;
function check(p){const r=spawnSync(process.execPath,['--check',p],{encoding:'utf8'});if(r.status!==0){console.error(r.stderr);process.exit(1);}n++;}
function walk(root){for(const f of fs.readdirSync(root,{withFileTypes:true})){const p=path.join(root,f.name);if(f.isDirectory())walk(p);else if(/\.(cjs|mjs|js)$/.test(p))check(p);}}
for(const p of ['mcp/src','scripts/lib'])walk(path.join(base,p));
for(const p of ['scripts/launch.mjs','scripts/test.mjs','scripts/build-mcp-release.mjs','scripts/pack-mcp-zip.mjs','scripts/login-upseller.mjs'])check(path.join(base,p));
console.log(n+' JavaScript files parsed successfully');
