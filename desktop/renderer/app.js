import { ensureTaskList, deleteTasks, createProduct, nextSelectedId, visibleTasks as filterTasks } from './task-list.mjs';
import { realShops, isPlaceholderShopName, runBlockReason } from './run-guards.mjs';
import { applyDraftFields, findShopOption } from '../lib/draft-form.mjs';
import { draftPickerLabel, productPickerLabel, filterListedItems, formatListPrice, pickerThumbHtml } from '../lib/picker-view.mjs';
import { successActionToast } from '../lib/action-toast.mjs';
import { bindSourceToTask, markTaskSaved, applyBoundTaskToList } from '../lib/task-bind.mjs';
import { statusBadge, statusAfterSuccessfulAction, isSubmittedTask } from '../lib/status-badge.mjs';
import { taskListThumbHtml } from '../lib/task-thumb.mjs';

const api = window.upsellerDesktop;

const demoTasks = [
  demo('t-demo-1', '无线降噪耳机 Pro', 'WH-1000XM5-B', '目标店铺 A', 'US', '199.99', 'USD', 'live', '2分钟前'),
  demo('t-demo-2', '智能手表 Lite', 'SW-LITE-42', '目标店铺 A', 'US', '129.00', 'USD', 'wait', '5分钟前'),
  demo('t-demo-3', '城市背包 20L', 'BP-20L-BLK', '目标店铺 B', 'UK', '45.99', 'GBP', 'live', '10分钟前'),
  demo('t-demo-4', '简约陶瓷杯', 'MUG-CER-WHT', '目标店铺 C', 'DE', '12.90', 'EUR', 'draft', '15分钟前'),
  demo('t-demo-5', '台灯 LED', 'LAMP-LED-DSK', '目标店铺 A', 'US', '29.50', 'USD', 'live', '18分钟前'),
];

function demo(id, title, sku, shopName, site, price, currency, status, age) {
  return {
    id,
    demo: true,
    title,
    skuPrefix: sku,
    productId: '',
    shopName,
    site,
    price,
    currency,
    status,
    age,
    mainImages: [],
    galleryImages: [],
    skuImages: [],
    video: '',
    notes: '',
  };
}

let state = { tasks: [], shops: [], materials: { images: [], videos: [] }, auth: {}, meta: {} };
let selectedId = null;
let formVideo = '';
let pickerMode = 'draft';
const checkedIds = new Set();

function $(id) { return document.getElementById(id); }

function visibleTasks() {
  return filterTasks(state.tasks, $('taskSearch').value);
}

function syncCheckAll() {
  const ids = visibleTasks().map((t) => t.id);
  const box = $('checkAll');
  const all = ids.length > 0 && ids.every((id) => checkedIds.has(id));
  const some = ids.some((id) => checkedIds.has(id));
  box.checked = all;
  box.indeterminate = some && !all;
}

function toast(message, isError) {
  const el = $('toast');
  el.textContent = String(message || '').split('\n')[0];
  el.classList.toggle('err', Boolean(isError));
  el.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), isError ? 8000 : 6000);
}

function currentForm() {
  const shopSel = $('f-shop');
  const shopName = shopSel.selectedOptions[0]?.dataset.name || shopSel.value || '';
  const shopId = shopSel.selectedOptions[0]?.dataset.id || '';
  const task = state.tasks.find((t) => t.id === selectedId) || {};
  return {
    taskId: selectedId || `ui-${Date.now().toString(36)}`,
    productId: $('f-productId').value.trim(),
    draftId: task.draftId || ($('f-draftIdManual') ? $('f-draftIdManual').value.trim() : ''),
    title: $('f-title').value.trim(),
    price: $('f-price').value,
    currency: $('f-currency').value,
    skuPrefix: $('f-skuPrefix').value.trim(),
    notes: $('f-notes').value.trim(),
    mainImages: task.mainImages || [],
    galleryImages: task.galleryImages || [],
    skuImages: task.skuImages || [],
    video: formVideo || task.video || '',
    shopName,
    shopId,
    demo: Boolean(task.demo),
  };
}

