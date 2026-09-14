// packages/player/src/chimiq/userDataStorage.ts
// Хранение пользовательских данных (история результатов/настройки),
// отдельно от контента викторины. Тонкая обёртка над window.chimiqAPI
// (packages/player/electron/preload.js — Фаза 5, ещё не подключена).
// Прямая адаптация rusiq/userDataStorage.ts (Тип 7).
//
// До подключения electron IPC (Фаза 5) window.chimiqAPI не существует —
// loadUserData/saveUserData деградируют на FALLBACK/no-op, а не падают:
// то же поведение, что у rusiq до его собственной Фазы 5.

import { ChimiqUserDataSchema, CHIMIQ_USERDATA_SCHEMA_VERSION, type ChimiqUserData } from './model/schema.ts';

const FALLBACK: ChimiqUserData = {
  schemaVersion: CHIMIQ_USERDATA_SCHEMA_VERSION,
  sessions: [],
  soundOn: true,
  activeQuizId: null,
  teacherPinHash: null,
};

declare global {
  interface Window {
    chimiqAPI?: {
      loadUserData: () => Promise<unknown>;
      saveUserData: (data: ChimiqUserData) => Promise<{ ok: boolean }>;
    };
  }
}

export async function loadUserData(): Promise<ChimiqUserData> {
  if (typeof window === 'undefined' || !window.chimiqAPI) return FALLBACK;
  try {
    const raw = await window.chimiqAPI.loadUserData();
    const parsed = ChimiqUserDataSchema.safeParse(raw);
    return parsed.success ? parsed.data : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

export function saveUserData(data: ChimiqUserData): void {
  if (typeof window === 'undefined' || !window.chimiqAPI) return;
  window.chimiqAPI.saveUserData(data).catch(() => {
    // Ошибка записи не должна ронять UI — история просто не сохранится
    // на этот раз, следующий saveUserData попробует снова.
  });
}
