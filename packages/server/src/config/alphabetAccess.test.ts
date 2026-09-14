import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEmailAllowedForAlphabet, projectDataHasAlphabetWidget } from './alphabetAccess.ts';

test('isEmailAllowedForAlphabet allows the known allow-listed email', () => {
  assert.equal(isEmailAllowedForAlphabet('mokretcov.m@poznaikino.ru'), true);
});

test('isEmailAllowedForAlphabet is case-insensitive', () => {
  assert.equal(isEmailAllowedForAlphabet('MOKRETCOV.M@POZNAIKINO.RU'), true);
});

test('isEmailAllowedForAlphabet rejects any other email', () => {
  assert.equal(isEmailAllowedForAlphabet('someone.else@example.com'), false);
});

test('isEmailAllowedForAlphabet rejects undefined/null/empty', () => {
  assert.equal(isEmailAllowedForAlphabet(undefined), false);
  assert.equal(isEmailAllowedForAlphabet(null), false);
  assert.equal(isEmailAllowedForAlphabet(''), false);
});

test('projectDataHasAlphabetWidget detects an alphabet widget among others', () => {
  assert.equal(
    projectDataHasAlphabetWidget({ widgets: [{ type: 'text' }, { type: 'alphabet' }] }),
    true,
  );
});

test('projectDataHasAlphabetWidget returns false when there is no alphabet widget', () => {
  assert.equal(projectDataHasAlphabetWidget({ widgets: [{ type: 'text' }] }), false);
  assert.equal(projectDataHasAlphabetWidget({}), false);
  assert.equal(projectDataHasAlphabetWidget(null), false);
});
