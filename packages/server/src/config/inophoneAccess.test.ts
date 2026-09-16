import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEmailAllowedForInophone, projectDataHasInophoneWidget } from './inophoneAccess.ts';

test('isEmailAllowedForInophone allows the known allow-listed email', () => {
  assert.equal(isEmailAllowedForInophone('mokretcov.m@poznaikino.ru'), true);
});

test('isEmailAllowedForInophone is case-insensitive', () => {
  assert.equal(isEmailAllowedForInophone('MOKRETCOV.M@POZNAIKINO.RU'), true);
});

test('isEmailAllowedForInophone rejects any other email', () => {
  assert.equal(isEmailAllowedForInophone('someone.else@example.com'), false);
});

test('isEmailAllowedForInophone rejects undefined/null/empty', () => {
  assert.equal(isEmailAllowedForInophone(undefined), false);
  assert.equal(isEmailAllowedForInophone(null), false);
  assert.equal(isEmailAllowedForInophone(''), false);
});

test('projectDataHasInophoneWidget detects an inophone widget among others', () => {
  assert.equal(
    projectDataHasInophoneWidget({ widgets: [{ type: 'text' }, { type: 'inophone' }] }),
    true,
  );
});

test('projectDataHasInophoneWidget returns false when there is no inophone widget', () => {
  assert.equal(projectDataHasInophoneWidget({ widgets: [{ type: 'text' }] }), false);
  assert.equal(projectDataHasInophoneWidget({}), false);
  assert.equal(projectDataHasInophoneWidget(null), false);
});
