// packages/player/electron/alphabet/setArchive.test.js
// Обмен комплектами: ТЗ строка 77 (импорт и экспорт) и раздел 9 (проверка
// импортируемого контента).
//
// Главное, что здесь проверяется, — НЕ «файл создался», а что комплект,
// уехавший с одного устройства, на другом играется: слоги приехали вместе
// со словами, идентификаторы не затёрли чужие, а подделанный архив отвергнут.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const yazl = require('yazl');

const archive = require('./setArchive');
const store = require('./contentStore');
const media = require('../common/mediaFiles');
const { alphabet } = require('@kiosk/shared');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'abc-archive-'));

function pngBytes(tint = 0) {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, tint,
  ]);
}

function webmBytes(n = 0) {
  return Buffer.concat([
    Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00]),
    Buffer.alloc(64, n),
  ]);
}

/** Устройство с одним своим словом «Кошка» в комплекте вместе с поставочным */
function deviceWithSet() {
  const dir = tmp();
  const ko = store.createSyllable(dir, { name: 'ко', letterNumbers: [12, 16] });
  const shka = store.createSyllable(dir, { name: 'шка', letterNumbers: [26, 12, 1] });
  const image = media.storeMediaBuffer(dir, pngBytes(7), 'image').fileName;
  const word = store.createWord(dir, {
    name: 'Кошка',
    syllableIds: [ko.id, shka.id],
    hasWithoutLastSyllable: true,
    imageFile: image,
  });
  store.saveVoice(dir, 'word', word.id, webmBytes(1));
  store.saveVoice(dir, 'bgn', word.id, webmBytes(2));
  store.saveVoice(dir, 'syllable', ko.id, webmBytes(3));
  store.saveVoice(dir, 'syllable', shka.id, webmBytes(4));
  const set = store.createSet(
    dir,
    { title: 'Урок', wordIds: ['avtobus', word.id] },
    [{ id: 'avtobus', name: 'Автобус', syllableIds: ['av'], hasWithoutLastSyllable: false }]
  );
  return { dir, set, word, ko, shka, image };
}

test('комплект уезжает и приезжает целиком', async () => {
  const source = deviceWithSet();
  const file = path.join(source.dir, 'set.zip');
  const exported = await archive.exportSetToZip(source.dir, source.set.id, file);
  assert.equal(exported.words, 2);
  assert.equal(exported.ownWords, 1, 'поставочное слово в архив не кладётся');
  assert.ok(exported.files >= 5, 'картинка и четыре записи должны были уехать');

  const target = tmp();
  const report = await archive.importSetFromZip(target, file, ['avtobus']);
  assert.equal(report.words, 2);
  assert.equal(report.ownWords, 1);
  assert.equal(report.syllables, 2, 'слоги обязаны приехать вместе со словом');
  assert.equal(report.voices, 4);
  assert.deepEqual(report.dropped, []);
});

test('приехавшее слово играется — граф на новом устройстве цел', async () => {
  // Это и есть смысл обмена. «Файл создался» ничего не доказывает
  const source = deviceWithSet();
  const file = path.join(source.dir, 'set.zip');
  await archive.exportSetToZip(source.dir, source.set.id, file);

  const target = tmp();
  await archive.importSetFromZip(target, file, ['avtobus']);
  const content = store.readContent(target);

  const library = alphabet.parseAlphabetLibrary({
    schemaVersion: 1,
    audioScheme: { recorded: false },
    letters: [...'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ'].map((name, i) => ({
      number: i + 1,
      name,
      wordIds: i === 0 ? ['avtobus'] : [],
    })),
    syllables: [{ id: 'av', name: 'ав', letterNumbers: [1, 3] }],
    words: [
      { id: 'avtobus', name: 'Автобус', syllableIds: ['av'], hasWithoutLastSyllable: false },
    ],
    sets: [],
  });
  const merged = alphabet.mergeUserContent(library, content);
  const report = alphabet.checkGraph(merged);
  assert.deepEqual(report.issues, [], 'после импорта граф сломан');

  // И слово действительно предлагается игрой
  const eligible = alphabet.eligibleWords(merged, 'wordMake');
  assert.ok(eligible.includes(content.words[0].id), 'приехавшее слово не попало в этап 3');
});

