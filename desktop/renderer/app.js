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
    notes: '示意数据，不是真实店铺或真实商品',
  };
}

let state = { tasks: [], shops: [], materials: { images: [], videos: [] }, auth: {}, meta: {} };
let selectedId = null;
let formVideo = '';

function $(id) { return document.getElementById(id); }

function toast(message, isError) {
  const el = $('toast');
  el.textContent = message;
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
  $('f-notes').value = task.notes || '';
  $('f-copyCount').value = task.copyToShopCount || 1;
  formVideo = task.video || '';
  $('f-videoName').value = formVideo ? formVideo.split(/[\\/]/).pop() : '';
  $('footTitle').textContent = task.title || '未命名任务';
  $('footSub').textContent = task.demo
    ? '示意数据，仅用于对照风格，不会当作真实店铺上架'
    : (task.skuPrefix ? `SKU: ${task.skuPrefix}` : '先预览，再保存草稿；发布需二次确认');
  const shopSel = $('f-shop');
  if (task.shopId || task.shopName) {
    const match = [...shopSel.options].find((o) => o.dataset.id === task.shopId || o.dataset.name === task.shopName);
    if (match) shopSel.value = match.value;
  }
  renderThumbs();
}

function collectShopsForRun() {
  const form = currentForm();
  const fromState = state.shops || [];
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
  const q = $('taskSearch').value.trim().toLowerCase();
  const rows = (state.tasks.length ? state.tasks : demoTasks).filter((t) => {
    const blob = `${t.title || ''} ${t.skuPrefix || ''} ${t.productId || ''}`.toLowerCase();
    return !q || blob.includes(q);
  });
  $('taskRows').innerHTML = rows.map((t) => {
    const thumb = (t.mainImages && t.mainImages[0])
      ? `<img class="thumb" src="${fileUrl(t.mainImages[0])}" alt="" />`
      : `<div class="thumb ph">图</div>`;
    const selected = t.id === selectedId ? 'selected' : '';
    return `<div class="task-row ${selected}" data-id="${t.id}">
      <div><input type="checkbox" /></div>
      <div class="product-cell">${thumb}<div><div class="prod-name">${escapeHtml(t.title || '未命名')}${t.demo ? '<span class="badge demo">示意</span>' : ''}</div><div class="prod-sku">${escapeHtml(t.skuPrefix ? 'SKU: ' + t.skuPrefix : (t.productId || ''))}</div></div></div>
      <div class="shop-cell">${escapeHtml(t.shopName || '未指定')}${t.site ? `<small>(${escapeHtml(t.site)})</small>` : ''}</div>
      <div class="price-cell">${escapeHtml(String(t.price || '—'))}<div class="prod-sku">${escapeHtml(t.currency || '')}</div></div>
      <div class="status-cell">${statusBadge(t.status)}${escapeHtml(t.age || '')}</div>
    </div>`;
  }).join('');
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
  $('shopList').innerHTML = list.length
    ? list.map((s, i) => `<div class="list-item"><div>${escapeHtml(s.name || '未命名')}<div class="prod-sku">${escapeHtml(s.id || '无店铺ID')}</div></div><button class="ghost" data-del-shop="${i}">删除</button></div>`).join('')
    : '<p class="lede">还没有店铺。添加后可用于「目标店铺」和「复制到几店」。请使用你自己的店铺，不要把示意名称当成真实店铺。</p>';
  const select = $('f-shop');
  const previous = select.value;
  const options = list.length ? list : [{ name: '目标店铺 A', id: '', demo: true }, { name: '目标店铺 B', id: '', demo: true }, { name: '目标店铺 C', id: '', demo: true }];
  select.innerHTML = options.map((s, i) => `<option value="${i}" data-name="${escapeAttr(s.name || '')}" data-id="${escapeAttr(s.id || '')}">${escapeHtml(s.name || '未命名')}${s.demo ? '（示意）' : ''}</option>`).join('');
  if (previous) select.value = previous;
}

function renderMaterials() {
  const images = state.materials?.images || [];
  $('matThumbs').innerHTML = images.map((file) => `<div class="tile"><img src="${fileUrl(file)}" alt="" /></div>`).join('')
    || '<p class="lede">还没有素材。</p>';
}