function applyForm(task) {
  if ($('f-draftIdManual')) $('f-draftIdManual').value = task.draftId || '';
  $('f-productId').value = task.productId || '';
  const titleInput = $('f-title');
  titleInput.value = task.title || '';
  titleInput.scrollLeft = 0;
  try { titleInput.setSelectionRange(0, 0); } catch { /* not all inputs support this */ }
  requestAnimationFrame(() => { titleInput.scrollLeft = 0; });
  $('f-price').value = task.price || '';
  $('f-currency').value = task.currency || 'USD';
  $('f-skuPrefix').value = task.skuPrefix || '';
  $('f-notes').value = task.demo ? '' : (task.notes || '');
  formVideo = task.video || '';
  $('f-videoName').value = formVideo ? formVideo.split(/[\\/]/).pop() : '';
  const footTitle = task.title || '未命名任务';
  $('footTitle').textContent = footTitle;
  $('footTitle').title = task.title || '';
  $('footSub').textContent = task.demo
    ? '示意内容，不会拿去上架'
    : (task.skuPrefix ? `编号 ${task.skuPrefix}` : '先预览，再保存草稿');
  const shopSel = $('f-shop');
  const match = findShopOption([...shopSel.options], task);
  if (match) shopSel.value = match.value;
  renderPickerTriggers();
  renderThumbs();
}

function collectShopsForRun() {
  const fromState = realShops(state.shops);
  if (fromState.length) return fromState;
  const form = currentForm();
  if ((form.shopId || form.shopName) && !isPlaceholderShopName(form.shopName)) {
    return realShops([{ id: form.shopId, name: form.shopName }]);
  }
  return [];
}

function fileUrl(file) {
  if (!file) return '';
  if (file.startsWith('file:') || file.startsWith('data:')) return file;
  return 'file://' + file;
}

function renderRows() {
  const rows = visibleTasks();
  $('taskRows').innerHTML = rows.map((t) => {
    const thumb = taskListThumbHtml(t, fileUrl);
    const selected = t.id === selectedId ? 'selected' : '';
    const checked = checkedIds.has(t.id) ? 'checked' : '';
    return `<div class="task-row ${selected}" data-id="${t.id}">
      <div class="col-check"><input type="checkbox" data-check="${escapeAttr(t.id)}" ${checked} aria-label="选择 ${escapeAttr(t.title || '任务')}" /></div>
      <div class="product-cell">${thumb}<div class="prod-meta"><div class="prod-name">${escapeHtml(t.title || '未命名')}${t.demo ? '<span class="badge demo">示意</span>' : ''}</div><div class="prod-sku">${escapeHtml(t.skuPrefix ? 'SKU: ' + t.skuPrefix : (t.productId || ''))}</div></div></div>
      <div class="shop-cell">${escapeHtml(t.shopName || '未指定')}${t.site ? `<small>(${escapeHtml(t.site)})</small>` : ''}</div>
      <div class="price-cell">${escapeHtml(String(t.price || '—'))}<div class="prod-sku">${escapeHtml(t.currency || '')}</div></div>
      <div class="status-cell">${statusBadge(t)}${t.demo ? '' : escapeHtml(t.age || '')}</div>
      <div class="col-actions"><button type="button" class="row-del" data-delete="${escapeAttr(t.id)}">删除</button></div>
    </div>`;
  }).join('');
  const empty = $('emptyTasks');
  if (empty) empty.classList.toggle('hidden', rows.length > 0);
  for (const img of $('taskRows').querySelectorAll('img[data-fallback-thumb]')) {
    img.addEventListener('error', () => {
      const ph = document.createElement('div');
      ph.className = 'thumb ph';
      ph.textContent = '图';
      img.replaceWith(ph);
    });
  }
  syncCheckAll();
}

