// packages/player/electron/words/setArchive.test.js
// Экспорт/импорт комплекта на временном каталоге, без Electron.
//
// Отдельно проверяются негативные сценарии, названные ТЗ (раздел 12):
// некорректные данные, отсутствующий файл, чужая структура архива — и
// требование раздела 9: файл из архива не принимается по имени, только по
// сигнатуре содержимого.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const yazl = require('yazl');

const archive = require('./setArchive');
const wordStore = require('./wordStore');
const mediaFiles = require('./mediaFiles');

/** Минимальный валидный PNG — сигнатура плюс пустой IHDR */
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(24, 1),
]);
/** Минимальный валидный WEBM (EBML) */
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(24, 2)]);
/** PE-заголовок: тот самый переименованный .exe */
const EXE = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(30, 0)]);

const LIBRARY_IDS = ['0000', '0001', '0002'];

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'words-archive-'));
}

/** Готовит устройство с одним комплектом: своё слово + два поставочных */
function seed(dir) {
  const image = mediaFiles.storeMediaBuffer(dir, PNG, 'image');
  const audio = mediaFiles.storeMediaBuffer(dir, WEBM, 'audio');
  const word = wordStore.createUserWord(dir, {
    name: 'Скворечник',
    imageFile: image.fileName,
    audioFile: audio.fileName,
  });
  const set = wordStore.createSet(
    dir,
    { title: 'Урок', wordIds: [word.id, '0000', '0001'] },
    LIBRARY_IDS
  );
  return { word, set, image, audio };
}

/** Собирает произвольный ZIP — для проверок на чужую и битую структуру */
async function makeZip(target, files) {
  const zip = new yazl.ZipFile();
  for (const [name, content] of Object.entries(files)) {
    zip.addBuffer(Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8'), name);
  }
  zip.end();
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(target);
    out.on('close', resolve);
    out.on('error', reject);
    zip.outputStream.pipe(out);
  });
  return target;
}

// ─── Экспорт ────────────────────────────────────────────────────────────

test('экспорт кладёт манифест, состав и файлы своих слов', async () => {
  const dir = tmpDir();
  const { set } = seed(dir);
  const out = path.join(dir, 'urok.kwset');

  const report = await archive.exportSetToZip(dir, set.id, out);

  assert.equal(report.title, 'Урок');
  assert.equal(report.words, 3, 'в комплекте три слова');
  assert.equal(report.ownWords, 1, 'своё из них одно');
  assert.equal(report.files, 2, 'картинка и запись');
  assert.ok(fs.statSync(out).size > 0);
  assert.equal(fs.readdirSync(dir).filter((f) => f.includes('.tmp-')).length, 0,
    'временных файлов после экспорта не осталось');
});

test('экспорт несуществующего комплекта — ошибка, а не пустой архив', async () => {
  const dir = tmpDir();
  await assert.rejects(
    () => archive.exportSetToZip(dir, 'set-нет', path.join(dir, 'x.kwset')),
    archive.SetArchiveError
  );
});

test('потерянный на диске файл не роняет экспорт — слово уезжает без него', async () => {
  const dir = tmpDir();
  const { set, image } = seed(dir);
  fs.unlinkSync(mediaFiles.mediaFilePath(dir, image.fileName));

  const report = await archive.exportSetToZip(dir, set.id, path.join(dir, 'u.kwset'));
  assert.equal(report.files, 1, 'уехала только запись');
});

// ─── Импорт: нормальный путь ────────────────────────────────────────────

test('комплект переезжает на другое устройство целиком', async () => {
  const from = tmpDir();
  const { set } = seed(from);
  const zipPath = path.join(from, 'urok.kwset');
  await archive.exportSetToZip(from, set.id, zipPath);

  const to = tmpDir();
  const result = await archive.importSetFromZip(to, zipPath, LIBRARY_IDS);

  assert.equal(result.set.title, 'Урок');
  assert.equal(result.set.wordIds.length, 3);
  assert.equal(result.addedWords, 1);
  assert.deepEqual(result.skippedWords, []);

  const words = wordStore.listUserWords(to);
  assert.equal(words.length, 1);
  assert.equal(words[0].name, 'Скворечник');
  assert.notEqual(words[0].id, 'должен быть свой идентификатор');
  assert.ok(fs.existsSync(mediaFiles.mediaFilePath(to, words[0].imageFile)),
    'картинка легла в хранилище принимающего устройства');
  assert.ok(fs.existsSync(mediaFiles.mediaFilePath(to, words[0].audioFile)));
});

