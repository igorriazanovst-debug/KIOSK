import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEmailAllowedForPhysastroiq, projectDataHasPhysastroiqWidget } from './physastroiqAccess.ts';

test('isEmailAllowedForPhysastroiq allows the known allow-listed email', () => {
  assert.equal(isEmailAllowedForPhysastroiq('mokretcov.m@poznaikino.ru'), true);
});

test('isEmailAllowedForPhysastroiq is case-insensitive', () => {
  assert.equal(isEmailAllowedForPhysastroiq('MOKRETCOV.M@POZNAIKINO.RU'), true);
});

test('isEmailAllowedForPhysastroiq rejects any other email', () => {
  assert.equal(isEmailAllowedForPhysastroiq('someone.else@example.com'), false);
});

test('isEmailAllowedForPhysastroiq rejects undefined/null/empty', () => {
  assert.equal(isEmailAllowedForPhysastroiq(undefined), false);
  assert.equal(isEmailAllowedForPhysastroiq(null), false);
  assert.equal(isEmailAllowedForPhysastroiq(''), false);
});

test('projectDataHasPhysastroiqWidget detects a physastroiq widget among others', () => {
  assert.equal(
    projectDataHasPhysastroiqWidget({ widgets: [{ type: 'text' }, { type: 'physastroiq' }] }),
    true,
  );
});

test('projectDataHasPhysastroiqWidget returns false when there is no physastroiq widget', () => {
  assert.equal(projectDataHasPhysastroiqWidget({ widgets: [{ type: 'text' }] }), false);
  assert.equal(projectDataHasPhysastroiqWidget({}), false);
  assert.equal(projectDataHasPhysastroiqWidget(null), false);
});
