// packages/player/electron/alphabet/ipc.js
// Единственная точка, через которую рантайм виджета «АзбукоСлов» получает
// доступ к локальному хранилищу. По образцу chrono/ipc.js, natcom/ipc.js и
// words/ipc.js: контракт узкий, каждая ручка — одно понятное действие,
// произвольных путей рендерер не передаёт.
//
// Проверки пароля здесь нет: профили детей — не учётные записи ОС. Когда
// появится раздел педагога (Фаза 5), гейт добавится ОДНИМ requireTeacher
// перед соответствующими ручками, а не размажется по ним — так это и сделано
// в Тип 2, и там приём себя оправдал.

const { resolveStorageDir } = require('../chrono/storageDir');
const store = require('./profileStore');
const { WordsRulesError, alphabet } = require('@kiosk/shared');

const ALPHABET_APP_DIR_NAME = store.ALPHABET_APP_DIR_NAME;

/**
 * Превращает ошибку файловой системы в текст, понятный педагогу у доски.
 * Не переиспользует words/ipc.js: тот упоминает «данные занятия» виджета
 * слов в тексте и тянет за собой его же хранилища. Осознанное дублирование
 * маленькой стабильной функции — Сценарий_разработки_фичи.md, раздел 3.
 * @param {unknown} err
 * @returns {string}
 */
function translateDiskError(err) {
  const code = err && typeof err === 'object' ? err.code : undefined;
  if (code === 'EACCES' || code === 'EPERM') {
    return 'Нет прав на запись данных занятия. Запустите программу от имени администратора или обратитесь к системному администратору.';
  }
  if (code === 'ENOSPC') {
    return 'На диске не осталось места — данные занятия не сохранены.';
  }
  if (code === 'EROFS') {
    return 'Диск доступен только для чтения — данные занятия не сохранены.';
  }
  // Нарушение правила («такого игрока нет») и поломка хранилища — разные
  // вещи, но педагогу в обоих случаях нужен готовый текст, а не стек
  if (err instanceof WordsRulesError) return err.message;
  if (err instanceof store.AlphabetStoreError) return err.message;
  if (err instanceof alphabet.AlphabetValidationError) return err.message;
  return err && err.message ? err.message : 'Не удалось выполнить операцию с данными занятия';
}

/** Оборачивает обработчик так, чтобы в рендерер уходил понятный текст, а не стек */
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
 * @param {{ ipcMain: Electron.IpcMain, app: Electron.App, sharedDirOverride?: string,
 *   loadLibrary?: () => object }} deps
 *   sharedDirOverride — только для тестов: каталог данных общий на машину
 *   (%ProgramData%\kiosk-alphabet), и без подмены тест писал бы в РЕАЛЬНЫЕ
 *   данные педагога на этой машине. В проде не передаётся.
 *   loadLibrary — тоже для тестов; в проде пакет контента появится в Фазе 7.
 */
function registerAlphabetIpc({ ipcMain, app, sharedDirOverride, loadLibrary }) {
  const { dir: baseDir, isFallback } = resolveStorageDir({
    platform: process.platform,
    userDataDir: app.getPath('userData'),
    sharedDirOverride,
    appDirName: ALPHABET_APP_DIR_NAME,
    fallbackSubdir: 'alphabet',
  });

  // Библиотека читается и проверяется ОДИН раз при старте, а не на каждый
  // вызов: она статична на всё время жизни процесса. Её отсутствие не роняет
  // регистрацию — рантайм покажет внятное сообщение вместо пустого экрана.
  let library = null;
  let libraryError = null;
  if (typeof loadLibrary === 'function') {
    try {
      library = loadLibrary();
    } catch (err) {
      library = null;
      libraryError = err && err.message ? err.message : 'Пакет контента повреждён';
    }
  } else {
    libraryError = 'Пакет учебного контента не входит в эту сборку';
  }

  ipcMain.handle(
    'alphabet:get-context',
    guarded(async () => ({ baseDir, isFallback, hasLibrary: !!library, libraryError }))
  );

  ipcMain.handle(
    'alphabet:get-library',
    guarded(async () => {
      if (!library) {
        throw new store.AlphabetStoreError(
          libraryError || 'Пакет учебного контента не найден в этой сборке'
        );
      }
      return library;
    })
  );

  ipcMain.handle('alphabet:list-profiles', guarded(async () => store.listProfiles(baseDir)));
  ipcMain.handle(
    'alphabet:create-profile',
    guarded(async (_e, name) => store.createProfile(baseDir, name))
  );
  ipcMain.handle(
    'alphabet:delete-profile',
    guarded(async (_e, id) => store.deleteProfile(baseDir, id))
  );

  ipcMain.handle('alphabet:get-settings', guarded(async () => store.readSettings(baseDir)));
  ipcMain.handle(
    'alphabet:save-settings',
    guarded(async (_e, settings) => store.writeSettings(baseDir, settings))
  );

  ipcMain.handle('alphabet:get-statistics', guarded(async () => store.readStatistics(baseDir)));
  ipcMain.handle(
    'alphabet:save-session',
    guarded(async (_e, profileId, answers) =>
      store.saveSessionStatistics(baseDir, profileId, answers)
    )
  );
  ipcMain.handle(
    'alphabet:clear-statistics',
    guarded(async (_e, profileId) => store.clearStatistics(baseDir, profileId))
  );

  return { baseDir, isFallback };
}

module.exports = { registerAlphabetIpc, translateDiskError, guarded, ALPHABET_APP_DIR_NAME };
