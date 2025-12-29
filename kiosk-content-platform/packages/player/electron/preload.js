const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Получить текущий проект
  getProject: () => ipcRenderer.invoke('get-project'),
  
  // Открыть проект из файла
  openProject: () => ipcRenderer.invoke('open-project'),
  
  // Переключить полноэкранный режим
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  
  // Закрыть приложение
  closeApp: () => ipcRenderer.invoke('close-app'),
  
  // Слушать события из main процесса
  onLoadProject: (callback) => {
    ipcRenderer.on('load-project', (event, project) => callback(project));
  }
});
