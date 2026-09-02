// packages/player/electron/chrono/auth.js
// Локальная авторизация редактирования «Хронолинии» — ОДИН пароль на
// устройство (решение: Хронолайнер_план_реализации.md, раздел «Вопросы,
// требующие решения человека»: «Именные профили педагогов — решено: один
// пароль на устройство»), не отдельные профили педагогов. Хранится ВНЕ
// конкретного проекта — auth.json лежит прямо в baseDir (общий каталог
// хранилища), т.к. пароль защищает устройство целиком, а не один проект.
//
// scrypt (не bcrypt/PBKDF2) — встроен в Node без доп. зависимостей,
// memory-hard по умолчанию, параметры — задокументированные дефолты
// Node (N=16384, r=8, p=1). Троттлинг — по числу подряд идущих неудачных
// попыток, персистентному НА ДИСКЕ (не в памяти процесса, иначе
// перезапуск приложения тихо сбрасывал бы счётчик и снимал блокировку).
//
// Порог для брутфорса здесь ниже, чем для интернет-сервиса: устройство —
// киоск в помещении, а не удалённый сервис, доступный кому угодно; цель
// троттлинга — не пустить случайного посетителя музея методом перебора
// коротких паролей за разумное время, не защита от целевой атаки с
// физическим доступом к файловой системе (тот сценарий вне угрозы модели
// пароля — physical access to the device is already trusted).
//
// FAIL-CLOSED при повреждении auth.json (правка по итогам security-review
// Фазы 4): "файла нет" (легитимно, пароль никогда не задавали) и "файл
// есть, но испорчен/неполон" - РАЗНЫЕ состояния. Первое honestly значит
// "редактирование не защищено"; второе обязано означать "редактирование
// заблокировано, требуется вмешательство администратора", а не молча
// откатываться к первому - иначе повреждённый файл на диске (сбой
// записи, антивирус, ручная ошибка) тихо открывал бы редактирование
// всем, ровно то, от чего должен защищать пароль.

const path = require('path');
const crypto = require('crypto');
const { atomicWriteJson, readJsonStatus } = require('./atomicJson');

const AUTH_FILE = 'auth.json';
const AUTH_SCHEMA_VERSION = 1;
const SCRYPT_KEYLEN = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const MIN_PASSWORD_LENGTH = 4;

/** Сколько подряд неудачных попыток допускается до первой блокировки */
const LOCKOUT_THRESHOLD = 5;
/** Длительность первой блокировки */
const BASE_LOCKOUT_MS = 30_000;
/** Каждые LOCKOUT_THRESHOLD неудач сверх порога длительность удваивается, но не дальше этого потолка */
const MAX_LOCKOUT_MS = 60 * 60_000;

class AuthConfigCorruptedError extends Error {
  constructor() {
    super('Файл авторизации устройства повреждён или не читается. Обратитесь к администратору устройства.');
    this.name = 'AuthConfigCorruptedError';
  }
}

function authFilePath(baseDir) {
  return path.join(baseDir, AUTH_FILE);
}

function isValidAuthConfigShape(data) {
  return (
    !!data &&
    typeof data.salt === 'string' &&
    typeof data.hash === 'string' &&
    typeof data.keylen === 'number' &&
    typeof data.N === 'number' &&
    typeof data.r === 'number' &&
    typeof data.p === 'number'
  );
}

/**
 * @param {string} baseDir
 * @returns {{ state: 'absent' } | { state: 'corrupted' } | { state: 'ok', config: object }}
 */
function readAuthConfig(baseDir) {
  const status = readJsonStatus(authFilePath(baseDir));
  if (!status.exists) return { state: 'absent' };
  if (!status.valid || !isValidAuthConfigShape(status.data)) return { state: 'corrupted' };
  return { state: 'ok', config: status.data };
}

/**
 * true, если на устройстве когда-либо задавали пароль (или файл есть, но
 * повреждён - fail-closed: возможно, пароль БЫЛ задан, отдавать "нет"
 * здесь означало бы молча открыть редактирование).
 */
function isPasswordSet(baseDir) {
  return readAuthConfig(baseDir).state !== 'absent';
}

