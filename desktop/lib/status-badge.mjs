export function isSubmittedTask(task) {
  if (task?.demo) return false;
  return task?.status === 'submitted' || task?.status === 'wait';
}

export function statusLabel(task) {
  if (task?.demo) return '示例';
  if (task?.status === 'live') return '已发布';
  if (isSubmittedTask(task)) return '已提交';
  return '草稿';
}

export function statusBadgeClass(task) {
  if (task?.demo) return 'demo-status';
  if (task?.status === 'live') return 'live';
  if (isSubmittedTask(task)) return 'wait';
  return 'draft';
}

export function statusBadge(task) {
  if (task?.demo) return '<span class="badge demo-status">示例</span>';
  return `<span class="badge ${statusBadgeClass(task)}"><i></i>${statusLabel(task)}</span>`;
}

export function statusAfterSuccessfulAction(mode, currentStatus) {
  if (mode === 'publish') return 'submitted';
  return currentStatus || 'draft';
}