test('импорт того же архива дважды не плодит копии слов', async () => {
  const from = tmpDir();
  const { set } = seed(from);
  const zipPath = path.join(from, 'u.kwset');
  await archive.exportSetToZip(from, set.id, zipPath);

  const to = tmpDir();
  await archive.importSetFromZip(to, zipPath, LIBRARY_IDS);
  const second = await archive.importSetFromZip(to, zipPath, LIBRARY_IDS);

  assert.equal(second.addedWords, 0);
  assert.equal(second.reusedWords, 1, 'слово переиспользовано, а не заведено заново');
  assert.equal(wordStore.listUserWords(to).length, 1, 'своих слов по-прежнему одно');
  assert.equal(second.set.title, 'Урок (2)', 'название разведено, импорт не отклонён');
  assert.equal(wordStore.listSets(to).length, 2);
});

test('поставочное слово, которого нет на устройстве, выпадает, а импорт идёт дальше', async () => {
  const from = tmpDir();
  const { set } = seed(from);
  const zipPath = path.join(from, 'u.kwset');
  await archive.exportSetToZip(from, set.id, zipPath);

  const to = tmpDir();
  // На принимающем устройстве другой пакет контента: есть только '0000'
  const result = await archive.importSetFromZip(to, zipPath, ['0000']);

  assert.deepEqual(result.skippedWords, ['0001']);
  assert.equal(result.set.wordIds.length, 2, 'своё слово плюс найденное поставочное');
});

test('если после выпадения слов осталось меньше двух — импорт отклонён', async () => {
  const from = tmpDir();
  const { set } = seed(from);
  const zipPath = path.join(from, 'u.kwset');
  await archive.exportSetToZip(from, set.id, zipPath);

  const to = tmpDir();
  await assert.rejects(
    () => archive.importSetFromZip(to, zipPath, []), // ни одного поставочного слова
    (err) => err instanceof archive.SetArchiveError && /осталось слов/.test(err.message)
  );
  assert.equal(wordStore.listSets(to).length, 0, 'полукомплект не сохранён');
});

// ─── Импорт: негативные сценарии (ТЗ разделы 9 и 12) ────────────────────

test('переименованный .exe внутри архива отвергается по сигнатуре', async () => {
  const dir = tmpDir();
  const fake = 'a'.repeat(32) + '.png';
  const zipPath = await makeZip(path.join(dir, 'evil.kwset'), {
    'manifest.json': JSON.stringify({ formatVersion: 1 }),
    'set.json': JSON.stringify({
      title: 'Вредный',
      wordIds: ['u0123456789abcdef'],
      words: [{ id: 'u0123456789abcdef', name: 'Вирус', level: 9, imageFile: fake, audioFile: null }],
    }),
    [`media/${fake}`]: EXE,
  });

  await assert.rejects(() => archive.importSetFromZip(dir, zipPath, LIBRARY_IDS),
    (err) => /не картинка и не звук|Это не изображение/.test(err.message));
  assert.equal(fs.existsSync(path.join(dir, 'media', fake)), false,
    'ничего не легло в хранилище');
});

// Белый список — это ТОЧНОЕ совпадение имени, а не проверка «нет ..» в пути.
// Поэтому здесь проверяются имена, которые yazl соглашается положить в
// архив: путь с traversal (`../../evil.txt`) им собрать нельзя вообще —
// библиотека отказывается его создавать, так что архив с ним пришлось бы
// писать сырыми байтами. Ветка отказа при этом одна и та же: имя не
// совпало с ожидаемым — разбор прекращается.
test('посторонний файл в архиве — отказ, а не молчаливый пропуск', async () => {
  const dir = tmpDir();
  const zipPath = await makeZip(path.join(dir, 'extra.kwset'), {
    'manifest.json': JSON.stringify({ formatVersion: 1 }),
    'set.json': JSON.stringify({ title: 'X', wordIds: [], words: [] }),
    'evil.txt': 'посторонний файл',
  });

  await assert.rejects(() => archive.importSetFromZip(dir, zipPath, LIBRARY_IDS),
    (err) => err instanceof archive.SetArchiveError && /Неожиданный файл/.test(err.message));
});

