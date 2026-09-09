// Хранение пользовательских данных (прогресс/настройки), отдельно от
// контента (спека, разд. 3). Атомарная запись — временный файл + rename
// (спека, разд. 9) — но само чтение/запись файла происходит в
// main-процессе Electron, не здесь: рендерер-процесс в песочнице Electron
// не имеет доступа к node:fs напрямую (найдено вживую при первом запуске —
// давало полностью чёрный экран). Этот модуль — тонкая обёртка над
// window.mathmachineAPI (packages/player/electron/preload.js), тем же
// способом, что уже устоялся у chronoAPI/natcomAPI.

import { MathMachineUserDataSchema, MATHMACHINE_USERDATA_SCHEMA_VERSION, type MathMachineUserData } from '@kiosk/shared';

const FALLBACK: MathMachineUserData = {
  schemaVersion: MATHMACHINE_USERDATA_SCHEMA_VERSION,
  progress: {},
  soundOn: true,
};

declare global {
  interface Window {
    mathmachineAPI?: {
      loadUserData: () => Promise<unknown>;
      saveUserData: (data: MathMachineUserData) => Promise<{ ok: boolean }>;
    };
  }
}

export async function loadUserData(): Promise<MathMachineUserData> {
  if (!window.mathmachineAPI) return FALLBACK;
  try {
    const raw = await window.mathmachineAPI.loadUserData();
    const parsed = MathMachineUserDataSchema.safeParse(raw);
    return parsed.success ? parsed.data : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

export function saveUserData(data: MathMachineUserData): void {
  if (!window.mathmachineAPI) return;
  window.mathmachineAPI.saveUserData(data).catch(() => {
    // Ошибка записи не должна ронять UI — прогресс просто не сохранится
    // на этот раз, следующий saveUserData (после следующего ответа
    // ребёнка) попробует снова.
  });
}
