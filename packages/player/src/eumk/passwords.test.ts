// Тесты K5-1 (домен рендерера): правила пароля локальной учётной записи,
// разбор записи пароля у существующей учётки (миграция), реализация
// хэширования на Web Crypto для браузерного стенда и выбор реализации
// (мост из главного процесса или WebCrypto). Записи синтетические.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pbkdf2Sync } from 'node:crypto';
import {
  MIN_PASSWORD_LENGTH, passwordProblem, passwordRecordOf,
  constantTimeEqual, derivePbkdf2Sha256, webcryptoPasswordCrypto, pickPasswordCrypto,
} from './passwords.ts';
import {
  PasswordRecordSchema, PBKDF2_ITERATIONS, PASSWORD_RECORD_VERSION, PBKDF2_ALGO_ID, PASSWORD_SALT_BYTES,
  type Account, type PasswordRecord,
} from './model/schema.ts';

// Синтетическая валидная запись с дешёвыми итерациями (параметры берутся
// из записи, поэтому верификация остаётся быстрой).
function fastRecord(password: string, iterations = 1000): PasswordRecord {
  const salt = 'ab'.repeat(PASSWORD_SALT_BYTES);
  const hash = pbkdf2Sync(password, Buffer.from(salt, 'hex'), iterations, 32, 'sha256').toString('hex');
  return PasswordRecordSchema.parse({ version: PASSWORD_RECORD_VERSION, algo: PBKDF2_ALGO_ID, iterations, salt, hash, keyLen: 32 });
}

function accountWith(password: unknown): Account {
  return { id: 'acc-синтетика', name: 'Ученик тестовый', createdAt: 1, password };
}

test('MIN_PASSWORD_LENGTH is 6, per the fixed user decision (Ответы 2026-11-09, E-06)', () => {
  assert.equal(MIN_PASSWORD_LENGTH, 6);
});

test('PBKDF2 iterations are pinned to the OWASP 2023 recommendation for SHA-256', () => {
  assert.equal(PBKDF2_ITERATIONS, 600000);
});

test('passwordProblem explains a too-short password: 4 and 5 chars are invalid, 6 is valid', () => {
  assert.match(passwordProblem('abc', 'Ученик тестовый')!, /не короче 6/);
  assert.match(passwordProblem('abcd', 'Ученик тестовый')!, /не короче 6/);
  assert.match(passwordProblem('abcde', 'Ученик тестовый')!, /не короче 6/);
  assert.equal(passwordProblem('abcdef', 'Ученик тестовый'), null);
});

test('passwordProblem rejects a password equal to the account name (case-insensitive)', () => {
  assert.match(passwordProblem('ученик тестовый', 'Ученик тестовый')!, /совпадать с именем/);
  assert.match(passwordProblem('Ученик Тестовый', 'ученик тестовый')!, /совпадать с именем/);
});

test('passwordProblem returns null for an acceptable password', () => {
  assert.equal(passwordProblem('синтетика-1', 'Ученик тестовый'), null);
});

test('passwordRecordOf reports a legacy account (no password) as absent', () => {
  assert.deepEqual(passwordRecordOf(accountWith(null)), { status: 'absent' });
  assert.deepEqual(passwordRecordOf(accountWith(undefined)), { status: 'absent' });
});

test('passwordRecordOf reports a damaged password entry as invalid, never as absent', () => {
  // «Битая» запись обязана отличаться от «пароля нет»: иначе повреждённый
  // файл молча превращался бы в вход без пароля.
  assert.deepEqual(passwordRecordOf(accountWith({ algo: 'md5' })).status, 'invalid');
  assert.deepEqual(passwordRecordOf(accountWith('просто строка')).status, 'invalid');
});

test('passwordRecordOf returns the parsed record for a valid entry', () => {
  const record = fastRecord('синтетика-1');
  const status = passwordRecordOf(accountWith(record));
  assert.deepEqual(status, { status: 'ok', record });
});

test('derivePbkdf2Sha256 matches node:crypto byte for byte (main process parity)', async () => {
  const salt = new Uint8Array(PASSWORD_SALT_BYTES).fill(7);
  const derived = await derivePbkdf2Sha256(globalThis.crypto.subtle, 'синтетика', salt, 1000, 32);
  const expected = pbkdf2Sync('синтетика', salt, 1000, 32, 'sha256');
  assert.deepEqual(Buffer.from(derived), expected);
});

test('webcryptoPasswordCrypto creates a schema-valid record and verifies it', async () => {
  const passwordCrypto = webcryptoPasswordCrypto(1000);
  const record = await passwordCrypto.hash('пароль-синтетика');
  assert.equal(record.version, PASSWORD_RECORD_VERSION);
  assert.equal(record.algo, PBKDF2_ALGO_ID);
  assert.equal(record.salt.length, PASSWORD_SALT_BYTES * 2);
  assert.equal(PasswordRecordSchema.safeParse(record).success, true);
  assert.equal(await passwordCrypto.verify('пароль-синтетика', record), true);
  assert.equal(await passwordCrypto.verify('другой-пароль', record), false);
});

test('two accounts with the same password get different salts and hashes', async () => {
  const passwordCrypto = webcryptoPasswordCrypto(1000);
  const a = await passwordCrypto.hash('общий-пароль');
  const b = await passwordCrypto.hash('общий-пароль');
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.hash, b.hash);
});

test('constantTimeEqual: equal buffers match, one flipped byte or a length gap does not', () => {
  const a = new Uint8Array([1, 2, 3, 4]);
  assert.equal(constantTimeEqual(a, new Uint8Array([1, 2, 3, 4])), true);
  assert.equal(constantTimeEqual(a, new Uint8Array([1, 2, 3, 5])), false);
  assert.equal(constantTimeEqual(a, new Uint8Array([1, 2, 3])), false);
  assert.equal(constantTimeEqual(new Uint8Array(0), new Uint8Array(0)), true);
});

test('pickPasswordCrypto prefers the eumk bridge of the packaged app', async () => {
  const calls: string[] = [];
  const host = {
    eumkAPI: {
      getItem: () => ({ ok: true, value: null }),
      setItem: () => ({ ok: true }),
      hashPassword: async (password: string) => { calls.push(`hash ${password}`); return { ok: true, value: fastRecord(password) }; },
      verifyPassword: async (password: string) => { calls.push(`verify ${password}`); return { ok: true, value: true }; },
    },
  };
  const passwordCrypto = pickPasswordCrypto(host);
  assert.ok(passwordCrypto);
  const record = await passwordCrypto!.hash('синтетика');
  assert.equal(await passwordCrypto!.verify('синтетика', record), true);
  assert.deepEqual(calls, ['hash синтетика', 'verify синтетика']);
});

test('pickPasswordCrypto surfaces bridge errors instead of inventing a verdict', async () => {
  const host = {
    eumkAPI: {
      getItem: () => ({ ok: true, value: null }),
      setItem: () => ({ ok: true }),
      hashPassword: async () => ({ ok: false, error: 'Запись пароля повреждена' }),
      verifyPassword: async () => ({ ok: false, error: 'Запись пароля повреждена' }),
    },
  };
  const passwordCrypto = pickPasswordCrypto(host)!;
  await assert.rejects(() => passwordCrypto.hash('x'), /повреждена/);
  await assert.rejects(() => passwordCrypto.verify('x', fastRecord('x')), /повреждена/);
});

test('pickPasswordCrypto falls back to WebCrypto in a plain browser and gives null without either', () => {
  assert.ok(pickPasswordCrypto({ crypto: globalThis.crypto }));
  assert.equal(pickPasswordCrypto({}), null);
});
