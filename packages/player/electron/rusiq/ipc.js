// packages/player/electron/rusiq/ipc.js
// Единственная точка, через которую рендерер (виджет «РусIQ») получает
// доступ к пользовательским данным (история результатов/настройки).
// Тот же принцип, что уже устоялся у chronoAPI/natcomAPI/mathmachineAPI
// (packages/player/electron/mathmachine/ipc.js) — вся файловая работа в
// main-процессе, мост через contextBridge (window.rusiqAPI), т.к. рендерер
// Electron в песочнице не имеет доступа к node:fs напрямую.

const fs = require('fs');
const path = require('path');

const RUSIQ_APP_DIR_NAME = 'kiosk-rusiq';
const USERDATA_FILE_NAME = 'userdata.json';

const FALLBACK_USER_DATA = { schemaVersion: 1, sessions: [], soundOn: true };

function resolveBaseDir(app) {
  try {
    const dir = path.join(app.getPath('appData'), RUSIQ_APP_DIR_NAME);
    fs.mkdirSync(dir, { recursive: true });
    return { baseDir: dir, isFallback: false };
  } catch (err) {
    const dir = path.join(require('os').tmpdir(), RUSIQ_APP_DIR_NAME);
    fs.mkdirSync(dir, { recursive: true });
    return { baseDir: dir, isFallback: true };
  }
}

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
function registerRusiqIpc({ ipcMain, app }) {
  const { baseDir, isFallback } = resolveBaseDir(app);
  const filePath = path.join(baseDir, USERDATA_FILE_NAME);

  ipcMain.handle('rusiq:load-user-data', () => readUserData(filePath));
  ipcMain.handle('rusiq:save-user-data', (_event, data) => {
    if (!isPlainRecord(data)) return { ok: false };
    writeUserDataAtomic(filePath, data);
    return { ok: true };
  });

  return { baseDir, isFallback };
}

module.exports = { registerRusiqIpc, readUserData, writeUserDataAtomic, resolveBaseDir };
