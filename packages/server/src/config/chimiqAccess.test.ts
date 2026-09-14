import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEmailAllowedForChimiq, projectDataHasChimiqWidget } from './chimiqAccess.ts';

test('isEmailAllowedForChimiq allows the known allow-listed email', () => {
  assert.equal(isEmailAllowedForChimiq('mokretcov.m@poznaikino.ru'), true);
});

test('isEmailAllowedForChimiq is case-insensitive', () => {
  assert.equal(isEmailAllowedForChimiq('MOKRETCOV.M@POZNAIKINO.RU'), true);
});

test('isEmailAllowedForChimiq rejects any other email', () => {
  assert.equal(isEmailAllowedForChimiq('someone.else@example.com'), false);
});

test('isEmailAllowedForChimiq rejects undefined/null/empty', () => {
  assert.equal(isEmailAllowedForChimiq(undefined), false);
  assert.equal(isEmailAllowedForChimiq(null), false);
  assert.equal(isEmailAllowedForChimiq(''), false);
});

test('projectDataHasChimiqWidget detects a chimiq widget among others', () => {
  assert.equal(
    projectDataHasChimiqWidget({ widgets: [{ type: 'text' }, { type: 'chimiq' }] }),
    true,
  );
});

test('projectDataHasChimiqWidget returns false when there is no chimiq widget', () => {
  assert.equal(projectDataHasChimiqWidget({ widgets: [{ type: 'text' }] }), false);
  assert.equal(projectDataHasChimiqWidget({}), false);
  assert.equal(projectDataHasChimiqWidget(null), false);
});
