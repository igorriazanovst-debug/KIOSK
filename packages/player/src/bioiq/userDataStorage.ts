// packages/player/src/bioiq/userDataStorage.ts
// Хранение пользовательских данных (история результатов/настройки),
// отдельно от контента викторины. Тонкая обёртка над window.bioiqAPI
// (packages/player/electron/preload.js — Фаза 5, ещё не подключена).
// Прямая адаптация rusiq/userDataStorage.ts (Тип 7).
//
// Мост может отсутствовать: виджет открывают и в браузере редактора, где
// electron-а нет вовсе. Тогда loadUserData/saveUserData деградируют на
// FALLBACK и no-op, а не падают.
//
// ОТСУТСТВИЕ МОСТА И ПОВРЕЖДЁННЫЙ ФАЙЛ — РАЗНЫЕ СЛУЧАИ, и путать их нельзя.
// Первый штатен и молчит. Второй возвращает `corrupted: true`, и рантайм
// обязан сказать о нём педагогу: молчаливый откат к пустой истории выглядит
// как потеря накопленной статистики, а не как поломка файла. У Типа 4 этот
// самый класс дефекта однажды показал пустой список учеников вместо ошибки.

import { BioiqUserDataSchema, BIOIQ_USERDATA_SCHEMA_VERSION, type BioiqUserData } from './model/schema.ts';

const FALLBACK: BioiqUserData = {
  schemaVersion: BIOIQ_USERDATA_SCHEMA_VERSION,
  sessions: [],
  soundOn: true,
  boardZoomed: false,
  activeQuizId: null,
  teacherPinHash: null,
};

declare global {
  interface Window {
    bioiqAPI?: {
      loadUserData: () => Promise<unknown>;
      saveUserData: (data: BioiqUserData) => Promise<{ ok: boolean }>;
    };
  }
}

export interface LoadUserDataResult {
  data: BioiqUserData;
  // true, только когда данные РЕАЛЬНО были на диске, но не удалось их
  // использовать (IPC отклонён - см. BioiqStoreError в electron/bioiq/ipc.js
  // - либо содержимое не проходит схему). НЕ true на первом запуске, когда
  // файла ещё нет: отсутствие данных - не повреждение. Различие важно для
  // BioiqRuntime - молча откатываться к пустой истории партий на
  // повреждённом файле означало бы потерю статистики без предупреждения
  // (находка сверки с ТЗ, docs/bioiq-acceptance-matrix.md §3).
  corrupted: boolean;
}

export async function loadUserData(): Promise<LoadUserDataResult> {
  if (typeof window === 'undefined' || !window.bioiqAPI) return { data: FALLBACK, corrupted: false };
  let raw: unknown;
  try {
    raw = await window.bioiqAPI.loadUserData();
  } catch {
    return { data: FALLBACK, corrupted: true };
  }
  const parsed = BioiqUserDataSchema.safeParse(raw);
  return parsed.success ? { data: parsed.data, corrupted: false } : { data: FALLBACK, corrupted: true };
}

export function saveUserData(data: BioiqUserData): void {
  if (typeof window === 'undefined' || !window.bioiqAPI) return;
  window.bioiqAPI.saveUserData(data).catch(() => {
    // Ошибка записи не должна ронять UI — история просто не сохранится
    // на этот раз, следующий saveUserData попробует снова.
  });
}