function renderThumbs() {
  const task = state.tasks.find((t) => t.id === selectedId) || { mainImages: [], galleryImages: [], skuImages: [] };
  paintThumbs('mainThumbs', task.mainImages || [], 'main');
  paintThumbs('galleryThumbs', task.galleryImages || [], 'gallery');
  paintThumbs('skuThumbs', (task.skuImages || []).map((x) => (typeof x === 'string' ? x : x.path)), 'sku');
}

function paintThumbs(id, files, kind) {
  $(id).innerHTML = files.filter(Boolean).map((file, index) => `
    <div class="tile ${kind === 'main' && index === 0 ? 'selected' : ''}">
      <img src="${fileUrl(file)}" alt="" />
      <button type="button" data-kind="${kind}" data-index="${index}">×</button>
    </div>
  `).join('');
}

function shopOptionLabel(shop) {
  const name = shop.name || (shop.id ? `店铺 ${shop.id}` : '未命名');
  if (shop.expired) return `${name}（已过期）`;
  if (shop.source === 'manual') return `${name}（手动添加）`;
  return name;
}

function renderShops() {
  const list = (state.shops || []).filter((shop) => shop && (shop.id || shop.name) && !shop.demo);
  const select = $('f-shop');
  const previousId = select.selectedOptions[0]?.dataset.id || '';
  const previousName = select.selectedOptions[0]?.dataset.name || '';
  if (!list.length) {
    const empty = state.auth?.loggedIn ? '还没有店铺。登录后仍列不出店时，请点「刷新店铺」。' : '还没有店铺。登录后会自动列出账号里的店。';
    select.innerHTML = `<option value="" disabled selected>${empty}</option>`;
    return;
  }
  select.innerHTML = list.map((s, i) => {
    const disabled = s.expired ? ' disabled' : '';
    return `<option value="${i}" data-name="${escapeAttr(s.name || '')}" data-id="${escapeAttr(s.id || '')}"${disabled}>${escapeHtml(shopOptionLabel(s))}</option>`;
  }).join('');
  const match = list.findIndex((s) => (previousId && s.id === previousId) || (!previousId && previousName && s.name === previousName));
  const firstUsable = list.findIndex((s) => !s.expired);
  select.value = String(match >= 0 ? match : (firstUsable >= 0 ? firstUsable : 0));
}

