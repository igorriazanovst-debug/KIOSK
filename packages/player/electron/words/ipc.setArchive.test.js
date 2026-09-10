// packages/player/electron/words/ipc.setArchive.test.js
// Экспорт и импорт комплекта ЧЕРЕЗ IPC-ручки, а не напрямую через модуль
// архива.
//
// Зачем отдельно от setArchive.test.js: сам архив там уже покрыт, а здесь
// проверяется шов — регистрация ручек, обёртка guarded (ошибка приходит
// текстом, а не исключением наружу), подстановка списка поставочных слов и
// поведение при отказе от системного диалога. Именно такие тонкие прослойки
// ломаются молча: модуль работает, кнопка не работает.
//
// Electron не поднимается: ipcMain, app и dialog — заглушки. Это тот же
// приём, что и у остальных тестов хранилища в этой папке.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { registerWordsIpc } = require('./ipc');
const wordStore = require('./wordStore');
const mediaFiles = require('./mediaFiles');

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(24, 1),
]);

/** Поднимает IPC на временном каталоге и возвращает вызыватель ручек */
function bootstrap({ saveTo = null, openFrom = null, canceled = false } = {}) {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'words-ipc-'));
  const handlers = new Map();

  const ipcMain = {
    handle(channel, fn) {
      handlers.set(channel, fn);
    },
  };
  // storageDir кладёт данные внутрь каталога приложения — отдаём временный
  const app = {
    getPath: () => baseDir,
    getAppPath: () => baseDir,
    isPackaged: false,
  };

  const dialog = {
    showSaveDialog: async () => (canceled ? { canceled: true } : { canceled: false, filePath: saveTo }),
    showOpenDialog: async () =>
      canceled ? { canceled: true, filePaths: [] } : { canceled: false, filePaths: [openFrom] },
  };

  // Без подмены каталога тест писал бы в РЕАЛЬНЫЙ %ProgramData%\kiosk-words:
  // хранилище общее на машину, и «два устройства» в одном тесте оказались бы
  // одним. Именно на этом тест и упал в первый раз.
  const ctx = registerWordsIpc({ ipcMain, app, dialog, sharedDirOverride: baseDir });
  const call = (channel, ...args) => {
    const fn = handlers.get(channel);
    assert.ok(fn, `ручка ${channel} не зарегистрирована`);
    return fn({}, ...args);
  };
  return { baseDir: ctx.baseDir, call, handlers };
}

test('ручки экспорта и импорта комплекта зарегистрированы', () => {
  const { handlers } = bootstrap();
  assert.ok(handlers.has('words:export-set'), 'words:export-set');
  assert.ok(handlers.has('words:import-set'), 'words:import-set');
});

test('экспорт через ручку пишет файл и возвращает отчёт', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'words-out-')), 'Урок.kwset');
  const { baseDir, call } = bootstrap({ saveTo: out });

  const image = mediaFiles.storeMediaBuffer(baseDir, PNG, 'image');
  const word = wordStore.createUserWord(baseDir, {
    name: 'Скворечник',
    imageFile: image.fileName,
    audioFile: null,
  });
  const set = wordStore.createSet(baseDir, { title: 'Урок', wordIds: [word.id, '0000'] }, ['0000']);

  const res = await call('words:export-set', set.id);

  assert.equal(res.ok, true, res.error);
  assert.equal(res.data.canceled, false);
  assert.equal(res.data.title, 'Урок');
  assert.ok(fs.existsSync(out), 'файл архива создан');
});

test('отказ от диалога сохранения — это не ошибка', async () => {
  const { baseDir, call } = bootstrap({ canceled: true });
  const image = mediaFiles.storeMediaBuffer(baseDir, PNG, 'image');
  const word = wordStore.createUserWord(baseDir, {
    name: 'Ёлка',
    imageFile: image.fileName,
    audioFile: null,
  });
  const set = wordStore.createSet(baseDir, { title: 'Набор', wordIds: [word.id, '0000'] }, ['0000']);

  const res = await call('words:export-set', set.id);

  assert.equal(res.ok, true, 'отмена приходит успехом с признаком canceled');
  assert.equal(res.data.canceled, true);
});

test('экспорт несуществующего комплекта приходит текстом ошибки, а не исключением', async () => {
  const { call } = bootstrap({ saveTo: 'неважно.kwset' });
  const res = await call('words:export-set', 'set-нет-такого');
  assert.equal(res.ok, false);
  assert.match(res.error, /комплект/i);
});

test('экспорт и импорт через ручки переносят комплект между устройствами', async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'words-out-')), 'Перенос.kwset');

  // Устройство-источник
  const src = bootstrap({ saveTo: out });
  const image = mediaFiles.storeMediaBuffer(src.baseDir, PNG, 'image');
  const word = wordStore.createUserWord(src.baseDir, {
    name: 'Скворечник',
    imageFile: image.fileName,
    audioFile: null,
  });
  const set = wordStore.createSet(
    src.baseDir,
    { title: 'Урок на перенос', wordIds: [word.id, '0000'] },
    ['0000']
  );
  const exported = await src.call('words:export-set', set.id);
  assert.equal(exported.ok, true, exported.error);

  // Устройство-приёмник
  const dst = bootstrap({ openFrom: out });
  const imported = await dst.call('words:import-set');

  assert.equal(imported.ok, true, imported.error);
  assert.equal(imported.data.canceled, false);
  assert.equal(imported.data.set.title, 'Урок на перенос');
  // Ручка возвращает обновлённые списки, чтобы интерфейс не перечитывал их отдельно
  assert.equal(imported.data.words.length, 1);
  assert.equal(imported.data.sets.length, 1);
  assert.equal(imported.data.addedWords, 1);

  // Поставочное слово '0000' в архив не кладётся — едет только
  // идентификатор. Ручка подставляет список слов СВОЕЙ библиотеки
  // (libraryWordIds), поставочный пакет здесь подключён, слово находится и
  // остаётся в комплекте. Случай «на устройстве такого слова нет» покрыт в
  // setArchive.test.js, где список библиотеки задаётся явно.
  assert.deepEqual(imported.data.skippedWords, [], 'ничего не выпало');
  assert.ok(
    imported.data.set.wordIds.includes('0000'),
    'поставочное слово подхвачено из библиотеки приёмника, а не приехало файлом'
  );
});

test('отказ от диалога открытия — это не ошибка', async () => {
  const { call } = bootstrap({ canceled: true });
  const res = await call('words:import-set');
  assert.equal(res.ok, true);
  assert.equal(res.data.canceled, true);
});

test('импорт чужого файла приходит понятным текстом', async () => {
  const junk = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'words-junk-')), 'чужое.kwset');
  fs.writeFileSync(junk, 'это не архив');
  const { call } = bootstrap({ openFrom: junk });

  const res = await call('words:import-set');
  assert.equal(res.ok, false);
  assert.match(res.error, /архив/i);
});
