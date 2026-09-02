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
  },

  // Проверить нужна ли активация (при монтировании компонента)
  checkActivationNeeded: () => ipcRenderer.invoke('check-activation-needed'),

  // Активация плеера по email + password
  activateWithCredentials: (email, password) => ipcRenderer.invoke('activate-with-credentials', email, password),

  // Показ экрана активации (слушатель)
  onShowActivation: (callback) => {
    ipcRenderer.on('show-activation', (event, data) => callback(data));
  },

  // Доступно обновление (слушатель)
  onUpdateAvailable: (callback) => {
    ipcRenderer.on('update-available', (event, data) => callback(data));
  },

  // Обновление применено (слушатель)
  onUpdateApplied: (callback) => {
    ipcRenderer.on('update-applied', (event, data) => callback(data));
  },

  // Проверка пароля для подтверждения обновления
  verifyUpdatePassword: (password) => ipcRenderer.invoke('verify-update-password', password),

  // Применить обновление
  applyUpdate: () => ipcRenderer.invoke('apply-update')
});

// Локальное хранилище проектов «Хронолинии» — отдельный namespace, не
// смешивается с electronAPI. Используется только виджетом chronoline.
contextBridge.exposeInMainWorld('chronoAPI', {
  listProjects: () => ipcRenderer.invoke('chrono:list-projects'),
  createProject: (name) => ipcRenderer.invoke('chrono:create-project', name),
  renameProject: (projectId, newName) => ipcRenderer.invoke('chrono:rename-project', projectId, newName),
  deleteProject: (projectId) => ipcRenderer.invoke('chrono:delete-project', projectId),
  loadProjectData: (projectId) => ipcRenderer.invoke('chrono:load-project-data', projectId),
  saveProjectData: (projectId, data) => ipcRenderer.invoke('chrono:save-project-data', projectId, data),
  getAuthStatus: () => ipcRenderer.invoke('chrono:auth-status'),
  verifyPassword: (password) => ipcRenderer.invoke('chrono:auth-verify-password', password),
  changePassword: (newPassword, currentPassword) =>
    ipcRenderer.invoke('chrono:auth-change-password', newPassword, currentPassword),
  lockEditing: () => ipcRenderer.invoke('chrono:auth-lock'),
  getResetChallenge: () => ipcRenderer.invoke('chrono:reset-challenge'),
  resetWithCode: (code, newPassword) => ipcRenderer.invoke('chrono:reset-with-code', code, newPassword),
  pickMediaFile: () => ipcRenderer.invoke('chrono:pick-media-file'),
  importMedia: (projectId, sourceFilePath) => ipcRenderer.invoke('chrono:import-media', projectId, sourceFilePath)
});
