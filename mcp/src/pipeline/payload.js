import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { maybeParseJson,parseImgUrlList,parseResourceUriMap } from '../form.js';
import { hash } from './storage.js';
import { stripDescriptionImages } from './description.js';
export const rowsOf=d=>maybeParseJson(d.variationListStr??d.variationList??d.variations??[]);
const attrs=r=>maybeParseJson(r.salesAttributesJson)||[];
const colorAttr=(r,name)=>attrs(r).find(a=>name?a.name===name:/^(color|colour|cor|颜色)$/i.test(a.name));
export function inspectAssets(task){
 const files=(task.images||[]).map(a=>{if(!['main','gallery','sku'].includes(a.role))throw new Error('未知图片类型');const p=path.resolve(a.path||'');if(!a.path||!fs.existsSync(p)||!fs.statSync(p).isFile())throw new Error('图片文件不存在：'+p);if(!/\.(png|jpe?g|webp)$/i.test(p))throw new Error('仅支持 PNG/JPEG/WebP');const bytes=fs.readFileSync(p);if(bytes.length===0||bytes.length>5000000)throw new Error('图片必须大于 0 且不超过 5MB：'+p);return{...a,path:p,hash:hash(bytes),size:bytes.length};});
 if(files.filter(f=>f.role==='main').length>1)throw new Error('只能有一张主图');
 const names=files.filter(f=>f.role==='sku').map(f=>f.skuName);if(names.some(n=>!n)||new Set(names).size!==names.length)throw new Error('SKU 图片名称缺失或重复');
 return files;
}
export function preparePayload(data,task,files,uploads){
 const sourceRows=rowsOf(data);if(!Array.isArray(sourceRows)||sourceRows.length===0)throw new Error('源商品没有可用 SKU');
 const skuFiles=files.filter(f=>f.role==='sku');const colorName=task.colorAttributeName;const colors=[...new Set(sourceRows.map(r=>colorAttr(r,colorName)?.valueName).filter(Boolean))];let mappings=task.skuMappings;
 if(skuFiles.length&&task.replaceDesigns){
  if(skuFiles.length>colors.length)throw new Error('素材款式多于源商品款式，不能自动增加未知 SKU');
  const models=name=>sourceRows.filter(r=>colorAttr(r,colorName)?.valueName===name).map(r=>JSON.stringify(attrs(r).filter(a=>a.name!==colorAttr(r,colorName)?.name).map(a=>[a.name,a.valueName]).sort())).sort();
  if(!colors.every(c=>isDeepStrictEqual(models(c),models(colors[0]))))throw new Error('源款式的机型集合不同，需要显式 SKU 映射');
  mappings=skuFiles.map((f,i)=>({from:colors[i],to:f.skuName}));
 }
 if(!mappings)mappings=skuFiles.map(f=>({from:f.skuName,to:f.skuName}));
 if(new Set(mappings.map(x=>x.from)).size!==mappings.length||new Set(mappings.map(x=>x.to)).size!==mappings.length)throw new Error('SKU mapping 不能重复');
 for(const m of mappings)if(!colors.includes(m.from)||!skuFiles.some(f=>f.skuName===m.to))throw new Error('SKU mapping 找不到原款式或素材：'+m.from+' => '+m.to);
 for(const f of skuFiles)if(!mappings.some(m=>m.to===f.skuName))throw new Error('SKU 图片缺少 mapping：'+f.skuName);
 const byColor=new Map(mappings.map(m=>[m.from,{...m,file:skuFiles.find(f=>f.skuName===m.to)}]));
 const keepOnly=task.retainMappedColorsOnly===true||task.replaceDesigns===true;
 const variations=sourceRows.filter(r=>!keepOnly||!skuFiles.length||byColor.has(colorAttr(r,colorName)?.valueName)).map(r=>{
  const n={...r};if(task.productPrice!=null)n.price=Number(task.productPrice);const ca=colorAttr(r,colorName),m=byColor.get(ca?.valueName);
  if(m){n.imageUrl=uploads[m.file.hash].fileUrl;n.resourceUriMap=null;n.salesAttributesJson=JSON.stringify(attrs(r).map(a=>a.name===ca.name?{...a,valueName:m.to}:{...a}));const amap=maybeParseJson(r.attrMap);if(amap&&typeof amap==='object')n.attrMap=JSON.stringify({...amap,[ca.name]:m.to});}
  return n;
 });
 if(!variations.length||new Set(variations.map(r=>String(r.id))).size!==variations.length)throw new Error('SKU 列表为空或 ID 重复');
 let galleryFiles=[...files.filter(f=>f.role==='main'),...files.filter(f=>f.role==='gallery')];
 let gallery=galleryFiles.length?galleryFiles.map(f=>uploads[f.hash].fileUrl):parseImgUrlList(data.imgUrl);
 if(skuFiles.length&&task.includeSkuImagesInGallery!==false)gallery=[...gallery,...skuFiles.map(f=>uploads[f.hash].fileUrl)];
 gallery=[...new Set(gallery)];if(gallery.length===0||gallery.length>9)throw new Error('产品图库须为 1–9 张，当前 '+gallery.length);
 const description=stripDescriptionImages(task.description??data.description);const title=task.title??data.itemTitle;if(!String(title).trim())throw new Error('标题为空');
 const patches={itemTitle:title,description:description.html,variationListStr:variations,imgUrls:gallery,mainImage:gallery[0],sourceImgUrl:gallery[0],resourceUriMap:parseResourceUriMap(data.resourceUriMap).filter(m=>gallery.includes(m.url))};
 return{patches,expected:{id:String(data.idStr??data.id),shopId:String(data.shopId),itemTitle:title,description:description.html,gallery,variations},summary:{removedDescriptionImages:description.removedImages,galleryCount:gallery.length,skuCount:variations.length,skuMappings:mappings,removedSkuRows:sourceRows.length-variations.length}};
}
export function verifyPayload(actual,expected,publish){
 const rows=rowsOf(actual);const byId=new Map((Array.isArray(rows)?rows:[]).map(r=>[String(r.id),r]));
 const normalized=r=>Object.fromEntries(Object.entries(r).filter(([k])=>!['updateTime','createTime','resourceUriMap','variationId','productStatus'].includes(k)).map(([k,v])=>[k,['salesAttributesJson','attrMap','inventoryItem'].includes(k)?maybeParseJson(v):v]));
 const checks={identity:String(actual.idStr??actual.id)===expected.id&&String(actual.shopId)===expected.shopId,title:actual.itemTitle===expected.itemTitle,description:actual.description===expected.description,gallery:isDeepStrictEqual(parseImgUrlList(actual.imgUrl),expected.gallery),skuCount:Array.isArray(rows)&&rows.length===expected.variations.length&&byId.size===rows.length,skuFields:expected.variations.every(e=>byId.has(String(e.id))&&isDeepStrictEqual(normalized(byId.get(String(e.id))),normalized(e))),state:publish?['publishing','online'].includes(actual.state):actual.state==='draft',noError:!actual.errMsg};
 return{ok:Object.values(checks).every(Boolean),checks,platformStatus:actual.productStatus??actual.state,itemId:actual.itemId==null?null:String(actual.itemId),state:actual.state};
}
