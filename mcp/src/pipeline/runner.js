import path from 'node:path';
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import { assertApiOk } from '../client.js';
import { upsellerGetDraft } from '../tools/get_draft.js';
import { upsellerUploadMedia } from '../tools/upload_media.js';
import { buildSaveFormFields } from '../form.js';
import { hash,openStore,mapLimit } from './storage.js';
import { inspectAssets,preparePayload,verifyPayload } from './payload.js';
import { listingFingerprint,decideListingResume } from './resume.js';
import { listDraftsForShop } from '../tools/list_drafts.js';

export async function runListing(client,task,options={}){
 const started=performance.now(),dryRun=options.dryRun!==false,publish=task.publish===true;
 if(task.optimizeImages===true)throw new Error('仅上传原图；请移除 optimizeImages=true，不执行压缩、缩放或转码');
 if(!/^[a-zA-Z0-9_-]{1,100}$/.test(task.taskId||''))throw new Error('taskId must be a stable safe identifier');
 if(!/^\d+$/.test(String(task.targetShopId||'')))throw new Error('请先解析并验证目标店铺 ID');
 if(!task.sourceInternalId&&!task.draftId)throw new Error('sourceInternalId or draftId is required');
 if(publish&&!dryRun&&options.confirmPublish!==true)throw new Error('发布需要明确确认 confirmPublish=true');
 if(task.productPrice!=null&&(!Number.isFinite(Number(task.productPrice))||Number(task.productPrice)<=0))throw new Error('价格无效');
 if(task.video)throw new Error('当前快速流程尚不支持视频');
 const concurrency=Math.max(1,Math.min(4,Math.trunc(options.uploadConcurrency||3)));
 const timeoutMs=Math.max(1000,Math.min(300000,options.timeoutMs||60000));
 const controller=new AbortController(),signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal;
 const timer=setTimeout(()=>controller.abort(new Error('单任务处理达到时限，请续跑查看已有回执')),timeoutMs);
 const base=client.withSignal?client.withSignal(signal):client;const requestCounts={get:0,post:0,put:0};
 const api={get:async(...a)=>{signal.throwIfAborted();requestCounts.get++;return base.get(...a);},postForm:async(...a)=>{signal.throwIfAborted();requestCounts.post++;return base.postForm(...a);},postJson:async(...a)=>{signal.throwIfAborted();requestCounts.post++;return base.postJson(...a);},putBinary:async(...a)=>{signal.throwIfAborted();requestCounts.put++;return base.putBinary(...a);}};
 let store,state,phase='preflight',releaseSubmit;const timings={};
 const elapsed=()=>Math.round(performance.now()-started);
 const event=(name,extra={})=>{phase=name;try{options.onProgress?.({phase:name,taskId:task.taskId,elapsedMs:elapsed(),...extra});}catch{}};
 const save=()=>store.save(state);
 const read=async id=>(await upsellerGetDraft(api,{draftId:id}))._rawData;
 function finish(result){if(result.ok===false)options.coordinator?.stop(result.error||result.stage);const out={...result,taskId:task.taskId,draftId:state?.draftId||String(task.draftId||''),publishRequested:publish,dryRun,elapsedMs:elapsed(),targetMs:60000,timings,requestCounts,receiptPath:store?.file};if(state){if(out.ok&&out.stage==='verified'){state.completedResult=out;state.verifiedAt=new Date().toISOString();}state.lastResult=out;state.updatedAt=new Date().toISOString();save();}event(out.stage,{ok:out.ok});return out;}
 try{
  event('preflight');const files=inspectAssets(task);const first=await read(task.draftId||task.sourceInternalId);
  if(String(first.idStr??first.id)!==String(task.draftId||task.sourceInternalId))throw new Error('源商品/草稿身份不匹配');
  if(task.productId&&!task.draftId&&String(first.itemId)!==String(task.productId))throw new Error('源商品平台 ID 不匹配');
  if(task.targetSite&&first.site!==task.targetSite)throw new Error('源商品与目标店铺站点不同，需单独处理分类/货币');
  if(task.draftId&&String(first.shopId)!==String(task.targetShopId))throw new Error('草稿不属于目标店铺');
  const root=path.resolve(options.dataDir||path.join(os.homedir(),'.upseller-client'));
  const account=first.puid!=null?'puid:'+String(first.puid):options.accountKey||client.accountKey?.();
  if(!account)throw new Error('缺少账号隔离标识，拒绝共享任务缓存');
  const fingerprint=listingFingerprint(task,files,hash);
  store=openStore(root,account,task.taskId);state=store.load();
  const decision=decideListingResume({state,fingerprint,task,platform:first});
  if(decision.type==='mismatch')throw new Error('任务 ID 已用于不同内容；如需新建商品请使用新的任务 ID');
  if(!state){state={taskId:task.taskId,fingerprint,createdAt:new Date().toISOString(),uploads:{},draftId:task.draftId?String(task.draftId):null};save();}
  else if(decision.updateFingerprint){state.fingerprint=fingerprint;save();}
  if(decision.type==='already-completed'){return finish({...state.completedResult||state.lastResult,ok:true,stage:'already-completed',reused:true,verifiedAt:state.verifiedAt,verificationScope:'previous verified receipt; no new remote write'});}
  if(!decision.skipSubmissionShortCircuit&&state.submission?.stage==='verified'&&(state.completedResult||state.lastResult)?.ok){return finish({...state.completedResult||state.lastResult,ok:true,stage:'already-completed',reused:true,verifiedAt:state.verifiedAt,verificationScope:'previous verified receipt; no new remote write'});}
  if(state.submission?.stage==='intent'||state.submission?.stage==='accepted'||(!decision.skipSubmissionShortCircuit&&state.submission?.stage==='verified')){
   event('reconciling');const current=task.draftId&&String(first.id)===state.draftId?first:await read(state.draftId);const v=verifyPayload(current,state.expected,publish);
   if(v.ok){state.submission.stage='verified';save();return finish({ok:true,stage:'verified',reused:true,itemId:v.itemId,platformStatus:v.platformStatus,verification:v});}
   if(current.errMsg||current.state==='fail')return finish({ok:false,stage:'platform-failed',verification:v,error:String(current.errMsg||'平台处理失败')});
   return finish({ok:false,pending:true,stage:'needs-reconciliation',verification:v,error:'已有提交回执尚未完全匹配；不会重复提交。请稍后续跑或查看商品状态。'});
  }
  if(task.draftId&&first.state!=='draft')throw new Error('快速新上架流程只编辑草稿；不会覆盖已上线商品');
  if(!task.draftId&&(first.state!=='online'||!first.itemId))throw new Error('复制来源必须是可识别的在线商品');
  const placeholder=Object.fromEntries(files.map(f=>[f.hash,{fileUrl:'dryRun://'+f.hash}]));
  const preview=preparePayload(first,task,files,placeholder);timings.preflightMs=elapsed();
  if(dryRun)return finish({ok:true,stage:'preview',dryRun:true,summary:preview.summary,uploads:files.map(f=>({fileName:path.basename(f.path),bytes:f.size,role:f.role})),businessSubmitCount:0});
  const unique=[...new Map(files.map(f=>[f.hash,f])).values()];const cache=store.cache();
  async function uploadAll(){const begin=performance.now();await mapLimit(unique,concurrency,async file=>{
    signal.throwIfAborted();if(state.uploads[file.hash]?.fileUrl)return;
    if(cache[file.hash]?.fileUrl&&Date.now()-Date.parse(cache[file.hash].uploadedAt)<7*86400000){state.uploads[file.hash]=cache[file.hash];save();return;}
    const upload=()=>upsellerUploadMedia(api,{filePath:file.path,dryRun:false});
    const up=options.coordinator?await options.coordinator.upload(account+'|'+file.hash,upload,signal):await upload();if(!up.fileUrl)throw new Error('上传未返回图片地址');
    const receipt={fileUrl:up.fileUrl,fileKey:up.fileKey,size:up.size,uploadedAt:new Date().toISOString()};state.uploads[file.hash]=receipt;store.cachePut(file.hash,receipt);save();
   });timings.uploadMs=Math.round(performance.now()-begin);}
  async function listDrafts(){return listDraftsForShop(api,task.targetShopId,{signal});}
  async function obtainDraft(){const begin=performance.now();if(state.draftId){const d=task.draftId?first:await read(state.draftId);if(d.state!=='draft')throw new Error('目标不再是草稿，停止覆盖');timings.copyMs=Math.round(performance.now()-begin);return d;}
   const releaseCopy=await options.coordinator?.acquireCopy(account+'|'+String(first.id)+'|'+String(task.targetShopId),signal);let copyLock;
   try{
    copyLock=openStore(root,account,'copy-'+hash(String(first.id)+'|'+String(task.targetShopId)).slice(0,24));
    if(!state.copy){const old=await listDrafts();options.coordinator?.assertRunning();signal.throwIfAborted();state.copy={stage:'intent',sourceId:String(first.shopId)+'|'+String(first.itemId),beforeIds:old.map(d=>String(d.idStr??d.id)),startedAt:new Date().toISOString()};save();
     try{const r=await api.postJson('/api/tiktok/product/copy',{id:String(first.idStr??first.id),shopCountVoList:[{count:1,shopId:Number(task.targetShopId)}]});state.copy.response=assertApiOk(r,'copy');state.copy.stage='accepted';save();}catch(e){state.copy.error=e.message;save();if(!e.uncertainWrite)throw e;}
    }
    for(let i=0;i<20;i++){const all=await listDrafts();const matches=all.filter(d=>d.sourceId===state.copy.sourceId&&!state.copy.beforeIds.includes(String(d.idStr??d.id)));if(matches.length>1)throw new Error('同一来源出现多个新草稿，需人工确认，禁止猜测');if(matches.length===1){state.draftId=String(matches[0].idStr??matches[0].id);state.copy.stage='resolved';save();const d=await read(state.draftId);if(d.state!=='draft'||String(d.shopId)!==String(task.targetShopId))throw new Error('复制结果店铺或状态不符');timings.copyMs=Math.round(performance.now()-begin);return d;}await sleep(500,undefined,{signal});}
    throw new Error('复制回执尚未找到；续跑只查询，不会重新复制');
   }catch(error){options.coordinator?.stop(error);throw error;}finally{copyLock?.close();releaseCopy?.();}
  }
  event('preparing',{imageCount:unique.length,concurrency});
  const stopOnError=promise=>promise.catch(error=>{options.coordinator?.stop(error);throw error;});
  const work=await Promise.allSettled([stopOnError(uploadAll()),stopOnError(obtainDraft())]);const failed=work.find(x=>x.status==='rejected');if(failed)throw failed.reason;
  const draft=work[1].value;state.before=draft;save();
  const built=preparePayload(draft,task,files,state.uploads);state.expected=built.expected;state.summary=built.summary;
  const {fields}=buildSaveFormFields(draft,built.patches);fields.op=publish?'2':'1';if(publish&&draft.state==='online')fields.state='online';
  if(fields.id!==state.draftId||String(fields.shopId)!==String(task.targetShopId))throw new Error('提交身份检查失败');
  releaseSubmit=await options.coordinator?.acquireSubmit(account+'|'+String(task.targetShopId),signal);
  options.coordinator?.assertRunning();event('price-check');const beforeCheck=performance.now();const check=assertApiOk(await api.postForm('/api/tiktok/product/check-edit-price',fields),'check-edit-price');
  if(!Array.isArray(check.data)||check.data.length)throw new Error('价格检查要求确认，拒绝强制跳过');timings.priceCheckMs=Math.round(performance.now()-beforeCheck);
  signal.throwIfAborted();options.coordinator?.assertRunning();state.submission={stage:'intent',startedAt:new Date().toISOString(),op:fields.op};save();event('submitting');const begin=performance.now();
  try{const res=assertApiOk(await api.postForm('/api/tiktok/product/add',fields),'product/add');state.submission.stage='accepted';state.submission.responseCode=res.code;save();}catch(e){state.submission.error=e.message;save();if(!e.uncertainWrite)throw e;}
  timings.submitMs=Math.round(performance.now()-begin);event('verifying');
  for(let i=0;i<8;i++){const actual=await read(state.draftId);const v=verifyPayload(actual,state.expected,publish);state.lastVerification=v;save();if(v.ok){state.submission.stage='verified';save();return finish({ok:true,stage:'verified',itemId:v.itemId,platformStatus:v.platformStatus,verification:v,summary:built.summary});}if(actual.errMsg||actual.state==='fail')return finish({ok:false,stage:'platform-failed',verification:v,error:String(actual.errMsg||'平台处理失败')});if(i<7)await sleep(750,undefined,{signal});}
  return finish({ok:false,pending:true,stage:'needs-reconciliation',verification:state.lastVerification,error:'提交已受理，但最终回读尚未匹配。平台图片 URL 转换或异步处理需复核；不会重复发布。'});
 }catch(error){
  options.coordinator?.stop(error);
  if(state){state.lastError={phase,message:String(error.message).slice(0,400),at:new Date().toISOString()};save();}
  if(state?.submission||state?.copy)return finish({ok:false,pending:true,stage:'needs-reconciliation',error:String(error.message).slice(0,400),recovery:'续跑使用同一任务 ID，读取已有回执，禁止另建 ID 盲目重发'});
  error.phase=phase;error.receiptPath=store?.file;error.elapsedMs=elapsed();error.requestCounts=requestCounts;throw error;
 }finally{clearTimeout(timer);releaseSubmit?.();store?.close();}
}
