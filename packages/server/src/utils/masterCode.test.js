import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  crockfordEncode,
  buildCodeFromBuildId,
  deriveBuildSecret,
  computeResetCode,
  buildResetConfig,
} from './masterCode.js';

test('crockfordEncode: all-zero bytes encode to all-"0" characters', () => {
  assert.equal(crockfordEncode(Buffer.from([0, 0, 0, 0, 0])), '00000000');
});

test('crockfordEncode: all-one-bits bytes encode to all-"Z" characters (last alphabet index)', () => {
  assert.equal(crockfordEncode(Buffer.from([0xff, 0xff, 0xff, 0xff, 0xff])), 'ZZZZZZZZ');
});

test('crockfordEncode: single zero byte pads the trailing partial group with zero bits', () => {
  assert.equal(crockfordEncode(Buffer.from([0x00])), '00');
});

test('crockfordEncode: output length matches ceil(bits/5) for arbitrary lengths', () => {
  assert.equal(crockfordEncode(Buffer.alloc(4)).length, 7); // 32 бита -> 7 симв. (35 бит вместимость)
  assert.equal(crockfordEncode(Buffer.alloc(5)).length, 8); // 40 бит -> ровно 8 симв., без паддинга
});

test('crockfordEncode: never emits ambiguous letters (I, L, O, U)', () => {
  const out = crockfordEncode(crypto_randomBytesStub());
  assert.equal(/[ILOU]/.test(out), false);
});

// Не тянем node:crypto ради одного randomBytes в тесте кодировщика — байты
// заведомо покрывают весь диапазон 0-255, этого достаточно для проверки
// алфавита.
function crypto_randomBytesStub() {
  return Buffer.from(Array.from({ length: 32 }, (_, i) => i * 8));
}

test('buildCodeFromBuildId: deterministic - same buildId always yields the same code', () => {
  const a = buildCodeFromBuildId('build-123');
  const b = buildCodeFromBuildId('build-123');
  assert.equal(a, b);
});

test('buildCodeFromBuildId: different buildId yields a different code', () => {
  assert.notEqual(buildCodeFromBuildId('build-123'), buildCodeFromBuildId('build-456'));
});

test('buildCodeFromBuildId: is exactly 10 characters (6 bytes of sha256, 2 padding bits)', () => {
  assert.equal(buildCodeFromBuildId('any-build-id').length, 10);
});

test('deriveBuildSecret: deterministic for the same master secret + buildCode', () => {
  const a = deriveBuildSecret('master-secret', 'ABCD1234');
  const b = deriveBuildSecret('master-secret', 'ABCD1234');
  assert.equal(a, b);
});

test('deriveBuildSecret: different master secret yields a different derived secret', () => {
  const a = deriveBuildSecret('master-secret-A', 'ABCD1234');
  const b = deriveBuildSecret('master-secret-B', 'ABCD1234');
  assert.notEqual(a, b);
});

test('deriveBuildSecret: different buildCode yields a different derived secret (build isolation)', () => {
  const a = deriveBuildSecret('master-secret', 'AAAAAAAA');
  const b = deriveBuildSecret('master-secret', 'BBBBBBBB');
  assert.notEqual(a, b);
});

test('computeResetCode: always exactly 6 digits, zero-padded', () => {
  for (let i = 0; i < 50; i++) {
    const code = computeResetCode('aa'.repeat(32), 'ABCD1234', `challenge-${i}`);
    assert.match(code, /^\d{6}$/);
  }
});

test('computeResetCode: deterministic for the same inputs', () => {
  const secret = deriveBuildSecret('master-secret', 'ABCD1234');
  const a = computeResetCode(secret, 'ABCD1234', 'CHALLENGE1');
  const b = computeResetCode(secret, 'ABCD1234', 'CHALLENGE1');
  assert.equal(a, b);
});

test('computeResetCode: different challenge yields a different code (no universal reusable code)', () => {
  const secret = deriveBuildSecret('master-secret', 'ABCD1234');
  const a = computeResetCode(secret, 'ABCD1234', 'CHALLENGE1');
  const b = computeResetCode(secret, 'ABCD1234', 'CHALLENGE2');
  assert.notEqual(a, b);
});

test('computeResetCode: different secret yields a different code (per-build isolation carries through)', () => {
  const secretA = deriveBuildSecret('master-secret', 'AAAAAAAA');
  const secretB = deriveBuildSecret('master-secret', 'BBBBBBBB');
  const a = computeResetCode(secretA, 'AAAAAAAA', 'CHALLENGE1');
  const b = computeResetCode(secretB, 'BBBBBBBB', 'CHALLENGE1');
  assert.notEqual(a, b);
});

test('buildResetConfig: shape and internal consistency with the individual functions', () => {
  const config = buildResetConfig('master-secret', 'build-789');
  assert.equal(config.version, 1);
  assert.equal(config.buildCode, buildCodeFromBuildId('build-789'));
  assert.equal(config.secret, deriveBuildSecret('master-secret', config.buildCode));
});

// Фиксированный вектор, ПОБАЙТОВО зеркальный
// packages/player/electron/chrono/resetCode.test.js (тот же masterSecret/
// buildId/challenge и те же ожидаемые buildCode/secret/code) — если
// формулы на двух сторонах разойдутся, один из двух тестовых файлов
// перестанет проходить, а не только "внутренне самосогласован".
test('cross-check vector: fixed inputs produce the exact code mirrored on the player side', () => {
  const masterSecret = 'test-master-secret-do-not-use-in-prod';
  const buildId = 'fixed-build-id-for-cross-check';
  const challenge = 'FIXEDCHALLENGE';

  const config = buildResetConfig(masterSecret, buildId);
  const code = computeResetCode(config.secret, config.buildCode, challenge);

  assert.equal(config.buildCode, 'H6THFHQJC0');
  assert.equal(config.secret, 'b9800c946a907194677727793117e7fdcf70cd8ba2e46bd55b77b01842036cb8');
  assert.equal(code, '936650');
});
