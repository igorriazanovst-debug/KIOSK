// Тесты K5-1: PBKDF2-SHA256-хэширование паролей локальных учётных записей
// ЭУМК в главном процессе (node:crypto). Большинство тестовых записей
// строится с уменьшенным числом итераций (1000 вместо 600 000), чтобы набор
// не занимал секунды; настоящие параметры проверяются отдельными тестами.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  hashPassword, verifyPassword, assertPasswordAcceptable, EumkPasswordError,
  PBKDF2_ITERATIONS, PASSWORD_RECORD_VERSION, PBKDF2_ALGO_ID, PBKDF2_KEYLEN_BYTES, PASSWORD_SALT_BYTES,
} from './passwords.js';
// Константы рендерера - для parity-теста: значения намеренно продублированы
// между главным процессом и рендерером (общего пакета нет), копии не должны
// разъезжаться молча.
import {
  PBKDF2_ITERATIONS as TS_ITERATIONS, PASSWORD_SALT_BYTES as TS_SALT_BYTES, PBKDF2_KEYLEN_BYTES as TS_KEYLEN,
  PASSWORD_RECORD_VERSION as TS_VERSION, PBKDF2_ALGO_ID as TS_ALGO,
} from '../../src/eumk/model/schema.ts';
import { MIN_PASSWORD_LENGTH as TS_MIN_LENGTH } from '../../src/eumk/passwords.ts';

// Запись с «дешёвыми» параметрами — для быстрых проверок логики верификации.
function fastRecord(password, overrides = {}) {
  const salt = 'ab'.repeat(PASSWORD_SALT_BYTES);
  const hash = crypto.pbkdf2Sync(password, Buffer.from(salt, 'hex'), 1000, PBKDF2_KEYLEN_BYTES, 'sha256').toString('hex');
  return { version: PASSWORD_RECORD_VERSION, algo: PBKDF2_ALGO_ID, iterations: 1000, salt, hash, keyLen: PBKDF2_KEYLEN_BYTES, ...overrides };
}

// Одна «настоящая» запись на весь файл: 600 000 итераций дважды гонять незачем.
const REAL_RECORD = await hashPassword('синтетический-пароль-1');

test('PBKDF2 iterations are pinned to the OWASP 2023 recommendation for SHA-256 (600 000)', () => {
  assert.equal(PBKDF2_ITERATIONS, 600000);
});

test('duplicated constants stay in sync between the main process and the renderer', () => {
  assert.equal(TS_ITERATIONS, PBKDF2_ITERATIONS, 'итерации');
  assert.equal(TS_SALT_BYTES, PASSWORD_SALT_BYTES, 'размер соли');
  assert.equal(TS_KEYLEN, PBKDF2_KEYLEN_BYTES, 'длина ключа');
  assert.equal(TS_VERSION, PASSWORD_RECORD_VERSION, 'версия записи');
  assert.equal(TS_ALGO, PBKDF2_ALGO_ID, 'идентификатор алгоритма');
  assert.equal(TS_MIN_LENGTH, 6, 'минимальная длина пароля рендерера (E-06: 6+)');
});

test('hashPassword returns a self-describing record: version, algo, iterations, salt, hash', () => {
  assert.equal(REAL_RECORD.version, PASSWORD_RECORD_VERSION);
  assert.equal(REAL_RECORD.algo, PBKDF2_ALGO_ID);
  assert.equal(REAL_RECORD.iterations, PBKDF2_ITERATIONS);
  assert.equal(REAL_RECORD.keyLen, PBKDF2_KEYLEN_BYTES);
  assert.match(REAL_RECORD.salt, /^[0-9a-f]+$/);
  assert.equal(REAL_RECORD.salt.length, PASSWORD_SALT_BYTES * 2);
  assert.match(REAL_RECORD.hash, /^[0-9a-f]+$/);
  assert.equal(REAL_RECORD.hash.length, PBKDF2_KEYLEN_BYTES * 2);
});

test('hashPassword round-trips with the real 600k parameters: right password passes, wrong fails', async () => {
  assert.equal(await verifyPassword('синтетический-пароль-1', REAL_RECORD), true);
  assert.equal(await verifyPassword('синтетический-пароль-2', REAL_RECORD), false);
});

test('each account gets its own random salt (same password - different records)', async () => {
  const other = await hashPassword('синтетический-пароль-1');
  assert.notEqual(other.salt, REAL_RECORD.salt);
  assert.notEqual(other.hash, REAL_RECORD.hash);
});

test('verifyPassword uses the parameters stored in the record, not the current defaults', async () => {
  // Старая запись с меньшим числом итераций обязана проверяться её числом.
  const oldStyle = fastRecord('тест-пароль', { iterations: 1000 });
  assert.equal(await verifyPassword('тест-пароль', oldStyle), true);
});

test('verifyPassword compares hashes without leaking through length mismatch', async () => {
  const record = fastRecord('правильный');
  assert.equal(await verifyPassword('неправильный', record), false);
  // Хеш другой длины (битая запись) - явная ошибка, а не false.
  await assert.rejects(() => verifyPassword('правильный', { ...record, hash: 'ab' }), EumkPasswordError);
});

test('a corrupted password record is an explicit error, not a silent "wrong password"', async () => {
  const base = fastRecord('x');
  const broken = [
    null,
    'строка',
    42,
    {},
    { ...base, algo: 'scrypt' },          // чужой алгоритм
    { ...base, version: 2 },              // запись формата будущей версии
    { ...base, iterations: 0 },
    { ...base, iterations: 1000.5 },
    { ...base, iterations: 100000001 },   // абсурдно большое число
    { ...base, keyLen: 0 },
    { ...base, salt: 'не-hex' },
    { ...base, salt: 'ab' },              // соль короче 16 байт
    { ...base, salt: `${'ab'.repeat(16)}a` }, // нечётная длина hex - обрезанная запись
    { ...base, hash: 'zz' },              // не hex
  ];
  for (const bad of broken) {
    await assert.rejects(() => verifyPassword('x', bad), EumkPasswordError, `должна быть ошибка для ${JSON.stringify(bad)}`);
  }
});

test('assertPasswordAcceptable enforces the minimum length at the IPC boundary', () => {
  assert.doesNotThrow(() => assertPasswordAcceptable('abcdef'));
  assert.throws(() => assertPasswordAcceptable('abcde'), EumkPasswordError); // 5 - уже невалиден (E-06: 6+)
  assert.throws(() => assertPasswordAcceptable('abc'), EumkPasswordError);
  assert.throws(() => assertPasswordAcceptable(42), EumkPasswordError);
  assert.throws(() => assertPasswordAcceptable(null), EumkPasswordError);
});
