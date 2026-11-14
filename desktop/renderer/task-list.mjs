export function ensureTaskList(state, demos = []) {
  const settings = { ...(state?.settings || {}) };
  const tasks = Array.isArray(state?.tasks) ? state.tasks.slice() : [];
  if (!settings.taskListInitialized && tasks.length === 0) {
    return {
      tasks: demos.map((task) => ({ ...task })),
      settings: { ...settings, taskListInitialized: true },
      seeded: true,
    };
  }
  return { tasks, settings, seeded: false };
}

export function deleteTasks(tasks, ids) {
  const remove = new Set(ids.filter(Boolean));
  return (tasks || []).filter((task) => !remove.has(task.id));
}

export function createProduct(now = Date.now()) {
  return {
    id: `ui-${now.toString(36)}`,
    title: '新任务',
    status: 'draft',
    mainImages: [],
    galleryImages: [],
    skuImages: [],
    demo: false,
  };
}

export function nextSelectedId(tasks, removedIds, currentId) {
  const removed = new Set(removedIds || []);
  if (currentId && !removed.has(currentId) && (tasks || []).some((task) => task.id === currentId)) {
    return currentId;
  }
  return tasks[0]?.id || null;
}

export function visibleTasks(tasks, query = '') {
  const q = String(query || '').trim().toLowerCase();
  return (tasks || []).filter((task) => {
    const blob = `${task.title || ''} ${task.skuPrefix || ''} ${task.productId || ''}`.toLowerCase();
    return !q || blob.includes(q);
  });
}