function renderAuth() {
  const auth = state.auth || {};
  const loggedIn = Boolean(auth.loggedIn);
  let status = '未登录';
  if (loggedIn) status = '已登录 Upseller';
  else if (auth.expired) status = '登录已失效，请重新登录';
  else if (auth.present && auth.networkError) status = '无法确认登录状态';
  $('loginPill').classList.toggle('on', loggedIn);
  $('loginPill').innerHTML = loggedIn ? '<i></i>已登录 Upseller' : '<i></i>未登录';
  $('userState').textContent = loggedIn ? '已登录 Upseller' : '未登录';
  $('authStatus').textContent = status;
  const loginBtn = $('loginBtn');
  loginBtn.textContent = loggedIn ? '重新登录' : '登录 Upseller';
  loginBtn.classList.toggle('primary', !loggedIn);
  const logoutBtn = $('logoutBtn');
  if (logoutBtn) logoutBtn.classList.toggle('hidden', !(loggedIn || auth.present || auth.expired));
  const hint = $('authHint');
  if (hint) hint.textContent = loggedIn ? '换账号请先退出登录。' : '登录后才能预览和保存草稿。';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

function renderPickerTriggers() {
  const task = state.tasks.find((item) => item.id === selectedId) || {};
  const draftLabel = draftPickerLabel(task);
  const productLabel = productPickerLabel(task);
  const draftEl = $('draftPickerLabelText');
  const productEl = $('productPickerLabelText');
  if (draftEl) {
    draftEl.textContent = draftLabel || '从草稿箱选择';
    draftEl.classList.toggle('is-placeholder', !draftLabel);
  }
  if (productEl) {
    productEl.textContent = productLabel || '复制在线商品';
    productEl.classList.toggle('is-placeholder', !productLabel);
  }
}

function renderPickerShops(select) {
  const shops = (state.shops || []).filter((shop) => shop && (shop.id || shop.name) && !shop.demo);
  const previousShop = select.value;
  select.innerHTML = '<option value="">全部店铺</option>' + shops.map((shop) =>
    `<option value="${escapeAttr(shop.id || '')}">${escapeHtml(shop.name || shop.id || '')}</option>`
  ).join('');
  if ([...select.options].some((option) => option.value === previousShop)) select.value = previousShop;
}

function renderPickerModal() {
  const body = $('pickerRows');
  const shopFilter = $('pickerShop');
  if (!body || !shopFilter) return;
  renderPickerShops(shopFilter);
  const query = $('pickerSearch') ? $('pickerSearch').value : '';
  const all = pickerMode === 'draft' ? (state.drafts || []) : (state.products || []);
  const error = pickerMode === 'draft' ? state.draftsError : state.productsError;
  const rows = filterListedItems(all, { shopId: shopFilter.value, query });
  const task = state.tasks.find((item) => item.id === selectedId) || {};
  const selectedKey = pickerMode === 'draft'
    ? String(task.draftId || '')
    : (task.draftId ? '' : String(task.productId || ''));
  if (!state.auth?.loggedIn) {
    body.innerHTML = `<div class="picker-empty">${pickerMode === 'draft' ? '登录后显示草稿' : '登录后显示在线商品'}</div>`;
    return;
  }
  if (error && !all.length) {
    body.innerHTML = `<div class="picker-empty">${escapeHtml(error)}</div>`;
    return;
  }
  if (!rows.length) {
    const empty = query
      ? '没有匹配的结果'
      : (pickerMode === 'draft' ? '还没有草稿' : '还没有在线商品');
    body.innerHTML = `<div class="picker-empty">${empty}</div>`;
    return;
  }
  body.innerHTML = rows.map((row) => {
    const id = pickerMode === 'draft' ? row.draftId : row.productId;
    const selected = selectedKey && String(id) === selectedKey ? 'is-selected' : '';
    const thumb = pickerThumbHtml(row);
    const title = row.title || (pickerMode === 'draft' ? '未命名草稿' : '未命名商品');
    const shop = row.shopName || row.shopId || '未指定';
    return `<div class="picker-row ${selected}" data-id="${escapeAttr(id)}" data-kind="${pickerMode}">
      <div class="picker-col-product">${thumb}<div class="picker-title-wrap"><div class="picker-title">${escapeHtml(title)}</div></div></div>
      <div class="picker-col-shop">${escapeHtml(shop)}${row.site ? `<small>${escapeHtml(row.site)}</small>` : ''}</div>
      <div class="picker-col-price">${escapeHtml(formatListPrice(row))}</div>
    </div>`;
  }).join('');
}

async function fetchDrafts({ quiet = true } = {}) {
  if (!api.listDrafts || !state.auth?.loggedIn) {
    state.drafts = [];
    state.draftsError = '';
    renderPickerTriggers();
    if (pickerMode === 'draft' && $('pickerModal') && !$('pickerModal').classList.contains('hidden')) renderPickerModal();
    return;
  }
  const out = await api.listDrafts();
  if (out?.ok) {
    state.drafts = Array.isArray(out.drafts) ? out.drafts : [];
    state.draftsError = '';
  } else {
    if (!Array.isArray(state.drafts)) state.drafts = [];
    state.draftsError = out?.error || '没能列出草稿';
  }
  renderPickerTriggers();
  if (pickerMode === 'draft' && $('pickerModal') && !$('pickerModal').classList.contains('hidden')) renderPickerModal();
  if (state.draftsError && !quiet) toast(state.draftsError, true);
}

async function fetchProducts({ quiet = true } = {}) {
  if (!api.listProducts || !state.auth?.loggedIn) {
    state.products = [];
    state.productsError = '';
    renderPickerTriggers();
    if (pickerMode === 'product' && $('pickerModal') && !$('pickerModal').classList.contains('hidden')) renderPickerModal();
    return;
  }
  const out = await api.listProducts();
  if (out?.ok) {
    state.products = Array.isArray(out.products) ? out.products : [];
    state.productsError = '';
  } else {
    if (!Array.isArray(state.products)) state.products = [];
    state.productsError = out?.error || '没能列出在线商品';
  }
  renderPickerTriggers();
  if (pickerMode === 'product' && $('pickerModal') && !$('pickerModal').classList.contains('hidden')) renderPickerModal();
  if (state.productsError && !quiet) toast(state.productsError, true);
}

function closePicker() {
  const modal = $('pickerModal');
  if (modal) modal.classList.add('hidden');
}

async function openPicker(mode) {
  pickerMode = mode === 'product' ? 'product' : 'draft';
  const title = $('pickerTitle');
  if (title) title.textContent = pickerMode === 'draft' ? '从草稿箱选择' : '复制在线商品';
  if ($('pickerSearch')) $('pickerSearch').value = '';
  const modal = $('pickerModal');
  if (modal) modal.classList.remove('hidden');
  renderPickerModal();
  if (pickerMode === 'draft') await fetchDrafts({ quiet: true });
  else await fetchProducts({ quiet: true });
}

function taskForSourceBind() {
  let task = state.tasks.find((item) => item.id === selectedId);
  if (!task) {
    task = createProduct();
    selectedId = task.id;
    state.tasks = [task, ...state.tasks];
    return task;
  }
  if (isSubmittedTask(task)) return task;
  const form = currentForm();
  Object.assign(task, form, { id: task.id, status: task.status || 'draft', demo: Boolean(task.demo) });
  return task;
}

function replaceBoundTask(current, bound) {
  const next = applyBoundTaskToList(state.tasks, bound, { selectedId, checkedIds });
  state.tasks = next.tasks;
  selectedId = next.selectedId;
  checkedIds.clear();
  for (const id of next.checkedIds) checkedIds.add(id);
  return state.tasks.find((task) => task.id === selectedId) || bound.task || current;
}

function bindResultToast(kind, bound) {
  if (kind === 'product') {
    if (bound.forked) return '已新增任务并复制在线商品';
    if (bound.rotated) return '已换到新的任务并复制在线商品';
    return '已复制在线商品';
  }
  if (bound.forked) return '已新增任务并载入草稿';
  if (bound.rotated) return '已换到新的任务并载入草稿';
  return '已载入草稿';
}

async function bindDraft(id) {
  const draftId = String(id || '').trim();
  if (!draftId) {
    toast('请选择草稿或输入编号', true);
    return;
  }
  const out = await api.loadDraft(draftId);
  if (!out.ok) {
    const msg = out.error || '载入草稿失败';
    toast(msg.startsWith('载入草稿') ? msg : `载入草稿：${msg}`, true);
    return;
  }
  const current = taskForSourceBind();
  const bound = bindSourceToTask(current, { kind: 'draft', draft: out.draft, draftId: out.draftId || draftId });
  const task = replaceBoundTask(current, bound);
  await persistTasks(state.tasks);
  applyForm(task);
  renderRows();
  toast(bindResultToast('draft', bound));
}

async function bindOnlineProduct(id) {
  const productId = String(id || '').trim();
  if (!productId) {
    toast('请选择在线商品', true);
    return;
  }
  const product = (state.products || []).find((row) => String(row.productId) === productId);
  if (!product) {
    toast('找不到这个产品。请从列表里重新选择。', true);
    return;
  }
  const current = taskForSourceBind();
  const bound = bindSourceToTask(current, { kind: 'product', product });
  const task = replaceBoundTask(current, bound);
  await persistTasks(state.tasks);
  applyForm(task);
  renderRows();
  toast(bindResultToast('product', bound));
}

async function loadDraftById(id) {
  await bindDraft(id);
}

async function refresh({ refreshShops = true } = {}) {
  state = await api.getState();
  if (refreshShops && state.auth?.loggedIn && api.refreshShops) {
    const listed = await api.refreshShops();
    if (listed) {
      state = { ...state, ...listed };
    }
  }
  if (!state.tasks) state.tasks = [];
  const seeded = ensureTaskList(state, demoTasks);
  state.tasks = seeded.tasks;
  state.settings = seeded.settings;
  if (seeded.seeded) await api.saveState({ tasks: state.tasks, settings: state.settings });
  renderShops();
  renderRows();
  renderAuth();
  await fetchDrafts();
  if (selectedId) {
    const task = state.tasks.find((t) => t.id === selectedId);
    if (task) applyForm(task);
    else renderThumbs();
  }
}

function persistTasks(tasks) {
  return api.saveState({ tasks, settings: state.settings });
}

function ensureTask() {
  let task = state.tasks.find((t) => t.id === selectedId);
  if (!task) {
    task = createProduct();
    selectedId = task.id;
    state.tasks = [task, ...state.tasks];
  }
  const form = currentForm();
  const keepDemo = Boolean(task.demo);
  Object.assign(task, form, { id: task.id, status: task.status || 'draft', demo: keepDemo });
  return task;
}

async function removeTasks(ids) {
  const removed = ids.filter(Boolean);
  if (!removed.length) {
    toast('请先勾选要删除的产品', true);
    return;
  }
  state.tasks = deleteTasks(state.tasks, removed);
  selectedId = nextSelectedId(state.tasks, removed, selectedId);
  for (const id of removed) checkedIds.delete(id);
  await persistTasks(state.tasks);
  const task = state.tasks.find((t) => t.id === selectedId);
  if (task) applyForm(task);
  else applyForm({ title: '', status: 'draft' });
  renderRows();
}

async function addImages(kind) {
  const files = await api.pickFiles(kind === 'video' ? 'video' : (kind === 'main' ? 'main' : 'images'));
  if (!files?.length) return;
  const task = ensureTask();
  if (kind === 'main') task.mainImages = [files[0]];
  else if (kind === 'gallery') task.galleryImages = [...(task.galleryImages || []), ...files];
  else if (kind === 'sku') task.skuImages = [...(task.skuImages || []), ...files.map((path) => ({ path }))];
  else if (kind === 'video') {
    formVideo = files[0];
    task.video = files[0];
    $('f-videoName').value = files[0].split(/[\\/]/).pop();
  }
  await persistTasks(state.tasks);
  applyForm(task);
  renderRows();
}

async function run(mode, confirmPublish = false) {
  const task = state.tasks.find((t) => t.id === selectedId);
  const form = task ? { ...currentForm(), demo: Boolean(task.demo) } : currentForm();
  const blocked = runBlockReason({ form, shops: collectShopsForRun(), demo: Boolean(form.demo) });
  if (blocked) {
    toast(blocked, true);
    return { ok: false, error: blocked };
  }
  const saved = ensureTask();
  await persistTasks(state.tasks);
  const result = await api.runAction({
    mode,
    confirmPublish,
    form: currentForm(),
    shops: collectShopsForRun(),
  });
  if (!result?.ok) {
    const label = mode === 'preview' ? '预览' : mode === 'save-draft' ? '保存草稿' : '发布';
    const msg = result?.error || '操作没完成，请再试一次。';
    toast(msg.startsWith(label) ? msg : `${label}：${msg}`, true);
    return result;
  }
  toast(successActionToast(mode, { videoIgnored: Boolean(result.videoIgnored) }));
  if (mode === 'save-draft') {
    const marked = markTaskSaved(saved, { draftId: result?.draftId || result?.result?.draftId || saved.draftId });
    Object.assign(saved, marked, { status: isSubmittedTask(saved) ? saved.status : marked.status });
  }
  if (mode === 'publish') saved.status = statusAfterSuccessfulAction('publish', saved.status);
  await persistTasks(state.tasks);
  renderRows();
  return result;
}

document.querySelectorAll('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.page').forEach((p) => p.classList.toggle('active', p.id === 'page-' + btn.dataset.nav));
  });
});

