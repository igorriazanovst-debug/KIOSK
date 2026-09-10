// packages/player/electron/words/ipc.js
// Единственная точка, через которую рантайм виджета «Я знаю много слов»
// получает доступ к локальному хранилищу. По образцу chrono/ipc.js и
// natcom/ipc.js: контракт узкий, каждая ручка — одно понятное действие,
// произвольных путей рендерер не передаёт.
//
// Проверки роли/пароля здесь нет намеренно: профили детей — не учётные
// записи ОС и паролей у них нет (см. Яслов_план_реализации.md, «Что явно НЕ
// входит в MVP»). Когда появится разграничение «педагог/ученик», оно
// добавится здесь одним requireTeacher, а не размажется по ручкам.

const { resolveStorageDir } = require('../chrono/storageDir');
const store = require('./profileStore');
const { WordsRulesError } = require('@kiosk/shared');
const { loadLibrarySync } = require('./contentLibrary');
const wordStore = require('./wordStore');
const mediaFiles = require('./mediaFiles');

const WORDS_APP_DIR_NAME = store.WORDS_APP_DIR_NAME;

/**
 * Превращает ошибку файловой системы в текст, понятный педагогу у доски.
 * Не переиспользует chrono/ipc.js: тот упоминает «Хронолинию» в сообщении —
 * тот же принцип осознанного дублирования маленькой стабильной функции, что
 * и у natcom (Сценарий_разработки_фичи.md, раздел 3).
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
  // Нарушение правила («игрок уже есть») и поломка хранилища — разные вещи,
  // но педагогу в обоих случаях нужен готовый текст, а не стек
  if (err instanceof WordsRulesError) return err.message;
  if (err instanceof mediaFiles.MediaError) return err.message;
  if (err instanceof wordStore.WordStoreError) return err.message;
  if (err instanceof store.WordsStoreError) return err.message;
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
 * @param {{ ipcMain: Electron.IpcMain, app: Electron.App, dialog?: Electron.Dialog }} deps
 */
function registerWordsIpc({ ipcMain, app, dialog }) {
  let libraryError = null;
  const { dir: baseDir, isFallback } = resolveStorageDir({
    platform: process.platform,
    userDataDir: app.getPath('userData'),
    appDirName: WORDS_APP_DIR_NAME,
    fallbackSubdir: 'words',
  });

  // Библиотека читается и валидируется ОДИН раз при старте, а не на каждый
  // вызов: она статична на всё время жизни процесса (тот же принцип, что у
  // natcom/library.js). Отсутствие пакета контента не роняет регистрацию —
  // рантайм покажет пустую карту тем и внятное сообщение.
  let loaded = null;
  try {
    loaded = loadLibrarySync();
  } catch (err) {
    loaded = null;
    libraryError = err && err.message ? err.message : 'Пакет контента повреждён';
  }

  ipcMain.handle('words:get-context', guarded(async () => ({
    baseDir,
    isFallback,
    hasLibrary: !!loaded,
    libraryError,
  })));

  ipcMain.handle('words:get-library', guarded(async () => {
    if (!loaded) {
      throw new store.WordsStoreError(
        libraryError || 'Пакет учебного контента не найден в этой сборке'
      );
    }
    return loaded.library;
  }));

  ipcMain.handle('words:list-profiles', guarded(async () => store.listProfiles(baseDir)));
  ipcMain.handle('words:create-profile', guarded(async (_e, name) => store.createProfile(baseDir, name)));
  ipcMain.handle('words:delete-profile', guarded(async (_e, id) => store.deleteProfile(baseDir, id)));

  ipcMain.handle('words:get-settings', guarded(async () => store.readSettings(baseDir)));
  ipcMain.handle('words:save-settings', guarded(async (_e, settings) => store.writeSettings(baseDir, settings)));

  ipcMain.handle('words:get-scores', guarded(async () => store.readScores(baseDir)));
  ipcMain.handle(
    'words:save-score',
    guarded(async (_e, profileId, themeId, tier) => store.saveScore(baseDir, profileId, themeId, tier))
  );

  // ── Контент педагога (Фаза 5) ────────────────────────────────────────
  // Идентификаторы поставочных слов нужны, чтобы проверить состав комплекта:
  // он может смешивать поставочные и свои слова (ТЗ строка 56)
  const libraryWordIds = () => (loaded ? loaded.library.words.map((w) => w.id) : []);

  ipcMain.handle('words:list-user-words', guarded(async () => wordStore.listUserWords(baseDir)));
  ipcMain.handle('words:create-user-word', guarded(async (_e, draft) => wordStore.createUserWord(baseDir, draft)));
  ipcMain.handle('words:update-user-word', guarded(async (_e, id, draft) => wordStore.updateUserWord(baseDir, id, draft)));
  ipcMain.handle('words:delete-user-word', guarded(async (_e, id) => wordStore.deleteUserWord(baseDir, id)));

  ipcMain.handle('words:list-sets', guarded(async () => wordStore.listSets(baseDir)));
  ipcMain.handle('words:create-set', guarded(async (_e, draft) => wordStore.createSet(baseDir, draft, libraryWordIds())));
  ipcMain.handle('words:update-set', guarded(async (_e, id, draft) => wordStore.updateSet(baseDir, id, draft, libraryWordIds())));
  ipcMain.handle('words:delete-set', guarded(async (_e, id) => wordStore.deleteSet(baseDir, id)));

  /**
   * Выбор файла педагогом. Рендерер НЕ передаёт путь — он приходит только из
   * системного диалога, и дальше файл проверяется по содержимому. Так
   * произвольный путь с диска в хранилище попасть не может.
   */
  ipcMain.handle(
    'words:pick-media-file',
    guarded(async (_e, kind) => {
      if (kind !== 'image' && kind !== 'audio') throw new mediaFiles.MediaError('Неизвестный тип файла');
      if (!dialog) throw new mediaFiles.MediaError('Диалог выбора файла недоступен');

      const extensions = (kind === 'image' ? mediaFiles.IMAGE_EXTENSIONS : mediaFiles.AUDIO_EXTENSIONS).map(
        (e) => e.replace('.', '')
      );
      const result = await dialog.showOpenDialog({
        title: kind === 'image' ? 'Выберите изображение' : 'Выберите звуковой файл',
        properties: ['openFile'],
        filters: [{ name: kind === 'image' ? 'Изображения' : 'Звук', extensions }],
      });
      if (result.canceled || result.filePaths.length === 0) return { canceled: true };

      const stored = mediaFiles.importMediaFile(baseDir, result.filePaths[0], kind);
      return { canceled: false, fileName: stored.fileName, type: stored.type, bytes: stored.bytes };
    })
  );

  /** Запись с микрофона приходит из рендерера массивом байтов, а не путём */
  ipcMain.handle(
    'words:save-recording',
    guarded(async (_e, bytes) => {
      const buffer = Buffer.from(bytes);
      const stored = mediaFiles.storeMediaBuffer(baseDir, buffer, 'audio');
      return { fileName: stored.fileName, type: stored.type, bytes: stored.bytes };
    })
  );

  return {
    baseDir,
    isFallback,
    assetsDir: loaded ? loaded.assetsDir : null,
    completeness: loaded ? loaded.completeness : null,
  };
}

module.exports = { registerWordsIpc, translateDiskError, guarded, WORDS_APP_DIR_NAME };
