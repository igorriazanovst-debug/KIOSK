import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
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
} from './auth.js';

function tmpBaseDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'chrono-auth-'));
}

test('isPasswordSet is false on a fresh device, true after setPassword', () => {
  const baseDir = tmpBaseDir();
  assert.equal(isPasswordSet(baseDir), false);

  setPassword(baseDir, 'sekret123');
  assert.equal(isPasswordSet(baseDir), true);
});

test('verifyPassword succeeds with the correct password and resets the failure counter', () => {
  const baseDir = tmpBaseDir();
  setPassword(baseDir, 'correct-horse');

  const result = verifyPassword(baseDir, 'correct-horse');
  assert.deepEqual(result, { success: true, locked: false, retryAfterMs: 0 });
});

test('verifyPassword fails with the wrong password', () => {
  const baseDir = tmpBaseDir();
  setPassword(baseDir, 'correct-horse');

  const result = verifyPassword(baseDir, 'wrong-guess');
  assert.equal(result.success, false);
  assert.equal(result.locked, false);
});

test('verifyPassword against a device with no password ever set fails without throwing', () => {
  const baseDir = tmpBaseDir();
  assert.doesNotThrow(() => {
    const result = verifyPassword(baseDir, 'anything');
    assert.equal(result.success, false);
  });
});

test(`after ${LOCKOUT_THRESHOLD} consecutive wrong attempts, the device locks out`, () => {
  const baseDir = tmpBaseDir();
  setPassword(baseDir, 'correct-horse');

  let last;
  for (let i = 0; i < LOCKOUT_THRESHOLD; i++) {
    last = verifyPassword(baseDir, 'wrong');
  }

  assert.equal(last.locked, true);
  assert.ok(last.retryAfterMs > 0);
  assert.equal(checkLockout(baseDir).locked, true);
});

test('verifyPassword rejects even the CORRECT password while locked out - no bypass', () => {
  const baseDir = tmpBaseDir();
  setPassword(baseDir, 'correct-horse');

  for (let i = 0; i < LOCKOUT_THRESHOLD; i++) verifyPassword(baseDir, 'wrong');

  const result = verifyPassword(baseDir, 'correct-horse');
  assert.equal(result.success, false);
  assert.equal(result.locked, true);
});

test('setPassword clears any existing lockout - changing the password is not itself an attempt', () => {
  const baseDir = tmpBaseDir();
  setPassword(baseDir, 'old-password');
  for (let i = 0; i < LOCKOUT_THRESHOLD; i++) verifyPassword(baseDir, 'wrong');
  assert.equal(checkLockout(baseDir).locked, true);

  setPassword(baseDir, 'new-password');

  assert.equal(checkLockout(baseDir).locked, false);
  assert.equal(verifyPassword(baseDir, 'new-password').success, true);
});

test('checkLockout on a device that was never locked returns locked: false', () => {
  const baseDir = tmpBaseDir();
  setPassword(baseDir, 'correct-horse');
  assert.deepEqual(checkLockout(baseDir), { locked: false, retryAfterMs: 0 });
});

// ─── changePassword (used by the IPC layer - the security-relevant gate) ──

test('changePassword on a device with no password yet succeeds without a current password', () => {
  const baseDir = tmpBaseDir();
  const result = changePassword(baseDir, 'first-password');

  assert.equal(result.success, true);
  assert.equal(verifyPassword(baseDir, 'first-password').success, true);
});

test('changePassword requires the correct current password once one is set', () => {
  const baseDir = tmpBaseDir();
  setPassword(baseDir, 'old-password');

  const wrongAttempt = changePassword(baseDir, 'new-password', 'not-the-old-one');
  assert.equal(wrongAttempt.success, false);
  assert.equal(verifyPassword(baseDir, 'old-password').success, true, 'password must be unchanged after a rejected change');

  const rightAttempt = changePassword(baseDir, 'new-password', 'old-password');
  assert.equal(rightAttempt.success, true);
});

