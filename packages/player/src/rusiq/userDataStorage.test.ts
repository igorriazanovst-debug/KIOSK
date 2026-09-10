// packages/player/src/rusiq/userDataStorage.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadUserData, saveUserData } from './userDataStorage.ts';

test('loadUserData returns a valid default when window.rusiqAPI is absent (non-Electron context)', async () => {
  // @ts-expect-error — тестовое окружение без window
  delete globalThis.window;
  const data = await loadUserData();
  assert.deepEqual(data, { schemaVersion: 1, sessions: [], soundOn: true });
});

test('saveUserData does nothing (does not throw) when window.rusiqAPI is absent', () => {
  // @ts-expect-error
  delete globalThis.window;
  assert.doesNotThrow(() => saveUserData({ schemaVersion: 1, sessions: [], soundOn: true }));
});

test('loadUserData falls back to defaults when the API returns malformed data', async () => {
  (globalThis as any).window = { rusiqAPI: { loadUserData: async () => ({ garbage: true }) } };
  const data = await loadUserData();
  assert.deepEqual(data, { schemaVersion: 1, sessions: [], soundOn: true });
});

test('saveUserData then loadUserData round-trips the same data', async () => {
  let stored: unknown = null;
  (globalThis as any).window = {
    rusiqAPI: {
      loadUserData: async () => stored,
      saveUserData: async (data: unknown) => { stored = data; return { ok: true }; },
    },
  };
  const data = { schemaVersion: 1 as const, sessions: [{ id: 's1', quizId: 'q1', playedAtIso: '2026-01-01T00:00:00.000Z', players: [{ name: 'Аня', score: 10, correctCount: 1, totalCount: 1 }] }], soundOn: false };
  saveUserData(data);
  await new Promise((r) => setTimeout(r, 0));
  const reloaded = await loadUserData();
  assert.deepEqual(reloaded, data);
});
