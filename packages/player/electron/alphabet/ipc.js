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
const { WordsRulesError, TeacherGateError, alphabet } = require('@kiosk/shared');
const { loadLibrarySync } = require('./contentLibrary');
const teacherPassword = require('./teacherPassword');
const content = require('./contentStore');
const media = require('../common/mediaFiles');

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
  if (err instanceof TeacherGateError) return err.message;
  if (err instanceof store.AlphabetStoreError) return err.message;
  if (err instanceof alphabet.AlphabetValidationError) return err.message;
  if (err instanceof alphabet.AlphabetContentError) return err.message;
  if (err instanceof content.AlphabetContentStoreError) return err.message;
  if (err instanceof media.MediaError) return err.message;
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
 * @param {{ ipcMain: Electron.IpcMain, app: Electron.App, dialog?: Electron.Dialog,
 *   sharedDirOverride?: string,
 *   loadLibrary?: () => object }} deps
 *   sharedDirOverride — только для тестов: каталог данных общий на машину
 *   (%ProgramData%\kiosk-alphabet), и без подмены тест писал бы в РЕАЛЬНЫЕ
 *   данные педагога на этой машине. В проде не передаётся.
 *   loadLibrary — тоже для тестов; в проде берётся ./contentLibrary.
 */
function registerAlphabetIpc({ ipcMain, app, dialog, sharedDirOverride, loadLibrary }) {
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
  let assetsDir = null;
  let libraryError = null;
  let report = null;
  try {
    const loaded = (loadLibrary || loadLibrarySync)();
    if (loaded) {
      library = loaded.library;
      assetsDir = loaded.assetsDir;
      report = {
        completeness: loaded.completeness,
        graph: loaded.graph,
        illustrations: loaded.illustrations,
      };
    } else {
      libraryError = 'Пакет учебного контента не найден в этой сборке';
    }
  } catch (err) {
    library = null;
    libraryError = err && err.message ? err.message : 'Пакет контента повреждён';
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

  // ── Пароль педагога (ТЗ раздел 3) ────────────────────────────────────
  // Наружу уходит только «подошёл или нет»: ни пароль, ни его хеш границу
  // процесса не пересекают, иначе «защита» снималась бы инспектором
  ipcMain.handle(
    'alphabet:check-teacher-password',
    guarded(async (_e, password) => teacherPassword.checkPassword(baseDir, password))
  );
  ipcMain.handle(
    'alphabet:set-teacher-password',
    guarded(async (_e, password) => {
      teacherPassword.setPassword(baseDir, password);
      return { isDefault: teacherPassword.isDefaultPassword(baseDir) };
    })
  );
  ipcMain.handle(
    'alphabet:teacher-password-state',
    guarded(async () => ({ isDefault: teacherPassword.isDefaultPassword(baseDir) }))
  );

  // ── Контент педагога (ТЗ строки 76–78) ───────────────────────────────
  // Поставочные слоги и слова передаются в правила из уже прочитанной
  // библиотеки: своё слово может опираться на поставочный слог, а комплект —
  // содержать и то и другое (ТЗ строка 77 требует этого буквально)
  const librarySyllables = () => (library ? library.syllables : []);
  const libraryWords = () => (library ? library.words : []);

  ipcMain.handle('alphabet:get-user-content', guarded(async () => content.readContent(baseDir)));
  ipcMain.handle(
    'alphabet:word-readiness',
    guarded(async () => content.wordReadiness(baseDir, librarySyllables()))
  );

  ipcMain.handle(
    'alphabet:create-syllable',
    guarded(async (_e, draft) => content.createSyllable(baseDir, draft))
  );
  ipcMain.handle(
    'alphabet:delete-syllable',
    guarded(async (_e, id) => content.deleteSyllable(baseDir, id, libraryWords()))
  );

  ipcMain.handle(
    'alphabet:create-word',
    guarded(async (_e, draft) => content.createWord(baseDir, draft, librarySyllables()))
  );
  ipcMain.handle(
    'alphabet:update-word',
    guarded(async (_e, id, draft) => content.updateWord(baseDir, id, draft, librarySyllables()))
  );
  ipcMain.handle(
    'alphabet:delete-word',
    guarded(async (_e, id) => content.deleteWord(baseDir, id))
  );

  ipcMain.handle(
    'alphabet:create-set',
    guarded(async (_e, draft) => content.createSet(baseDir, draft, libraryWords()))
  );
  ipcMain.handle(
    'alphabet:update-set',
    guarded(async (_e, id, draft) => content.updateSet(baseDir, id, draft, libraryWords()))
  );
  ipcMain.handle('alphabet:delete-set', guarded(async (_e, id) => content.deleteSet(baseDir, id)));

  /**
   * Выбор картинки. ПУТЬ НЕ ПЕРЕСЕКАЕТ ГРАНИЦУ: диалог открывает главный
   * процесс, рендерер получает только имя файла в хранилище. Иначе рендерер
   * мог бы назвать любой путь на диске.
   */
  ipcMain.handle(
    'alphabet:pick-word-image',
    guarded(async () => {
      if (!dialog) throw new content.AlphabetContentStoreError('Диалог выбора файла недоступен');
      const result = await dialog.showOpenDialog({
        title: 'Выберите картинку для слова',
        properties: ['openFile'],
        filters: [{ name: 'Изображения', extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'] }],
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      return content.importImage(baseDir, result.filePaths[0]);
    })
  );

  // Запись голоса приходит байтами из рендерера — MediaRecorder работает
  // только там. Сигнатуру хранилище проверяет само
  ipcMain.handle(
    'alphabet:save-voice',
    guarded(async (_e, kind, id, bytes) => content.saveVoice(baseDir, kind, id, bytes))
  );
  ipcMain.handle(
    'alphabet:delete-voice',
    guarded(async (_e, kind, id) => content.deleteVoice(baseDir, kind, id))
  );

  return { baseDir, isFallback, assetsDir, report, libraryError };
}

module.exports = { registerAlphabetIpc, translateDiskError, guarded, ALPHABET_APP_DIR_NAME };
