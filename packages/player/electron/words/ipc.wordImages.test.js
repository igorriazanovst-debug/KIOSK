// packages/player/electron/words/ipc.wordImages.test.js
// Свои картинки педагога для ПОСТАВОЧНЫХ слов — через IPC-ручки.
//
// Проверяется шов: диалог, проверка «слово вообще есть в поставке», импорт
// файла через ту же проверку по сигнатуре, что и любое медиа, и обратимость —
// поставочная картинка должна возвращаться.

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
  Buffer.alloc(40, 3),
]);
const EXE = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(40, 0)]);

/** Готовит файл на диске, который «выберет» педагог в диалоге */
function fileWith(content, name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'words-pick-'));
  const p = path.join(dir, name);
  fs.writeFileSync(p, content);
  return p;
}

function bootstrap({ pickPath = null, canceled = false } = {}) {
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'words-imgipc-'));
  const handlers = new Map();
  const ipcMain = { handle: (ch, fn) => handlers.set(ch, fn) };
  const app = { getPath: () => baseDir, getAppPath: () => baseDir, isPackaged: false };
  const dialog = {
    showOpenDialog: async () =>
      canceled ? { canceled: true, filePaths: [] } : { canceled: false, filePaths: [pickPath] },
    showSaveDialog: async () => ({ canceled: true }),
  };
  // Без подмены каталога тест писал бы в реальные данные педагога
  const ctx = registerWordsIpc({ ipcMain, app, dialog, sharedDirOverride: baseDir });
  const call = (ch, ...args) => {
    const fn = handlers.get(ch);
    assert.ok(fn, `ручка ${ch} не зарегистрирована`);
    return fn({}, ...args);
  };
  return { baseDir: ctx.baseDir, call, handlers, hasLibrary: !!ctx.assetsDir };
}

test('ручки картинок зарегистрированы', () => {
  const { handlers } = bootstrap();
  for (const ch of ['words:list-word-images', 'words:pick-word-image', 'words:clear-word-image']) {
    assert.ok(handlers.has(ch), ch);
  }
});

test('на чистом устройстве своих картинок нет', async () => {
  const { call } = bootstrap();
  const res = await call('words:list-word-images');
  assert.equal(res.ok, true, res.error);
  assert.deepEqual(res.data, {});
});

test('картинка ставится поставочному слову и переживает перечитывание', async (t) => {
  const src = fileWith(PNG, 'своя.png');
  const { call, hasLibrary } = bootstrap({ pickPath: src });
  if (!hasLibrary) return t.skip('пакет контента не подключён в этом окружении');

  const res = await call('words:pick-word-image', '0000');
  assert.equal(res.ok, true, res.error);
  assert.equal(res.data.canceled, false);
  assert.match(res.data.fileName, /^[0-9a-f]{32}\.png$/, 'имя файла — хеш содержимого');
  assert.equal(res.data.overrides['0000'], res.data.fileName);

  const again = await call('words:list-word-images');
  assert.equal(again.data['0000'], res.data.fileName, 'запись на диске сохранилась');
});

test('поставочная картинка возвращается, файл подмены удаляется', async (t) => {
  const src = fileWith(PNG, 'своя.png');
  const { baseDir, call, hasLibrary } = bootstrap({ pickPath: src });
  if (!hasLibrary) return t.skip('пакет контента не подключён в этом окружении');

  const set = await call('words:pick-word-image', '0000');
  const stored = set.data.fileName;
  assert.ok(fs.existsSync(mediaFiles.mediaFilePath(baseDir, stored)), 'файл лёг в хранилище');

  const cleared = await call('words:clear-word-image', '0000');
  assert.equal(cleared.ok, true, cleared.error);
  assert.deepEqual(cleared.data, {}, 'переопределений не осталось');
  assert.equal(
    fs.existsSync(mediaFiles.mediaFilePath(baseDir, stored)),
    false,
    'осиротевший файл убран с диска'
  );
});

test('возврат там, где своей картинки не было, — понятная ошибка', async () => {
  const { call } = bootstrap();
  const res = await call('words:clear-word-image', '0000');
  assert.equal(res.ok, false);
  assert.match(res.error, /нет своей картинки/i);
});

test('слову, которого нет в поставке, картинку не поставить', async (t) => {
  const src = fileWith(PNG, 'своя.png');
  const { call, hasLibrary } = bootstrap({ pickPath: src });
  if (!hasLibrary) return t.skip('пакет контента не подключён в этом окружении');

  const res = await call('words:pick-word-image', '9999');
  assert.equal(res.ok, false);
  assert.match(res.error, /нет в поставке/i);
});

test('переименованный .exe отвергается по сигнатуре, а не по расширению', async (t) => {
  const src = fileWith(EXE, 'вирус.png');
  const { call, hasLibrary } = bootstrap({ pickPath: src });
  if (!hasLibrary) return t.skip('пакет контента не подключён в этом окружении');

  const res = await call('words:pick-word-image', '0000');
  assert.equal(res.ok, false);
  assert.match(res.error, /не изображение|не картинка|распознать/i);

  const after = await call('words:list-word-images');
  assert.deepEqual(after.data, {}, 'ничего не записалось');
});

test('отказ от диалога не считается ошибкой', async (t) => {
  const { call, hasLibrary } = bootstrap({ canceled: true });
  if (!hasLibrary) return t.skip('пакет контента не подключён в этом окружении');

  const res = await call('words:pick-word-image', '0000');
  assert.equal(res.ok, true);
  assert.equal(res.data.canceled, true);
});
