const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Файловые операции
  saveFile: (data) => ipcRenderer.invoke('save-file', data),
  openFile: (filters) => ipcRenderer.invoke('open-file', filters),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  showMessage: (options) => ipcRenderer.invoke('show-message', options),

  // Получение событий от меню
  onMenuNewProject: (callback) => {
    ipcRenderer.on('menu-new-project', callback);
  },
  onMenuOpenProject: (callback) => {
    ipcRenderer.on('menu-open-project', callback);
  },
  onMenuSaveProject: (callback) => {
    ipcRenderer.on('menu-save-project', callback);
  },
  onMenuExportJson: (callback) => {
    ipcRenderer.on('menu-export-json', callback);
  },
  onMenuExportPlayer: (callback) => {
    ipcRenderer.on('menu-export-player', callback);
  },

  // Проверка, что мы в Electron
  isElectron: true
});
