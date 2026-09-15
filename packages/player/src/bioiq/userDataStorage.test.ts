// packages/player/src/bioiq/userDataStorage.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadUserData, saveUserData } from './userDataStorage.ts';
import { BIOIQ_USERDATA_SCHEMA_VERSION, type BioiqUserData } from './model/schema.ts';

const FALLBACK: BioiqUserData = {
  schemaVersion: BIOIQ_USERDATA_SCHEMA_VERSION,
  sessions: [],
  soundOn: true,
  boardZoomed: false,
  activeQuizId: null,
  teacherPinHash: null,
};

function withBioiqAPI<T>(api: Window['bioiqAPI'], fn: () => Promise<T>): Promise<T> {
  const original = (globalThis as any).window;
  (globalThis as any).window = { bioiqAPI: api };
  return fn().finally(() => {
    (globalThis as any).window = original;
  });
}

test('loadUserData returns the fallback, not corrupted, when window.bioiqAPI is unavailable', async () => {
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
  const saved: BioiqUserData = { ...FALLBACK, soundOn: false, sessions: [] };
  await withBioiqAPI(
    { loadUserData: async () => saved, saveUserData: async () => ({ ok: true }) },
    async () => {
      const result = await loadUserData();
      assert.deepEqual(result, { data: saved, corrupted: false });
    }
  );
});

// Находка при сверке с ТЗ (docs/bioiq-acceptance-matrix.md §3): раньше
// ЛЮБАЯ ошибка IPC (в т.ч. "файл повреждён") молча превращалась в пустой
// FALLBACK - от потери истории партий (FR-010) не оставалось и следа.
// Теперь BioiqRuntime должен узнать, что данные не загрузились НЕ потому,
// что их ещё не было, и показать предупреждение (см. BioiqRuntime.tsx).
test('loadUserData reports corrupted:true and falls back when the IPC call rejects (e.g. corrupted userdata.json)', async () => {
  await withBioiqAPI(
    {
      loadUserData: async () => {
        throw new Error('Файл данных БиоIQ повреждён: userdata.json');
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
  await withBioiqAPI(
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
    bioiqAPI: {
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
