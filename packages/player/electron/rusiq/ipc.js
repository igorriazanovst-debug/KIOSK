// packages/player/electron/rusiq/ipc.js
// Единственная точка, через которую рендерер (виджет «РусIQ») получает
// доступ к пользовательским данным (история результатов/настройки).
// Тот же принцип, что уже устоялся у chronoAPI/natcomAPI/mathmachineAPI
// (packages/player/electron/mathmachine/ipc.js) — вся файловая работа в
// main-процессе, мост через contextBridge (window.rusiqAPI), т.к. рендерер
// Electron в песочнице не имеет доступа к node:fs напрямую.

const fs = require('fs');
const path = require('path');

const { resolveWithinRoot } = require('../chrono/pathGuard');

const RUSIQ_APP_DIR_NAME = 'kiosk-rusiq';
const USERDATA_FILE_NAME = 'userdata.json';
const QUIZZES_DIR_NAME = 'quizzes';

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

function resolveQuizzesDir(baseDir) {
  const dir = path.join(baseDir, QUIZZES_DIR_NAME);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function quizFilePath(quizzesDir, quizId) {
  return resolveWithinRoot(quizzesDir, `${quizId}.json`);
}

// Главный процесс НЕ валидирует структуру викторины схемой (zod живёт
// только в рендерере, см. Global Constraints плана) - здесь только
// duck-typing минимума, нужного для отображения списка, и защита от
// одного битого файла, роняющего весь каталог (ТЗ §9).
function listQuizMetadata(quizzesDir) {
  let fileNames;
  try {
    fileNames = fs.readdirSync(quizzesDir).filter((name) => name.endsWith('.json'));
  } catch {
    return [];
  }
  const result = [];
  for (const fileName of fileNames) {
    try {
      const filePath = path.join(quizzesDir, fileName);
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (!isPlainRecord(raw) || typeof raw.title !== 'string') continue;
      const id = fileName.slice(0, -'.json'.length);
      const stat = fs.statSync(filePath);
      result.push({
        id,
        title: raw.title,
        hasPassword: typeof raw.passwordHash === 'string' && raw.passwordHash.length > 0,
        updatedAt: stat.mtime.toISOString(),
      });
    } catch {
      // Битый файл - пропускаем, не роняем весь список.
    }
  }
  return result;
}

function loadQuizFile(quizzesDir, quizId) {
  try {
    const filePath = quizFilePath(quizzesDir, quizId);
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function saveQuizFile(quizzesDir, quiz) {
  const filePath = quizFilePath(quizzesDir, quiz.id);
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(quiz), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

function deleteQuizFile(quizzesDir, quizId) {
  try {
    fs.unlinkSync(quizFilePath(quizzesDir, quizId));
    return true;
  } catch {
    return false;
  }
}

const BACKGROUND_EXT_BY_MIME = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

function saveQuizBackground(quizzesDir, quizId, bufferLike, mimeType) {
  const ext = BACKGROUND_EXT_BY_MIME[mimeType];
  if (!ext) return { ok: false };
  const fileName = `${quizId}-background${ext}`;
  const filePath = resolveWithinRoot(quizzesDir, fileName);
  const buffer = Buffer.isBuffer(bufferLike) ? bufferLike : Buffer.from(bufferLike);
  fs.writeFileSync(filePath, buffer);
  return { ok: true, fileName };
}

/**
 * @param {{ ipcMain: import('electron').IpcMain, app: import('electron').App }} deps
 */
function registerRusiqIpc({ ipcMain, app }) {
  const { baseDir, isFallback } = resolveBaseDir(app);
  const filePath = path.join(baseDir, USERDATA_FILE_NAME);
  const quizzesDir = resolveQuizzesDir(baseDir);

  ipcMain.handle('rusiq:load-user-data', () => readUserData(filePath));
  ipcMain.handle('rusiq:save-user-data', (_event, data) => {
    if (!isPlainRecord(data)) return { ok: false };
    writeUserDataAtomic(filePath, data);
    return { ok: true };
  });

  ipcMain.handle('rusiq:list-quizzes', () => listQuizMetadata(quizzesDir));
  ipcMain.handle('rusiq:load-quiz', (_event, quizId) => {
    if (typeof quizId !== 'string' || quizId.length === 0) return null;
    return loadQuizFile(quizzesDir, quizId);
  });
  ipcMain.handle('rusiq:save-quiz', (_event, quiz) => {
    if (!isPlainRecord(quiz) || typeof quiz.id !== 'string' || quiz.id.length === 0) return { ok: false };
    try {
      saveQuizFile(quizzesDir, quiz);
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });
  ipcMain.handle('rusiq:delete-quiz', (_event, quizId) => {
    if (typeof quizId !== 'string' || quizId.length === 0) return { ok: false };
    return { ok: deleteQuizFile(quizzesDir, quizId) };
  });

  ipcMain.handle('rusiq:save-quiz-background', (_event, quizId, arrayBuffer, mimeType) => {
    if (typeof quizId !== 'string' || quizId.length === 0) return { ok: false };
    try {
      return saveQuizBackground(quizzesDir, quizId, arrayBuffer, mimeType);
    } catch {
      return { ok: false };
    }
  });

  return { baseDir, isFallback, quizzesDir };
}

module.exports = {
  registerRusiqIpc,
  readUserData,
  writeUserDataAtomic,
  resolveBaseDir,
  listQuizMetadata,
  loadQuizFile,
  saveQuizFile,
  deleteQuizFile,
  resolveQuizzesDir,
  saveQuizBackground,
};
