export function successActionToast(mode, { videoIgnored } = {}) {
  const prefix = mode === 'preview'
    ? '预览完成，没有写入草稿，也没有发布'
    : mode === 'save-draft'
      ? '已请求保存草稿，不会发布'
      : '已提交发布请求';
  if (videoIgnored) {
    return `${prefix}。所选视频只会留在本机，这一版还不能把视频发出去。`;
  }
  return prefix;
}
