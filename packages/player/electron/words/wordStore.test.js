// packages/player/electron/words/wordStore.test.js
// Хранилище контента педагога на временном каталоге, без Electron.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const store = require('./wordStore');
const media = require('./mediaFiles');
const { WordsRulesError } = require('@kiosk/shared');

const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'kiosk-words-store-'));

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20, 7)]);
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(20, 3)]);

const LIBRARY = ['0000', '0001', '0002'];

function withImage(dir, buffer = PNG) {
  return media.storeMediaBuffer(dir, buffer, 'image').fileName;
}

test('на свежем устройстве своих слов и комплектов нет', () => {
  const dir = tempDir();
  assert.deepEqual(store.listUserWords(dir), []);
  assert.deepEqual(store.listSets(dir), []);
});

test('своё слово создаётся и переживает перезапуск', () => {
  const dir = tempDir();
  const created = store.createUserWord(dir, {
    name: 'Скворечник',
    imageFile: withImage(dir),
    audioFile: null,
  });
  assert.match(created.id, /^u[0-9a-f]{16}$/);
  assert.equal(created.level, 9);
  assert.deepEqual(store.listUserWords(dir).map((w) => w.name), ['Скворечник']);
});

test('правила общие с доменом: пустое имя и дубликат отклоняются', () => {
  const dir = tempDir();
  const image = withImage(dir);
  store.createUserWord(dir, { name: 'Ёлка', imageFile: image, audioFile: null });
  assert.throws(
    () => store.createUserWord(dir, { name: '  ', imageFile: image, audioFile: null }),
    WordsRulesError,
  );
  assert.throws(
    () => store.createUserWord(dir, { name: 'ёлка', imageFile: image, audioFile: null }),
    WordsRulesError,
  );
});

test('слово с записью и без картинки допустимо', () => {
  const dir = tempDir();
  const audio = media.storeMediaBuffer(dir, WEBM, 'audio').fileName;
  const created = store.createUserWord(dir, { name: 'Шорох', imageFile: null, audioFile: audio });
  assert.equal(created.audioFile, audio);
});

test('правка слова удаляет ставший ненужным файл', () => {
  const dir = tempDir();
  const first = withImage(dir, PNG);
  const word = store.createUserWord(dir, { name: 'Ёлка', imageFile: first, audioFile: null });

  const second = withImage(dir, JPEG);
  store.updateUserWord(dir, word.id, { name: 'Ёлка', imageFile: second, audioFile: null });

  assert.equal(fs.existsSync(path.join(dir, 'media', first)), false, 'старая картинка убрана');
  assert.equal(fs.existsSync(path.join(dir, 'media', second)), true);
});

test('правка не удаляет файл, который делит другое слово', () => {
  const dir = tempDir();
  const shared = withImage(dir);
  const a = store.createUserWord(dir, { name: 'Ёлка', imageFile: shared, audioFile: null });
  store.createUserWord(dir, { name: 'Сосна', imageFile: shared, audioFile: null });

  const other = withImage(dir, JPEG);
  store.updateUserWord(dir, a.id, { name: 'Ёлка', imageFile: other, audioFile: null });

  assert.equal(fs.existsSync(path.join(dir, 'media', shared)), true, 'чужая картинка на месте');
});

// ─── Удаление слова: целостность связей ─────────────────────────────────

test('удаление слова вычищает его из всех комплектов и убирает его файлы', () => {
  const dir = tempDir();
  const image = withImage(dir);
  const a = store.createUserWord(dir, { name: 'Ёлка', imageFile: image, audioFile: null });
  const b = store.createUserWord(dir, { name: 'Сосна', imageFile: withImage(dir, JPEG), audioFile: null });

  store.createSet(dir, { title: 'Деревья', wordIds: [a.id, b.id] }, LIBRARY);
  store.createSet(dir, { title: 'Смешанный', wordIds: ['0000', a.id] }, LIBRARY);

  const res = store.deleteUserWord(dir, a.id);

  assert.deepEqual(res.words.map((w) => w.name), ['Сосна']);
  assert.equal(res.affectedSetIds.length, 2);
  for (const set of store.listSets(dir)) {
    assert.ok(!set.wordIds.includes(a.id), `слово осталось в комплекте ${set.title}`);
  }
  assert.equal(fs.existsSync(path.join(dir, 'media', image)), false, 'осиротевший файл убран');
});

