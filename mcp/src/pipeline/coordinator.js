/** Batch-scoped limits. Existing filesystem receipts/locks remain authoritative. */
export function validateLimit(value,fallback,name,max=4){
 const n=value===undefined?fallback:Number(value);
 if(!Number.isInteger(n)||n<1||n>max)throw new Error(name+' 并发必须是 1–'+max+' 的整数');
 return n;
}
function limiter(limit){
 let active=0;const queue=[];
 function pump(){while(active<limit&&queue.length){const next=queue.shift();next.signal?.removeEventListener('abort',next.onAbort);if(next.signal?.aborted){next.reject(next.signal.reason);continue;}active++;let done=false;next.resolve(()=>{if(done)return;done=true;active--;pump();});}}
 return signal=>new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(signal.reason);return;}
  const entry={resolve,reject,signal,onAbort:()=>{const i=queue.indexOf(entry);if(i>=0){queue.splice(i,1);reject(signal.reason);}}};
  signal?.addEventListener('abort',entry.onAbort,{once:true});queue.push(entry);pump();
 });
}
export function createBatchCoordinator(uploadConcurrency=3){
 const uploadSlots=limiter(validateLimit(uploadConcurrency,3,'图片'));
 const copies=new Map(),submissions=new Map(),uploads=new Map();let stopped=false,reason=null;
 const assertRunning=()=>{if(stopped)throw new Error('批次已暂停，停止新的复制/上传/提交；保留同一任务 ID 续跑');};
 function lockFor(map,key){if(!map.has(key))map.set(key,limiter(1));return map.get(key);}
 async function acquire(map,key,signal){const release=await lockFor(map,key)(signal);try{assertRunning();signal?.throwIfAborted();return release;}catch(e){release();throw e;}}
 return{
  get stopped(){return stopped;},get reason(){return reason;},
  stop(error){stopped=true;reason??=String(error?.message||error||'任务未通过核验');},assertRunning,
  acquireCopy:(key,signal)=>acquire(copies,key,signal),
  acquireSubmit:(key,signal)=>acquire(submissions,key,signal),
  upload(key,fn,signal){
   assertRunning();signal?.throwIfAborted();
   if(!uploads.has(key)){
    const work=(async()=>{const release=await uploadSlots(signal);try{assertRunning();signal?.throwIfAborted();return await fn();}finally{release();}})();
    uploads.set(key,work);work.catch(error=>{stopped=true;reason??=String(error?.message||error);if(uploads.get(key)===work)uploads.delete(key);});
   }
   return uploads.get(key);
  }
 };
}
