// Пароли локальных учётных записей ЭУМК (K5-1): правила выбора пароля,
// разбор записи пароля у аккаунта (миграция старых записей) и реализация
// хэширования для рендерера.
//
// ГДЕ ЖИВЁТ ХЭШИРОВАНИЕ. В собранном приложении - в главном процессе
// (node:crypto, PBKDF2-HMAC-SHA256), рендерер зовёт его через мост eumkAPI:
// это то же место, где лежит файл данных (electron/eumk), и там доступен
// node:crypto, которого в изолированном рендерере нет. Web Crypto-вариант
// ниже - запасной для браузерного стенда без eumkAPI (dev/предпросмотр);
// параметры и формат записи у обоих одинаковые, что закреплено тестом
// (derivePbkdf2Sha256 против node:crypto).

import {
  PBKDF2_ALGO_ID, PBKDF2_ITERATIONS, PASSWORD_RECORD_VERSION, PASSWORD_SALT_BYTES, PBKDF2_KEYLEN_BYTES,
  PasswordRecordSchema, type Account, type PasswordRecord,
} from './model/schema.ts';
import type { EumkBridge } from './persistentStorage.ts';

// Минимальная длина пароля локальной учётной записи (K5-1). 6 - решение
// пользователя, зафиксированное в «Ответы_2026-11-09.md», E-06: «пароль
// 6+ символов, не равный имени». Значение продублировано в
// electron/eumk/passwords.js (проверка на границе IPC); parity-тест в
// electron/eumk/passwords.test.js не даёт копиям разойтись.
export const MIN_PASSWORD_LENGTH = 6;

/** Объяснение, почему пароль не подходит, или null, если подходит. */
export function passwordProblem(password: string, accountName: string): string | null {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов`;
  }
  // E-06: пароль не должен совпадать с именем записи (его видит любой на экране входа).
  if (password.trim().toLowerCase() === accountName.trim().toLowerCase()) {
    return 'Пароль не должен совпадать с именем записи';
  }
  return null;
}

export type PasswordRecordStatus =
  | { status: 'absent' } // аккаунт до K5-1, пароля нет - предложить задать
  | { status: 'invalid' } // запись есть, но испорчена - вход по паролю невозможен, ошибка
  | { status: 'ok'; record: PasswordRecord };

/**
 * Разбор записи пароля аккаунта. «Пароля нет» и «запись испорчена» -
 * РАЗНЫЕ состояния: второе обязано блокировать вход с понятной ошибкой,
 * а не превращаться молча в первое (иначе повреждённый файл открывал бы
 * вход без пароля).
 */
export function passwordRecordOf(account: Pick<Account, 'password'>): PasswordRecordStatus {
  if (account.password === null || account.password === undefined) return { status: 'absent' };
  const parsed = PasswordRecordSchema.safeParse(account.password);
  return parsed.success ? { status: 'ok', record: parsed.data } : { status: 'invalid' };
}

/** Криптографические операции с паролем (главный процесс или WebCrypto). */
export interface PasswordCrypto {
  hash(password: string): Promise<PasswordRecord>;
  verify(password: string, record: PasswordRecord): Promise<boolean>;
}

// ---------- Web Crypto-реализация (браузерный стенд без eumkAPI) ----------

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Сравнение без раннего выхода по байтам (аналог node:crypto.timingSafeEqual). */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

// Тип параметра salt - Uint8Array<ArrayBuffer>, а не просто Uint8Array:
// WebCrypto принимает BufferSource (массив на чистом ArrayBuffer), а
// Uint8Array по умолчанию типизирован как ArrayBufferLike.
export async function derivePbkdf2Sha256(subtle: SubtleCrypto, password: string, salt: Uint8Array<ArrayBuffer>, iterations: number, keyLenBytes: number): Promise<Uint8Array> {
  const keyMaterial = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, keyMaterial, keyLenBytes * 8);
  return new Uint8Array(bits);
}

/**
 * Web Crypto-реализация. Параметр итераций - только для тестов (быстрые
 * записи); в проде используется PBKDF2_ITERATIONS из схемы (600 000, OWASP 2023).
 */
export function webcryptoPasswordCrypto(iterations: number = PBKDF2_ITERATIONS, subtle: SubtleCrypto = crypto.subtle): PasswordCrypto {
  return {
    async hash(password: string): Promise<PasswordRecord> {
      const salt = crypto.getRandomValues(new Uint8Array(PASSWORD_SALT_BYTES));
      const hash = await derivePbkdf2Sha256(subtle, password, salt, iterations, PBKDF2_KEYLEN_BYTES);
      return {
        version: PASSWORD_RECORD_VERSION,
        algo: PBKDF2_ALGO_ID,
        iterations,
        salt: toHex(salt),
        hash: toHex(hash),
        keyLen: PBKDF2_KEYLEN_BYTES,
      };
    },
    async verify(password: string, record: PasswordRecord): Promise<boolean> {
      const derived = await derivePbkdf2Sha256(subtle, password, fromHex(record.salt), record.iterations, record.keyLen);
      return constantTimeEqual(derived, fromHex(record.hash));
    },
  };
}

// ---------- Выбор реализации по окружению ----------

export interface PasswordHost {
  eumkAPI?: EumkBridge;
  crypto?: { subtle: SubtleCrypto };
}

function unwrap<T>(reply: { ok: boolean; value?: T; error?: string }): T {
  if (!reply.ok) throw new Error(reply.error ?? 'Ошибка проверки пароля');
  return reply.value as T;
}

/** Мост главного процесса, если он есть; иначе WebCrypto браузера; иначе null. */
export function pickPasswordCrypto(host: PasswordHost): PasswordCrypto | null {
  const bridge = host.eumkAPI;
  if (bridge && typeof bridge.hashPassword === 'function' && typeof bridge.verifyPassword === 'function') {
    return {
      hash: async (password) => unwrap(await bridge.hashPassword(password)),
      verify: async (password, record) => unwrap(await bridge.verifyPassword(password, record)),
    };
  }
  if (host.crypto && host.crypto.subtle) return webcryptoPasswordCrypto(PBKDF2_ITERATIONS, host.crypto.subtle);
  return null;
}
