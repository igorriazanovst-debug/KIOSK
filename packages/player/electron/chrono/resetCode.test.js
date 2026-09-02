import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  crockfordEncode,
  computeResetCode,
  normalizeCode,
  parseResetConfig,
  getChallenge,
  verifyResetCode,
} from './resetCode.js';
import { isPasswordSet, verifyPassword } from './auth.js';

function tmpBaseDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'chrono-reset-'));
}

const CONFIG = { buildCode: 'H6THFHQJC0', secret: 'b9800c946a907194677727793117e7fdcf70cd8ba2e46bd55b77b01842036cb8' };

test('crockfordEncode: all-zero bytes encode to all-"0" characters', () => {
  assert.equal(crockfordEncode(Buffer.from([0, 0, 0, 0, 0])), '00000000');
});

test('normalizeCode: strips spaces and dashes users might type while dictating the code', () => {
  assert.equal(normalizeCode('123 456'), '123456');
  assert.equal(normalizeCode('123-456'), '123456');
  assert.equal(normalizeCode(' 123456 '), '123456');
});

test('parseResetConfig: extracts buildCode/secret from a well-formed project.json', () => {
  assert.deepEqual(parseResetConfig({ chronoReset: { version: 1, buildCode: 'ABCD1234', secret: 'aa' } }), {
    buildCode: 'ABCD1234',
    secret: 'aa',
  });
});

test('parseResetConfig: null for a project without chronoReset (old build, or no master secret at build time)', () => {
  assert.equal(parseResetConfig({}), null);
  assert.equal(parseResetConfig(null), null);
  assert.equal(parseResetConfig({ chronoReset: null }), null);
  assert.equal(parseResetConfig({ chronoReset: { buildCode: 'ABCD1234' } }), null); // secret отсутствует
});

// Тот же вектор, что и packages/server/src/utils/masterCode.test.js — если
// формулы разойдутся, один из двух файлов перестанет проходить.
test('cross-check vector: matches the server-side computeResetCode exactly', () => {
  const code = computeResetCode(CONFIG.secret, CONFIG.buildCode, 'FIXEDCHALLENGE');
  assert.equal(code, '936650');
});

test('getChallenge: unavailable when the build has no chronoReset config (old/local build)', () => {
  const baseDir = tmpBaseDir();
  const result = getChallenge(null, baseDir);
  assert.deepEqual(result, { available: false, locked: false, retryAfterMs: 0 });
});

test('getChallenge: returns the buildCode and a generated challenge when available', () => {
  const baseDir = tmpBaseDir();
  const result = getChallenge(CONFIG, baseDir);
  assert.equal(result.available, true);
  assert.equal(result.buildCode, CONFIG.buildCode);
  assert.match(result.challenge, /^[0-9A-HJKMNP-TV-Z]+$/);
  assert.equal(result.locked, false);
});

test('getChallenge: returns the SAME challenge on repeated calls (not regenerated every time)', () => {
  const baseDir = tmpBaseDir();
  const first = getChallenge(CONFIG, baseDir);
  const second = getChallenge(CONFIG, baseDir);
  assert.equal(first.challenge, second.challenge);
});

test('verifyResetCode: succeeds with the correct code, sets the new password, and unlocks', () => {
  const baseDir = tmpBaseDir();
  const { challenge } = getChallenge(CONFIG, baseDir);
  const code = computeResetCode(CONFIG.secret, CONFIG.buildCode, challenge);

  const result = verifyResetCode(CONFIG, baseDir, code, 'new-password-123');
  assert.deepEqual(result, { success: true, locked: false, retryAfterMs: 0 });
  assert.equal(isPasswordSet(baseDir), true);
  assert.equal(verifyPassword(baseDir, 'new-password-123').success, true);
});

test('verifyResetCode: accepts the code with spaces/dashes a user might type while dictating it', () => {
  const baseDir = tmpBaseDir();
  const { challenge } = getChallenge(CONFIG, baseDir);
  const code = computeResetCode(CONFIG.secret, CONFIG.buildCode, challenge);
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;

  const result = verifyResetCode(CONFIG, baseDir, spaced, 'new-password-123');
  assert.equal(result.success, true);
});

test('verifyResetCode: a correct code with a too-short new password fails cleanly, without burning the challenge or counting as a failed attempt', () => {
  const baseDir = tmpBaseDir();
  const { challenge } = getChallenge(CONFIG, baseDir);
  const code = computeResetCode(CONFIG.secret, CONFIG.buildCode, challenge);

  const result = verifyResetCode(CONFIG, baseDir, code, 'abc'); // короче MIN_PASSWORD_LENGTH
  assert.deepEqual(result, { success: false, locked: false, retryAfterMs: 0 });
  assert.equal(isPasswordSet(baseDir), false);

  // Challenge не сожжён - тот же код с валидным паролем всё ещё проходит.
  const retry = verifyResetCode(CONFIG, baseDir, code, 'valid-password-123');
  assert.equal(retry.success, true);
});

