import fs from 'node:fs';
import {parseEnv} from 'node:util';
const allowed=new Set(['UPSELLER_COOKIE','UPSELLER_DEVICE_ID','UPSELLER_SAVE_OP','HTTP_PROXY','HTTPS_PROXY','NO_PROXY','http_proxy','https_proxy','no_proxy','NODE_USE_ENV_PROXY']);
export function assertNodeVersion(version=process.versions.node){
 const m=/^v?(\d+)\.(\d+)\.(\d+)(?:$|[-+])/.exec(version);
 if(!m||Number(m[1])<22||(Number(m[1])===22&&Number(m[2])<12))throw new Error('需要 Node.js >=22.12.0；请升级运行环境。');
}
export function loadEnvironment(file,inherited=process.env){
 const env={...inherited};
 if(!fs.existsSync(file))return env;
 const parsed=parseEnv(fs.readFileSync(file,'utf8'));
 for(const [key,value] of Object.entries(parsed))if(allowed.has(key)&&!Object.hasOwn(env,key))env[key]=value;
 return env;
}
export function configureProxy(env,supported=process.allowedNodeEnvironmentFlags.has('--use-env-proxy')){
 const result={...env};
 if(env.NODE_USE_ENV_PROXY==='0')return result;
 const requested=env.NODE_USE_ENV_PROXY==='1'||['HTTP_PROXY','HTTPS_PROXY','http_proxy','https_proxy'].some(k=>Boolean(env[k]));
 if(!requested)return result;
 if(!supported)throw new Error('已配置代理，但此 Node 运行时不支持原生 env proxy。请使用支持 --use-env-proxy 的 Node，或明确设置 NODE_USE_ENV_PROXY=0 使用直连。');
 result.NODE_USE_ENV_PROXY='1';return result;
}
