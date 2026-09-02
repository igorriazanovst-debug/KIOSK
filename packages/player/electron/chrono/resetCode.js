// packages/player/electron/chrono/resetCode.js
// Мастер-код сброса пароля «Хронолинии» — офлайн-проверка на устройстве
// (Фаза 4 плана, единственный оставшийся пункт локальной авторизации).
// Формула проверки ЗЕРКАЛЬНА packages/server/src/utils/masterCode.js
// (crockfordEncode/computeResetCode) — намеренное дублирование, а не общий
// модуль (см. комментарий в начале masterCode.js), подстраховано
// одинаковым тестовым вектором в masterCode.test.js и resetCode.test.js.
//
// Устройство НИКОГДА не видит мастер-секрет — только производный секрет
// ЭТОЙ сборки (project.chronoReset, записан builds.js при сборке
// дистрибутива). Педагог диктует поддержке buildCode (публичный, не
// секрет) и challenge (одноразовый nonce с экрана блокировки), поддержка
// вычисляет code на сервере тем же masterCode.js и не нуждается в доступе
// к устройству.
//
// resetGuard.json - ОТДЕЛЬНЫЙ от auth.json файл состояния (свой троттлинг,
// свой challenge). Два намеренных решения:
//  1. Троттлинг сброса не делит счётчик с троттлингом пароля - иначе
//     подбор кода сброса запирал бы легитимный ввод пароля и наоборот.
//  2. Сброс обязан работать, даже если auth.json ПОВРЕЖДЁН
//     (AuthConfigCorruptedError) - это и есть тот сценарий, ради которого
//     механизм существует; если бы состояние сброса жило в auth.json,
//     recovery-путь ломался бы ровно тогда, когда он нужнее всего.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { atomicWriteJson, readJsonStatus } = require('./atomicJson');
const auth = require('./auth');

const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const RESET_GUARD_FILE = 'resetGuard.json';
const CHALLENGE_BYTES = 4;
/** Fail-closed срок для повреждённого resetGuard.json (security-review) - тот же потолок, что и у auth.js */
const CORRUPTED_GUARD_LOCKOUT_MS = 60 * 60_000;

function crockfordEncode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += CROCKFORD_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += CROCKFORD_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

/**
 * @param {string} secretHex - производный секрет сборки (project.chronoReset.secret)
 * @param {string} buildCode
 * @param {string} challenge
 * @returns {string} ровно 6 цифр
 */
function computeResetCode(secretHex, buildCode, challenge) {
  const h = crypto
    .createHmac('sha256', Buffer.from(secretHex, 'hex'))
    .update(`chrono-reset:v1:${buildCode}:${challenge}`)
    .digest();
  const num = h.readUInt32BE(0) & 0x7fffffff;
  return String(num % 1_000_000).padStart(6, '0');
}

function normalizeCode(input) {
  return String(input || '').replace(/[\s-]/g, '');
}

/**
 * Чистая функция, отдельно юнит-тестируемая без реального Electron `app`/
 * файловой системы — вся ФС-специфика (какой project.json нашли и
 * распарсили) остаётся в loadResetConfigSync.
 * @param {unknown} projectData
 * @returns {{ buildCode: string, secret: string } | null}
 */
function parseResetConfig(projectData) {
  const reset = projectData && projectData.chronoReset;
  if (reset && typeof reset.buildCode === 'string' && typeof reset.secret === 'string') {
    return { buildCode: reset.buildCode, secret: reset.secret };
  }
  return null;
}

/**
 * Тот же порядок поиска project.json, что и findProjectJsonForWindowModeSync
 * в main.js — намеренно НЕЗАВИСИМАЯ копия (см. комментарий в main.js: не
 * переиспользуем состояние loadEmbeddedProject, чтобы не рисковать
 * остальным поведением плеера при правке этого модуля).
 * @param {import('electron').App} app
 * @returns {{ buildCode: string, secret: string } | null}
 */
function loadResetConfigSync(app) {
  const searchPaths = [
    path.join(process.resourcesPath || '', 'project.json'),
    path.join(__dirname, '..', 'project.json'),
    path.join(app.getAppPath(), 'project.json'),
    path.join(app.getAppPath(), 'electron', 'project.json'),
    path.join(path.dirname(app.getPath('exe')), 'project.json'),
  ];

  for (const projectPath of searchPaths) {
    if (!fs.existsSync(projectPath)) continue;
    try {
      return parseResetConfig(JSON.parse(fs.readFileSync(projectPath, 'utf-8')));
    } catch {
      // тот же путь, что и в findProjectJsonForWindowModeSync: битый файл — пробуем следующий
    }
  }
  return null;
}

function resetGuardPath(baseDir) {
  return path.join(baseDir, RESET_GUARD_FILE);
}

/**
 * Различает "файла нет" (легитимно) от "файл есть, но испорчен" — тот же
 * класс инварианта, что security-review Фазы 4 установил для auth.json
 * (readAuthConfig/AuthConfigCorruptedError). Разница здесь: это файл
 * ТРОТТЛИНГА, не credential-файл, поэтому вместо исключения (которое
 * заблокировало бы саму recovery-возможность) состояние "corrupted"
 * трактуется ниже как maximally locked — сброс временно недоступен, пока
 * администратор не поправит/удалит resetGuard.json, но НЕ пропускается
 * молча как "счётчик пуст" (то, что было найдено ревью как MEDIUM: до
 * этой правки повреждённый файл тихо снимал троттлинг).
 * @param {string} baseDir
 * @returns {{ corrupted: true } | { corrupted: false, challenge: string | null, failedAttempts: number, lockedUntil: string | null }}
 */
