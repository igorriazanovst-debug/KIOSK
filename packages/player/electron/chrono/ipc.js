// packages/player/electron/chrono/ipc.js
// Единственная точка, через которую рендерер (виджет «Хронолиния» в
// плеере) получает доступ к локальному хранилищу проектов и авторизации.
// Каждый канал — тонкая обёртка над projectStore/auth, вся защита путей,
// валидация схемы и проверка права на смену пароля уже внутри них
// (pathGuard, parseChronoProject/assertProjectSerializable,
// auth.changePassword). Ничего не открывает шире, чем нужно рендереру.
//
// requireUnlocked() ниже — граница авторизации МУТИРУЮЩИХ каналов
// (create/rename/delete-project, save-project-data). Найдено
// security-review Фазы 4 (CRITICAL): раньше эти каналы выполнялись
// безусловно, а решение "можно ли редактировать" жило только в React-
// состоянии рендерера (canEdit в ChronolineRuntime.tsx) - это лишь UX,
// не граница доверия: любой JS в рендерере (например, из DevTools) мог
// вызвать window.chronoAPI.saveProjectData напрямую и обойти пароль
// полностью. Чтение (list/load-project-data) остаётся без проверки
// намеренно - доска видна всем независимо от того, разблокировано ли
// редактирование (пароль защищает правки, не просмотр).
const { resolveStorageDir } = require('./storageDir');
const projectStore = require('./projectStore');
const auth = require('./auth');
const { createSessionLock } = require('./sessionLock');

/**
 * @param {{ ipcMain: import('electron').IpcMain, app: import('electron').App }} deps
 * @returns {{ baseDir: string, isFallback: boolean }}
 */
function registerChronoIpc({ ipcMain, app }) {
  const { dir: baseDir, isFallback } = resolveStorageDir({
    platform: process.platform,
    userDataDir: app.getPath('userData'),
  });
  const sessionLock = createSessionLock();

  function requireUnlocked() {
    if (auth.isPasswordSet(baseDir) && !sessionLock.isUnlocked()) {
      throw new Error('LOCKED: редактирование заблокировано, требуется пароль устройства');
    }
    sessionLock.touch();
  }

  ipcMain.handle('chrono:list-projects', async () => {
    return projectStore.listProjects(baseDir);
  });

  ipcMain.handle('chrono:create-project', async (_event, name) => {
    requireUnlocked();
    return projectStore.createProject(baseDir, name);
  });

  ipcMain.handle('chrono:rename-project', async (_event, projectId, newName) => {
    requireUnlocked();
    return projectStore.renameProject(baseDir, projectId, newName);
  });

  ipcMain.handle('chrono:delete-project', async (_event, projectId) => {
    requireUnlocked();
    projectStore.deleteProject(baseDir, projectId);
    return { success: true };
  });

  ipcMain.handle('chrono:load-project-data', async (_event, projectId) => {
    return projectStore.loadProjectData(baseDir, projectId);
  });

  ipcMain.handle('chrono:save-project-data', async (_event, projectId, data) => {
    requireUnlocked();
    return projectStore.saveProjectData(baseDir, projectId, data);
  });

  ipcMain.handle('chrono:auth-status', async () => {
    return { isPasswordSet: auth.isPasswordSet(baseDir), unlocked: sessionLock.isUnlocked(), ...auth.checkLockout(baseDir) };
  });

  ipcMain.handle('chrono:auth-verify-password', async (_event, password) => {
    const result = auth.verifyPassword(baseDir, password);
    if (result.success) sessionLock.unlock();
    return result;
  });

  ipcMain.handle('chrono:auth-change-password', async (_event, newPassword, currentPassword) => {
    const result = auth.changePassword(baseDir, newPassword, currentPassword);
    // Установка/смена пароля - тоже успешное подтверждение личности,
    // разблокирует сессию сразу, не заставляет вводить только что
    // заданный пароль второй раз подряд.
    if (result.success) sessionLock.unlock();
    return result;
  });

  ipcMain.handle('chrono:auth-lock', async () => {
    sessionLock.lock();
    return { success: true };
  });

  return { baseDir, isFallback };
}

module.exports = { registerChronoIpc };
