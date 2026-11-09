import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tests=fs.readdirSync(path.join(root,'mcp/test')).filter(f=>f.endsWith('.test.js')).sort().map(f=>path.join(root,'mcp/test',f));
const r=spawnSync(process.execPath,['--test',...tests],{cwd:root,stdio:'inherit'});process.exitCode=r.status??1;
