// packages/quiz-mini-player/test/bank.test.js
//
// Проверка НАСТОЯЩЕГО банка и собранных из него Excel-файлов.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('xlsx');
const rules = require('../bank/bankRules.js');
const core = require('../src/quizCore.js');

const ROOT = path.join(__dirname, '..');
const SUBJECTS = [
  { key: 'astronomy', expected: 390, file: 'physastroiq-astronomy-390.xlsx' },
  { key: 'physics', expected: 90, file: 'physastroiq-physics-90.xlsx' },
];

function loadBank(key) {
  const dir = path.join(ROOT, 'bank', key);
  const questions = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    for (const q of JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))) questions.push({ id: `${file}#${questions.length + 1}`, ...q });
  }
  return questions;
}

for (const subject of SUBJECTS) {
  test(`${subject.key}: весь банк целиком проходит правила качества`, () => {
    const violations = rules.allViolations(loadBank(subject.key), subject.expected);
    assert.deepEqual(violations.map((v) => `${v.id} [${v.rule}] ${v.why}`), []);
  });

  test(`${subject.key}: у каждого уровня хватает вопросов на трёх игроков по 15`, () => {
    const bank = loadBank(subject.key);
    for (const level of [1, 2, 3]) {
      const size = bank.filter((q) => q.level === level).length;
      assert.ok(size >= 30, `уровень ${level}: ${size}`);
    }
  });

  test(`${subject.key}: собранный Excel открывается проигрывателем без единой ошибки`, () => {
    const workbook = XLSX.readFile(path.join(ROOT, 'release', subject.file));
    assert.deepEqual(workbook.SheetNames, ['Вопросы', 'О викторине']);
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Вопросы'], { header: 1, defval: '', raw: true, blankrows: true });
    const { quiz, errors, warnings } = core.parseQuizRows(rows, { title: 't' });
    assert.deepEqual(errors, []);
    assert.deepEqual(warnings, []);
    assert.equal(quiz.questions.length, subject.expected);
    assert.ok(quiz.questions.every((q) => q.wrong.length === 3 && q.helpText.length > 0));
  });

  test(`${subject.key}: Excel содержит ровно те же вопросы, что и банк`, () => {
    const workbook = XLSX.readFile(path.join(ROOT, 'release', subject.file));
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Вопросы'], { header: 1, defval: '', raw: true });
    const inExcel = new Set(rows.slice(1).map((r) => `${r[3]}→${r[4]}`));
    const inBank = new Set(loadBank(subject.key).map((q) => `${q.text}→${q.answer}`));
    assert.deepEqual([...inBank].filter((k) => !inExcel.has(k)), []);
    assert.equal(inExcel.size, inBank.size);
  });
}

test('предметы не перепутаны: в физике нет астрономических тем и наоборот', () => {
  const physicsThemes = new Set(loadBank('physics').map((q) => q.theme));
  const shared = [...new Set(loadBank('astronomy').map((q) => q.theme))].filter((t) => physicsThemes.has(t));
  assert.deepEqual(shared, []);
});