document.querySelectorAll('[data-win]').forEach((btn) => {
  btn.addEventListener('click', () => api.windowControl(btn.dataset.win));
});

$('taskSearch').addEventListener('input', renderRows);
$('taskRows').addEventListener('click', async (e) => {
  const box = e.target.closest('input[data-check]');
  if (box) {
    e.stopPropagation();
    const id = box.dataset.check;
    if (box.checked) checkedIds.add(id);
    else checkedIds.delete(id);
    syncCheckAll();
    return;
  }
  const row = e.target.closest('.task-row');
  if (!row) return;
  selectedId = row.dataset.id;
  const del = e.target.closest('button[data-delete]');
  if (del) {
    e.stopPropagation();
    await removeTasks([del.dataset.delete]);
    return;
  }
  const task = state.tasks.find((t) => t.id === selectedId);
  renderRows();
  if (task) applyForm(task);
});
$('checkAll').addEventListener('click', (e) => {
  e.stopPropagation();
  const on = $('checkAll').checked;
  for (const t of visibleTasks()) {
    if (on) checkedIds.add(t.id);
    else checkedIds.delete(t.id);
  }
  renderRows();
});
$('newTaskBtn').addEventListener('click', async () => {
  const task = createProduct();
  selectedId = task.id;
  state.tasks = [task, ...state.tasks];
  await persistTasks(state.tasks);
  applyForm(task);
  renderRows();
});
$('deleteSelectedBtn').addEventListener('click', async () => {
  await removeTasks([...checkedIds]);
});

