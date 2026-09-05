// packages/player/electron/natcom/ipc.js
// Единственная точка, через которую рендерер (виджет «Конструктор природных
// сообществ» в плеере) получает доступ к локальному хранилищу презентаций.
// По образцу packages/player/electron/chrono/ipc.js - но БЕЗ requireUnlocked
// (проверка роли/пароля - отдельный, ещё не спроектированный эпик, см.
// Тип5_план_реализации.md, раздел 1.1 и открытый вопрос №3; добавлять сюда
// заглушку сейчас означало бы зафиксировать неверную границу доверия раньше,
// чем решение реально принято).
//
// translateDiskError - НЕ переиспользует chrono/ipc.js напрямую: тот
// возвращает текст с упоминанием «Хронолинии» в сообщении об ошибке, здесь
// нужен свой текст. Небольшая стабильная функция, тот же принцип
// осознанного дублирования, что у resetCode.js/masterCode.js (см.
// Сценарий_разработки_фичи.md, раздел 3).

const { resolveStorageDir } = require('../chrono/storageDir');
const projectStore = require('./projectStore');
const { loadLibrarySync } = require('./library');

const NATCOM_APP_DIR_NAME = 'kiosk-natcom';

/**
 * @param {unknown} err
 * @returns {Error}
 */
function translateDiskError(err) {
  const code = err && typeof err === 'object' ? /** @type {any} */ (err).code : undefined;
  if (code === 'ENOSPC') {
    return new Error('На устройстве закончилось место на диске. Освободите место и попробуйте снова.');
  }
  if (code === 'EACCES' || code === 'EPERM') {
    return new Error('Нет прав на запись в каталог хранения данных «Конструктора природных сообществ». Обратитесь к администратору устройства.');
  }
  return err instanceof Error ? err : new Error(String(err));
}

/**
 * @param {{ ipcMain: import('electron').IpcMain, app: import('electron').App }} deps
 * @returns {{ baseDir: string, isFallback: boolean }}
 */
function registerNatComIpc({ ipcMain, app }) {
  const { dir: baseDir, isFallback } = resolveStorageDir({
    platform: process.platform,
    userDataDir: app.getPath('userData'),
    appDirName: NATCOM_APP_DIR_NAME,
    fallbackSubdir: 'natcom',
  });

  // Библиотека читается и валидируется ОДИН раз при регистрации канала, не
  // на каждый IPC-вызов - она read-only и не меняется во время работы
  // процесса (тот же принцип, что resetConfig у chrono/ipc.js).
  const loaded = loadLibrarySync();

  /** Тонкая обёртка над ipcMain.handle - переводит дисковые ошибки в понятное сообщение для всех каналов разом (тот же принцип, что chrono/ipc.js). */
  function handle(channel, fn) {
    ipcMain.handle(channel, async (...args) => {
      try {
        return await fn(...args);
      } catch (err) {
        throw translateDiskError(err);
      }
    });
  }

  handle('natcom:get-library', async () => {
    return loaded ? loaded.library : null;
  });

  handle('natcom:list-projects', async () => {
    return projectStore.listProjects(baseDir);
  });

  handle('natcom:create-project', async (_event, params) => {
    return projectStore.createProject(baseDir, params);
  });

  handle('natcom:load-project', async (_event, projectId) => {
    return projectStore.loadProject(baseDir, projectId);
  });

  handle('natcom:save-project', async (_event, projectId, data) => {
    return projectStore.saveProject(baseDir, projectId, data);
  });

  handle('natcom:delete-project', async (_event, projectId) => {
    projectStore.deleteProject(baseDir, projectId);
    return { success: true };
  });

  return { baseDir, isFallback, libraryLoaded: !!loaded };
}

module.exports = { registerNatComIpc, translateDiskError, NATCOM_APP_DIR_NAME };
