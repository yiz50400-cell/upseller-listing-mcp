const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('upsellerDesktop', {
  getState: () => ipcRenderer.invoke('desktop:getState'),
  saveState: (patch) => ipcRenderer.invoke('desktop:saveState', patch),
  refreshShops: () => ipcRenderer.invoke('desktop:refreshShops'),
  login: (opts) => ipcRenderer.invoke('desktop:login', opts),
  logout: () => ipcRenderer.invoke('desktop:logout'),
  runAction: (payload) => ipcRenderer.invoke('desktop:runAction', payload),
  loadDraft: (draftId) => ipcRenderer.invoke('desktop:loadDraft', draftId),
  listDrafts: (shopId) => ipcRenderer.invoke('desktop:listDrafts', shopId),
  pickFiles: (kind) => ipcRenderer.invoke('desktop:pickFiles', kind),
  windowControl: (action) => ipcRenderer.invoke('desktop:windowControl', action),
});
