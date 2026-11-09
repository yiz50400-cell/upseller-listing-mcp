import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export function parseCsv(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  text = String(text).replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted; }
    else if (c === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) { if(c === '\r' && text[i+1] === '\n') i++; row.push(cell); if(row.some(x => x !== '')) rows.push(row); row=[];cell=''; }
    else cell += c;
  }
  if (quoted) throw new Error('CSV has an unterminated quoted field');
  row.push(cell); if(row.some(x => x !== '')) rows.push(row); return rows;
}
const headers = { '产品ID':'productId','复制到几店':'targetShopName','目标店铺':'targetShopName','目标店铺ID':'targetShopId','产品价格':'productPrice','标题':'title','上架':'publish','主图素材夹':'mainFolder','附图素材夹':'galleryFolder','SKU素材夹':'skuFolder','素材夹':'materialsFolder','SKU映射':'skuMappings','替换原款式':'replaceDesigns','视频':'video','任务ID':'taskId' };
const yes = v => v === true || v === 1 || /^(是|true|yes|1)$/i.test(String(v ?? '').trim());
const cleanCell = v => v?.richText ? v.richText.map(x => x.text).join('') : (v && typeof v === 'object' ? (v.text ?? v.result ?? '') : v);
function id(value, name) {
  if (value == null || value === '') return undefined;
  if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error(name + ' must be stored as text; spreadsheet numeric precision was lost');
  const s=String(value).trim(); if (!/^\d+$/.test(s)) throw new Error(name + ' must contain digits only'); return s;
}
async function folderImages(folder, role, base) {
  if (!folder) return []; const root=path.resolve(base,String(folder));
  const entries=(await fs.readdir(root,{withFileTypes:true})).filter(x=>x.isFile()&&/\.(png|jpe?g|webp)$/i.test(x.name)).sort((a,b)=>a.name.localeCompare(b.name,'zh',{numeric:true}));
  return entries.map(x=>{const stem=path.parse(x.name).name;const resolvedRole=role || (/^(主图|main|main-image)$/i.test(stem)?'main':/^(附图|gallery)/i.test(stem)?'gallery':'sku'); return {path:path.join(root,x.name),role:resolvedRole,...(resolvedRole==='sku'?{skuName:stem}:{})};});
}
export async function normalizeTask(input,{baseDir=process.cwd(),materialsRoot,identity='task'}={}) {
  const t={...input};
  if(yes(t.optimizeImages))throw new Error('仅上传原图，不支持 optimizeImages 压缩选项');
  t.productId=id(t.productId,'productId');t.sourceInternalId=id(t.sourceInternalId,'sourceInternalId');t.draftId=id(t.draftId,'draftId');
  t.targetShopId=id(t.targetShopId,'targetShopId');
  if(!t.productId&&!t.sourceInternalId&&!t.draftId) throw new Error('缺少产品 ID 或草稿 ID');
  if(!t.targetShopId&&!t.targetShopName) throw new Error('缺少目标店铺');
  t.publish=yes(t.publish);t.replaceDesigns=yes(t.replaceDesigns);t.includeSkuImagesInGallery=t.includeSkuImagesInGallery!==false;
  if(t.video) throw new Error('当前客户版尚不处理视频；请清空视频列后运行');
  if(t.productPrice!==''&&t.productPrice!=null){t.productPrice=Number(t.productPrice);if(!Number.isFinite(t.productPrice)||t.productPrice<=0)throw new Error('价格必须是大于零的数值');}else delete t.productPrice;
  const base=materialsRoot?path.resolve(materialsRoot):baseDir;
  if(Array.isArray(t.images))t.images=t.images.map(x=>({...x,path:path.resolve(base,x.path||x.filePath)}));
  else if(t.mainImage||t.galleryImages||t.skus){t.images=[...(t.mainImage?[{path:path.resolve(base,t.mainImage),role:'main'}]:[]),...(t.galleryImages||[]).map(p=>({path:path.resolve(base,p),role:'gallery'})),...(t.skus||[]).map(s=>({path:path.resolve(base,s.skuImage||s.image),role:'sku',skuName:s.skuName}))];}
  else if(t.mainFolder||t.galleryFolder||t.skuFolder){t.images=[...await folderImages(t.mainFolder,'main',base),...await folderImages(t.galleryFolder,'gallery',base),...await folderImages(t.skuFolder,'sku',base)];}
  else t.images=await folderImages(t.materialsFolder,null,base);
  if(t.images.filter(x=>x.role==='main').length>1)throw new Error('主图素材夹只能放一张主图');
  if(typeof t.skuMappings==='string'&&t.skuMappings.trim()){t.skuMappings=t.skuMappings.trim().startsWith('[')?JSON.parse(t.skuMappings):t.skuMappings.split(/[;；]/).map(pair=>{const [from,to]=pair.split('=>').map(x=>x.trim());if(!from||!to)throw new Error('SKU映射格式：原款式=>新款式');return{from,to};});}
  if(!Array.isArray(t.skuMappings))delete t.skuMappings;
  if(!t.taskId)t.taskId='task-'+crypto.createHash('sha256').update(identity+'|'+String(t.targetShopId||t.targetShopName)).digest('hex').slice(0,20);
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(t.taskId))throw new Error('任务 ID 只能使用字母、数字、下划线和短横线');
  return t;
}
export async function importTasks(filePath,{materialsRoot}={}) {
  const info=await fs.stat(filePath);if(info.size>10*1024*1024)throw new Error('任务表超过 10MB');
  const ext=path.extname(filePath).toLowerCase(); let objects;
  if(ext==='.json'){const v=JSON.parse(await fs.readFile(filePath,'utf8'));objects=Array.isArray(v)?v:(Array.isArray(v.tasks)?v.tasks:[v]);}
  else {
    let rows;
    if(ext==='.csv')rows=parseCsv(await fs.readFile(filePath,'utf8'));
    else if(ext==='.xlsx'){const {default:ExcelJS}=await import('exceljs');const wb=new ExcelJS.Workbook();await wb.xlsx.readFile(filePath);const ws=wb.worksheets[0];if(!ws)throw new Error('工作簿没有工作表');rows=[];ws.eachRow(r=>{const row=[];for(let i=1;i<=r.cellCount;i++)row.push(cleanCell(r.getCell(i).value));rows.push(row);});}
    else throw new Error('仅支持 JSON、CSV、XLSX；请将其他格式另存为 XLSX');
    const keys=(rows.shift()||[]).map(x=>headers[String(x).trim()]||String(x).trim());
    objects=rows.filter(r=>r.some(v=>v!==''&&v!=null)).map(r=>Object.fromEntries(keys.map((k,i)=>[k,r[i]??''])));
  }
  const tasks=[];
  for(let i=0;i<objects.length;i++){const input=objects[i];const targets=Array.isArray(input.copyToShops)?input.copyToShops:String(input.targetShopName||'').split(/[;；,，]/).filter(Boolean);
    for(const target of targets.length?targets:[undefined]){try{tasks.push(await normalizeTask({...input,...(target?{targetShopName:String(target).trim()}:{}),...(targets.length>1&&input.taskId?{taskId:input.taskId+'-'+(targets.indexOf(target)+1)}:{})},{baseDir:path.dirname(path.resolve(filePath)),materialsRoot,identity:path.resolve(filePath)+'|row-'+(i+2)}));}catch(e){throw new Error('第 '+(i+2)+' 行：'+e.message);}}
  }
  if(tasks.length===0)throw new Error('任务表没有有效任务');if(new Set(tasks.map(t=>t.taskId)).size!==tasks.length)throw new Error('任务 ID 重复');return tasks;
}
