// userDataStorage — тонкая обёртка над window.mathmachineAPI (IPC-мост
// к main-процессу Electron). Тесты подставляют fake window.mathmachineAPI —
// та же файловая логика (атомарная запись, fallback на битые данные)
// реально проверяется отдельно в
// packages/player/electron/mathmachine/ipc.test.js, на стороне main-процесса.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadUserData, saveUserData } from './userDataStorage.ts';
import { MATHMACHINE_USERDATA_SCHEMA_VERSION, type MathMachineUserData } from '@kiosk/shared';

function installFakeApi(initial: unknown) {
  let stored = initial;
  (globalThis as any).window = {
    mathmachineAPI: {
      loadUserData: async () => stored,
      saveUserData: async (data: unknown) => {
        stored = data;
        return { ok: true };
      },
    },
  };
  return () => stored;
}

test('loadUserData returns a valid default when the API reports nothing usable', async () => {
  installFakeApi({ schemaVersion: MATHMACHINE_USERDATA_SCHEMA_VERSION, progress: {}, soundOn: true });
  const data = await loadUserData();
  assert.equal(data.schemaVersion, MATHMACHINE_USERDATA_SCHEMA_VERSION);
  assert.deepEqual(data.progress, {});
  assert.equal(data.soundOn, true);
});

test('saveUserData then loadUserData round-trips the same data', async () => {
  installFakeApi(undefined);
  const data: MathMachineUserData = {
    schemaVersion: MATHMACHINE_USERDATA_SCHEMA_VERSION,
    progress: { g1: { doneTaskIds: ['t1'], currentTaskId: 't2' } },
    soundOn: false,
  };
  saveUserData(data);
  // saveUserData сознательно fire-and-forget (не роняет UI на ошибке
  // записи) — даём микротаске сохранения отработать перед чтением.
  await Promise.resolve();
  const loaded = await loadUserData();
  assert.deepEqual(loaded, data);
});

test('loadUserData falls back to defaults when the API returns malformed data', async () => {
  installFakeApi('not an object');
  const data = await loadUserData();
  assert.deepEqual(data.progress, {});
});

test('loadUserData falls back to defaults when window.mathmachineAPI is absent (non-Electron context)', async () => {
  (globalThis as any).window = {};
  const data = await loadUserData();
  assert.deepEqual(data, { schemaVersion: MATHMACHINE_USERDATA_SCHEMA_VERSION, progress: {}, soundOn: true });
});

test('saveUserData does nothing (does not throw) when window.mathmachineAPI is absent', () => {
  (globalThis as any).window = {};
  assert.doesNotThrow(() => saveUserData({ schemaVersion: MATHMACHINE_USERDATA_SCHEMA_VERSION, progress: {}, soundOn: true }));
});
