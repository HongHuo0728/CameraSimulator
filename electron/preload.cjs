const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  windowAction: action => ipcRenderer.invoke('window:action', action),
  onCloseRequested: callback => { const listener=()=>callback();ipcRenderer.on('window:prepare-close',listener);return()=>ipcRenderer.removeListener('window:prepare-close',listener); },
  finishClose: saved => ipcRenderer.invoke('window:finish-close', saved),
  openConfig: () => ipcRenderer.invoke('config:open'),
  saveConfig: (text, name) => ipcRenderer.invoke('config:save', { text, name }),
  readDraft: () => ipcRenderer.invoke('draft:read'),
  writeDraft: text => ipcRenderer.invoke('draft:write', text),
  savePhoto: (data, name) => ipcRenderer.invoke('photo:save', { data, name }),
});