test('после удаления слова в комплектах нет висячих ссылок', () => {
  const dir = tempDir();
  const a = store.createUserWord(dir, { name: 'Ёлка', imageFile: withImage(dir), audioFile: null });
  const b = store.createUserWord(dir, { name: 'Сосна', imageFile: withImage(dir, JPEG), audioFile: null });
  store.createSet(dir, { title: 'Деревья', wordIds: [a.id, b.id] }, LIBRARY);

  store.deleteUserWord(dir, a.id);

  const known = new Set([...LIBRARY, ...store.listUserWords(dir).map((w) => w.id)]);
  for (const set of store.listSets(dir)) {
    for (const id of set.wordIds) assert.ok(known.has(id), `висячая ссылка ${id}`);
  }
});

// ─── Комплекты ──────────────────────────────────────────────────────────

test('комплект собирается из поставочных и своих слов сразу', () => {
  // Требование строки 56 ТЗ
  const dir = tempDir();
  const own = store.createUserWord(dir, { name: 'Ёлка', imageFile: withImage(dir), audioFile: null });
  const set = store.createSet(dir, { title: 'Занятие', wordIds: ['0000', own.id] }, LIBRARY);
  assert.deepEqual(set.wordIds, ['0000', own.id]);
});

test('комплект со ссылкой на несуществующее слово не создаётся', () => {
  const dir = tempDir();
  assert.throws(
    () => store.createSet(dir, { title: 'Битый', wordIds: ['0000', 'u0000000000000000'] }, LIBRARY),
    WordsRulesError,
  );
});

test('переименование комплекта и правка состава — одна операция', () => {
  const dir = tempDir();
  const set = store.createSet(dir, { title: 'Занятие', wordIds: ['0000', '0001'] }, LIBRARY);
  const updated = store.updateSet(dir, set.id, { title: 'Урок', wordIds: ['0001', '0002'] }, LIBRARY);
  assert.equal(updated.id, set.id);
  assert.equal(updated.title, 'Урок');
  assert.deepEqual(store.listSets(dir)[0].wordIds, ['0001', '0002']);
});

test('удаление комплекта не трогает слова', () => {
  const dir = tempDir();
  const own = store.createUserWord(dir, { name: 'Ёлка', imageFile: withImage(dir), audioFile: null });
  const set = store.createSet(dir, { title: 'Занятие', wordIds: ['0000', own.id] }, LIBRARY);
  store.deleteSet(dir, set.id);
  assert.deepEqual(store.listSets(dir), []);
  assert.equal(store.listUserWords(dir).length, 1, 'слово осталось');
});

// ─── Устойчивость ───────────────────────────────────────────────────────

test('повреждённый файл своих слов — ошибка, а не «список пуст»', () => {
  const dir = tempDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, store.USER_WORDS_FILE), '{ это не json', 'utf8');
  assert.throws(() => store.listUserWords(dir), store.WordStoreError);
});

test('битая запись внутри списка отбрасывается, остальные выживают', () => {
  const dir = tempDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, store.USER_WORDS_FILE),
    JSON.stringify([{ id: 'u1', name: 'Ёлка', level: 9, imageFile: null, audioFile: 'a.webm' }, null, { id: 5 }]),
    'utf8',
  );
  assert.deepEqual(store.listUserWords(dir).map((w) => w.name), ['Ёлка']);
});

test('запись атомарная: временных файлов не остаётся', () => {
  const dir = tempDir();
  store.createUserWord(dir, { name: 'Ёлка', imageFile: withImage(dir), audioFile: null });
  store.createSet(dir, { title: 'Занятие', wordIds: ['0000', '0001'] }, LIBRARY);
  const leftovers = fs.readdirSync(dir).filter((f) => f.includes('.tmp-'));
  assert.deepEqual(leftovers, []);
});

test('идентификаторы своих слов не пересекаются с поставочными', () => {
  const dir = tempDir();
  const image = withImage(dir);
  const ids = new Set();
  for (let i = 0; i < 20; i++) {
    const w = store.createUserWord(dir, { name: `Слово ${i}`, imageFile: image, audioFile: null });
    assert.ok(!/^\d{4}$/.test(w.id), 'идентификатор не должен выглядеть как поставочный');
    ids.add(w.id);
  }
  assert.equal(ids.size, 20, 'идентификаторы уникальны');
});
