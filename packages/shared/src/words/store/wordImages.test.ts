// packages/shared/src/words/store/wordImages.test.ts
// Свои картинки педагога для ПОСТАВОЧНЫХ слов (ТЗ строка 42).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applySetWordImage, applyClearWordImage } from './contentRules';
import { WordsRulesError } from './rules';
import { parseWordImageOverrides } from '../model/schema';

const A = 'a'.repeat(32) + '.png';
const B = 'b'.repeat(32) + '.png';

test('картинка ставится поставочному слову', () => {
  const { overrides, orphanedFile } = applySetWordImage({}, '0101', A);
  assert.deepEqual(overrides, { '0101': A });
  assert.equal(orphanedFile, null, 'заменять было нечего');
});

test('замена картинки отдаёт прежний файл как осиротевший', () => {
  const { overrides, orphanedFile } = applySetWordImage({ '0101': A }, '0101', B);
  assert.deepEqual(overrides, { '0101': B });
  assert.equal(orphanedFile, A);
});

test('файл не считается осиротевшим, пока на него ссылается другое слово', () => {
  // одну картинку можно поставить двум словам — она общая
  const { overrides, orphanedFile } = applySetWordImage({ '0101': A, '0102': A }, '0101', B);
  assert.deepEqual(overrides, { '0101': B, '0102': A });
  assert.equal(orphanedFile, null, 'A всё ещё нужен слову 0102');
});

test('возврат к поставочной картинке убирает переопределение', () => {
  const { overrides, orphanedFile } = applyClearWordImage({ '0101': A, '0102': B }, '0101');
  assert.deepEqual(overrides, { '0102': B });
  assert.equal(orphanedFile, A);
});

test('возврат там, где своей картинки нет, — ошибка, а не тихий успех', () => {
  assert.throws(() => applyClearWordImage({}, '0101'), WordsRulesError);
});

test('исходный список не мутируется', () => {
  const before = { '0101': A };
  applySetWordImage(before, '0102', B);
  applyClearWordImage(before, '0101');
  assert.deepEqual(before, { '0101': A });
});

// ─── разбор с диска ─────────────────────────────────────────────────────

test('битая запись отбрасывается поштучно, целые выживают', () => {
  const parsed = parseWordImageOverrides({
    '0101': A,
    '0102': '../побег.png',      // имя не по форме — выбрасывается
    'не-идентификатор': B,        // ключ не похож на поставочное слово
    '0103': 42,                   // не строка
    '0104': B,
  });
  assert.deepEqual(parsed, { '0101': A, '0104': B });
});

test('мусор вместо объекта даёт пустой список, а не падение', () => {
  assert.deepEqual(parseWordImageOverrides(null), {});
  assert.deepEqual(parseWordImageOverrides('строка'), {});
  assert.deepEqual(parseWordImageOverrides([1, 2, 3]), {});
  assert.deepEqual(parseWordImageOverrides(undefined), {});
});

test('идентификатор своего слова в переопределения не попадает', () => {
  // свои слова хранят картинку у себя, переопределения — только для поставочных
  assert.deepEqual(parseWordImageOverrides({ u0123456789abcdef: A }), {});
});
