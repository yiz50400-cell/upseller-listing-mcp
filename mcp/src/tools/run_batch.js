import path from 'node:path';
import {normalizeTask} from '../task_import.js';
import {runListingBatch} from '../pipeline/batch.js';
import {runListingToolSchema} from './run_listing.js';
const activeAccounts=new Set();
export async function upsellerRunBatch(client,args={},options={}){
 if(!Array.isArray(args.tasks)||args.tasks.length<1||args.tasks.length>1000)throw new Error('tasks 必须包含 1–1000 个任务');
 const tasks=[];
 for(const input of args.tasks){if(!input?.taskId)throw new Error('每条任务必须提供稳定 taskId');tasks.push(await normalizeTask(input,{identity:input.taskId,materialsRoot:args.materialsRoot}));}
 const account=client.accountKey?.();if(!account)throw new Error('缺少账号隔离标识');
 if(activeAccounts.has(account))throw new Error('当前账号已有批次在本 MCP 进程执行，请等待完成后续跑，不要并开批次');
 activeAccounts.add(account);
 try{return await runListingBatch(client,tasks,{dataDir:args.dataDir?path.resolve(args.dataDir):undefined,dryRun:args.dryRun!==false,confirmPublish:args.confirmPublish===true,productConcurrency:args.productConcurrency,uploadConcurrency:args.uploadConcurrency,timeoutMs:args.timeoutMs,signal:options.signal,onProgress:options.onProgress});}
 finally{activeAccounts.delete(account);}
}
export const runBatchToolSchema={name:'upseller_run_batch',description:'批量并发上架：默认每批固定8件（≤8一批全开；>8按8、8、余数分批，上一批全部完成才启动下一批），当前保护上限8件（不是平台承载上限）；显式较小商品并发时同样按该值固定分批。整批共用3路原图上传，同店提交排队。失败停止新任务及新提交、不启动下一批，在途请求收尾并保留回执。默认预览；发布需要明确确认。批量调用超时应按任务量配置，取消后用原taskId续跑。',inputSchema:{type:'object',properties:{tasks:{type:'array',minItems:1,maxItems:1000,items:runListingToolSchema.inputSchema.properties.task},dryRun:{type:'boolean',default:true},confirmPublish:{type:'boolean',default:false},productConcurrency:{type:'integer',minimum:1,maximum:8,default:8},uploadConcurrency:{type:'integer',minimum:1,maximum:4,default:3},timeoutMs:{type:'integer',minimum:1000,maximum:300000,default:180000,description:'单商品执行器的限时（含等待共享资源），不是整批超时，也不是性能保证'},dataDir:{type:'string'},materialsRoot:{type:'string'}},required:['tasks']}};
