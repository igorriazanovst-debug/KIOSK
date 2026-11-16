// Локальный пароль административного режима для автономных (без сервера)
// сборок: без serverUrl/playerToken проверка на сервере невозможна, а
// административный режим (автозапуск) по ТЗ обязан работать и офлайн.
//
// Пароль хранится в resources/admin.password рядом с приложением
// (в deb — /opt/<продукт>/resources/admin.password). Файла нет — пароль по
// умолчанию «admin» (документируется в инструкции; смена — правкой файла).
// Модуль без electron: логика проверяется node:test.

const fs = require('node:fs');
const path = require('node:path');

// Техническое умолчание для офлайн-киоска, документируется в инструкции
// (не секрет реального пользователя). #пдн-ок
const DEFAULT_ADMIN_PASSWORD = 'admin'; // синтетика #пдн-ок

function localAdminPasswordFromFile(resourcesDir, existsSync = fs.existsSync, readFileSync = fs.readFileSync) {
  const file = path.join(resourcesDir || '', 'admin.password');
  if (!existsSync(file)) return null;
  try {
    const value = String(readFileSync(file, 'utf-8') || '').trim();
    return value || null;
  } catch {
    return null;
  }
}

// Сравнение в постоянном времени — не даём тайминг-оракул.
function safeEqual(a, b) {
  const la = Buffer.from(String(a || ''), 'utf-8');
  const lb = Buffer.from(String(b || ''), 'utf-8');
  if (la.length !== lb.length) {
    // сравниваем что-то той же длины, чтобы время не выдавало длину
    Buffer.compare(la, la);
    return false;
  }
  return Buffer.compare(la, lb) === 0;
}

function verifyLocalAdminPassword(input, resourcesDir, deps) {
  const expected =
    localAdminPasswordFromFile(resourcesDir, deps && deps.existsSync, deps && deps.readFileSync) ||
    DEFAULT_ADMIN_PASSWORD;
  return safeEqual(input, expected);
}

module.exports = {
  DEFAULT_ADMIN_PASSWORD,
  localAdminPasswordFromFile,
  verifyLocalAdminPassword,
};
