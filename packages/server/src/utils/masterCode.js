// packages/server/src/utils/masterCode.js
// Детерминированный офлайн мастер-код сброса пароля «Хронолинии» (Фаза 4
// плана, "мастер-код сброса" — единственный оставшийся пункт локальной
// авторизации). Мастер-секрет (CHRONO_MASTER_SECRET, .env) НИКОГДА не
// покидает сервер — в дистрибутив плеера попадает только производный
// секрет КОНКРЕТНОЙ сборки (buildResetConfig). Устройство проверяет код
// офлайн той же формулой (см. packages/player/electron/chrono/resetCode.js —
// это НАМЕРЕННОЕ дублирование формулы, не общий модуль: общий модуль
// пришлось бы тянуть либо через node:crypto в браузерный бандл
// packages/shared (editor-web его не соберёт), либо через новый межпакетный
// deep-import механизм — риск ради экономии ~20 строк не оправдан, поэтому
// каждая сторона имеет свою копию с зеркальными тестами на одни и те же
// векторы (masterCode.test.js).
//
// Принятый риск (задокументирован в плане, раздел приёмочной матрицы):
// извлечение производного секрета из дистрибутива позволяет сбросить
// пароль только НА УСТРОЙСТВАХ ЭТОЙ ЖЕ сборки (buildCode/secret уникальны
// на сборку) — мастер-секрет извлечь невозможно, он не сериализуется в
// дистрибутив ни в каком виде.
import crypto from 'crypto';

const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Crockford Base32 (без I/L/O/U — не различимы на слух/письме при диктовке
 * по телефону). Кодирует произвольный буфер, не требует кратности длины —
 * последняя группа бит дополняется нулями, как в стандартном Base32.
 * @param {Buffer} buffer
 * @returns {string}
 */
export function crockfordEncode(buffer) {
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
 * Короткий публичный идентификатор сборки — НЕ секрет, показывается на
 * экране блокировки и диктуется поддержке. Детерминирован от buildId
 * (стабилен на каждом запуске одной и той же сборки), но сам buildId
 * (UUID) неудобно диктовать вслух — отсюда укороченная хеш-производная.
 *
 * 6 байт sha256-хеша = 48 бит = 10 символов Crockford32 (с 2 битами
 * паддинга в последнем символе). deriveBuildSecret ниже выводит секрет
 * КОНКРЕТНО из buildCode (не из полного buildId) - это сознательный
 * компромисс: chrono-reset-code.js (CLI поддержки) получает от педагога по
 * телефону только buildCode+challenge, без buildId, и не хранит никакой
 * БД соответствий "buildCode → buildId". Следствие - деривация секрета
 * упирается в энтропию buildCode, а не в 122 бита UUID buildId. Раньше
 * здесь было 5 байт (40 бит, ~2^20 сборок до 50% вероятности коллизии
 * секрета между НЕСВЯЗАННЫМИ сборками) - security-review отметил это как
 * MEDIUM, поскольку явно противоречило комментарию выше о "секрет
 * уникален на сборку". Расширено до 6 байт (48 бит, ~2^24 ≈ 16.8 млн
 * сборок до 50%-й коллизии) - для этого продукта (нишевый B2B клиентский
 * софт) такой масштаб недостижим на практике, а 2 лишних символа не
 * меняют удобство диктовки по телефону.
 * @param {string} buildId
 * @returns {string} 10 символов
 */
export function buildCodeFromBuildId(buildId) {
  const hash = crypto.createHash('sha256').update(`kiosk-chrono-build:v1:${buildId}`).digest();
  return crockfordEncode(hash.subarray(0, 6));
}

/**
 * Производный секрет КОНКРЕТНОЙ сборки — то единственное, что попадает в
 * дистрибутив (см. buildResetConfig). HMAC, а не просто хеш(masterSecret+
 * buildCode) — устойчив к length-extension и является стандартной
 * практикой для деривации ключей из секрета.
 * @param {string} masterSecret
 * @param {string} buildCode
 * @returns {string} hex
 */
export function deriveBuildSecret(masterSecret, buildCode) {
  return crypto.createHmac('sha256', masterSecret).update(`chrono-reset-secret:v1:${buildCode}`).digest('hex');
}

/**
 * Код, который педагог вводит на устройстве. HOTP-подобно (HMAC → 6 цифр),
 * но challenge — не счётчик, а показанный на экране блокировки одноразовый
 * nonce (см. resetCode.js на стороне плеера) — не дата: часы киоска не
 * синхронизированы, а календарный код было бы легко "поделиться" на весь
 * день вперёд.
 * @param {string} secretHex - производный секрет сборки (deriveBuildSecret)
 * @param {string} buildCode
 * @param {string} challenge
 * @returns {string} ровно 6 цифр
 */
export function computeResetCode(secretHex, buildCode, challenge) {
  const h = crypto
    .createHmac('sha256', Buffer.from(secretHex, 'hex'))
    .update(`chrono-reset:v1:${buildCode}:${challenge}`)
    .digest();
  const num = h.readUInt32BE(0) & 0x7fffffff;
  return String(num % 1_000_000).padStart(6, '0');
}

/**
 * Поле chronoReset, которое builds.js кладёт в project.json конкретной
 * сборки (только для проектов с виджетом «Хронолиния» — см. builds.js).
 * @param {string} masterSecret
 * @param {string} buildId
 */
export function buildResetConfig(masterSecret, buildId) {
  const buildCode = buildCodeFromBuildId(buildId);
  const secret = deriveBuildSecret(masterSecret, buildCode);
  return { version: 1, buildCode, secret };
}
