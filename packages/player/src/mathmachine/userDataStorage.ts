// Хранение пользовательских данных (прогресс/настройки), отдельно от
// контента (спека, разд. 3). Атомарная запись — временный файл + rename
// (спека, разд. 9), чтобы обрыв записи не портил файл. `baseDir` — только
// для тестируемости; в бою всегда берётся системный каталог пользователя.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { MathMachineUserDataSchema, MATHMACHINE_USERDATA_SCHEMA_VERSION, type MathMachineUserData } from '@kiosk/shared';

function defaultBaseDir(): string {
  const base = process.env.APPDATA || path.join(os.homedir(), '.config');
  return path.join(base, 'kiosk-mathmachine');
}

function userDataPath(baseDir?: string): string {
  const dir = baseDir ?? defaultBaseDir();
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'userdata.json');
}

const FALLBACK: MathMachineUserData = {
  schemaVersion: MATHMACHINE_USERDATA_SCHEMA_VERSION,
  progress: {},
  soundOn: true,
};

export function loadUserData(baseDir?: string): MathMachineUserData {
  const filePath = userDataPath(baseDir);
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = MathMachineUserDataSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

export function saveUserData(data: MathMachineUserData, baseDir?: string): void {
  const filePath = userDataPath(baseDir);
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}