function readResetGuard(baseDir) {
  const status = readJsonStatus(resetGuardPath(baseDir));
  if (!status.exists) return { corrupted: false, challenge: null, failedAttempts: 0, lockedUntil: null };
  if (!status.valid) return { corrupted: true };
  return { corrupted: false, ...status.data };
}

function checkResetLockout(guard) {
  if (guard.corrupted) return { locked: true, retryAfterMs: CORRUPTED_GUARD_LOCKOUT_MS };
  if (!guard.lockedUntil) return { locked: false, retryAfterMs: 0 };
  const retryAfterMs = new Date(guard.lockedUntil).getTime() - Date.now();
  return retryAfterMs > 0 ? { locked: true, retryAfterMs } : { locked: false, retryAfterMs: 0 };
}

/**
 * Отдаёт challenge для показа на экране блокировки — генерирует новый,
 * только если его ещё нет (не при каждом вызове, иначе педагог, ушедший
 * звонить в поддержку, вернётся к уже неактуальному коду). При corrupted
 * guard НИЧЕГО не пишет — иначе сама генерация challenge "тихо чинила" бы
 * испорченный файл свежими нулевыми счётчиками, обнуляя троттлинг тем же
 * путём, которым его обнуляло само повреждение.
 * @param {{ buildCode: string, secret: string } | null} config - loadResetConfigSync(app), резолвится один раз в registerChronoIpc
 * @param {string} baseDir
 * @returns {{ available: boolean, buildCode?: string, challenge?: string, locked: boolean, retryAfterMs: number }}
 */
function getChallenge(config, baseDir) {
  if (!config) return { available: false, locked: false, retryAfterMs: 0 };

  const guard = readResetGuard(baseDir);
  const lockout = checkResetLockout(guard);
  if (guard.corrupted) return { available: true, buildCode: config.buildCode, ...lockout };

  let challenge = guard.challenge;
  if (!challenge && !lockout.locked) {
    challenge = crockfordEncode(crypto.randomBytes(CHALLENGE_BYTES));
    atomicWriteJson(resetGuardPath(baseDir), {
      challenge,
      failedAttempts: guard.failedAttempts,
      lockedUntil: guard.lockedUntil,
    });
  }
  return { available: true, buildCode: config.buildCode, challenge, ...lockout };
}

/**
 * @param {{ buildCode: string, secret: string } | null} config - loadResetConfigSync(app), резолвится один раз в registerChronoIpc
 * @param {string} baseDir
 * @param {string} enteredCode
 * @param {string} newPassword
 * @returns {{ success: boolean, locked: boolean, retryAfterMs: number }}
 */
function verifyResetCode(config, baseDir, enteredCode, newPassword) {
  if (!config) return { success: false, locked: false, retryAfterMs: 0 };

  const guard = readResetGuard(baseDir);
  const lockout = checkResetLockout(guard);
  if (lockout.locked) return { success: false, ...lockout };

  if (!guard.challenge) return { success: false, locked: false, retryAfterMs: 0 };

  const expected = computeResetCode(config.secret, config.buildCode, guard.challenge);
  const normalized = normalizeCode(enteredCode);
  const expectedBuf = Buffer.from(expected);
  const normalizedBuf = Buffer.from(normalized);
  const matches =
    normalizedBuf.length === expectedBuf.length && crypto.timingSafeEqual(normalizedBuf, expectedBuf);

  if (matches) {
    // Длина проверяется здесь, а не только полагаясь на setPassword -
    // иначе AuthConfigCorruptedError-подобное исключение из setPassword
    // прервало бы функцию ДО ротации challenge и ДО учёта попытки в
    // троттлинге (найдено security-review как LOW) - код совпал, но
    // короткий пароль не должен ни жечь challenge, ни считаться неудачной
    // попыткой подбора кода, это отдельная, явная ошибка ввода.
    if (typeof newPassword !== 'string' || newPassword.length < auth.MIN_PASSWORD_LENGTH) {
      return { success: false, locked: false, retryAfterMs: 0 };
    }
    // setPassword перезаписывает auth.json - работает, даже если старый
    // auth.json был повреждён, потому что ничего из него не читает.
    auth.setPassword(baseDir, newPassword);
    // challenge одноразовый - ротируем (следующий getChallenge сгенерирует новый).
    atomicWriteJson(resetGuardPath(baseDir), { challenge: null, failedAttempts: 0, lockedUntil: null });
    return { success: true, locked: false, retryAfterMs: 0 };
  }

  const failedAttempts = (guard.failedAttempts || 0) + 1;
  const durationMs = auth.lockoutDurationForAttempt(failedAttempts);
  const lockedUntil = durationMs > 0 ? new Date(Date.now() + durationMs).toISOString() : null;
  atomicWriteJson(resetGuardPath(baseDir), { challenge: guard.challenge, failedAttempts, lockedUntil });
  return { success: false, locked: durationMs > 0, retryAfterMs: durationMs };
}

module.exports = {
  crockfordEncode,
  computeResetCode,
  normalizeCode,
  parseResetConfig,
  loadResetConfigSync,
  getChallenge,
  verifyResetCode,
};
