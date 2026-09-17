// packages/player/electron/physastroiq/ipc.js
// Единственная точка, через которую рендерер (виджет «ФизАстроIQ») получает
// доступ к пользовательским данным и файлам викторин. Прямая адаптация
// rusiq/ipc.js (Тип 7) — тот же принцип (вся файловая работа в
// main-процессе, мост через contextBridge). Единственное содержательное
// отличие: вместо ОДНОГО общего фона (saveQuizBackground) — своё
// изображение НА КАЖДЫЙ из 3 уровней (saveQuizLevelImage), см. план
// реализации Тип11_ФизАстроIQ §3.

const fs = require('fs');
const path = require('path');

const { resolveWithinRoot } = require('../chrono/pathGuard');
const { atomicWriteJson, readJsonStatus } = require('../chrono/atomicJson');

const PHYSASTROIQ_APP_DIR_NAME = 'kiosk-physastroiq';
const USERDATA_FILE_NAME = 'userdata.json';
const QUIZZES_DIR_NAME = 'quizzes';

const FALLBACK_USER_DATA = { schemaVersion: 1, sessions: [], soundOn: true };

// Fail-loud при повреждении userdata.json - тот же паттерн, что
// AlphabetStoreError в alphabet/profileStore.js. userdata.json хранит
// историю партий (FR-010 сводная статистика) - молчаливый откат к пустому
// FALLBACK_USER_DATA на повреждённом файле выглядел бы для педагога как
// потеря накопленной статистики, а не как поломка файла (находка при
// сверке с ТЗ, docs/physastroiq-acceptance-matrix.md §3).
class PhysastroiqStoreError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PhysastroiqStoreError';
  }
}

function resolveBaseDir(app) {
  try {
    const dir = path.join(app.getPath('appData'), PHYSASTROIQ_APP_DIR_NAME);
    fs.mkdirSync(dir, { recursive: true });
    return { baseDir: dir, isFallback: false };
  } catch (err) {
    const dir = path.join(require('os').tmpdir(), PHYSASTROIQ_APP_DIR_NAME);
    fs.mkdirSync(dir, { recursive: true });
    return { baseDir: dir, isFallback: true };
  }
}

function isPlainRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readUserData(filePath) {
  const status = readJsonStatus(filePath);
  if (!status.exists) return FALLBACK_USER_DATA;
  if (!status.valid || !isPlainRecord(status.data)) {
    throw new PhysastroiqStoreError(`Файл данных ФизАстроIQ повреждён: ${path.basename(filePath)}`);
  }
  return status.data;
}

function writeUserDataAtomic(filePath, data) {
  atomicWriteJson(filePath, data);
}

function resolveQuizzesDir(baseDir) {
  const dir = path.join(baseDir, QUIZZES_DIR_NAME);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function quizFilePath(quizzesDir, quizId) {
  return resolveWithinRoot(quizzesDir, `${quizId}.json`);
}

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

// Собирает имена файлов ВСЕХ картинок, на которые ссылается викторина, для
// удаления при deleteQuizFile — отличие от rusiq: изображения-карты
// хранятся в quiz.images (объект по уровню), не в одном quiz.image.
function collectReferencedImageFileNames(quiz) {
  const names = [];
  if (quiz && isPlainRecord(quiz.images)) {
    for (const key of Object.keys(quiz.images)) {
      const entry = quiz.images[key];
      if (isPlainRecord(entry) && typeof entry.fileName === 'string' && entry.fileName.length > 0) {
        names.push(entry.fileName);
      }
    }
  }
  if (quiz && Array.isArray(quiz.questions)) {
    for (const q of quiz.questions) {
      if (!isPlainRecord(q)) continue;
      for (const key of ['questionImage', 'answerImage', 'hintImage']) {
        if (typeof q[key] === 'string' && q[key].length > 0) names.push(q[key]);
      }
    }
  }
  return names;
}

function deleteQuizFile(quizzesDir, quizId) {
  let filePath;
  try {
    filePath = quizFilePath(quizzesDir, quizId);
  } catch {
    return false;
  }

  const quiz = loadQuizFile(quizzesDir, quizId);
  for (const fileName of collectReferencedImageFileNames(quiz)) {
    try {
      fs.unlinkSync(resolveWithinRoot(quizzesDir, fileName));
    } catch {
      // Файл уже отсутствует/не читается - не блокирует ни удаление самой
      // викторины, ни удаление остальных картинок.
    }
  }

  try {
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}

const IMAGE_EXT_BY_MIME = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

const LEVEL_IDS = [1, 2, 3];

// Изображение-карта КОНКРЕТНОГО уровня сложности (1/2/3) — ключевое
// отличие от rusiq (там один общий saveQuizBackground на всю викторину).
// Имя файла включает номер уровня, чтобы три изображения одной викторины
// не сталкивались друг с другом.
function saveQuizLevelImage(quizzesDir, quizId, level, bufferLike, mimeType) {
  const ext = IMAGE_EXT_BY_MIME[mimeType];
  if (!ext) return { ok: false };
  const levelNum = Number(level);
  if (!LEVEL_IDS.includes(levelNum)) return { ok: false };
  const fileName = `${quizId}-level${levelNum}${ext}`;
  const filePath = resolveWithinRoot(quizzesDir, fileName);
  const buffer = Buffer.isBuffer(bufferLike) ? bufferLike : Buffer.from(bufferLike);
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, buffer);
  fs.renameSync(tmpPath, filePath);
  return { ok: true, fileName };
}

const ITEM_IMAGE_KINDS = ['question', 'answer', 'hint'];

function saveQuizItemImage(quizzesDir, quizId, questionId, kind, bufferLike, mimeType) {
  const ext = IMAGE_EXT_BY_MIME[mimeType];
  if (!ext) return { ok: false };
  if (!ITEM_IMAGE_KINDS.includes(kind)) return { ok: false };
  if (typeof questionId !== 'string' || questionId.length === 0) return { ok: false };
  const fileName = `${quizId}-${questionId}-${kind}${ext}`;
  const filePath = resolveWithinRoot(quizzesDir, fileName);
  const buffer = Buffer.isBuffer(bufferLike) ? bufferLike : Buffer.from(bufferLike);
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, buffer);
  fs.renameSync(tmpPath, filePath);
  return { ok: true, fileName };
}

