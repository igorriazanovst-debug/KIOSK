// packages/player/electron/alphabet/contentStore.test.js
// Хранилище контента педагога. Правила проверяются в @kiosk/shared; здесь —
// то, что есть только у файлового хранилища: общие файлы медиа, атомарность
// правки графа и устойчивость к порче.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const store = require('./contentStore');
const media = require('../common/mediaFiles');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'abc-content-'));

/** Минимальный настоящий PNG — сигнатуру хранилище проверяет по байтам */
function pngBytes(tint = 0) {
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, tint,
  ]);
}

/** Настоящий WebM-заголовок: EBML-сигнатура */
function webmBytes(n = 0) {
  const head = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00]);
  return Buffer.concat([head, Buffer.alloc(64, n)]);
}

/** storeMediaBuffer возвращает запись целиком — слову нужно только имя */
function imageFile(dir, tint = 0) {
  return media.storeMediaBuffer(dir, pngBytes(tint), 'image').fileName;
}

const KO = { name: 'ко', letterNumbers: [12, 16] };
const SHKA = { name: 'шка', letterNumbers: [26, 12, 1] };

function twoSyllables(dir) {
  return [store.createSyllable(dir, KO), store.createSyllable(dir, SHKA)];
}

/**
 * Второе слово, делящее картинку с первым. Слоги у него ДРУГИЕ: написание
 * слова обязано складываться из его слогов, и «Кошко» с теми же слогами
 * правило справедливо отвергает.
 */
function secondWord(dir, file) {
  const za = store.createSyllable(dir, { name: 'за', letterNumbers: [9, 1] });
  const ko = store.readContent(dir).syllables.find((s) => s.name === 'ко');
  return store.createWord(dir, { name: 'Коза', syllableIds: [ko.id, za.id], imageFile: file });
}

// ─── Базовое ────────────────────────────────────────────────────────────

test('на свежем устройстве контента нет, а не ошибка', () => {
  assert.deepEqual(store.readContent(tmp()), { words: [], syllables: [], sets: [] });
});

test('своё слово переживает перезапуск вместе со слогами', () => {
  const dir = tmp();
  const [ko, shka] = twoSyllables(dir);
  store.createWord(dir, { name: 'Кошка', syllableIds: [ko.id, shka.id] });

  const again = store.readContent(dir);
  assert.equal(again.words.length, 1);
  assert.equal(again.words[0].name, 'Кошка');
  assert.equal(again.syllables.length, 2);
});

test('слово может опираться и на поставочные слоги', () => {
  // Иначе педагогу пришлось бы заводить заново слоги, которые уже есть
  const dir = tmp();
  const library = [{ id: 'av', name: 'ав', letterNumbers: [1, 3] }];
  const to = store.createSyllable(dir, { name: 'то', letterNumbers: [20, 16] });
  const word = store.createWord(dir, { name: 'Авто', syllableIds: ['av', to.id] }, library);
  assert.deepEqual(word.syllableIds, ['av', to.id]);
});

test('повреждённый файл контента не роняет приложение', () => {
  // Свой контент — сотни записей, и уронить их все из-за одной испорченной
  // несоразмерно. У профилей строгость обратная, и это осознанно
  const dir = tmp();
  twoSyllables(dir);
  fs.writeFileSync(path.join(dir, store.CONTENT_FILE), '{ это не json');
  assert.deepEqual(store.readContent(dir), { words: [], syllables: [], sets: [] });
});

// ─── Общие файлы медиа ──────────────────────────────────────────────────

test('одна картинка на два слова лежит ОДНИМ файлом', () => {
  const dir = tmp();
  const [ko, shka] = twoSyllables(dir);
  const file1 = imageFile(dir);
  const file2 = imageFile(dir);
  assert.equal(file1, file2, 'одинаковое содержимое должно дать одно имя');
  assert.equal(fs.readdirSync(media.mediaDir(dir)).length, 1);

  store.createWord(dir, { name: 'Кошка', syllableIds: [ko.id, shka.id], imageFile: file1 });
  secondWord(dir, file2);
  assert.equal(store.readContent(dir).words.length, 2);
});

test('удаление одного из двух слов НЕ уносит общую картинку', () => {
  // Иначе второе слово осталось бы без иллюстрации, и найти причину было бы
  // нечем: файл исчез при правке совсем другого слова
  const dir = tmp();
  const [ko, shka] = twoSyllables(dir);
  const file = imageFile(dir);
  const first = store.createWord(dir, {
    name: 'Кошка',
    syllableIds: [ko.id, shka.id],
    imageFile: file,
  });
  secondWord(dir, file);

  store.deleteWord(dir, first.id);
  assert.ok(fs.existsSync(media.mediaFilePath(dir, file)), 'общая картинка удалена вместе с первым словом');
});

test('удаление последнего владельца картинку убирает', () => {
  const dir = tmp();
  const [ko, shka] = twoSyllables(dir);
  const file = imageFile(dir);
  const word = store.createWord(dir, {
    name: 'Кошка',
    syllableIds: [ko.id, shka.id],
    imageFile: file,
  });
  store.deleteWord(dir, word.id);
  assert.equal(fs.existsSync(media.mediaFilePath(dir, file)), false);
});

test('смена картинки убирает прежнюю, если её больше никто не держит', () => {
  const dir = tmp();
  const [ko, shka] = twoSyllables(dir);
  const oldFile = imageFile(dir, 1);
  const newFile = imageFile(dir, 2);
  const word = store.createWord(dir, {
    name: 'Кошка',
    syllableIds: [ko.id, shka.id],
    imageFile: oldFile,
  });
  store.updateWord(dir, word.id, {
    name: 'Кошка',
    syllableIds: [ko.id, shka.id],
    imageFile: newFile,
  });
  assert.equal(fs.existsSync(media.mediaFilePath(dir, oldFile)), false);
  assert.ok(fs.existsSync(media.mediaFilePath(dir, newFile)));
});

