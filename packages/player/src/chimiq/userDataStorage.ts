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
  boardZoomed: false,
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

export interface LoadUserDataResult {
  data: ChimiqUserData;
  // true, только когда данные РЕАЛЬНО были на диске, но не удалось их
  // использовать (IPC отклонён - см. ChimiqStoreError в electron/chimiq/ipc.js
  // - либо содержимое не проходит схему). НЕ true на первом запуске, когда
  // файла ещё нет: отсутствие данных - не повреждение. Различие важно для
  // ChimiqRuntime - молча откатываться к пустой истории партий на
  // повреждённом файле означало бы потерю статистики без предупреждения
  // (находка сверки с ТЗ, docs/chimiq-acceptance-matrix.md §3).
  corrupted: boolean;
}

export async function loadUserData(): Promise<LoadUserDataResult> {
  if (typeof window === 'undefined' || !window.chimiqAPI) return { data: FALLBACK, corrupted: false };
  let raw: unknown;
  try {
    raw = await window.chimiqAPI.loadUserData();
  } catch {
    return { data: FALLBACK, corrupted: true };
  }
  const parsed = ChimiqUserDataSchema.safeParse(raw);
  return parsed.success ? { data: parsed.data, corrupted: false } : { data: FALLBACK, corrupted: true };
}

export function saveUserData(data: ChimiqUserData): void {
  if (typeof window === 'undefined' || !window.chimiqAPI) return;
  window.chimiqAPI.saveUserData(data).catch(() => {
    // Ошибка записи не должна ронять UI — история просто не сохранится
    // на этот раз, следующий saveUserData попробует снова.
  });
}