$('addMain').addEventListener('click', () => addImages('main'));
$('addGallery').addEventListener('click', () => addImages('gallery'));
$('addSku').addEventListener('click', () => addImages('sku'));
$('pickVideoBtn').addEventListener('click', () => addImages('video'));
$('clearVideoBtn').addEventListener('click', async () => {
  formVideo = '';
  $('f-videoName').value = '';
  const task = ensureTask();
  task.video = '';
  await persistTasks(state.tasks);
});

['mainThumbs', 'galleryThumbs', 'skuThumbs'].forEach((id) => {
  $(id).addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-kind]');
    if (!btn) return;
    const task = ensureTask();
    const kind = btn.dataset.kind;
    const index = Number(btn.dataset.index);
    if (kind === 'main') task.mainImages.splice(index, 1);
    if (kind === 'gallery') task.galleryImages.splice(index, 1);
    if (kind === 'sku') task.skuImages.splice(index, 1);
    await persistTasks(state.tasks);
    applyForm(task);
  });
});

$('btnPreview').addEventListener('click', () => run('preview'));
$('btnDraft').addEventListener('click', () => run('save-draft'));
$('btnPublish').addEventListener('click', () => $('confirmModal').classList.remove('hidden'));
$('cancelPublish').addEventListener('click', () => $('confirmModal').classList.add('hidden'));
$('confirmPublish').addEventListener('click', async () => {
  $('confirmModal').classList.add('hidden');
  await run('publish', true);
});

