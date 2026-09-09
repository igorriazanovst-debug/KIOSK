// packages/player/electron/mathmachine/ipc.js
// Единственная точка, через которую рендерер (виджет «Матемашка») получает
// доступ к пользовательским данным (прогресс/настройки). Раньше эти данные
// читались/писались напрямую через node:fs в рендерере — это давало чёрный
// экран при запуске, потому что рендерер-процесс Electron в песочнице не
// имеет доступа к node:fs. Исправлено переносом всей файловой работы в
// main-процесс и мостом через contextBridge (window.mathmachineAPI), тем же
// способом, что уже устоялся у chronoAPI/natcomAPI (packages/player/electron/chrono/ipc.js,
// packages/player/electron/natcom/ipc.js).

const fs = require('fs');
const path = require('path');

const MATHMACHINE_APP_DIR_NAME = 'kiosk-mathmachine';
const USERDATA_FILE_NAME = 'userdata.json';

const FALLBACK_USER_DATA = { schemaVersion: 1, progress: {}, soundOn: true };

function resolveBaseDir(app) {
  try {
    const dir = path.join(app.getPath('appData'), MATHMACHINE_APP_DIR_NAME);
    fs.mkdirSync(dir, { recursive: true });
    return { baseDir: dir, isFallback: false };
  } catch (err) {
    const dir = path.join(require('os').tmpdir(), MATHMACHINE_APP_DIR_NAME);
    fs.mkdirSync(dir, { recursive: true });
    return { baseDir: dir, isFallback: true };
  }
}

/**
 * Простая, но настоящая валидация формы (без завязки на zod здесь, чтобы
 * electron/main.js не тянул @kiosk/shared как рантайм-зависимость главного
 * процесса — та же осторожность, что и у остальных ipc.js в этом каталоге).
 * Настоящая полная валидация схемой всё равно происходит на стороне
 * рендерера при чтении ответа (userDataStorage.ts использует
 * MathMachineUserDataSchema.safeParse).
 */
function isPlainRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readUserData(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!isPlainRecord(parsed)) return FALLBACK_USER_DATA;
    return parsed;
  } catch {
    return FALLBACK_USER_DATA;
  }
}

function writeUserDataAtomic(filePath, data) {
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

/**
 * @param {{ ipcMain: import('electron').IpcMain, app: import('electron').App }} deps
 */
function registerMathmachineIpc({ ipcMain, app }) {
  const { baseDir, isFallback } = resolveBaseDir(app);
  const filePath = path.join(baseDir, USERDATA_FILE_NAME);

  ipcMain.handle('mathmachine:load-user-data', () => readUserData(filePath));
  ipcMain.handle('mathmachine:save-user-data', (_event, data) => {
    if (!isPlainRecord(data)) return { ok: false };
    writeUserDataAtomic(filePath, data);
    return { ok: true };
  });

  return { baseDir, isFallback };
}

module.exports = { registerMathmachineIpc, readUserData, writeUserDataAtomic, resolveBaseDir };
