// packages/player/src/periodictable/viewSettingsStorage.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadViewSettings, saveViewSettings, DEFAULT_VIEW_SETTINGS } from './viewSettingsStorage.ts';

test('loadViewSettings returns the default when window/localStorage is unavailable (Node test environment)', () => {
  assert.deepEqual(loadViewSettings(), DEFAULT_VIEW_SETTINGS);
});

test('saveViewSettings does not throw when window/localStorage is unavailable', () => {
  assert.doesNotThrow(() => saveViewSettings({ tableForm: 'iupac', colorIndication: 'none', highlight: 'metal' }));
});
