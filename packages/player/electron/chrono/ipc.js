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
const mediaStore = require('./mediaStore');
const { createSessionLock } = require('./sessionLock');
const { createPickedMediaPaths } = require('./pickedMediaPaths');
const resetCode = require('./resetCode');
const archive = require('./archive');

const MEDIA_FILE_FILTERS = [
  { name: 'Изображения и видео', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov', 'mp3', 'wav', 'ogg'] },
];

/**
 * @param {{ ipcMain: import('electron').IpcMain, app: import('electron').App, dialog: import('electron').Dialog }} deps
 * @returns {{ baseDir: string, isFallback: boolean }}
 */
function registerChronoIpc({ ipcMain, app, dialog }) {
  const { dir: baseDir, isFallback } = resolveStorageDir({
    platform: process.platform,
    userDataDir: app.getPath('userData'),
  });
  const sessionLock = createSessionLock();
  const pickedMediaPaths = createPickedMediaPaths();
  mediaStore.sweepOrphanedTmpFiles(baseDir);
  // Резолвится один раз, как и baseDir - chronoReset статичен на всё время
  // жизни этой сборки (запечён в project.json на этапе сборки, не меняется
  // на рантайме независимо от того, приходит ли позже live-обновление
  // остального project.json).
  const resetConfig = resetCode.loadResetConfigSync(app);

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

  // Экспорт/импорт в свой архивный формат (Фаза 8). Путь к файлу НИКОГДА не
  // приходит от рендерера (в отличие от media - там это два отдельных
  // IPC-вызова с промежуточным разрешением через pickedMediaPaths) - весь
  // диалог выбора файла происходит ВНУТРИ одного этого обработчика, так что
  // скомпрометированный рендерер не может подсунуть произвольный путь ни
  // на чтение (импорт чужого файла), ни на запись (перезапись системного
  // файла путём подмены пути экспорта).
  ipcMain.handle('chrono:export-project', async (_event, projectId) => {
    requireUnlocked();
    const manifest = projectStore.readManifest(baseDir, projectId);
    const safeName = manifest.name.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').trim() || 'chronoline';
    const result = await dialog.showSaveDialog({
      defaultPath: `${safeName}.chronoline`,
      filters: [{ name: 'Архив Хронолинии', extensions: ['chronoline'] }],
    });
    if (result.canceled || !result.filePath) return { success: false, canceled: true };
    await archive.exportProjectToZip(baseDir, projectId, result.filePath);
    return { success: true, filePath: result.filePath };
  });

  ipcMain.handle('chrono:import-project', async () => {
    requireUnlocked();
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Архив Хронолинии', extensions: ['chronoline'] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return archive.importProjectFromZip(baseDir, result.filePaths[0]);
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

  // Мастер-код сброса пароля (Фаза 4) - намеренно БЕЗ requireUnlocked():
  // это и есть путь для педагога, который сам заблокирован и пароль забыл.
  // Троттлинг у resetCode.js свой, отдельный от auth.js (см. resetCode.js).
  ipcMain.handle('chrono:reset-challenge', async () => {
    return resetCode.getChallenge(resetConfig, baseDir);
  });

  ipcMain.handle('chrono:reset-with-code', async (_event, code, newPassword) => {
    const result = resetCode.verifyResetCode(resetConfig, baseDir, code, newPassword);
    if (result.success) sessionLock.unlock();
    return result;
  });

  ipcMain.handle('chrono:pick-media-file', async () => {
    // Заблокированная сессия не должна получать доступ к системному
    // диалогу выбора файла - это раскрытие структуры локальной файловой
    // системы (имена/пути файлов пользователя), более широкое, чем "видно
    // содержимое доски", доступное иначе без всякого пароля.
    requireUnlocked();
    const result = await dialog.showOpenDialog({ properties: ['openFile'], filters: MEDIA_FILE_FILTERS });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    pickedMediaPaths.remember(filePath);
    return filePath;
  });

  ipcMain.handle('chrono:import-media', async (_event, projectId, sourceFilePath) => {
    requireUnlocked();
    // Импортировать можно ТОЛЬКО путь, реально возвращённый диалогом выше -
    // без этой проверки chrono:import-media принимал бы любую строку от
    // рендерера как путь на диске (найдено security-review): рендерер не
    // выбирает файлы ОС напрямую, но мог бы вызвать сам IPC-канал с
    // произвольным путём, минуя диалог, и скопировать в медиатеку чужой
    // реальный файл с диска. Одноразово - consume() сжигает разрешение,
    // повторный импорт того же пути требует заново пройти через диалог.
    if (!pickedMediaPaths.consume(sourceFilePath)) {
      throw new Error('Файл должен быть выбран через системный диалог');
    }
    return mediaStore.importMedia(baseDir, projectId, sourceFilePath);
  });

  return { baseDir, isFallback };
}

module.exports = { registerChronoIpc };
