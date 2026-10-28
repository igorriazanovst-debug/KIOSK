import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEmailAllowedForEumk, projectDataHasEumkWidget } from './eumkAccess.ts';

test('isEmailAllowedForEumk allows the allow-listed email regardless of case', () => {
  assert.equal(isEmailAllowedForEumk('admin@kiosk.local'), true);
  assert.equal(isEmailAllowedForEumk('ADMIN@KIOSK.LOCAL'), true);
});

test('isEmailAllowedForEumk rejects other emails and empty values', () => {
  assert.equal(isEmailAllowedForEumk('someone.else@example.com'), false);
  assert.equal(isEmailAllowedForEumk(undefined), false);
  assert.equal(isEmailAllowedForEumk(null), false);
  assert.equal(isEmailAllowedForEumk(''), false);
});

test('projectDataHasEumkWidget detects an eumk widget among others', () => {
  assert.equal(projectDataHasEumkWidget({ widgets: [{ type: 'text' }, { type: 'eumk' }] }), true);
});

test('projectDataHasEumkWidget is false without an eumk widget or on bad input', () => {
  assert.equal(projectDataHasEumkWidget({ widgets: [{ type: 'text' }] }), false);
  assert.equal(projectDataHasEumkWidget({}), false);
  assert.equal(projectDataHasEumkWidget(null), false);
});
