import { assertApiOk } from './client.js';
const shopsCache=new WeakMap();
export async function listShops(client){
 if(shopsCache.has(client))return shopsCache.get(client);
 const pending=(async()=>{
  const value=assertApiOk(await client.postForm('/api/shop/platform-list',{platform:'tiktok'}),'shop-list');
  const rows=value.data?.tiktok;if(!Array.isArray(rows))throw new Error('店铺列表返回格式发生变化');
  return rows.filter(s=>Number(s.isCb||0)===0).map(s=>({id:String(s.idStr??s.id),name:s.name,site:s.site,expired:Number(s.expire||0)!==0}));
 })();shopsCache.set(client,pending);
 try{return await pending;}catch(e){shopsCache.delete(client);throw e;}
}
export async function resolveTask(client,task){
  const shops=await listShops(client);
  const found=shops.filter(s=>task.targetShopId?String(s.id)===String(task.targetShopId):s.name===task.targetShopName);
  if(found.length!==1||found[0].expired)throw new Error('目标店铺未授权、已过期或名称不唯一');
  const resolved={...task,targetShopId:found[0].id,targetShopName:found[0].name,targetSite:found[0].site};
  if(!resolved.sourceInternalId&&!resolved.draftId){
    const r=assertApiOk(await client.postForm('/api/tiktok/product/index',{state:'online',searchType:'3',searchValue:String(task.productId),pageNum:1,pageSize:100}),'source-list');
    if(!Array.isArray(r.data?.list)||r.data.total>100)throw new Error('源商品搜索结果过多或格式异常，请填写源商品内部 ID');
    const matches=r.data.list.filter(p=>String(p.itemId)===String(task.productId)&&(!task.sourceShopHint||p.shopName===task.sourceShopHint||String(p.shopId)===String(task.sourceShopHint)));
    if(matches.length!==1)throw new Error('源商品未找到或存在多店同 ID，请填写 sourceInternalId/sourceShopHint');
    resolved.sourceInternalId=String(matches[0].idStr??matches[0].id);
  }
  return resolved;
}
