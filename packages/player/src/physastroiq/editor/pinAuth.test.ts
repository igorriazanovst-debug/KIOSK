import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashSecret, verifySecret } from './pinAuth.ts';

test('hashSecret produces a 64-character hex SHA-256 digest', async () => {
  const hash = await hashSecret('1234');
  assert.equal(hash.length, 64);
  assert.match(hash, /^[0-9a-f]{64}$/);
});

test('hashSecret is deterministic for the same input', async () => {
  const a = await hashSecret('teacher-pin');
  const b = await hashSecret('teacher-pin');
  assert.equal(a, b);
});

test('hashSecret produces different hashes for different inputs', async () => {
  const a = await hashSecret('1234');
  const b = await hashSecret('4321');
  assert.notEqual(a, b);
});

test('verifySecret returns true for the matching plaintext', async () => {
  const hash = await hashSecret('correct-horse');
  assert.equal(await verifySecret('correct-horse', hash), true);
});

test('verifySecret returns false for a non-matching plaintext', async () => {
  const hash = await hashSecret('correct-horse');
  assert.equal(await verifySecret('wrong-guess', hash), false);
});

test('verifySecret returns false when hash is null (not yet set)', async () => {
  assert.equal(await verifySecret('anything', null), false);
});