test('verifyResetCode: fails with a wrong code and does not change the password', () => {
  const baseDir = tmpBaseDir();
  getChallenge(CONFIG, baseDir);

  const result = verifyResetCode(CONFIG, baseDir, '000000', 'new-password-123');
  assert.equal(result.success, false);
  assert.equal(isPasswordSet(baseDir), false);
});

test('verifyResetCode: unavailable (no throw) when the build has no chronoReset config', () => {
  const baseDir = tmpBaseDir();
  const result = verifyResetCode(null, baseDir, '000000', 'new-password-123');
  assert.deepEqual(result, { success: false, locked: false, retryAfterMs: 0 });
});

test('verifyResetCode: fails without throwing when no challenge was ever requested', () => {
  const baseDir = tmpBaseDir();
  const result = verifyResetCode(CONFIG, baseDir, '123456', 'new-password-123');
  assert.equal(result.success, false);
});

test('verifyResetCode: the challenge is single-use - the same code fails on a second attempt after success', () => {
  const baseDir = tmpBaseDir();
  const { challenge } = getChallenge(CONFIG, baseDir);
  const code = computeResetCode(CONFIG.secret, CONFIG.buildCode, challenge);

  assert.equal(verifyResetCode(CONFIG, baseDir, code, 'first-password').success, true);
  assert.equal(verifyResetCode(CONFIG, baseDir, code, 'second-password').success, false);
});

test('verifyResetCode: repeated wrong guesses eventually lock out (separate counter from the password guard)', () => {
  const baseDir = tmpBaseDir();
  getChallenge(CONFIG, baseDir);

  let last;
  for (let i = 0; i < 5; i++) {
    last = verifyResetCode(CONFIG, baseDir, '000000', 'irrelevant-password');
  }
  assert.equal(last.locked, true);
  assert.ok(last.retryAfterMs > 0);
});

test('verifyResetCode: reset lockout does not affect the independent password-guard lockout', () => {
  const baseDir = tmpBaseDir();
  getChallenge(CONFIG, baseDir);
  for (let i = 0; i < 5; i++) {
    verifyResetCode(CONFIG, baseDir, '000000', 'irrelevant-password');
  }
  // Пароль ещё не задан на этом устройстве вовсе - троттлинг пароля тут
  // просто не участвует, но важно, что verifyResetCode не трогает auth.json.
  assert.equal(isPasswordSet(baseDir), false);
});

test('getChallenge: fails closed (locked) when resetGuard.json itself is corrupted, without healing it', () => {
  const baseDir = tmpBaseDir();
  fs.writeFileSync(path.join(baseDir, 'resetGuard.json'), 'not valid json{{{', 'utf8');

  const result = getChallenge(CONFIG, baseDir);
  assert.equal(result.available, true);
  assert.equal(result.locked, true);
  assert.ok(result.retryAfterMs > 0);
  assert.equal(result.challenge, undefined);
  // Не переписан свежими нулевыми счётчиками - иначе следующий вызов
  // видел бы "чистый" файл и троттлинг тихо снимался бы самим фактом
  // повреждения (это и был MEDIUM из security-review).
  assert.equal(fs.readFileSync(path.join(baseDir, 'resetGuard.json'), 'utf8'), 'not valid json{{{');
});

test('verifyResetCode: fails closed when resetGuard.json is corrupted, does not touch auth.json', () => {
  const baseDir = tmpBaseDir();
  fs.writeFileSync(path.join(baseDir, 'resetGuard.json'), 'not valid json{{{', 'utf8');

  const result = verifyResetCode(CONFIG, baseDir, '123456', 'new-password-123');
  assert.equal(result.success, false);
  assert.equal(result.locked, true);
  assert.ok(result.retryAfterMs > 0);
  assert.equal(isPasswordSet(baseDir), false);
});

test('works even when auth.json is corrupted - this IS the recovery path for that scenario', () => {
  const baseDir = tmpBaseDir();
  // Повреждённый auth.json - симулируем "битый файл" напрямую.
  fs.writeFileSync(path.join(baseDir, 'auth.json'), 'not valid json{{{', 'utf8');

  const { challenge } = getChallenge(CONFIG, baseDir);
  const code = computeResetCode(CONFIG.secret, CONFIG.buildCode, challenge);

  const result = verifyResetCode(CONFIG, baseDir, code, 'recovered-password');
  assert.equal(result.success, true);
  assert.equal(verifyPassword(baseDir, 'recovered-password').success, true);
});
