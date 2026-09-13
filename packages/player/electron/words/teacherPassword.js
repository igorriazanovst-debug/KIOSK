// packages/player/electron/words/teacherPassword.js
// Хранение и проверка пароля педагога (ТЗ раздел 3).
//
// Проверка живёт в ГЛАВНОМ ПРОЦЕССЕ, а не в интерфейсе, и это главное решение
// этого файла: рендерер никогда не получает ни пароль, ни его хеш — только
// ответ «подошёл или нет». Иначе пароль лежал бы в бандле страницы, и
// «защита» снималась бы инспектором за полминуты.
//
// Пароль по умолчанию — DEFAULT_TEACHER_PASSWORD из общего пакета. Пока
// педагог не задал свой, файла на диске нет вовсе: сравнение идёт со
// значением по умолчанию. Так после первой установки не нужно ничего
// настраивать, чтобы попасть в разделы педагога.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { atomicWriteJson } = require('../chrono/atomicJson');
const {
  DEFAULT_TEACHER_PASSWORD,
  assertPasswordAcceptable,
} = require('@kiosk/shared');

const PASSWORD_FILE = 'teacher.json';

/**
 * Соль постоянная и лежит рядом с кодом. Это осознанно: она защищает от
 * сравнения хешей между устройствами, но не от подбора — подбор здесь и не
 * рассматривается как угроза (см. комментарий в teacherGate.ts).
 */
const SALT = 'kiosk-words-teacher';

function hash(password) {
  return crypto.createHash('sha256').update(SALT + String(password)).digest('hex');
}

function filePath(baseDir) {
  return path.join(baseDir, PASSWORD_FILE);
}

/** @returns {string} хеш действующего пароля — своего либо того, что по умолчанию */
function currentHash(baseDir) {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath(baseDir), 'utf8'));
    if (raw && typeof raw.passwordHash === 'string' && raw.passwordHash.length === 64) {
      return raw.passwordHash;
    }
  } catch {
    // файла нет или он испорчен — работаем на пароле по умолчанию, чтобы
    // педагог не остался заперт снаружи из-за повреждённого файла
  }
  return hash(DEFAULT_TEACHER_PASSWORD);
}

/** Задан ли свой пароль (для подсказки в интерфейсе) */
function isDefaultPassword(baseDir) {
  return currentHash(baseDir) === hash(DEFAULT_TEACHER_PASSWORD);
}

/**
 * Сравнение хешей постоянным по времени способом. От подбора это здесь не
 * спасает, но и повода сравнивать иначе нет.
 */
function checkPassword(baseDir, password) {
  const expected = Buffer.from(currentHash(baseDir), 'utf8');
  const actual = Buffer.from(hash(password), 'utf8');
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

function setPassword(baseDir, password) {
  const value = assertPasswordAcceptable(password);
  fs.mkdirSync(baseDir, { recursive: true });
  atomicWriteJson(filePath(baseDir), { passwordHash: hash(value) });
  return true;
}

module.exports = {
  PASSWORD_FILE,
  checkPassword,
  setPassword,
  isDefaultPassword,
};
