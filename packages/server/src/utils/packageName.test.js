import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizePackageName } from './packageName.js';

const DEB_NAME_RE = /^[a-z0-9][a-z0-9+.-]*$/;

test('sanitizePackageName leaves an already-valid appId unchanged', () => {
  assert.equal(sanitizePackageName('com.kiosk.app'), 'com.kiosk.app');
});

test('sanitizePackageName lowercases and strips characters Debian/RPM package names disallow', () => {
  const result = sanitizePackageName('Музей СВО');

  assert.match(result, DEB_NAME_RE);
  assert.ok(result.length >= 2);
});

test('sanitizePackageName replaces disallowed characters and collapses repeats', () => {
  assert.equal(sanitizePackageName('A_B   C!!'), 'a-b-c');
});

test('sanitizePackageName never starts with a non-alphanumeric character', () => {
  assert.equal(sanitizePackageName('---.foo'), 'foo');
});

test('sanitizePackageName falls back to a default for empty or non-string input', () => {
  assert.equal(sanitizePackageName(''), 'kiosk-app');
  assert.equal(sanitizePackageName(null), 'kiosk-app');
  assert.equal(sanitizePackageName(undefined), 'kiosk-app');
  assert.equal(sanitizePackageName('---'), 'kiosk-app');
});
