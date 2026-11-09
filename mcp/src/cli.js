#!/usr/bin/env node
import path from 'node:path';
import {createClient} from './client.js';
import {importTasks} from './task_import.js';
import {runListingBatch} from './pipeline/batch.js';
const args=process.argv.slice(2),opts={};
const valued=new Set(['file','materials','data-dir','timeout-ms','concurrency','product-concurrency']);
try{
 for(let i=0;i<args.length;i++){const k=args[i].replace(/^--/,'');if(valued.has(k)){if(!args[i+1]||args[i+1].startsWith('--'))throw new Error('Missing --'+k+' value');opts[k]=args[++i];}else if(['apply','confirm-publish','help'].includes(k))opts[k]=true;else throw new Error('Unknown option: '+args[i]);}
 if(opts.help||!opts.file){console.log('Usage: node scripts/launch.mjs listing --file tasks.json [--materials DIR] [--apply] [--confirm-publish] [--data-dir DIR] [--product-concurrency 8] [--concurrency 3] [--timeout-ms 180000]\n默认预览。--apply 执行草稿；任务 publish=true 还需要 --confirm-publish。商品并发默认8、保护上限8（固定分批：≤8一批全开，>8按8、8、余数；上一批完成才启动下一批；显式更低时同为固定分批大小）；--concurrency 是整批共享的图片上传并发，默认3、上限4。失败停发并保留回执，按原任务 ID 续跑。');process.exitCode=opts.help?0:2;}
 else{
  const tasks=await importTasks(path.resolve(opts.file),{materialsRoot:opts.materials});
  const client=createClient(),controller=new AbortController();
  const cancel=()=>controller.abort(new Error('用户取消，保留已有回执；续跑不要修改任务 ID'));
  process.once('SIGINT',cancel);process.once('SIGTERM',cancel);
  try{
   const out=await runListingBatch(client,tasks,{dataDir:opts['data-dir'],dryRun:!opts.apply,confirmPublish:!!opts['confirm-publish'],timeoutMs:opts['timeout-ms']===undefined?undefined:Number(opts['timeout-ms']),productConcurrency:opts['product-concurrency']===undefined?undefined:Number(opts['product-concurrency']),uploadConcurrency:opts.concurrency===undefined?undefined:Number(opts.concurrency),signal:controller.signal,onProgress:p=>console.error(JSON.stringify(p)),onResult:r=>console.log(JSON.stringify({type:'task-result',...r}))});
   console.log(JSON.stringify({type:'batch-summary',...out,results:undefined}));if(!out.ok)process.exitCode=out.cancelled?130:1;
  }finally{process.removeListener('SIGINT',cancel);process.removeListener('SIGTERM',cancel);}
 }
}catch(e){console.error(JSON.stringify({ok:false,error:e.message}));process.exitCode=1;}
