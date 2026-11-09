import { parseFragment } from 'parse5';
export function stripDescriptionImages(input) {
  const html=String(input??'');const tree=parseFragment(html,{sourceCodeLocationInfo:true});const ranges=[];let count=0;
  function visit(node,parent){
    const loc=node.sourceCodeLocation;
    if(loc&&node.tagName==='img'){ranges.push([loc.startOffset,loc.endOffset]);count++;return;}
    if(loc&&node.tagName==='source'&&parent?.tagName==='picture'){ranges.push([loc.startOffset,loc.endOffset]);return;}
    if(loc&&node.tagName==='picture'){if(loc.startTag)ranges.push([loc.startTag.startOffset,loc.startTag.endOffset]);if(loc.endTag)ranges.push([loc.endTag.startOffset,loc.endTag.endOffset]);}
    if(node.tagName==='svg'||node.tagName==='object'||node.tagName==='embed'||node.attrs?.some(a=>a.name==='style'&&/url\s*\(/i.test(a.value)))throw new Error('描述包含非标准图片容器，请先移除 SVG/object/CSS 背景图片');
    for(const child of node.childNodes||[])visit(child,node);if(node.content)visit(node.content,node);
  }
  visit(tree);let cleaned=html;for(const [start,end]of ranges.sort((a,b)=>b[0]-a[0]))cleaned=cleaned.slice(0,start)+cleaned.slice(end);
  if(!cleaned.replace(/<!--[\s\S]*?-->/g,'').replace(/<[^>]*>/g,'').replace(/&nbsp;/gi,' ').trim())throw new Error('删除图片后描述为空，需提供文字描述');
  return {html:cleaned,removedImages:count};
}