$('toggleShopAdd').addEventListener('click', () => {
  $('shopAddRow').classList.toggle('hidden');
});
$('addShopBtn').addEventListener('click', async () => {
  const name = $('shopName').value.trim();
  const id = $('shopId').value.trim();
  if (!name && !id) return toast('请填写店铺名称或编号', true);
  state.shops = [...(state.shops || []), { name, id, source: 'manual' }];
  $('shopName').value = '';
  $('shopId').value = '';
  $('shopAddRow').classList.add('hidden');
  await api.saveState({ shops: state.shops });
  renderShops();
  const real = realShops(state.shops);
  if (real.length) $('f-shop').value = String(real.length - 1);
  toast('已添加店铺');
});

$('logoutBtn').addEventListener('click', async () => {
  const out = await api.logout();
  if (out) state = { ...state, ...out };
  renderAuth();
  renderShops();
  state.drafts = [];
  state.products = [];
  state.draftsError = '';
  state.productsError = '';
  renderPickerTriggers();
  if (out?.ok) toast('已退出登录');
  else toast(out?.error || '退出登录未完成', true);
});
$('loginBtn').addEventListener('click', async () => {
  toast('正在打开登录窗口，请在弹出的页面里完成登录');
  const out = await api.login({ timeoutMs: 300000 });
  state.auth = out.auth || state.auth;
  if (Array.isArray(out.shops)) state.shops = out.shops;
  if (out.shopsError) state.shopsError = out.shopsError;
  renderAuth();
  renderShops();
  if (out.ok) {
    await fetchDrafts();
    toast(Array.isArray(out.shops) && out.shops.length ? '登录成功，已列出账号里的店铺' : '登录成功');
  } else toast(out.error || '登录未完成', true);
});
$('refreshAuthBtn').addEventListener('click', () => refresh({ refreshShops: true }));
$('refreshShopsBtn').addEventListener('click', async () => {
  if (!state.auth?.loggedIn) return toast('请先到「设置」里登录，登录后会自动列出账号里的店。', true);
  const listed = await api.refreshShops();
  if (listed) state = { ...state, ...listed };
  renderShops();
  if (state.shopsError) toast(state.shopsError, true);
  else toast(realShops(state.shops).length ? '已更新账号里的店铺' : '账号里还没有可用的店铺');
});
$('loadDraftBtn').addEventListener('click', async () => {
  await loadDraftById($('f-draftIdManual').value);
});
$('openDraftPickerBtn').addEventListener('click', () => openPicker('draft'));
$('openProductPickerBtn').addEventListener('click', () => openPicker('product'));
$('refreshDraftsBtn').addEventListener('click', async () => {
  if (!state.auth?.loggedIn) return toast('请先到「设置」里登录', true);
  await fetchDrafts({ quiet: false });
  if (!state.draftsError) toast((state.drafts || []).length ? '已更新草稿' : '还没有草稿');
});
$('refreshProductsBtn').addEventListener('click', async () => {
  if (!state.auth?.loggedIn) return toast('请先到「设置」里登录', true);
  await fetchProducts({ quiet: false });
  if (!state.productsError) toast((state.products || []).length ? '已更新在线商品' : '还没有在线商品');
});
$('pickerClose').addEventListener('click', closePicker);
$('pickerModal').addEventListener('click', (e) => {
  if (e.target === $('pickerModal')) closePicker();
});
$('pickerSearch').addEventListener('input', renderPickerModal);
$('pickerShop').addEventListener('change', renderPickerModal);
$('pickerRefresh').addEventListener('click', async () => {
  if (!state.auth?.loggedIn) return toast('请先到「设置」里登录', true);
  if (pickerMode === 'draft') {
    await fetchDrafts({ quiet: false });
    if (!state.draftsError) toast((state.drafts || []).length ? '已更新草稿' : '还没有草稿');
  } else {
    await fetchProducts({ quiet: false });
    if (!state.productsError) toast((state.products || []).length ? '已更新在线商品' : '还没有在线商品');
  }
});
$('pickerRows').addEventListener('click', async (e) => {
  const row = e.target.closest('.picker-row');
  if (!row) return;
  const id = row.dataset.id;
  if (row.dataset.kind === 'product') await bindOnlineProduct(id);
  else await bindDraft(id);
  closePicker();
});

refresh().then(() => {
  if (state.tasks.length) {
    selectedId = state.tasks[0].id;
    applyForm(state.tasks[0]);
  }
  renderRows();
}).catch((err) => toast(String(err?.message || err).split('\n')[0], true));
