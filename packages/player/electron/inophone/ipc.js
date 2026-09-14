// packages/player/electron/inophone/ipc.js
// Единственная точка, через которую рантайм «Инофона» достаёт локальные
// данные. По образцу chrono/ipc.js, words/ipc.js и alphabet/ipc.js: контракт
// узкий, каждая ручка — одно понятное действие, произвольных путей рендерер
// не передаёт.

const path = require('path');
const { resolveStorageDir } = require('../chrono/storageDir');
const store = require('./profileStore');
const { WordsRulesError, inophone } = require('@kiosk/shared');
const { loadLibrarySync, listAssetFiles } = require('./contentLibrary');

const INOPHONE_APP_DIR_NAME = store.INOPHONE_APP_DIR_NAME;

/**
 * Превращает ошибку файловой системы в текст, понятный педагогу у доски.
 *
 * Не переиспользует words/ipc.js и alphabet/ipc.js: те упоминают «данные
 * занятия» своих виджетов и тянут за собой их хранилища. Осознанное
 * дублирование маленькой стабильной функции — Сценарий_разработки_фичи.md,
 * раздел 3.
 */
function translateDiskError(err) {
  const code = err && typeof err === 'object' ? err.code : undefined;
  if (code === 'EACCES' || code === 'EPERM') {
    return 'Нет прав на запись данных занятия. Запустите программу от имени администратора или обратитесь к системному администратору.';
  }
  if (code === 'ENOSPC') return 'На диске не осталось места — данные занятия не сохранены.';
  if (code === 'EROFS') return 'Диск доступен только для чтения — данные занятия не сохранены.';
  if (err instanceof WordsRulesError) return err.message;
  if (err instanceof store.InophoneStoreError) return err.message;
  return 'Не удалось сохранить данные занятия. Подробности в журнале приложения.';
}

/**
 * Обёртка, превращающая исключение в { ok: false, error }.
 *
 * Рендерер НИКОГДА не получает стек: педагогу он бесполезен, а в кавычках
 * стека попадаются пути файловой системы.
 */
function guarded(handler) {
  return async (...args) => {
    try {
      return { ok: true, data: await handler(...args) };
    } catch (err) {
      return { ok: false, error: translateDiskError(err) };
    }
  };
}

/**
 * @param {object} deps
 * @param {import('electron').IpcMain} deps.ipcMain
 * @param {import('electron').App} deps.app
 * @param {string} [deps.sharedDirOverride] — подмена каталога данных ДЛЯ ТЕСТОВ.
 *   Без неё тест писал бы в реальные данные педагога на этой машине.
 * @param {Function} [deps.loadLibrary] — тоже для тестов.
 */
function registerInophoneIpc({ ipcMain, app, sharedDirOverride, loadLibrary }) {
  const { dir: baseDir, isFallback } = resolveStorageDir({
    platform: process.platform,
    userDataDir: app.getPath('userData'),
    sharedDirOverride,
    appDirName: INOPHONE_APP_DIR_NAME,
    fallbackSubdir: 'inophone',
  });

  // Библиотека читается ОДИН раз: она статична всё время жизни процесса, а
  // разбор трёх тысяч переводов на каждый щелчок — заметная пауза на доске
  const loaded = (loadLibrary || loadLibrarySync)();
  const library = loaded.library || null;
  const assetsDir = loaded.assetsDir || null;
  const libraryError = loaded.error || null;

  /**
   * Отчёт о комплектности считается ТОЖЕ ОДИН РАЗ и отдаётся рантайму как
   * есть. Он нужен не игре, а диагностике: педагог должен понимать, почему
   * слово молчит, а администратор — что доставить.
   */
  let completeness = null;
  if (library && assetsDir) {
    completeness = inophone.checkCompleteness(library, listAssetFiles(assetsDir));
  }

  // Разметка сцен проверяется ЗДЕСЬ ЖЕ и по той же причине: наложившиеся
  // контуры не роняют программу и ничего не сообщают — она молча засчитывает
  // нарисованный позже объект, и ученик не понимает, почему «неверно»
  const geometry = library ? inophone.checkGeometry(library) : null;

  ipcMain.handle(
    'inophone:get-context',
    guarded(async () => ({
      baseDir,
      isFallback,
      hasLibrary: !!library,
      libraryError,
      completeness,
      geometry,
      quotas: library ? inophone.checkQuotas(library) : null,
    }))
  );

  ipcMain.handle('inophone:get-library', guarded(async () => library));

  ipcMain.handle('inophone:list-profiles', guarded(async () => store.listProfiles(baseDir)));
  ipcMain.handle('inophone:create-profile', guarded(async (_e, name) => store.createProfile(baseDir, name)));
  ipcMain.handle('inophone:delete-profile', guarded(async (_e, id) => store.deleteProfile(baseDir, id)));

  ipcMain.handle('inophone:get-settings', guarded(async () => store.readSettings(baseDir)));
  ipcMain.handle('inophone:save-settings', guarded(async (_e, s) => store.saveSettings(baseDir, s)));

  ipcMain.handle('inophone:get-statistics', guarded(async () => store.readStatistics(baseDir)));
  ipcMain.handle(
    'inophone:record-session',
    guarded(async (_e, profileId, sceneId, byLanguage) =>
      store.recordSession(baseDir, profileId, sceneId, byLanguage)
    )
  );
  ipcMain.handle(
    'inophone:clear-statistics',
    guarded(async (_e, profileId) => store.clearStatistics(baseDir, profileId))
  );

  return { baseDir, isFallback, assetsDir, library, libraryError, completeness, geometry };
}

module.exports = { registerInophoneIpc, translateDiskError, guarded, INOPHONE_APP_DIR_NAME };
