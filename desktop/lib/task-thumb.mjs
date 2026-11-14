import { firstDisplayImage } from './picker-view.mjs';

function clean(value) {
  return value == null ? '' : String(value).trim();
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function sourceDisplayImageUrl(row) {
  return firstDisplayImage(row);
}

export function applyDisplayImage(task, row) {
  const next = { ...(task || {}) };
  const url = firstDisplayImage(row);
  next.displayImageUrl = url || '';
  return next;
}

export function localListImage(task) {
  const mains = task?.mainImages;
  if (!Array.isArray(mains) || !mains.length) return '';
  return clean(mains[0]);
}

export function taskListImageSrc(task) {
  const local = localListImage(task);
  if (local) return local;
  return clean(task?.displayImageUrl) || firstDisplayImage(task) || '';
}

export function taskListThumbHtml(task, fileUrl = (value) => value) {
  const local = localListImage(task);
  if (local) {
    return `<img class="thumb" src="${escapeAttr(fileUrl(local))}" alt="" data-fallback-thumb="1" />`;
  }
  const url = clean(task?.displayImageUrl) || firstDisplayImage(task);
  if (!url) return '<div class="thumb ph">图</div>';
  return `<img class="thumb" src="${escapeAttr(url)}" alt="" data-fallback-thumb="1" />`;
}
