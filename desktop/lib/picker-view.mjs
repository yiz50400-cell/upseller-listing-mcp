function clean(value) {
  return value == null ? '' : String(value).trim();
}

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

function firstHttpUrl(value) {
  const parts = [];
  pushUrlParts(value, parts);
  for (const part of parts) {
    if (/^https?:\/\//i.test(part)) return part;
    if (part.startsWith('//') && part.length > 2) return `https:${part}`;
  }
  return '';
}

export function draftPickerLabel(task) {
  const draftId = clean(task?.draftId);
  if (!draftId) return '';
  return clean(task?.title) || draftId;
}

export function productPickerLabel(task) {
  if (clean(task?.draftId)) return '';
  const productId = clean(task?.productId);
  if (!productId) return '';
  return clean(task?.title) || productId;
}

export function filterListedItems(rows, { shopId, query } = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const shop = clean(shopId);
  const q = clean(query).toLowerCase();
  return list.filter((row) => {
    if (shop && clean(row?.shopId) !== shop) return false;
    if (!q) return true;
    const blob = [
      row?.title,
      row?.draftId,
      row?.productId,
      row?.itemId,
      row?.shopName,
      row?.shopId,
    ].map((part) => String(part || '').toLowerCase()).join(' ');
    return blob.includes(q);
  });
}

export function formatListPrice(row) {
  if (row?.price == null || row.price === '') return '—';
  const amount = String(row.price);
  const currency = clean(row?.currency);
  if (currency === 'MXN') return `MX$ ${amount}`;
  return currency ? `${currency} ${amount}` : amount;
}

export function firstDisplayImage(row) {
  if (row == null) return '';
  if (typeof row !== 'object' || Array.isArray(row)) return firstHttpUrl(row);
  for (const key of IMAGE_KEYS) {
    const url = firstHttpUrl(row[key]);
    if (url) return url;
  }
  return '';
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function pickerThumbHtml(row) {
  const url = firstDisplayImage(row);
  if (!url) return '<div class="thumb ph">图</div>';
  return `<img class="thumb" src="${escapeAttr(url)}" alt="" />`;
}
