import { ensureTaskList, deleteTasks, createProduct, nextSelectedId, visibleTasks as filterTasks } from './task-list.mjs';

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
    copyToShopCount: 1,
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
  toast._t = setTimeout(() => el.classList.add('hidden'), 6000);
}

function currentForm() {
  const shopSel = $('f-shop');
  const shopName = shopSel.selectedOptions[0]?.dataset.name || shopSel.value || '';
  const shopId = shopSel.selectedOptions[0]?.dataset.id || '';
  const task = state.tasks.find((t) => t.id === selectedId) || {};
  return {
    taskId: selectedId || `ui-${Date.now().toString(36)}`,
    productId: $('f-productId').value.trim(),
    draftId: task.draftId || '',
    title: $('f-title').value.trim(),
    price: $('f-price').value,
    currency: $('f-currency').value,
    skuPrefix: $('f-skuPrefix').value.trim(),
    notes: $('f-notes').value.trim(),
    copyToShopCount: Number($('f-copyCount').value) || 1,
    mainImages: task.mainImages || [],
    galleryImages: task.galleryImages || [],
    skuImages: task.skuImages || [],
    video: formVideo || task.video || '',
    shopName,
    shopId,
  };
}

function applyForm(task) {
  $('f-productId').value = task.productId || task.draftId || '';
  $('f-title').value = task.title || '';
  $('f-price').value = task.price || '';
  $('f-currency').value = task.currency || 'USD';
  $('f-skuPrefix').value = task.skuPrefix || '';
  $('f-notes').value = task.demo ? '' : (task.notes || '');
  $('f-copyCount').value = task.copyToShopCount || 1;
  formVideo = task.video || '';
  $('f-videoName').value = formVideo ? formVideo.split(/[\\/]/).pop() : '';
  $('footTitle').textContent = task.title || '未命名任务';
  $('footSub').textContent = task.demo
    ? '示意内容，不会拿去上架'
    : (task.skuPrefix ? `编号 ${task.skuPrefix}` : '先预览，再保存草稿');
  const shopSel = $('f-shop');
  if (task.shopId || task.shopName) {
    const match = [...shopSel.options].find((o) => o.dataset.id === task.shopId || o.dataset.name === task.shopName);
    if (match) shopSel.value = match.value;
  }
  renderThumbs();
}

function collectShopsForRun() {
  const form = currentForm();
  const fromState = (state.shops || []).filter((s) => !s.demo);
  if (fromState.length) return fromState;
  if (form.shopId || form.shopName) return [{ id: form.shopId, name: form.shopName }];
  return [];
}

function statusBadge(status) {
  if (status === 'live') return '<span class="badge live"><i></i>已发布</span>';
  if (status === 'wait') return '<span class="badge wait"><i></i>待发布</span>';
  return '<span class="badge draft"><i></i>草稿</span>';
}

function fileUrl(file) {
  if (!file) return '';
  if (file.startsWith('file:') || file.startsWith('data:')) return file;
  return 'file://' + file;
}

