const IMAGE_KEYS = [
  'thumbnail',
  'mainImage',
  'sourceImgUrl',
  'imageUrl',
  'picUrl',
  'imgUrl',
  'image',
  'images',
  'pic',
  'cover',
  'coverUrl',
  'mainImg',
  'img',
  'picture',
  'photo',
  'headImage',
  'productImage',
];

function pushUrlParts(value, out, depth = 0) {
  if (value == null || value === '' || depth > 4) return;
  if (Array.isArray(value)) {
    for (const item of value) pushUrlParts(item, out, depth + 1);
    return;
  }
  if (typeof value === 'object') {
    pushUrlParts(
      value.url ?? value.src ?? value.imageUrl ?? value.picUrl ?? value.imgUrl ?? value.thumbnail ?? value.mainImage,
      out,
      depth + 1,
    );
    return;
  }
  const text = String(value).trim();
  if (!text) return;
  if ((text.startsWith('[') || text.startsWith('{')) && (text.includes('"') || text.includes("'"))) {
    try {
      pushUrlParts(JSON.parse(text), out, depth + 1);
      return;
    } catch {
      /* fall through and treat as a delimited string */
    }
  }
  for (const part of text.split(/[|,]/)) {
    const url = String(part || '').trim();
    if (url) out.push(url);
  }
}

export function firstHttpUrl(value) {
  const parts = [];
  pushUrlParts(value, parts);
  for (const part of parts) {
    if (/^https?:\/\//i.test(part)) return part;
    if (part.startsWith('//') && part.length > 2) return `https:${part}`;
  }
  return '';
}

export function firstDisplayImageUrl(row = {}) {
  if (row == null) return '';
  if (typeof row !== 'object' || Array.isArray(row)) return firstHttpUrl(row);
  for (const key of IMAGE_KEYS) {
    const url = firstHttpUrl(row[key]);
    if (url) return url;
  }
  return '';
}
