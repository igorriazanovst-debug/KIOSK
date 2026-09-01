// packages/player/electron/chrono/ipc.js
// Единственная точка, через которую рендерер (виджет «Хронолиния» в
// плеере) получает доступ к локальному хранилищу проектов. Каждый канал —
// тонкая обёртка над projectStore, вся защита путей и валидация схемы уже
// внутри него (pathGuard, parseChronoProject/assertProjectSerializable).
// Ничего не открывает шире, чем нужно рендереру: список/создание/
// переименование/удаление проектов + чтение/запись содержимого
// (timelines/события) одного проекта. Медиа — отдельно, Фаза 5.

const { resolveStorageDir } = require('./storageDir');
const projectStore = require('./projectStore');

/**
 * @param {{ ipcMain: import('electron').IpcMain, app: import('electron').App }} deps
 * @returns {{ baseDir: string, isFallback: boolean }}
 */
function registerChronoIpc({ ipcMain, app }) {
  const { dir: baseDir, isFallback } = resolveStorageDir({
    platform: process.platform,
    userDataDir: app.getPath('userData'),
  });

  ipcMain.handle('chrono:list-projects', async () => {
    return projectStore.listProjects(baseDir);
  });

  ipcMain.handle('chrono:create-project', async (_event, name) => {
    return projectStore.createProject(baseDir, name);
  });

  ipcMain.handle('chrono:rename-project', async (_event, projectId, newName) => {
    return projectStore.renameProject(baseDir, projectId, newName);
  });

  ipcMain.handle('chrono:delete-project', async (_event, projectId) => {
    projectStore.deleteProject(baseDir, projectId);
    return { success: true };
  });

  ipcMain.handle('chrono:load-project-data', async (_event, projectId) => {
    return projectStore.loadProjectData(baseDir, projectId);
  });

  ipcMain.handle('chrono:save-project-data', async (_event, projectId, data) => {
    return projectStore.saveProjectData(baseDir, projectId, data);
  });

  return { baseDir, isFallback };
}

module.exports = { registerChronoIpc };
