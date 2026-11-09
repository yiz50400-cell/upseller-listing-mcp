import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
export function atomicJson(file,value){fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});const temp=file+'.'+process.pid+'.'+crypto.randomBytes(4).toString('hex')+'.tmp';fs.writeFileSync(temp,JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'});fs.renameSync(temp,file);}
export function readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
export function openStore(root,account,taskId){
  const directory=path.join(root,'accounts',hash(String(account)));fs.mkdirSync(directory,{recursive:true,mode:0o700});const file=path.join(directory,taskId+'.json');const lock=file+'.lock';
  function claim(){fs.writeFileSync(lock,JSON.stringify({pid:process.pid,createdAt:new Date().toISOString()}),{flag:'wx',mode:0o600});}
  try{claim();}catch(e){if(e.code!=='EEXIST')throw e;const owner=readJson(lock,{});let dead=false;if(Number.isSafeInteger(owner.pid)){try{process.kill(owner.pid,0);}catch(err){dead=err.code==='ESRCH';}}if(!dead)throw new Error('此任务正在运行或锁状态不明，不能重复提交');fs.unlinkSync(lock);claim();}
  const cacheFile=path.join(directory,'upload-cache.json');return{file,load:()=>readJson(file,null),save:value=>atomicJson(file,value),cache:()=>readJson(cacheFile,{}),cachePut:(key,value)=>atomicJson(cacheFile,{...readJson(cacheFile,{}),[key]:value}),close:()=>{try{fs.unlinkSync(lock);}catch(e){if(e.code!=='ENOENT')throw e;}}};
}
export async function mapLimit(items,limit,fn){const out=new Array(items.length);let cursor=0,error;async function worker(){while(!error){const index=cursor++;if(index>=items.length)return;try{out[index]=await fn(items[index],index);}catch(e){error=e;}}}await Promise.all(Array.from({length:Math.min(items.length,limit)},worker));if(error)throw error;return out;}