function assertValidPassword(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов`);
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS);
  return {
    version: AUTH_SCHEMA_VERSION,
    salt: salt.toString('hex'),
    hash: hash.toString('hex'),
    keylen: SCRYPT_KEYLEN,
    ...SCRYPT_PARAMS,
  };
}

/**
 * Задаёт (или меняет) пароль устройства. Сбрасывает счётчик неудачных
 * попыток и снимает блокировку — смена пароля не должна наследовать
 * старую историю неудачных попыток по прежнему паролю. Минимальная длина
 * проверяется ЗДЕСЬ (не только в форме на стороне рендерера) — рендерер
 * не единственная граница доверия для содержимого IPC-вызова.
 *
 * @param {string} baseDir
 * @param {string} password
 */
function setPassword(baseDir, password) {
  assertValidPassword(password);
  atomicWriteJson(authFilePath(baseDir), { ...hashPassword(password), failedAttempts: 0, lockedUntil: null });
}

/**
 * @param {string} baseDir
 * @returns {{ locked: boolean, retryAfterMs: number }}
 */
function checkLockout(baseDir) {
  const result = readAuthConfig(baseDir);
  if (result.state !== 'ok' || !result.config.lockedUntil) return { locked: false, retryAfterMs: 0 };

  const retryAfterMs = new Date(result.config.lockedUntil).getTime() - Date.now();
  return retryAfterMs > 0 ? { locked: true, retryAfterMs } : { locked: false, retryAfterMs: 0 };
}

/** Длительность блокировки, которая наступит при данном числе НАКОПЛЕННЫХ неудачных попыток (0, если порог ещё не достигнут) */
function lockoutDurationForAttempt(failedAttempts) {
  if (failedAttempts < LOCKOUT_THRESHOLD) return 0;
  const doublings = Math.floor((failedAttempts - LOCKOUT_THRESHOLD) / LOCKOUT_THRESHOLD);
  return Math.min(BASE_LOCKOUT_MS * 2 ** doublings, MAX_LOCKOUT_MS);
}

/**
 * @param {string} baseDir
 * @param {string} password
 * @returns {{ success: boolean, locked: boolean, retryAfterMs: number }}
 * @throws {AuthConfigCorruptedError} если auth.json есть, но повреждён - явная ошибка, не "неверный пароль"
 */
function verifyPassword(baseDir, password) {
  const lockout = checkLockout(baseDir);
  if (lockout.locked) return { success: false, ...lockout };

  const result = readAuthConfig(baseDir);
  if (result.state === 'absent') return { success: false, locked: false, retryAfterMs: 0 };
  if (result.state === 'corrupted') throw new AuthConfigCorruptedError();

  const config = result.config;
  const candidate = crypto.scryptSync(password, Buffer.from(config.salt, 'hex'), config.keylen, {
    N: config.N,
    r: config.r,
    p: config.p,
  });
  const stored = Buffer.from(config.hash, 'hex');
  // Длины сравниваются ДО timingSafeEqual - он сам бросает исключение при
  // несовпадении длин буферов, а не просто возвращает false.
  const matches = candidate.length === stored.length && crypto.timingSafeEqual(candidate, stored);

  if (matches) {
    atomicWriteJson(authFilePath(baseDir), { ...config, failedAttempts: 0, lockedUntil: null });
    return { success: true, locked: false, retryAfterMs: 0 };
  }

  const failedAttempts = (config.failedAttempts || 0) + 1;
  const durationMs = lockoutDurationForAttempt(failedAttempts);
  const lockedUntil = durationMs > 0 ? new Date(Date.now() + durationMs).toISOString() : null;
  atomicWriteJson(authFilePath(baseDir), { ...config, failedAttempts, lockedUntil });

  return { success: false, locked: durationMs > 0, retryAfterMs: durationMs };
}

/**
 * Меняет пароль устройства для IPC-слоя (ipc.js) - в отличие от
 * setPassword (низкоуровневая, "просто перезаписать"), эта функция сама
 * проверяет право на смену: если пароль уже установлен, требует ТЕКУЩИЙ
 * пароль и уважает блокировку/троттлинг. Без этой проверки на уровне
 * IPC-канала рендерер мог бы вызвать смену пароля напрямую, минуя UI
 * подтверждения текущего пароля, и обойти весь смысл авторизации. Если
 * пароля ещё нет вообще - это первичная настройка устройства,
 * currentPassword не требуется.
 *
 * @param {string} baseDir
 * @param {string} newPassword
 * @param {string} [currentPassword]
 * @returns {{ success: boolean, locked: boolean, retryAfterMs: number }}
 */
function changePassword(baseDir, newPassword, currentPassword) {
  if (isPasswordSet(baseDir)) {
    const verify = verifyPassword(baseDir, currentPassword || '');
    if (!verify.success) return verify;
  }
  setPassword(baseDir, newPassword);
  return { success: true, locked: false, retryAfterMs: 0 };
}

module.exports = {
  isPasswordSet,
  setPassword,
  changePassword,
  verifyPassword,
  checkLockout,
  lockoutDurationForAttempt,
  LOCKOUT_THRESHOLD,
  MIN_PASSWORD_LENGTH,
  AuthConfigCorruptedError,
  authFilePath,
};