test('имя медиа не по форме «хеш.расширение» — отказ', async () => {
  const dir = tmpDir();
  const zipPath = await makeZip(path.join(dir, 'badname.kwset'), {
    'manifest.json': JSON.stringify({ formatVersion: 1 }),
    'set.json': JSON.stringify({ title: 'X', wordIds: [], words: [] }),
    'media/portrait.png': PNG, // не хеш
  });

  await assert.rejects(() => archive.importSetFromZip(dir, zipPath, LIBRARY_IDS),
    (err) => err instanceof archive.SetArchiveError && /Неожиданный файл/.test(err.message));
});

test('чужая версия формата отклоняется', async () => {
  const dir = tmpDir();
  const zipPath = await makeZip(path.join(dir, 'v99.kwset'), {
    'manifest.json': JSON.stringify({ formatVersion: 99 }),
    'set.json': JSON.stringify({ title: 'X', wordIds: [], words: [] }),
  });
  await assert.rejects(() => archive.importSetFromZip(dir, zipPath, LIBRARY_IDS),
    (err) => /Версия формата/.test(err.message));
});

test('архив без set.json — понятная ошибка, а не падение', async () => {
  const dir = tmpDir();
  const zipPath = await makeZip(path.join(dir, 'no-set.kwset'), {
    'manifest.json': JSON.stringify({ formatVersion: 1 }),
  });
  await assert.rejects(() => archive.importSetFromZip(dir, zipPath, LIBRARY_IDS),
    (err) => /не архив комплекта/.test(err.message));
});

test('битый JSON внутри архива — понятная ошибка', async () => {
  const dir = tmpDir();
  const zipPath = await makeZip(path.join(dir, 'broken.kwset'), {
    'manifest.json': JSON.stringify({ formatVersion: 1 }),
    'set.json': '{ это не json',
  });
  await assert.rejects(() => archive.importSetFromZip(dir, zipPath, LIBRARY_IDS),
    (err) => /повреждён/.test(err.message));
});

test('отсутствующий файл архива — понятная ошибка, а не стек', async () => {
  const dir = tmpDir();
  await assert.rejects(
    () => archive.importSetFromZip(dir, path.join(dir, 'нет-такого.kwset'), LIBRARY_IDS),
    (err) => err instanceof archive.SetArchiveError && /не является архивом/.test(err.message)
  );
});

test('слово со ссылкой на файл, которого в архиве нет, выпадает вместе с ним', async () => {
  const dir = tmpDir();
  const missing = 'b'.repeat(32) + '.png';
  const zipPath = await makeZip(path.join(dir, 'holed.kwset'), {
    'manifest.json': JSON.stringify({ formatVersion: 1 }),
    'set.json': JSON.stringify({
      title: 'Дырявый',
      wordIds: ['u1111111111111111', '0000', '0001'],
      words: [
        { id: 'u1111111111111111', name: 'Потеряшка', level: 9, imageFile: missing, audioFile: null },
      ],
    }),
  });

  const result = await archive.importSetFromZip(dir, zipPath, LIBRARY_IDS);
  assert.deepEqual(result.skippedWords, ['Потеряшка']);
  assert.equal(result.set.wordIds.length, 2, 'остались два поставочных');
  assert.equal(wordStore.listUserWords(dir).length, 0, 'битое слово не заведено');
});

test('не-архив (обычный текстовый файл) отклоняется', async () => {
  const dir = tmpDir();
  const notZip = path.join(dir, 'plain.kwset');
  fs.writeFileSync(notZip, 'просто текст, не архив');
  await assert.rejects(() => archive.importSetFromZip(dir, notZip, LIBRARY_IDS),
    (err) => err instanceof archive.SetArchiveError);
});