test('идентификаторы приезжего не затирают своё', async () => {
  // Комплект может вернуться туда, откуда уехал, после правок
  const source = deviceWithSet();
  const file = path.join(source.dir, 'set.zip');
  await archive.exportSetToZip(source.dir, source.set.id, file);

  const before = store.readContent(source.dir);
  await archive.importSetFromZip(source.dir, file, ['avtobus']);
  const after = store.readContent(source.dir);

  assert.equal(after.words.length, before.words.length + 1, 'слово должно добавиться, а не заместиться');
  assert.ok(after.words.some((w) => w.id === source.word.id), 'исходное слово пропало');
  assert.equal(new Set(after.words.map((w) => w.id)).size, after.words.length, 'дубликаты id');
});

test('слог с тем же написанием переиспользуется, а не дублируется', async () => {
  // Два одинаковых слога дали бы два файла на один звук
  const source = deviceWithSet();
  const file = path.join(source.dir, 'set.zip');
  await archive.exportSetToZip(source.dir, source.set.id, file);

  const before = store.readContent(source.dir).syllables.length;
  const report = await archive.importSetFromZip(source.dir, file, ['avtobus']);
  assert.equal(report.syllables, 0, 'слоги «ко» и «шка» уже есть — заводить заново нечего');
  assert.equal(store.readContent(source.dir).syllables.length, before);
});

test('конфликт названий переименовывает, а не отказывает', async () => {
  const source = deviceWithSet();
  const file = path.join(source.dir, 'set.zip');
  await archive.exportSetToZip(source.dir, source.set.id, file);
  const report = await archive.importSetFromZip(source.dir, file, ['avtobus']);
  assert.equal(report.renamed, true);
  assert.equal(report.set.title, 'Урок (2)');
});

test('поставочное слово, которого тут нет, выпадает — импорт продолжается', async () => {
  // Деградация, а не отказ: на принимающем устройстве может быть другая
  // версия пакета контента.
  //
  // Своих слов в комплекте ДВА: правило «меньше двух слов играть нечем»
  // сильнее, и с одним оставшимся импорт справедливо отказал бы — тогда
  // проверялась бы не деградация, а как раз отказ
  const source = deviceWithSet();
  const za = store.createSyllable(source.dir, { name: 'за', letterNumbers: [9, 1] });
  const second = store.createWord(source.dir, { name: 'Коза', syllableIds: [source.ko.id, za.id] });
  store.updateSet(
    source.dir,
    source.set.id,
    { title: 'Урок', wordIds: ['avtobus', source.word.id, second.id] },
    [{ id: 'avtobus', name: 'Автобус', syllableIds: ['av'], hasWithoutLastSyllable: false }]
  );

  const file = path.join(source.dir, 'set.zip');
  await archive.exportSetToZip(source.dir, source.set.id, file);

  const report = await archive.importSetFromZip(tmp(), file, []);
  assert.deepEqual(report.dropped, ['avtobus']);
  assert.equal(report.words, 2, 'остаться должны только свои слова');
});

test('комплект, от которого осталось меньше двух слов, отвергается', async () => {
  // Играть таким нечем, и сказать об этом честнее, чем создать пустышку
  const dir = tmp();
  const zip = new yazl.ZipFile();
  zip.addBuffer(
    Buffer.from(JSON.stringify({ formatVersion: 1, exportedAt: 'x' }), 'utf8'),
    'manifest.json'
  );
  zip.addBuffer(
    Buffer.from(
      JSON.stringify({ title: 'Пусто', wordIds: ['net1', 'net2'], words: [], syllables: [] }),
      'utf8'
    ),
    'set.json'
  );
  const file = path.join(dir, 'bad.zip');
  await new Promise((resolve) => {
    const out = fs.createWriteStream(file);
    out.on('close', resolve);
    zip.outputStream.pipe(out);
    zip.end();
  });

  await assert.rejects(() => archive.importSetFromZip(tmp(), file, []), /осталось слов/);
});

// ─── Безопасность (ТЗ раздел 9) ─────────────────────────────────────────

