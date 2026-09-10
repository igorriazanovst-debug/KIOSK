// packages/player/src/rusiq/userDataStorage.ts
// Хранение пользовательских данных (история результатов/настройки),
// отдельно от контента викторины. Тонкая обёртка над window.rusiqAPI
// (packages/player/electron/preload.js), тот же способ, что у
// chronoAPI/natcomAPI/mathmachineAPI.

import { RusiqUserDataSchema, RUSIQ_USERDATA_SCHEMA_VERSION, type RusiqUserData } from './model/schema.ts';

const FALLBACK: RusiqUserData = {
  schemaVersion: RUSIQ_USERDATA_SCHEMA_VERSION,
  sessions: [],
  soundOn: true,
};

declare global {
  interface Window {
    rusiqAPI?: {
      loadUserData: () => Promise<unknown>;
      saveUserData: (data: RusiqUserData) => Promise<{ ok: boolean }>;
    };
  }
}

export async function loadUserData(): Promise<RusiqUserData> {
  if (typeof window === 'undefined' || !window.rusiqAPI) return FALLBACK;
  try {
    const raw = await window.rusiqAPI.loadUserData();
    const parsed = RusiqUserDataSchema.safeParse(raw);
    return parsed.success ? parsed.data : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

export function saveUserData(data: RusiqUserData): void {
  if (typeof window === 'undefined' || !window.rusiqAPI) return;
  window.rusiqAPI.saveUserData(data).catch(() => {
    // Ошибка записи не должна ронять UI — история просто не сохранится
    // на этот раз, следующий saveUserData попробует снова.
  });
}
