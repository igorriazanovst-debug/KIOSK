// packages/quiz-mini-player/tools/build-bank.mjs
//
// Блоки банка (bank/<предмет>/*.json) → готовые Excel-файлы для проигрывателя и
// файлы для экспертной рецензии.
//
//   node tools/build-bank.mjs           собрать xlsx в release/
//   node tools/build-bank.mjs --review  ещё и файлы «слепого решения» в review/
//
// Сборка ПАДАЕТ на любом нарушении правил банка: в поставку не должен попасть
// файл, который сам проигрыватель потом разберёт с ошибками.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
const rules = require('../bank/bankRules.js');
const core = require('../src/quizCore.js');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const REVIEW_CHUNK = 65;

export const SUBJECTS = [
  {
    key: 'astronomy', idPrefix: 'astro', expected: 390, file: 'physastroiq-astronomy-390.xlsx',
    title: 'ФизАстроIQ: астрономия',
    description: 'Текстовая викторина по астрономии: Солнечная система, звёзды, галактики, небесная сфера и календарь, телескопы, история космонавтики. 390 вопросов, три уровня.',
  },
  {
    key: 'physics', idPrefix: 'phys', expected: 90, file: 'physastroiq-physics-90.xlsx',
    title: 'ФизАстроIQ: физика',
    description: 'Текстовая викторина по физике 7–9 классов: электрическая цепь, простые механизмы и силы, оптика. 90 вопросов, три уровня.',
  },
];

const HEADER = ['№', 'Уровень', 'Тема', 'Вопрос', 'Ответ', 'Неверный 1', 'Неверный 2', 'Неверный 3', 'Подсказка', 'Вес', 'Время, с'];
const COLUMN_WIDTHS = [5, 9, 30, 70, 34, 34, 34, 34, 70, 7, 10];

export function loadSubject(subject) {
  const dir = path.join(ROOT, 'bank', subject.key);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  const questions = [];
  for (const file of files) {
    for (const q of JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))) {
      questions.push({ id: `${subject.idPrefix}-${String(questions.length + 1).padStart(3, '0')}`, block: file, ...q });
    }
  }
  return questions;
}

function toRows(questions) {
  // Сортировка по уровню и теме: педагогу так удобнее править файл в Excel
  const sorted = [...questions].sort((a, b) => a.level - b.level || a.theme.localeCompare(b.theme, 'ru'));
  return [HEADER, ...sorted.map((q, i) => {
    const defaults = core.LEVEL_DEFAULTS[q.level];
    return [i + 1, q.level, q.theme, q.text, q.answer, ...q.wrong, q.helpText, defaults.price, defaults.timeSeconds];
  })];
}

export function buildWorkbook(subject, questions) {
  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(toRows(questions));
  sheet['!cols'] = COLUMN_WIDTHS.map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, sheet, 'Вопросы');
  const about = XLSX.utils.aoa_to_sheet([
    ['Название', subject.title],
    ['Описание', subject.description],
    ['Как пользоваться', 'Откройте player.html в любом браузере и выберите этот файл. Установка и интернет не нужны.'],
    ['Как править', 'Обязательны столбцы «Вопрос» и «Ответ». Пустые «Неверные» проигрыватель доберёт из ответов той же темы. Уровень — 1, 2 или 3.'],
  ]);
  about['!cols'] = [{ wch: 18 }, { wch: 120 }];
  XLSX.utils.book_append_sheet(wb, about, 'О викторине');
  return wb;
}

/** Детерминированное перемешивание: рецензия должна быть воспроизводимой */
function seededRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function writeReviewFiles(subject, questions) {
  const dir = path.join(ROOT, 'review');
  fs.mkdirSync(dir, { recursive: true });
  for (const stale of fs.readdirSync(dir).filter((f) => f.startsWith(subject.key))) fs.unlinkSync(path.join(dir, stale));
  const rng = seededRng(20260920);
  const blind = questions.map((q) => {
    const options = [q.answer, ...q.wrong];
    for (let i = options.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    return { id: q.id, level: q.level, theme: q.theme, text: q.text, options, helpText: q.helpText };
  });
  let part = 0;
  for (let from = 0; from < blind.length; from += REVIEW_CHUNK) {
    part += 1;
    fs.writeFileSync(path.join(dir, `${subject.key}-blind-${part}.json`), JSON.stringify(blind.slice(from, from + REVIEW_CHUNK), null, 1), 'utf8');
  }
  fs.writeFileSync(path.join(dir, `${subject.key}-key.json`),
    JSON.stringify(questions.map(({ id, block, level, theme, text, answer, wrong, helpText }) => ({ id, block, level, theme, text, answer, wrong, helpText })), null, 1), 'utf8');
  return part;
}

function main() {
  const withReview = process.argv.includes('--review');
  const outDir = path.join(ROOT, 'release');
  fs.mkdirSync(outDir, { recursive: true });
  for (const subject of SUBJECTS) {
    const questions = loadSubject(subject);
    const violations = rules.allViolations(questions, subject.expected);
    if (violations.length > 0) {
      for (const v of violations) console.error(`  ${subject.key} ${v.id} [${v.rule}] ${v.why}`);
      throw new Error(`${subject.key}: нарушений правил банка — ${violations.length}`);
    }
    XLSX.writeFile(buildWorkbook(subject, questions), path.join(outDir, subject.file));
    const parts = withReview ? writeReviewFiles(subject, questions) : 0;
    console.log(`${subject.file}: ${questions.length} вопросов${withReview ? `, файлов для слепого решения: ${parts}` : ''}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