test('changePassword without providing currentPassword at all is rejected once a password exists (renderer cannot skip the check)', () => {
  const baseDir = tmpBaseDir();
  setPassword(baseDir, 'old-password');

  const result = changePassword(baseDir, 'new-password');
  assert.equal(result.success, false);
});

test('changePassword respects lockout - cannot brute-force the current password through the change endpoint either', () => {
  const baseDir = tmpBaseDir();
  setPassword(baseDir, 'old-password');
  for (let i = 0; i < LOCKOUT_THRESHOLD; i++) verifyPassword(baseDir, 'wrong');

  const result = changePassword(baseDir, 'new-password', 'old-password');
  assert.equal(result.success, false);
  assert.equal(result.locked, true);
});

// ─── minimum password length enforced server-side, not just in the UI ────

test(`setPassword rejects a password shorter than MIN_PASSWORD_LENGTH (${MIN_PASSWORD_LENGTH})`, () => {
  const baseDir = tmpBaseDir();
  assert.throws(() => setPassword(baseDir, 'a'.repeat(MIN_PASSWORD_LENGTH - 1)));
  assert.equal(isPasswordSet(baseDir), false, 'a rejected setPassword must not leave a partial config on disk');
});

test('changePassword rejects a too-short new password even with the correct current password', () => {
  const baseDir = tmpBaseDir();
  setPassword(baseDir, 'old-password');

  assert.throws(() => changePassword(baseDir, 'ab', 'old-password'));
  assert.equal(verifyPassword(baseDir, 'old-password').success, true, 'old password must still work - rejected change must not partially apply');
});

// ─── fail-closed when auth.json exists but is corrupted/malformed ─────────
// (security-review finding: readJsonOrNull used to collapse "never
// configured" and "corrupted" into the same null, silently reopening
// editing on a device that previously had a password)

test('isPasswordSet is true (fail-closed) when auth.json exists but is not valid JSON', () => {
  const baseDir = tmpBaseDir();
  setPassword(baseDir, 'correct-horse');
  fs.writeFileSync(authFilePath(baseDir), '{ not valid json');

  assert.equal(isPasswordSet(baseDir), true);
});

test('isPasswordSet is true (fail-closed) when auth.json is valid JSON but missing required fields', () => {
  const baseDir = tmpBaseDir();
  fs.writeFileSync(authFilePath(baseDir), JSON.stringify({}));

  assert.equal(isPasswordSet(baseDir), true);
});

test('verifyPassword throws AuthConfigCorruptedError on a corrupted auth.json instead of silently rejecting the password', () => {
  const baseDir = tmpBaseDir();
  setPassword(baseDir, 'correct-horse');
  fs.writeFileSync(authFilePath(baseDir), 'garbage');

  assert.throws(() => verifyPassword(baseDir, 'correct-horse'), AuthConfigCorruptedError);
});

test('changePassword also fails closed (throws) against a corrupted auth.json, does not let a new password overwrite it silently', () => {
  const baseDir = tmpBaseDir();
  setPassword(baseDir, 'correct-horse');
  fs.writeFileSync(authFilePath(baseDir), 'garbage');

  assert.throws(() => changePassword(baseDir, 'new-password', 'correct-horse'));
});

// ─── lockoutDurationForAttempt (pure escalation curve) ────────────────────

test('lockoutDurationForAttempt is 0 below the threshold', () => {
  assert.equal(lockoutDurationForAttempt(LOCKOUT_THRESHOLD - 1), 0);
});

test('lockoutDurationForAttempt escalates by doubling every LOCKOUT_THRESHOLD failures past the first lockout', () => {
  const first = lockoutDurationForAttempt(LOCKOUT_THRESHOLD);
  const second = lockoutDurationForAttempt(LOCKOUT_THRESHOLD * 2);
  const third = lockoutDurationForAttempt(LOCKOUT_THRESHOLD * 3);

  assert.equal(second, first * 2);
  assert.equal(third, first * 4);
});

test('lockoutDurationForAttempt is capped and never grows unbounded', () => {
  const huge = lockoutDurationForAttempt(LOCKOUT_THRESHOLD * 1000);
  assert.ok(Number.isFinite(huge));
  assert.ok(huge <= 60 * 60_000);
});
