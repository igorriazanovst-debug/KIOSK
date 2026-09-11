import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEmailAllowedForPeriodicTable, projectDataHasPeriodicTableWidget } from './periodicTableAccess.ts';

test('isEmailAllowedForPeriodicTable allows the designated email, case-insensitively', () => {
  assert.equal(isEmailAllowedForPeriodicTable('mokretcov.m@poznaikino.ru'), true);
  assert.equal(isEmailAllowedForPeriodicTable('MOKRETCOV.M@POZNAIKINO.RU'), true);
});

test('isEmailAllowedForPeriodicTable denies other emails and empty input', () => {
  assert.equal(isEmailAllowedForPeriodicTable('test@kiosk.local'), false);
  assert.equal(isEmailAllowedForPeriodicTable(undefined), false);
  assert.equal(isEmailAllowedForPeriodicTable(null), false);
});

test('projectDataHasPeriodicTableWidget detects the widget among other widgets', () => {
  assert.equal(
    projectDataHasPeriodicTableWidget({ widgets: [{ type: 'text' }, { type: 'periodictable' }] }),
    true,
  );
});

test('projectDataHasPeriodicTableWidget returns false when absent or malformed', () => {
  assert.equal(projectDataHasPeriodicTableWidget({ widgets: [{ type: 'text' }] }), false);
  assert.equal(projectDataHasPeriodicTableWidget(null), false);
  assert.equal(projectDataHasPeriodicTableWidget({}), false);
});
