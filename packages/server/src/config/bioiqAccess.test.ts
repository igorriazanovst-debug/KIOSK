import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEmailAllowedForBioiq, projectDataHasBioiqWidget } from './bioiqAccess.ts';

test('isEmailAllowedForBioiq allows the known allow-listed email', () => {
  assert.equal(isEmailAllowedForBioiq('mokretcov.m@poznaikino.ru'), true);
});

test('isEmailAllowedForBioiq is case-insensitive', () => {
  assert.equal(isEmailAllowedForBioiq('MOKRETCOV.M@POZNAIKINO.RU'), true);
});

test('isEmailAllowedForBioiq rejects any other email', () => {
  assert.equal(isEmailAllowedForBioiq('someone.else@example.com'), false);
});

test('isEmailAllowedForBioiq rejects undefined/null/empty', () => {
  assert.equal(isEmailAllowedForBioiq(undefined), false);
  assert.equal(isEmailAllowedForBioiq(null), false);
  assert.equal(isEmailAllowedForBioiq(''), false);
});

test('projectDataHasBioiqWidget detects a bioiq widget among others', () => {
  assert.equal(
    projectDataHasBioiqWidget({ widgets: [{ type: 'text' }, { type: 'bioiq' }] }),
    true,
  );
});

test('projectDataHasBioiqWidget returns false when there is no bioiq widget', () => {
  assert.equal(projectDataHasBioiqWidget({ widgets: [{ type: 'text' }] }), false);
  assert.equal(projectDataHasBioiqWidget({}), false);
  assert.equal(projectDataHasBioiqWidget(null), false);
});
