// packages/player/electron/eumk/passwords.js
// PBKDF2-HMAC-SHA256-хэширование паролей локальных учётных записей ЭУМК
// (K5-1) в ГЛАВНОМ процессе. Модуль бестелесный: сам ничего не хранит -
// запись пароля лежит в данных пользователя (accounts[] в файле профиля),
// а сюда приходят «захэшируй» и «провери» с параметрами из самой записи.
//
// Почему главный процесс: node:crypto недоступен изолированному рендереру,
// а данные и так живут в профиле через electron/eumk. Тот же паттерн, что
// у chrono/auth.js и common/teacherPassword.js - криптография в главном
// процессе, интерфейс получает только результат.

const crypto = require('node:crypto');
const { promisify } = require('node:util');

// Асинхронный pbkdf2, НЕ pbkdf2Sync: хэширование в 600k итераций занимает
// десятые доли секунды, а синхронный вызов внутри ipcMain.handle блокирует
// ЦИКЛ СОБЫТИЙ главного процесса целиком - вместе с ним замерзают и все
// остальные IPC-каналы приложения (включая sendSync-хранилище eumk).
const pbkdf2 = promisify(crypto.pbkdf2);

// Итерации PBKDF2-HMAC-SHA256 по OWASP Password Storage Cheat Sheet (2023).
// Значение намеренно продублировано в src/eumk/model/schema.ts (рендерер):
// общего пакета у главного процесса и рендерера нет; тест синхронности копий -
// в passwords.test.js (parity-тест).
const PBKDF2_ITERATIONS = 600000;
const PBKDF2_MAX_ITERATIONS = 5000000; // защита от испорченной записи: не гнать миллионы итераций на каждый вход
const PBKDF2_KEYLEN_BYTES = 32; // 256 бит
const PBKDF2_MAX_KEYLEN_BYTES = 128;
const PASSWORD_SALT_BYTES = 16; // криптослучайная соль на каждого пользователя
const PASSWORD_RECORD_VERSION = 1;
const PBKDF2_ALGO_ID = 'pbkdf2-sha256';
// Минимальная длина пароля - 6, по решению пользователя (Ответы_2026-11-09.md,
// E-06: «пароль 6+ символов, не равный имени»). Продублирована из
// src/eumk/passwords.ts: рендерер - не единственная граница доверия для
// IPC-вызова (как в chrono/auth.js); копии сверяет parity-тест.
const MIN_PASSWORD_LENGTH = 6;

class EumkPasswordError extends Error {
  constructor(message) {
    super(message);
    this.name = 'EumkPasswordError';
  }
}

/** Форма записи пароля: типы полей, свой алгоритм, своя версия, разумные пределы. */
function isValidRecordShape(record) {
  if (!record || typeof record !== 'object') return false;
  if (record.version !== PASSWORD_RECORD_VERSION) return false;
  if (record.algo !== PBKDF2_ALGO_ID) return false;
  if (!Number.isInteger(record.iterations) || record.iterations < 1 || record.iterations > PBKDF2_MAX_ITERATIONS) return false;
  if (!Number.isInteger(record.keyLen) || record.keyLen < 16 || record.keyLen > PBKDF2_MAX_KEYLEN_BYTES) return false;
  // hex обязан быть чётной длины: нечётная (обрезанная битым файлом) соль
  // молча трактуется Buffer'ом как короче на полбайта - это выглядело бы
  // «неверным паролем», а не повреждённой записью.
  if (typeof record.salt !== 'string' || !/^[0-9a-f]+$/.test(record.salt) || record.salt.length % 2 !== 0 || record.salt.length < PASSWORD_SALT_BYTES * 2) return false;
  if (typeof record.hash !== 'string' || !/^[0-9a-f]+$/.test(record.hash) || record.hash.length !== record.keyLen * 2) return false;
  return true;
}

/**
 * Пароль годен по длине? Проверяется при СОЗДАНИИ записи (граница IPC).
 * При проверке существующего пароля длина не проверяется - любой введённый
 * текст просто сравнивается с хэшем.
 */
function assertPasswordAcceptable(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new EumkPasswordError(`Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов`);
  }
}

/** Захэшировать пароль: своя криптослучайная соль, параметры текущих констант. */
async function hashPassword(password) {
  assertPasswordAcceptable(password);
  const salt = crypto.randomBytes(PASSWORD_SALT_BYTES);
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS, PBKDF2_KEYLEN_BYTES, 'sha256');
  return {
    version: PASSWORD_RECORD_VERSION,
    algo: PBKDF2_ALGO_ID,
    iterations: PBKDF2_ITERATIONS,
    salt: salt.toString('hex'),
    hash: hash.toString('hex'),
    keyLen: PBKDF2_KEYLEN_BYTES,
  };
}

/**
 * Проверить пароль против записи. Параметры берутся ИЗ ЗАПИСИ, а не из
 * текущих констант: старые записи обязаны проверяться своими параметрами.
 * Испорченная запись - явная ошибка (fail-closed), а не «неверный пароль».
 *
 * @returns {Promise<boolean>} подошёл ли пароль
 * @throws {EumkPasswordError} если запись не похожа на целую запись пароля
 */
async function verifyPassword(password, record) {
  if (!isValidRecordShape(record)) throw new EumkPasswordError('Запись пароля повреждена');
  const candidate = await pbkdf2(String(password), Buffer.from(record.salt, 'hex'), record.iterations, record.keyLen, 'sha256');
  const stored = Buffer.from(record.hash, 'hex');
  // Длины сверяются до timingSafeEqual: при несовпадении он бросает
  // исключение, а не возвращает false.
  return candidate.length === stored.length && crypto.timingSafeEqual(candidate, stored);
}

module.exports = {
  hashPassword,
  verifyPassword,
  assertPasswordAcceptable,
  EumkPasswordError,
  PBKDF2_ITERATIONS,
  PBKDF2_MAX_ITERATIONS,
  PBKDF2_KEYLEN_BYTES,
  PASSWORD_SALT_BYTES,
  PASSWORD_RECORD_VERSION,
  PBKDF2_ALGO_ID,
  MIN_PASSWORD_LENGTH,
};