function renderRows() {
  const rows = visibleTasks();
  $('taskRows').innerHTML = rows.map((t) => {
    const thumb = (t.mainImages && t.mainImages[0])
      ? `<img class="thumb" src="${fileUrl(t.mainImages[0])}" alt="" />`
      : `<div class="thumb ph">图</div>`;
    const selected = t.id === selectedId ? 'selected' : '';
    const checked = checkedIds.has(t.id) ? 'checked' : '';
    return `<div class="task-row ${selected}" data-id="${t.id}">
      <div class="col-check"><input type="checkbox" data-check="${escapeAttr(t.id)}" ${checked} aria-label="选择 ${escapeAttr(t.title || '任务')}" /></div>
      <div class="product-cell">${thumb}<div><div class="prod-name">${escapeHtml(t.title || '未命名')}${t.demo ? '<span class="badge demo">示意</span>' : ''}</div><div class="prod-sku">${escapeHtml(t.skuPrefix ? 'SKU: ' + t.skuPrefix : (t.productId || ''))}</div></div></div>
      <div class="shop-cell">${escapeHtml(t.shopName || '未指定')}${t.site ? `<small>(${escapeHtml(t.site)})</small>` : ''}</div>
      <div class="price-cell">${escapeHtml(String(t.price || '—'))}<div class="prod-sku">${escapeHtml(t.currency || '')}</div></div>
      <div class="status-cell">${statusBadge(t.status)}${escapeHtml(t.age || '')}</div>
      <div class="col-actions"><button type="button" class="row-del" data-delete="${escapeAttr(t.id)}">删除</button></div>
    </div>`;
  }).join('');
  const empty = $('emptyTasks');
  if (empty) empty.classList.toggle('hidden', rows.length > 0);
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

function renderShops() {
  const list = state.shops || [];
  const select = $('f-shop');
  const previous = select.value;
  const options = list.length ? list : [{ name: '目标店铺 A', id: '', demo: true }, { name: '目标店铺 B', id: '', demo: true }, { name: '目标店铺 C', id: '', demo: true }];
  select.innerHTML = options.map((s, i) => `<option value="${i}" data-name="${escapeAttr(s.name || '')}" data-id="${escapeAttr(s.id || '')}">${escapeHtml(s.name || '未命名')}${s.demo ? '（示意）' : ''}</option>`).join('');
  if (previous) select.value = previous;
}

function renderAuth() {
  const auth = state.auth || {};
  const loggedIn = Boolean(auth.loggedIn);
  $('loginPill').classList.toggle('on', loggedIn);
  $('loginPill').innerHTML = loggedIn ? '<i></i>已登录' : '<i></i>未登录';
  $('userState').textContent = loggedIn ? '已登录' : '未登录';
  $('authStatus').textContent = loggedIn ? '当前已登录' : '当前未登录';
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

async function refresh() {
  state = await api.getState();
  if (!state.tasks) state.tasks = [];
  const seeded = ensureTaskList(state, demoTasks);
  state.tasks = seeded.tasks;
  state.settings = seeded.settings;
  if (seeded.seeded) await api.saveState({ tasks: state.tasks, settings: state.settings });
  renderShops();
  renderRows();
  renderAuth();
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
  Object.assign(task, form, { id: task.id, status: task.status || 'draft', demo: false });
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
  const task = ensureTask();
  await persistTasks(state.tasks);
  const result = await api.runAction({
    mode,
    confirmPublish,
    form: currentForm(),
    shops: collectShopsForRun(),
  });
  if (!result?.ok) {
    toast(result?.error || '操作未完成', true);
    return result;
  }
  const prefix = mode === 'preview' ? '预览完成，没有写入草稿，也没有发布' : mode === 'save-draft' ? '已请求保存草稿，不会发布' : '已提交发布请求。试用版不宣称已在真机刊登通过';
  toast(result.videoIgnored ? `${prefix}。所选视频不会进入上架流程。` : prefix);
  if (mode === 'save-draft') task.status = 'draft';
  if (mode === 'publish') task.status = 'wait';
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
  state.shops = [...(state.shops || []), { name, id }];
  $('shopName').value = '';
  $('shopId').value = '';
  $('shopAddRow').classList.add('hidden');
  await api.saveState({ shops: state.shops });
  renderShops();
  $('f-shop').value = String(state.shops.length - 1);
  toast('已添加店铺');
});

$('loginBtn').addEventListener('click', async () => {
  toast('正在打开登录窗口，请在弹出的页面里完成登录');
  const out = await api.login({ timeoutMs: 300000 });
  state.auth = out.auth || state.auth;
  renderAuth();
  if (out.ok) toast('登录成功');
  else toast(out.error || '登录未完成', true);
});
$('refreshAuthBtn').addEventListener('click', refresh);
$('loadDraftBtn').addEventListener('click', async () => {
  const id = $('f-productId').value.trim();
  if (!id) return toast('请先填写草稿编号', true);
  const out = await api.loadDraft(id);
  if (!out.ok) return toast(out.error || '载入草稿失败', true);
  const task = ensureTask();
  task.draftId = out.draftId;
  task.productId = out.draft?.itemId || task.productId;
  task.title = out.draft?.itemTitle || task.title;
  task.price = out.draft?.price ?? task.price;
  task.currency = out.draft?.currency || task.currency;
  task.shopName = out.draft?.shopName || task.shopName;
  await persistTasks(state.tasks);
  applyForm(task);
  toast('已载入草稿');
});

refresh().then(() => {
  if (state.tasks.length) {
    selectedId = state.tasks[0].id;
    applyForm(state.tasks[0]);
  }
  renderRows();
}).catch((err) => toast(String(err?.message || err).split('\n')[0], true));