function renderAuth() {
  const auth = state.auth || {};
  const loggedIn = Boolean(auth.loggedIn);
  $('loginPill').classList.toggle('on', loggedIn);
  $('loginPill').innerHTML = loggedIn ? '<i></i>已登录' : '<i></i>未登录';
  $('userState').textContent = loggedIn ? `已登录 · cookieLen=${auth.cookieLen || 0} deviceIdLen=${auth.deviceIdLen || 0}` : '未登录';
  $('authKv').innerHTML = [
    ['登录状态', loggedIn ? '已登录' : '未登录'],
    ['cookieLen', auth.cookieLen ?? 0],
    ['deviceIdLen', auth.deviceIdLen ?? 0],
    ['env 权限', auth.mode || '—'],
    ['env 路径', auth.envPath || '—'],
    ['固定批次', state.meta?.productConcurrency || 8],
    ['需要 Cursor', '否'],
    ['需要 Codex', '否'],
  ].map(([k, v]) => `<dt>${escapeHtml(String(k))}</dt><dd>${escapeHtml(String(v))}</dd>`).join('');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

async function refresh() {
  state = await api.getState();
  if (!state.tasks) state.tasks = [];
  renderShops();
  renderRows();
  renderMaterials();
  renderAuth();
  if (selectedId) {
    const task = state.tasks.find((t) => t.id === selectedId);
    if (task) applyForm(task);
    else renderThumbs();
  }
}

function persistTasks(tasks) {
  return api.saveState({ tasks });
}

function ensureTask() {
  let task = state.tasks.find((t) => t.id === selectedId);
  if (!task || task.demo) {
    task = {
      id: selectedId && !String(selectedId).startsWith('t-demo-') ? selectedId : `ui-${Date.now().toString(36)}`,
      status: 'draft',
      mainImages: [],
      galleryImages: [],
      skuImages: [],
    };
    selectedId = task.id;
    state.tasks = [task, ...state.tasks.filter((t) => !t.demo && t.id !== task.id)];
  }
  const form = currentForm();
  Object.assign(task, form, { id: task.id, status: task.status || 'draft', demo: false });
  return task;
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
    toast((result?.error || '操作未完成') + (result?.warnings?.length ? `\n${result.warnings.join('\n')}` : ''), true);
    return result;
  }
  const prefix = mode === 'preview' ? '预览完成（未写草稿、未发布）' : mode === 'save-draft' ? '已请求保存草稿（未发布）' : '已提交发布请求（实机结果需由 IZ 验收，试用版不宣称已实机通过）';
  const extra = [result.warnings?.join('\n'), result.videoIgnored ? '视频未进入上架流程。' : ''].filter(Boolean).join('\n');
  toast([prefix, extra].filter(Boolean).join('\n'));
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
$('taskRows').addEventListener('click', (e) => {
  const row = e.target.closest('.task-row');
  if (!row) return;
  selectedId = row.dataset.id;
  const task = (state.tasks.length ? state.tasks : demoTasks).find((t) => t.id === selectedId);
  renderRows();
  if (task) applyForm(task);
});
$('taskRows').addEventListener('click', (e) => {
  if (e.target.matches('button[data-kind]')) {
    e.stopPropagation();
  }
});
$('newTaskBtn').addEventListener('click', async () => {
  const task = { id: `ui-${Date.now().toString(36)}`, title: '新任务', status: 'draft', copyToShopCount: 1, mainImages: [], galleryImages: [], skuImages: [] };
  selectedId = task.id;
  state.tasks = [task, ...state.tasks.filter((t) => !t.demo)];
  await persistTasks(state.tasks);
  applyForm(task);
  renderRows();
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

$('addShopBtn').addEventListener('click', async () => {
  const name = $('shopName').value.trim();
  const id = $('shopId').value.trim();
  if (!name && !id) return toast('请填写店铺名称或 ID', true);
  state.shops = [...(state.shops || []), { name, id }];
  $('shopName').value = '';
  $('shopId').value = '';
  await api.saveState({ shops: state.shops });
  renderShops();
});
$('shopList').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-del-shop]');
  if (!btn) return;
  state.shops.splice(Number(btn.dataset.delShop), 1);
  await api.saveState({ shops: state.shops });
  renderShops();
});

$('addMatImages').addEventListener('click', async () => {
  const files = await api.pickFiles('images');
  if (!files?.length) return;
  state.materials = state.materials || { images: [], videos: [] };
  state.materials.images = [...(state.materials.images || []), ...files];
  await api.saveState({ materials: state.materials });
  renderMaterials();
});
$('addMatVideo').addEventListener('click', async () => {
  const files = await api.pickFiles('video');
  if (!files?.length) return;
  state.materials = state.materials || { images: [], videos: [] };
  state.materials.videos = [...(state.materials.videos || []), ...files];
  toast('视频已加入本机素材库。当前上架能力尚不处理视频。');
});

$('loginBtn').addEventListener('click', async () => {
  toast('正在打开登录浏览器，完成后只回报长度…');
  const out = await api.login({ timeoutMs: 300000 });
  state.auth = out.auth || state.auth;
  renderAuth();
  if (out.ok) toast(`登录成功。cookieLen=${out.cookieLen} deviceIdLen=${out.deviceIdLen} mode=${out.mode || ''}`);
  else toast(out.error || '登录未完成', true);
});
$('refreshAuthBtn').addEventListener('click', refresh);
$('loadDraftBtn').addEventListener('click', async () => {
  const id = $('f-productId').value.trim();
  if (!id) return toast('请先填写草稿 ID', true);
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
  toast('已载入草稿摘要（不含密钥）');
});

refresh().then(() => {
  if (!state.tasks.length) {
    selectedId = demoTasks[0].id;
    applyForm(demoTasks[0]);
  } else {
    selectedId = state.tasks[0].id;
    applyForm(state.tasks[0]);
  }
  renderRows();
}).catch((err) => toast(String(err?.message || err), true));
