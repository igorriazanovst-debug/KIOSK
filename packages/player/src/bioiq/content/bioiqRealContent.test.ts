// packages/player/src/bioiq/content/bioiqRealContent.test.ts
//
// Методическая викторина в поставке (FR-021). Проверяется не «файл читается»,
// а то, на чём этот класс виджета уже спотыкался.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { BioiqQuizSchema } from '../model/schema.ts';
import { checkBioiqQuiz } from '../model/completeness.ts';
import realContent from './bioiqRealContent.json' with { type: 'json' };

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(HERE, '..', '..', '..', 'public', 'bioiq');

/** Ширина и высота PNG из заголовка IHDR: байты 16..23 после сигнатуры. */
function pngSize(file: string): { width: number; height: number } {
  const head = Buffer.alloc(24);
  const fd = fs.openSync(file, 'r');
  try {
    fs.readSync(fd, head, 0, 24, 0);
  } finally {
    fs.closeSync(fd);
  }
  assert.equal(head.subarray(1, 4).toString('ascii'), 'PNG', `${path.basename(file)} — не PNG`);
  return { width: head.readUInt32BE(16), height: head.readUInt32BE(20) };
}

test('викторина проходит схему', () => {
  BioiqQuizSchema.parse(realContent);
});

test('викторина проходит проверку комплектности', () => {
  assert.deepEqual(checkBioiqQuiz(BioiqQuizSchema.parse(realContent)), []);
});

test('ОБЪЯВЛЕННЫЙ размер карты совпадает с НАСТОЯЩИМ размером файла', () => {
  // Это не придирка. Заявленный в схеме размер изображения — система
  // координат, в которой лежат все точки ответов. Разойдись он с реальным
  // пикселем PNG, точки поедут пропорционально: картинка на месте, вопросы на
  // месте, а нажимать надо рядом с органом. Ровно так «РусIQ» потерял около
  // пятой части кликабельных вопросов (см. шапку model/schema.ts).
  const quiz = BioiqQuizSchema.parse(realContent);
  for (const [level, meta] of Object.entries(quiz.images)) {
    const file = path.join(PUBLIC, meta.fileName);
    assert.ok(fs.existsSync(file), `уровень ${level}: нет файла ${meta.fileName}`);
    const real = pngSize(file);
    assert.deepEqual(
      { width: meta.width, height: meta.height },
      real,
      `уровень ${level} (${meta.fileName}): в схеме ${meta.width}×${meta.height}, в файле ${real.width}×${real.height}`
    );
  }
});

test('у каждого уровня СВОЯ карта', () => {
  // Одна картинка на три уровня — признак недоделанного контента: у «ХимIQ»
  // так выглядел образец Фазы 3, который чуть не уехал в поставку.
  const quiz = BioiqQuizSchema.parse(realContent);
  const files = Object.values(quiz.images).map((i) => i.fileName);
  assert.equal(new Set(files).size, files.length, `карты повторяются: ${files.join(', ')}`);
});

test('вопросов не меньше, чем у эталона на уровень', () => {
  // Разбор эталона: 48 / 43 / 40 вопросов, всего 131. Ниже этого по уровню
  // опускаться нельзя — иначе на приёмке сравнение будет не в нашу пользу.
  const quiz = BioiqQuizSchema.parse(realContent);
  for (const level of [1, 2, 3] as const) {
    const count = quiz.questions.filter((q) => q.level === level).length;
    assert.ok(count >= 30, `уровень ${level}: вопросов ${count}`);
  }
  assert.ok(quiz.questions.length >= 100, `всего вопросов ${quiz.questions.length}`);
});

test('у каждого вопроса есть подсказка (FR-006)', () => {
  const quiz = BioiqQuizSchema.parse(realContent);
  const silent = quiz.questions.filter((q) => q.helpText.trim().length === 0);
  assert.deepEqual(silent.map((q) => q.text), [], 'вопросы без подсказки');
});

test('тема каждого вопроса объявлена в списке тем викторины', () => {
  const quiz = BioiqQuizSchema.parse(realContent);
  const unknown = quiz.questions.filter((q) => !quiz.themes.includes(q.theme));
  assert.deepEqual(unknown.map((q) => `${q.text} → ${q.theme}`), []);
});

test('в текстах вопросов не осталось химии Типа 9', () => {
  const quiz = BioiqQuizSchema.parse(realContent);
  const all = quiz.questions.map((q) => `${q.text} ${q.answer} ${q.helpText}`).join(' ').toLowerCase();
  for (const word of ['менделеев', 'валентн', 'пробирк', 'реактив']) {
    assert.ok(!all.includes(word), `в вопросах осталось слово «${word}»`);
  }
});