// ─── Озвучка ────────────────────────────────────────────────────────────

test('запись слова сохраняется и находится', () => {
  const dir = tmp();
  const [ko, shka] = twoSyllables(dir);
  const word = store.createWord(dir, { name: 'Кошка', syllableIds: [ko.id, shka.id] });
  assert.equal(store.hasVoice(dir, 'word', word.id), false);
  store.saveVoice(dir, 'word', word.id, webmBytes());
  assert.equal(store.hasVoice(dir, 'word', word.id), true);
});

test('не звук записью не считается', () => {
  // Запись приходит из рендерера, а рендерер — граница системы
  const dir = tmp();
  assert.throws(() => store.saveVoice(dir, 'word', 'u1', pngBytes()), /не звуковая/);
  assert.throws(() => store.saveVoice(dir, 'word', 'u1', Buffer.alloc(0)), /Пустая/);
});

test('род записи — только один из трёх', () => {
  const dir = tmp();
  assert.throws(() => store.saveVoice(dir, 'нечто', 'u1', webmBytes()), /Неизвестный род/);
});

test('удаление слова уносит его записи, но не записи слогов', () => {
  // Слог живёт дольше слова и может использоваться другими
  const dir = tmp();
  const [ko, shka] = twoSyllables(dir);
  const word = store.createWord(dir, { name: 'Кошка', syllableIds: [ko.id, shka.id] });
  store.saveVoice(dir, 'word', word.id, webmBytes(1));
  store.saveVoice(dir, 'bgn', word.id, webmBytes(2));
  store.saveVoice(dir, 'syllable', ko.id, webmBytes(3));

  store.deleteWord(dir, word.id);
  assert.equal(store.hasVoice(dir, 'word', word.id), false);
  assert.equal(store.hasVoice(dir, 'bgn', word.id), false);
  assert.equal(store.hasVoice(dir, 'syllable', ko.id), true, 'запись слога не должна была пропасть');
});

test('готовность слова считается по фактическим файлам', () => {
  const dir = tmp();
  const [ko, shka] = twoSyllables(dir);
  const file = imageFile(dir);
  const word = store.createWord(dir, {
    name: 'Кошка',
    syllableIds: [ko.id, shka.id],
    hasWithoutLastSyllable: true,
    imageFile: file,
  });

  let r = store.wordReadiness(dir)[word.id];
  assert.equal(r.letterShow, true, 'картинка есть — этап 1 должен работать');
  assert.equal(r.wordMake, false, 'слоги не озвучены');

  store.saveVoice(dir, 'word', word.id, webmBytes(1));
  store.saveVoice(dir, 'syllable', ko.id, webmBytes(2));
  store.saveVoice(dir, 'syllable', shka.id, webmBytes(3));
  r = store.wordReadiness(dir)[word.id];
  assert.deepEqual(r.missing, []);
  assert.equal(r.wordMake, true);
});

// ─── Целостность графа при правках ──────────────────────────────────────

test('удаление слова правит слова и комплекты ОДНОЙ записью на диск', () => {
  // Два файла нельзя переписать атомарно — поэтому весь свой контент лежит
  // в одном. У эталона это три файла, и там это стоило целостности
  const dir = tmp();
  const [ko, shka] = twoSyllables(dir);
  const word = store.createWord(dir, { name: 'Кошка', syllableIds: [ko.id, shka.id] });
  store.createSet(dir, { title: 'Дом', wordIds: [word.id] });

  store.deleteWord(dir, word.id);
  const after = store.readContent(dir);
  assert.deepEqual(after.words, []);
  assert.deepEqual(after.sets[0].wordIds, [], 'ссылка на удалённое слово осталась в комплекте');
});

test('слог, использованный словом, удалить нельзя', () => {
  const dir = tmp();
  const [ko, shka] = twoSyllables(dir);
  store.createWord(dir, { name: 'Кошка', syllableIds: [ko.id, shka.id] });
  assert.throws(() => store.deleteSyllable(dir, ko.id), /Кошка/);
  assert.equal(store.readContent(dir).syllables.length, 2, 'слог всё-таки удалён');
});

test('комплект собирается и из поставочных слов, и из своих', () => {
  // ТЗ строка 77 требует этого буквально
  const dir = tmp();
  const [ko, shka] = twoSyllables(dir);
  const mine = store.createWord(dir, { name: 'Кошка', syllableIds: [ko.id, shka.id] });
  const library = [
    { id: 'avtobus', name: 'Автобус', syllableIds: ['av'], hasWithoutLastSyllable: false },
  ];
  const set = store.createSet(dir, { title: 'Смешанный', wordIds: ['avtobus', mine.id] }, library);
  assert.deepEqual(set.wordIds, ['avtobus', mine.id]);
});

test('пять операций ТЗ строки 77 доступны', () => {
  const dir = tmp();
  const [ko, shka] = twoSyllables(dir);
  const word = store.createWord(dir, { name: 'Кошка', syllableIds: [ko.id, shka.id] });

  const created = store.createSet(dir, { title: 'Дом', wordIds: [word.id] });
  const renamed = store.updateSet(dir, created.id, { title: 'Квартира', wordIds: [word.id] });
  assert.equal(renamed.title, 'Квартира');

  const trimmed = store.updateSet(dir, created.id, { title: 'Квартира', wordIds: [] });
  assert.deepEqual(trimmed.wordIds, []);

  assert.deepEqual(store.deleteSet(dir, created.id), []);
  // Импорт и экспорт — отдельный модуль обмена; здесь проверено, что
  // хранилище даёт всё, на чём они строятся
});
