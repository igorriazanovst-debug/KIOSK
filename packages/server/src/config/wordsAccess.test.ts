import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEmailAllowedForWords, projectDataHasWordsWidget } from './wordsAccess.ts';

test('isEmailAllowedForWords allows the known allow-listed email', () => {
  assert.equal(isEmailAllowedForWords('mokretcov.m@poznaikino.ru'), true);
});

test('isEmailAllowedForWords is case-insensitive', () => {
  assert.equal(isEmailAllowedForWords('MOKRETCOV.M@POZNAIKINO.RU'), true);
});

test('isEmailAllowedForWords rejects any other email', () => {
  assert.equal(isEmailAllowedForWords('someone.else@example.com'), false);
});

test('isEmailAllowedForWords rejects undefined/null/empty', () => {
  assert.equal(isEmailAllowedForWords(undefined), false);
  assert.equal(isEmailAllowedForWords(null), false);
  assert.equal(isEmailAllowedForWords(''), false);
});

test('projectDataHasWordsWidget detects a words widget among others', () => {
  assert.equal(
    projectDataHasWordsWidget({ widgets: [{ type: 'text' }, { type: 'words' }] }),
    true,
  );
});

test('projectDataHasWordsWidget returns false when there is no words widget', () => {
  assert.equal(projectDataHasWordsWidget({ widgets: [{ type: 'text' }] }), false);
  assert.equal(projectDataHasWordsWidget({}), false);
  assert.equal(projectDataHasWordsWidget(null), false);
});
