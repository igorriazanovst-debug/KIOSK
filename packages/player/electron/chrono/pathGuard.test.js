import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { resolveWithinRoot, tryResolveWithinRoot, PathGuardError } from './pathGuard.js';

const ROOT = path.resolve('/safe/root');

test('resolveWithinRoot resolves a plain relative id inside root', () => {
  const result = resolveWithinRoot(ROOT, 'abc-123');
  assert.equal(result, path.join(ROOT, 'abc-123'));
});

test('resolveWithinRoot resolves a nested relative path inside root', () => {
  const result = resolveWithinRoot(ROOT, path.join('abc-123', 'media', 'x.png'));
  assert.equal(result, path.join(ROOT, 'abc-123', 'media', 'x.png'));
});

test('resolveWithinRoot rejects classic ../ traversal', () => {
  assert.throws(() => resolveWithinRoot(ROOT, '../../etc/passwd'), PathGuardError);
});

test('resolveWithinRoot rejects a traversal that starts inside root but escapes it', () => {
  assert.throws(() => resolveWithinRoot(ROOT, path.join('abc-123', '..', '..', 'etc')), PathGuardError);
});

test('resolveWithinRoot rejects an absolute path pointing entirely outside root', () => {
  const outside = process.platform === 'win32' ? 'D:\\evil' : '/etc/passwd';
  assert.throws(() => resolveWithinRoot(ROOT, outside), PathGuardError);
});

test('resolveWithinRoot rejects a sibling directory whose name is a prefix of root (no false accept via naive startsWith)', () => {
  // root = /safe/root, an attacker-controlled '../root-evil' must NOT be
  // accepted just because the string "root" is a textual prefix match.
  assert.throws(() => resolveWithinRoot(ROOT, '../root-evil'), PathGuardError);
});

test('resolveWithinRoot rejects a null byte in the path', () => {
  assert.throws(() => resolveWithinRoot(ROOT, 'abc\0def'), PathGuardError);
});

test('resolveWithinRoot rejects empty or non-string input', () => {
  assert.throws(() => resolveWithinRoot(ROOT, ''), PathGuardError);
  assert.throws(() => resolveWithinRoot(ROOT, null), PathGuardError);
  assert.throws(() => resolveWithinRoot(ROOT, undefined), PathGuardError);
});

test('tryResolveWithinRoot returns null instead of throwing on an invalid path', () => {
  assert.equal(tryResolveWithinRoot(ROOT, '../../etc/passwd'), null);
});

test('tryResolveWithinRoot returns the resolved path for a valid input', () => {
  assert.equal(tryResolveWithinRoot(ROOT, 'abc-123'), path.join(ROOT, 'abc-123'));
});
