// packages/player/src/chimiq/userDataStorage.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadUserData, saveUserData } from './userDataStorage.ts';
import { CHIMIQ_USERDATA_SCHEMA_VERSION, type ChimiqUserData } from './model/schema.ts';

const FALLBACK: ChimiqUserData = {
  schemaVersion: CHIMIQ_USERDATA_SCHEMA_VERSION,
  sessions: [],
  soundOn: true,
  boardZoomed: false,
  activeQuizId: null,
  teacherPinHash: null,
};

function withChimiqAPI<T>(api: Window['chimiqAPI'], fn: () => Promise<T>): Promise<T> {
  const original = (globalThis as any).window;
  (globalThis as any).window = { chimiqAPI: api };
  return fn().finally(() => {
    (globalThis as any).window = original;
  });
}

test('loadUserData returns the fallback, not corrupted, when window.chimiqAPI is unavailable', async () => {
  const original = (globalThis as any).window;
  (globalThis as any).window = {};
  try {
    const result = await loadUserData();
    assert.deepEqual(result, { data: FALLBACK, corrupted: false });
  } finally {
    (globalThis as any).window = original;
  }
});

test('loadUserData returns the loaded data, not corrupted, on a valid payload', async () => {
  const saved: ChimiqUserData = { ...FALLBACK, soundOn: false, sessions: [] };
  await withChimiqAPI(
    { loadUserData: async () => saved, saveUserData: async () => ({ ok: true }) },
    async () => {
      const result = await loadUserData();
      assert.deepEqual(result, { data: saved, corrupted: false });
    }
  );
});

// Находка при сверке с ТЗ (docs/chimiq-acceptance-matrix.md §3): раньше
// ЛЮБАЯ ошибка IPC (в т.ч. "файл повреждён") молча превращалась в пустой
// FALLBACK - от потери истории партий (FR-010) не оставалось и следа.
// Теперь ChimiqRuntime должен узнать, что данные не загрузились НЕ потому,
// что их ещё не было, и показать предупреждение (см. ChimiqRuntime.tsx).
test('loadUserData reports corrupted:true and falls back when the IPC call rejects (e.g. corrupted userdata.json)', async () => {
  await withChimiqAPI(
    {
      loadUserData: async () => {
        throw new Error('Файл данных ХимIQ повреждён: userdata.json');
      },
      saveUserData: async () => ({ ok: true }),
    },
    async () => {
      const result = await loadUserData();
      assert.deepEqual(result, { data: FALLBACK, corrupted: true });
    }
  );
});

test('loadUserData reports corrupted:true when the payload does not match the schema', async () => {
  await withChimiqAPI(
    { loadUserData: async () => ({ nonsense: true }), saveUserData: async () => ({ ok: true }) },
    async () => {
      const result = await loadUserData();
      assert.deepEqual(result, { data: FALLBACK, corrupted: true });
    }
  );
});

test('saveUserData does not throw when the IPC call rejects', () => {
  const original = (globalThis as any).window;
  (globalThis as any).window = {
    chimiqAPI: {
      loadUserData: async () => FALLBACK,
      saveUserData: async () => {
        throw new Error('disk full');
      },
    },
  };
  try {
    assert.doesNotThrow(() => saveUserData(FALLBACK));
  } finally {
    (globalThis as any).window = original;
  }
});
