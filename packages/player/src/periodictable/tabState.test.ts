// packages/player/src/periodictable/tabState.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toggleTab, shouldClearHighlight, decideViewSettingsClick } from './tabState.ts';

test('toggleTab closes the tab when clicking the already-open one', () => {
  assert.equal(toggleTab('search', 'search'), 'none');
  assert.equal(toggleTab('legend', 'legend'), 'none');
});

test('toggleTab opens the clicked tab when a different one (or none) is active', () => {
  assert.equal(toggleTab('none', 'search'), 'search');
  assert.equal(toggleTab('legend', 'search'), 'search');
  assert.equal(toggleTab('viewSettings', 'legend'), 'legend');
});

test('shouldClearHighlight is false only while search stays open', () => {
  assert.equal(shouldClearHighlight('search'), false);
  assert.equal(shouldClearHighlight('none'), true);
  assert.equal(shouldClearHighlight('viewSettings'), true);
  assert.equal(shouldClearHighlight('legend'), true);
});

test('decideViewSettingsClick closes the tab if it is already open, regardless of lock state', () => {
  assert.deepEqual(decideViewSettingsClick('viewSettings', false, '1234'), { action: 'close' });
  assert.deepEqual(decideViewSettingsClick('viewSettings', true, ''), { action: 'close' });
});

test('decideViewSettingsClick opens directly once already unlocked', () => {
  assert.deepEqual(decideViewSettingsClick('none', true, '1234'), { action: 'openDirectly' });
});

test('decideViewSettingsClick opens directly when the PIN is empty (lock disabled) — regression for the dead-tab defect', () => {
  assert.deepEqual(decideViewSettingsClick('none', false, ''), { action: 'openDirectly' });
});

test('decideViewSettingsClick shows the PIN modal when locked and a non-empty PIN is configured', () => {
  assert.deepEqual(decideViewSettingsClick('none', false, '1234'), { action: 'showPinModal' });
  assert.deepEqual(decideViewSettingsClick('search', false, '0000'), { action: 'showPinModal' });
});
