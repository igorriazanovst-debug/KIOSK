// packages/player/electron/common/teacherPassword.js
// Хранение и проверка пароля педагога (ТЗ раздел 3) — общее для виджетов.
//
// Вынесено из electron/words/ при работе над Тип 3: механизм оказался нужен
// второму виджету слово в слово, а второй экземпляр того же кода разошёлся бы
// с первым при первой правке. План Тип 3 относил этот подъём к Фазе 5 —
// сделан раньше, потому что упёрлись в него на Фазе 4.
//
// ПРОВЕРКА ЖИВЁТ В ГЛАВНОМ ПРОЦЕССЕ, а не в интерфейсе, и это главное решение
// файла: рендерер никогда не получает ни пароль, ни его хеш — только ответ
// «подошёл или нет». Иначе пароль лежал бы в бандле страницы, и «защита»
// снималась бы инспектором за полминуты.
//
// ЧЕМ ЭТА ЗАЩИТА НЕ ЯВЛЯЕТСЯ — см. teacherGate.ts в @kiosk/shared: это рубеж
// от детей на занятии, а не средство защиты данных.
//
// СОЛЬ У КАЖДОГО ВИДЖЕТА СВОЯ. Общий код — не повод давать им общий пароль:
// каталоги данных разные, и хеш из одного не должен подходить к другому.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { atomicWriteJson } = require('../chrono/atomicJson');
const { DEFAULT_TEACHER_PASSWORD, assertPasswordAcceptable } = require('@kiosk/shared');

const PASSWORD_FILE = 'teacher.json';

/**
 * @param {{ salt: string, fileName?: string }} options
 *   salt — постоянная и лежит рядом с кодом. Это осознанно: она разводит
 *   хеши между виджетами и устройствами, но не защищает от подбора — подбор
 *   здесь и не рассматривается как угроза.
 */
function createTeacherPassword({ salt, fileName = PASSWORD_FILE }) {
  const hash = (password) =>
    crypto.createHash('sha256').update(salt + String(password)).digest('hex');

  const filePath = (baseDir) => path.join(baseDir, fileName);

  /** @returns {string} хеш действующего пароля — своего либо того, что по умолчанию */
  function currentHash(baseDir) {
    try {
      const raw = JSON.parse(fs.readFileSync(filePath(baseDir), 'utf8'));
      if (raw && typeof raw.passwordHash === 'string' && raw.passwordHash.length === 64) {
        return raw.passwordHash;
      }
    } catch {
      // Файла нет или он испорчен — работаем на пароле по умолчанию, чтобы
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

  return { PASSWORD_FILE: fileName, checkPassword, setPassword, isDefaultPassword };
}

module.exports = { createTeacherPassword, PASSWORD_FILE };
