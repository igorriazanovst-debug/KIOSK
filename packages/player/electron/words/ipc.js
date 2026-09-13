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
const setArchive = require('./setArchive');
const teacherPassword = require('./teacherPassword');

const WORDS_APP_DIR_NAME = store.WORDS_APP_DIR_NAME;

/** Своё расширение, чтобы файл комплекта было видно среди прочих */
const SET_FILE_EXTENSION = '.kwset';

/**
 * Основа имени файла из названия комплекта. Название задаёт педагог, и в
 * нём может оказаться что угодно — в имя файла попадают только буквы,
 * цифры, пробел, дефис и подчёркивание. Это подсказка в диалоге сохранения,
 * а не путь: итоговый путь всё равно выбирает пользователь в системном
 * диалоге.
 */
function safeFileStem(title) {
  const cleaned = String(title || '')
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .trim()
    .slice(0, 60);
  return cleaned || 'Комплект';
}

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
 * @param {{ ipcMain: Electron.IpcMain, app: Electron.App, dialog?: Electron.Dialog,
 *   sharedDirOverride?: string }} deps
 *   sharedDirOverride — только для тестов: каталог данных общий на машину
 *   (%ProgramData%\kiosk-words), и без подмены тест IPC писал бы в РЕАЛЬНЫЕ
 *   данные педагога на этой машине. Тот же параметр и с тем же назначением
 *   есть у resolveStorageDir. В проде не передаётся.
 */
function registerWordsIpc({ ipcMain, app, dialog, sharedDirOverride }) {
  let libraryError = null;
  const { dir: baseDir, isFallback } = resolveStorageDir({
    platform: process.platform,
    userDataDir: app.getPath('userData'),
    sharedDirOverride,
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

  // ── Пароль педагога (ТЗ раздел 3) ────────────────────────────────────
  //
  // Наружу уходит только «подошёл или нет». Ни пароль, ни его хеш рендерер не
  // получает: иначе проверка снималась бы инспектором страницы.

  ipcMain.handle(
    'words:check-teacher-password',
    guarded(async (_e, password) => ({ ok: teacherPassword.checkPassword(baseDir, password) }))
  );

  ipcMain.handle(
    'words:set-teacher-password',
    guarded(async (_e, password) => {
      teacherPassword.setPassword(baseDir, password);
      return { isDefault: teacherPassword.isDefaultPassword(baseDir) };
    })
  );

  ipcMain.handle(
    'words:teacher-password-state',
    guarded(async () => ({ isDefault: teacherPassword.isDefaultPassword(baseDir) }))
  );

  // ── Свои картинки для поставочных слов (ТЗ строка 42) ────────────────
  //
  // Путь к выбранному файлу рендерер не передаёт и не получает: диалог
  // открывает главный процесс, файл проходит ту же проверку по сигнатуре
  // содержимого, что и любое другое медиа, и в хранилище попадает под именем
  // из хеша.

  ipcMain.handle('words:list-word-images', guarded(async () => wordStore.listWordImages(baseDir)));

  ipcMain.handle(
    'words:pick-word-image',
    guarded(async (_e, wordId) => {
      if (!dialog) throw new mediaFiles.MediaError('Диалог выбора файла недоступен');
      if (!libraryWordIds().includes(wordId)) {
        throw new mediaFiles.MediaError('Такого слова нет в поставке');
      }

      const result = await dialog.showOpenDialog({
        title: 'Выберите картинку для слова',
        properties: ['openFile'],
        filters: [{ name: 'Изображения', extensions: mediaFiles.IMAGE_EXTENSIONS.map((e) => e.replace('.', '')) }],
      });
      if (result.canceled || result.filePaths.length === 0) return { canceled: true };

      const stored = mediaFiles.importMediaFile(baseDir, result.filePaths[0], 'image');
      const overrides = wordStore.setWordImage(baseDir, wordId, stored.fileName);
      return { canceled: false, fileName: stored.fileName, overrides };
    })
  );

  ipcMain.handle(
    'words:clear-word-image',
    guarded(async (_e, wordId) => wordStore.clearWordImage(baseDir, wordId))
  );

  // ── Экспорт и импорт комплекта (ТЗ строка 56) ────────────────────────
  //
  // Путь к файлу рендерер не передаёт и не получает: и сохранение, и
  // открытие идут через системный диалог в main-процессе — тот же принцип,
  // что и у выбора картинки выше.

  ipcMain.handle(
    'words:export-set',
    guarded(async (_e, setId) => {
      if (!dialog) throw new setArchive.SetArchiveError('Диалог сохранения недоступен');

      const set = wordStore.listSets(baseDir).find((s) => s.id === setId);
      if (!set) throw new setArchive.SetArchiveError('Такого комплекта нет');

      const result = await dialog.showSaveDialog({
        title: 'Сохранить комплект',
        defaultPath: `${safeFileStem(set.title)}${SET_FILE_EXTENSION}`,
        filters: [{ name: 'Комплект слов', extensions: [SET_FILE_EXTENSION.slice(1)] }],
      });
      if (result.canceled || !result.filePath) return { canceled: true };

      const report = await setArchive.exportSetToZip(baseDir, setId, result.filePath);
      return { canceled: false, filePath: result.filePath, ...report };
    })
  );

  ipcMain.handle(
    'words:import-set',
    guarded(async () => {
      if (!dialog) throw new setArchive.SetArchiveError('Диалог выбора файла недоступен');

      const result = await dialog.showOpenDialog({
        title: 'Выберите файл комплекта',
        properties: ['openFile'],
        filters: [{ name: 'Комплект слов', extensions: [SET_FILE_EXTENSION.slice(1)] }],
      });
      if (result.canceled || result.filePaths.length === 0) return { canceled: true };

      const imported = await setArchive.importSetFromZip(
        baseDir,
        result.filePaths[0],
        libraryWordIds()
      );
      return {
        canceled: false,
        set: imported.set,
        addedWords: imported.addedWords,
        reusedWords: imported.reusedWords,
        skippedWords: imported.skippedWords,
        words: wordStore.listUserWords(baseDir),
        sets: wordStore.listSets(baseDir),
      };
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
