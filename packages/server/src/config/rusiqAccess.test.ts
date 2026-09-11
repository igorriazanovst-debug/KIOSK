import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEmailAllowedForRusiq, projectDataHasRusiqWidget } from './rusiqAccess.ts';

test('isEmailAllowedForRusiq allows the known allow-listed email', () => {
  assert.equal(isEmailAllowedForRusiq('mokretcov.m@poznaikino.ru'), true);
});

test('isEmailAllowedForRusiq is case-insensitive', () => {
  assert.equal(isEmailAllowedForRusiq('MOKRETCOV.M@POZNAIKINO.RU'), true);
});

test('isEmailAllowedForRusiq rejects any other email', () => {
  assert.equal(isEmailAllowedForRusiq('someone.else@example.com'), false);
});

test('isEmailAllowedForRusiq rejects undefined/null/empty', () => {
  assert.equal(isEmailAllowedForRusiq(undefined), false);
  assert.equal(isEmailAllowedForRusiq(null), false);
  assert.equal(isEmailAllowedForRusiq(''), false);
});

test('projectDataHasRusiqWidget detects a rusiq widget among others', () => {
  assert.equal(
    projectDataHasRusiqWidget({ widgets: [{ type: 'text' }, { type: 'rusiq' }] }),
    true,
  );
});

test('projectDataHasRusiqWidget returns false when there is no rusiq widget', () => {
  assert.equal(projectDataHasRusiqWidget({ widgets: [{ type: 'text' }] }), false);
  assert.equal(projectDataHasRusiqWidget({}), false);
  assert.equal(projectDataHasRusiqWidget(null), false);
});