test('неожиданный файл в архиве отвергает весь архив', async () => {
  // Чужая структура значит, что это не наш архив, и разбирать нечего
  const dir = tmp();
  const zip = new yazl.ZipFile();
  zip.addBuffer(Buffer.from('{}', 'utf8'), 'manifest.json');
  zip.addBuffer(Buffer.from('{}', 'utf8'), 'set.json');
  zip.addBuffer(Buffer.from('MZ', 'utf8'), 'payload.exe');
  const file = path.join(dir, 'evil.zip');
  await new Promise((resolve) => {
    const out = fs.createWriteStream(file);
    out.on('close', resolve);
    zip.outputStream.pipe(out);
    zip.end();
  });

  await assert.rejects(() => archive.importSetFromZip(tmp(), file, []), /Неожиданный файл/);
});

test('файл не той природы под видом картинки не сохраняется', async () => {
  // Проверка по СИГНАТУРЕ, а не по имени: переименованный .exe отвергается
  // ровно так же, как при обычном импорте
  const dir = tmp();
  const zip = new yazl.ZipFile();
  zip.addBuffer(
    Buffer.from(JSON.stringify({ formatVersion: 1, exportedAt: 'x' }), 'utf8'),
    'manifest.json'
  );
  zip.addBuffer(
    Buffer.from(
      JSON.stringify({
        title: 'Проба',
        wordIds: ['u1111111111111111', 'u2222222222222222'],
        syllables: [{ id: 'u3333333333333333', name: 'ко', letterNumbers: [12, 16] }],
        words: [
          {
            id: 'u1111111111111111',
            name: 'Ко',
            syllableIds: ['u3333333333333333'],
            hasWithoutLastSyllable: false,
            imageFile: '0123456789abcdef0123456789abcdef.png',
          },
          {
            id: 'u2222222222222222',
            name: 'Кок',
            syllableIds: ['u3333333333333333'],
            hasWithoutLastSyllable: false,
          },
        ],
      }),
      'utf8'
    ),
    'set.json'
  );
  // Под именем .png лежит исполняемый файл
  zip.addBuffer(Buffer.from('MZ\x90\x00executable'), 'media/0123456789abcdef0123456789abcdef.png');
  const file = path.join(dir, 'fake.zip');
  await new Promise((resolve) => {
    const out = fs.createWriteStream(file);
    out.on('close', resolve);
    zip.outputStream.pipe(out);
    zip.end();
  });

  const target = tmp();
  const report = await archive.importSetFromZip(target, file, []);
  // Импорт прошёл, но картинка НЕ сохранена: слово приедет без иллюстрации
  const saved = store.readContent(target).words.find((w) => w.name === 'Ко');
  assert.equal(saved?.imageFile ?? null, null, 'подделка сохранена как картинка');
  assert.equal(report.words, 2);
  const mediaDir = media.mediaDir(target);
  const stored = fs.existsSync(mediaDir) ? fs.readdirSync(mediaDir) : [];
  assert.deepEqual(stored, [], 'в хранилище что-то легло');
});

test('архив чужой версии формата отвергается внятно', async () => {
  const dir = tmp();
  const zip = new yazl.ZipFile();
  zip.addBuffer(Buffer.from(JSON.stringify({ formatVersion: 99 }), 'utf8'), 'manifest.json');
  zip.addBuffer(
    Buffer.from(JSON.stringify({ title: 'X', wordIds: [], words: [], syllables: [] }), 'utf8'),
    'set.json'
  );
  const file = path.join(dir, 'future.zip');
  await new Promise((resolve) => {
    const out = fs.createWriteStream(file);
    out.on('close', resolve);
    zip.outputStream.pipe(out);
    zip.end();
  });

  await assert.rejects(() => archive.importSetFromZip(tmp(), file, []), /другой версией/);
});

test('имя файла для диалога сохранения чистится от лишнего', () => {
  assert.equal(archive.safeFileStem('ПДД / занятие №1'), 'ПДД  занятие 1');
  assert.equal(archive.safeFileStem(''), 'Комплект');
  assert.equal(archive.safeFileStem('***'), 'Комплект');
});
