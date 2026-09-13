// packages/player/electron/alphabet/teacherPassword.test.js
// Пароль педагога «АзбукоСлов». Механизм общий с Тип 2, поэтому здесь
// проверяется НЕ он заново, а то, что действительно своё: разведённые соли.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const alphabetGate = require('./teacherPassword');
const wordsGate = require('../words/teacherPassword');
const { DEFAULT_TEACHER_PASSWORD, TeacherGateError } = require('@kiosk/shared');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'alphabet-pass-'));

test('на чистом устройстве работает пароль по умолчанию', () => {
  const dir = tmp();
  assert.equal(alphabetGate.checkPassword(dir, DEFAULT_TEACHER_PASSWORD), true);
  assert.equal(alphabetGate.isDefaultPassword(dir), true);
});

test('смена пароля переживает перезапуск, старый перестаёт подходить', () => {
  const dir = tmp();
  alphabetGate.setPassword(dir, '7788');
  assert.equal(alphabetGate.checkPassword(dir, '7788'), true);
  assert.equal(alphabetGate.checkPassword(dir, DEFAULT_TEACHER_PASSWORD), false);
  assert.equal(alphabetGate.isDefaultPassword(dir), false);
});

test('пароль виджетов не общий, хотя механизм общий', () => {
  // Два виджета стоят на одном устройстве. Общий код — не повод открывать
  // редактор одного паролем, заданным в другом: каталоги данных разные
  const dir = tmp();
  alphabetGate.setPassword(dir, 'obschij');
  const alphabetHash = JSON.parse(fs.readFileSync(path.join(dir, 'teacher.json'), 'utf8'));

  const wordsDir = tmp();
  wordsGate.setPassword(wordsDir, 'obschij');
  const wordsHash = JSON.parse(fs.readFileSync(path.join(wordsDir, 'teacher.json'), 'utf8'));

  assert.notEqual(
    alphabetHash.passwordHash,
    wordsHash.passwordHash,
    'один пароль дал одинаковый хеш — соли не разведены'
  );
});

test('сам пароль на диск не попадает', () => {
  const dir = tmp();
  alphabetGate.setPassword(dir, 'sekretnyj');
  const raw = fs.readFileSync(path.join(dir, 'teacher.json'), 'utf8');
  assert.ok(!raw.includes('sekretnyj'), 'пароль оказался в файле открытым текстом');
  assert.match(raw, /[0-9a-f]{64}/);
});

test('повреждённый файл не запирает педагога снаружи', () => {
  // Потерять доступ к настройкам из-за сбоя диска хуже, чем откатиться к
  // паролю по умолчанию: во втором случае педагог хотя бы войдёт
  const dir = tmp();
  alphabetGate.setPassword(dir, '4321');
  fs.writeFileSync(path.join(dir, 'teacher.json'), '{ не json');
  assert.equal(alphabetGate.checkPassword(dir, DEFAULT_TEACHER_PASSWORD), true);
  assert.equal(alphabetGate.isDefaultPassword(dir), true);
});

test('слишком короткий пароль не принимается', () => {
  const dir = tmp();
  assert.throws(() => alphabetGate.setPassword(dir, '12'), TeacherGateError);
  // и старый пароль при этом остаётся рабочим
  assert.equal(alphabetGate.checkPassword(dir, DEFAULT_TEACHER_PASSWORD), true);
});

test('пароль с пробелом по краям не принимается', () => {
  const dir = tmp();
  assert.throws(() => alphabetGate.setPassword(dir, ' 12345'), TeacherGateError);
});
