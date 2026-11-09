import {performance} from 'node:perf_hooks';
import {runListing} from './runner.js';
import {resolveTask} from '../task_resolver.js';
import {createBatchCoordinator,validateLimit} from './coordinator.js';
/** Runs normalized tasks in fixed-size product batches. A later batch starts only after the previous batch fully settles. Stops new batches/work on the first error; drains already-running work. */
export async function runListingBatch(client,tasks,options={}){
 const started=performance.now();
 const productConcurrency=validateLimit(options.productConcurrency,8,'商品',8);
 const uploadConcurrency=validateLimit(options.uploadConcurrency,3,'图片');
 const timeoutMs=options.timeoutMs===undefined?180000:Number(options.timeoutMs);
 if(!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>300000)throw new Error('单商品 timeoutMs 必须在 1000–300000 之间');
 if(!Array.isArray(tasks)||tasks.length<1||tasks.length>1000)throw new Error('批次必须包含 1–1000 个任务');
 const ids=new Set(),drafts=new Set();
 for(const task of tasks){
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(task.taskId||''))throw new Error('每个任务必须有稳定 taskId');
  if(ids.has(task.taskId))throw new Error('taskId 重复');ids.add(task.taskId);
  if(task.draftId){if(drafts.has(String(task.draftId)))throw new Error('同一批次不能重复编辑同一草稿');drafts.add(String(task.draftId));}
  if(task.publish===true&&options.dryRun===false&&options.confirmPublish!==true)throw new Error('本批次包含发布任务，需要明确确认 confirmPublish=true');
 }
 const coordinator=createBatchCoordinator(uploadConcurrency),results=tasks.map(t=>({ok:false,taskId:t.taskId,stage:'not-started'}));
 let active=0,peak=0;
 const emit=p=>{try{options.onProgress?.({...p,batchElapsedMs:Math.round(performance.now()-started)});}catch{}};
 // Share one scoped client so concurrent shop lookups coalesce.
 const scoped=options.signal&&client.withSignal?client.withSignal(options.signal):client;
 async function runOne(index){
  if(coordinator.stopped||options.signal?.aborted)return;
  const task=tasks[index],begin=performance.now();active++;peak=Math.max(peak,active);
  emit({phase:'task-start',taskId:task.taskId,index,active});
  let result;
  try{
   const resolved=await resolveTask(scoped,task);coordinator.assertRunning();options.signal?.throwIfAborted();
   result=await runListing(scoped,resolved,{...options,timeoutMs,uploadConcurrency,coordinator,onProgress:p=>emit({...p,index})});
   if(!result.ok)coordinator.stop(result.error||result.stage);
  }catch(e){coordinator.stop(e);result={ok:false,taskId:task.taskId,stage:options.signal?.aborted?'cancelled':'failed',error:String(e.message||e).slice(0,400),receiptPath:e.receiptPath};}
  result={...result,index,endToEndMs:Math.round(performance.now()-begin)};results[index]=result;active--;
  emit({phase:'task-end',taskId:task.taskId,index,active,ok:result.ok,stage:result.stage});
  try{options.onResult?.(result);}catch{}
 }
 for(let offset=0;offset<tasks.length;offset+=productConcurrency){
  if(coordinator.stopped||options.signal?.aborted)break;
  const end=Math.min(offset+productConcurrency,tasks.length);
  const indexes=[];for(let i=offset;i<end;i++)indexes.push(i);
  await Promise.all(indexes.map(runOne));
 }
 const completed=results.filter(r=>r.ok).length,notStarted=results.filter(r=>r.stage==='not-started').length;
 return{ok:completed===tasks.length,stage:completed===tasks.length?'batch-completed':'batch-paused',dryRun:options.dryRun!==false,productConcurrency,uploadConcurrency,peakActiveProducts:peak,elapsedMs:Math.round(performance.now()-started),total:tasks.length,completed,failed:tasks.length-completed-notStarted,notStarted,stopped:coordinator.stopped||Boolean(options.signal?.aborted),cancelled:Boolean(options.signal?.aborted),stopReason:coordinator.reason,results};
}
