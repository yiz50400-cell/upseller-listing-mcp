export function toggleId(ids, id) {
  const next = new Set(ids);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function setAll(ids, visibleIds, checked) {
  const next = new Set(ids);
  for (const id of visibleIds) {
    if (checked) next.add(id);
    else next.delete(id);
  }
  return next;
}

export function allChecked(ids, visibleIds) {
  return visibleIds.length > 0 && visibleIds.every((id) => ids.has(id));
}

export function someChecked(ids, visibleIds) {
  return visibleIds.some((id) => ids.has(id));
}
