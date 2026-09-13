// packages/player/src/periodictable/viewSettingsStorage.ts
// Последний выбранный вид (форма таблицы/индикация/подсветка) — чистое
// UI-удобство конкретного устройства, не пользовательский прогресс (спека,
// разд. 9: в отличие от rusiq/mathmachine здесь нет прогресс-данных вообще,
// поэтому localStorage без IPC достаточно — не через window.periodictableAPI).
//
// Guard по `typeof window` — тот же принцип, что userDataStorage.ts у
// rusiq/mathmachine использует для window.rusiqAPI/window.mathmachineAPI:
// в тестовой среде `node --test` глобального window/localStorage нет
// вообще, обращение к нему без проверки — ReferenceError, а не просто
// "undefined".

import { z } from 'zod';
import { ColorIndicationSchema, HighlightModeSchema, TrendPropertySchema } from './viewTypes.ts';
import { TABLE_FORM_VALUES } from './tableLayout.ts';

const STORAGE_KEY = 'periodictable.viewSettings.v1';

// Built from tableLayout.ts's TABLE_FORM_VALUES, not a parallel
// `z.enum(['short', 'iupac'])` literal — the same single-source-of-truth
// principle already applied to ColorIndicationSchema/HighlightModeSchema
// below, extended to close the one remaining literal duplication found by
// the final whole-branch review.
export const TableFormSchema = z.enum(TABLE_FORM_VALUES);
// ColorIndicationSchema/HighlightModeSchema imported from viewTypes.ts
// (Task 6) — do NOT redeclare them here, that was the exact duplication
// this plan's Type Consistency self-review caught and fixed before Task 9
// shipped. TableScreen.tsx's prop types and this file's ViewSettingsSchema
// now derive from the same single definition.

export const ViewSettingsSchema = z.object({
  tableForm: TableFormSchema,
  colorIndication: ColorIndicationSchema,
  highlight: HighlightModeSchema,
  // Актуально только когда colorIndication === 'trend' — но поле хранится
  // всегда (проще, чем делать его optional и подставлять дефолт в трёх
  // местах, которые его читают). safeParse у ViewSettingsSchema в
  // loadViewSettings() отбрасывает старые сохранённые настройки, где этого
  // поля ещё нет, на DEFAULT_VIEW_SETTINGS целиком — миграция не нужна,
  // это чисто локальное per-device UI-состояние (см. комментарий выше).
  trendProperty: TrendPropertySchema,
});
export type ViewSettings = z.infer<typeof ViewSettingsSchema>;

export const DEFAULT_VIEW_SETTINGS: ViewSettings = {
  tableForm: 'short',
  colorIndication: 'class',
  highlight: 'none',
  trendProperty: 'atomicMass',
};

function hasLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function loadViewSettings(): ViewSettings {
  if (!hasLocalStorage()) return DEFAULT_VIEW_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_VIEW_SETTINGS;
    const parsed = ViewSettingsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_VIEW_SETTINGS;
  } catch {
    return DEFAULT_VIEW_SETTINGS;
  }
}

export function saveViewSettings(settings: ViewSettings): void {
  if (!hasLocalStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Приватный режим/квота — не критично, следующая попытка запишет снова.
  }
}