function deleteQuizItemImage(quizzesDir, fileName) {
  if (typeof fileName !== 'string' || fileName.length === 0) return false;
  try {
    fs.unlinkSync(resolveWithinRoot(quizzesDir, fileName));
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {{ ipcMain: import('electron').IpcMain, app: import('electron').App }} deps
 */
function registerPhysastroiqIpc({ ipcMain, app }) {
  const { baseDir, isFallback } = resolveBaseDir(app);
  const filePath = path.join(baseDir, USERDATA_FILE_NAME);
  const quizzesDir = resolveQuizzesDir(baseDir);

  ipcMain.handle('physastroiq:load-user-data', () => readUserData(filePath));
  ipcMain.handle('physastroiq:save-user-data', (_event, data) => {
    if (!isPlainRecord(data)) return { ok: false };
    writeUserDataAtomic(filePath, data);
    return { ok: true };
  });

  ipcMain.handle('physastroiq:list-quizzes', () => listQuizMetadata(quizzesDir));
  ipcMain.handle('physastroiq:load-quiz', (_event, quizId) => {
    if (typeof quizId !== 'string' || quizId.length === 0) return null;
    return loadQuizFile(quizzesDir, quizId);
  });
  ipcMain.handle('physastroiq:save-quiz', (_event, quiz) => {
    if (!isPlainRecord(quiz) || typeof quiz.id !== 'string' || quiz.id.length === 0) return { ok: false };
    try {
      saveQuizFile(quizzesDir, quiz);
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });
  ipcMain.handle('physastroiq:delete-quiz', (_event, quizId) => {
    if (typeof quizId !== 'string' || quizId.length === 0) return { ok: false };
    return { ok: deleteQuizFile(quizzesDir, quizId) };
  });

  ipcMain.handle('physastroiq:save-quiz-level-image', (_event, quizId, level, arrayBuffer, mimeType) => {
    if (typeof quizId !== 'string' || quizId.length === 0) return { ok: false };
    try {
      return saveQuizLevelImage(quizzesDir, quizId, level, arrayBuffer, mimeType);
    } catch {
      return { ok: false };
    }
  });

  ipcMain.handle('physastroiq:save-quiz-item-image', (_event, quizId, questionId, kind, arrayBuffer, mimeType) => {
    if (typeof quizId !== 'string' || quizId.length === 0) return { ok: false };
    try {
      return saveQuizItemImage(quizzesDir, quizId, questionId, kind, arrayBuffer, mimeType);
    } catch {
      return { ok: false };
    }
  });

  ipcMain.handle('physastroiq:delete-quiz-item-image', (_event, fileName) => {
    return { ok: deleteQuizItemImage(quizzesDir, fileName) };
  });

  return { baseDir, isFallback, quizzesDir };
}

module.exports = {
  registerPhysastroiqIpc,
  PhysastroiqStoreError,
  readUserData,
  writeUserDataAtomic,
  resolveBaseDir,
  listQuizMetadata,
  loadQuizFile,
  saveQuizFile,
  deleteQuizFile,
  resolveQuizzesDir,
  saveQuizLevelImage,
  saveQuizItemImage,
  deleteQuizItemImage,
  collectReferencedImageFileNames,
};
