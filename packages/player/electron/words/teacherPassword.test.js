// packages/player/electron/words/teacherPassword.test.js
// Пароль педагога: значение по умолчанию, смена, устойчивость к порче файла.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const gate = require('./teacherPassword');
const { DEFAULT_TEACHER_PASSWORD, TeacherGateError } = require('@kiosk/shared');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'words-pass-'));

test('на чистом устройстве работает пароль по умолчанию', () => {
  const dir = tmp();
  assert.equal(DEFAULT_TEACHER_PASSWORD, '12345');
  assert.equal(gate.checkPassword(dir, '12345'), true);
  assert.equal(gate.isDefaultPassword(dir), true);
});

test('неверный пароль не подходит', () => {
  const dir = tmp();
  for (const wrong of ['1234', '123456', '', 'пароль', ' 12345', '12345 ']) {
    assert.equal(gate.checkPassword(dir, wrong), false, `подошёл: «${wrong}»`);
  }
});

test('новый пароль заменяет прежний', () => {
  const dir = tmp();
  gate.setPassword(dir, 'группа7');

  assert.equal(gate.checkPassword(dir, 'группа7'), true);
  assert.equal(gate.checkPassword(dir, '12345'), false, 'старый пароль больше не подходит');
  assert.equal(gate.isDefaultPassword(dir), false);
});

test('сам пароль на диск не попадает — только его хеш', () => {
  const dir = tmp();
  gate.setPassword(dir, 'секрет123');

  const raw = fs.readFileSync(path.join(dir, gate.PASSWORD_FILE), 'utf8');
  assert.equal(raw.includes('секрет123'), false, 'пароль лежит открытым текстом');
  assert.match(JSON.parse(raw).passwordHash, /^[0-9a-f]{64}$/);
});

test('слишком короткий и слишком длинный пароль отклоняются', () => {
  const dir = tmp();
  assert.throws(() => gate.setPassword(dir, '123'), TeacherGateError);
  assert.throws(() => gate.setPassword(dir, 'x'.repeat(33)), TeacherGateError);
  // отклонённый пароль не должен ничего менять
  assert.equal(gate.checkPassword(dir, '12345'), true);
});

test('пароль с пробелом по краям отклоняется — его невозможно ввести повторно', () => {
  const dir = tmp();
  assert.throws(() => gate.setPassword(dir, ' пароль '), TeacherGateError);
});

test('повреждённый файл не запирает педагога снаружи', () => {
  const dir = tmp();
  gate.setPassword(dir, 'группа7');
  fs.writeFileSync(path.join(dir, gate.PASSWORD_FILE), '{ это не json', 'utf8');

  // Падать здесь нельзя: педагог потерял бы доступ к своим материалам
  // насовсем. Возвращаемся к паролю по умолчанию.
  assert.equal(gate.checkPassword(dir, '12345'), true);
  assert.equal(gate.isDefaultPassword(dir), true);
});

test('файл с мусором вместо хеша тоже откатывает к паролю по умолчанию', () => {
  const dir = tmp();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, gate.PASSWORD_FILE), JSON.stringify({ passwordHash: 'коротко' }), 'utf8');
  assert.equal(gate.checkPassword(dir, '12345'), true);
});

test('смена пароля переживает перечитывание', () => {
  const dir = tmp();
  gate.setPassword(dir, 'первый1');
  gate.setPassword(dir, 'второй2');
  assert.equal(gate.checkPassword(dir, 'первый1'), false);
  assert.equal(gate.checkPassword(dir, 'второй2'), true);
});
