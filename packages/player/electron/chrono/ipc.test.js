import { test } from 'node:test';
import assert from 'node:assert/strict';
import { translateDiskError } from './ipc.js';

test('translateDiskError: ENOSPC becomes a clear Russian "out of disk space" message', () => {
  const err = Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' });
  const translated = translateDiskError(err);
  assert.match(translated.message, /закончилось место на диске/);
});

test('translateDiskError: EACCES/EPERM become a clear Russian "no write permission" message', () => {
  for (const code of ['EACCES', 'EPERM']) {
    const err = Object.assign(new Error('permission denied'), { code });
    const translated = translateDiskError(err);
    assert.match(translated.message, /Нет прав на запись/);
  }
});

test('translateDiskError: any other Error passes through unchanged (identity preserved)', () => {
  const err = new Error('some other failure');
  assert.equal(translateDiskError(err), err);
});

test('translateDiskError: preserves custom Error subclasses (e.g. AuthConfigCorruptedError) unchanged', () => {
  class CustomError extends Error {}
  const err = new CustomError('custom message');
  const translated = translateDiskError(err);
  assert.equal(translated, err);
  assert.ok(translated instanceof CustomError);
});

test('translateDiskError: a non-Error thrown value is wrapped into an Error', () => {
  const translated = translateDiskError('a plain string throw');
  assert.ok(translated instanceof Error);
  assert.equal(translated.message, 'a plain string throw');
});
