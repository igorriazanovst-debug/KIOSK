const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('activationAPI', {
  activate: (email, password) => ipcRenderer.invoke('activation-submit', email, password),
  close: () => ipcRenderer.invoke('activation-close'),
  quit: () => ipcRenderer.invoke('activation-quit')
});
