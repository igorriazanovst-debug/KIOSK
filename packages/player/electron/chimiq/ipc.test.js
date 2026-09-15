// packages/player/electron/chimiq/ipc.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { registerChimiqIpc, readUserData, writeUserDataAtomic, resolveBaseDir, listQuizMetadata, loadQuizFile, saveQuizFile, deleteQuizFile, resolveQuizzesDir, saveQuizLevelImage, saveQuizItemImage, deleteQuizItemImage, ChimiqStoreError } from './ipc.js';

// invoke оборачивает вызов обработчика в Promise.resolve().then(...), а не
// зовёт его напрямую - реальный Electron ipcMain.handle всегда отдаёт
// результат/ошибку рендереру через Promise (см. registerChimiqIpc load
// handler rejects when userdata.json is corrupted ниже: обработчик,
// бросающий СИНХРОННО, без этой обёртки провалил бы assert.rejects, потому
// что исключение улетело бы мимо Promise-цепочки, а не в реальном IPC).
function fakeIpcMain() {
  const handlers = new Map();
  return {
    handle: (channel, fn) => handlers.set(channel, fn),
    invoke: (channel, ...args) => Promise.resolve().then(() => handlers.get(channel)({}, ...args)),
  };
}

test('resolveBaseDir creates and returns a directory under app.getPath("appData")', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chimiq-ipc-appdata-'));
  const app = { getPath: () => tmp };
  const { baseDir, isFallback } = resolveBaseDir(app);
  assert.equal(isFallback, false);
  assert.equal(fs.existsSync(baseDir), true);
  assert.equal(baseDir, path.join(tmp, 'kiosk-chimiq'));
});

test('readUserData returns the fallback when the file does not exist', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chimiq-ipc-read-'));
  const result = readUserData(path.join(tmp, 'userdata.json'));
  assert.deepEqual(result, { schemaVersion: 1, sessions: [], soundOn: true });
});

test('writeUserDataAtomic then readUserData round-trips the same data', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chimiq-ipc-roundtrip-'));
  const filePath = path.join(tmp, 'userdata.json');
  const data = { schemaVersion: 1, sessions: [{ id: 's1', quizId: 'q1', playedAtIso: '2026-01-01T00:00:00.000Z', players: [] }], soundOn: false };
  writeUserDataAtomic(filePath, data);
  assert.deepEqual(readUserData(filePath), data);
});

// Находка при сверке с ТЗ (docs/chimiq-acceptance-matrix.md §3): раньше
// readUserData не различала "файла нет" (легитимно, устройство новое) от
// "файл есть, но повреждён" (диск/AV/ручная правка) - оба случая молча
// схлопывались в FALLBACK_USER_DATA, из-за чего повреждение userdata.json
// выглядело как "статистика ещё не копилась", а не как ошибка. Тот же
// класс дефекта уже был закрыт для auth.json (см. chrono/atomicJson.js) -
// здесь применяется тот же fail-loud паттерн, что и в alphabet/profileStore
// (readOrDefault бросает AlphabetStoreError на повреждённых профилях).
test('readUserData throws ChimiqStoreError when the file exists but is not valid JSON', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chimiq-ipc-corrupt-'));
  const filePath = path.join(tmp, 'userdata.json');
  fs.writeFileSync(filePath, '{not valid json');
  assert.throws(() => readUserData(filePath), ChimiqStoreError);
});

test('readUserData throws ChimiqStoreError when the file is valid JSON but not a record (e.g. an array)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chimiq-ipc-corrupt-shape-'));
  const filePath = path.join(tmp, 'userdata.json');
  fs.writeFileSync(filePath, '[1,2,3]');
  assert.throws(() => readUserData(filePath), ChimiqStoreError);
});

test('registerChimiqIpc load handler rejects when userdata.json is corrupted, without touching the file', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chimiq-ipc-register-corrupt-'));
  const app = { getPath: () => tmp };
  const ipcMain = fakeIpcMain();
  registerChimiqIpc({ ipcMain, app });
  const filePath = path.join(tmp, 'kiosk-chimiq', 'userdata.json');
  fs.writeFileSync(filePath, '{not valid json');

  await assert.rejects(() => ipcMain.invoke('chimiq:load-user-data'), ChimiqStoreError);
  // Повреждённый файл не должен быть молча перезаписан фолбэком.
  assert.equal(fs.readFileSync(filePath, 'utf-8'), '{not valid json');
});

test('registerChimiqIpc wires load/save handlers end-to-end', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chimiq-ipc-register-'));
  const app = { getPath: () => tmp };
  const ipcMain = fakeIpcMain();
  registerChimiqIpc({ ipcMain, app });

  const initial = await ipcMain.invoke('chimiq:load-user-data');
  assert.deepEqual(initial, { schemaVersion: 1, sessions: [], soundOn: true });

  const saveResult = await ipcMain.invoke('chimiq:save-user-data', { schemaVersion: 1, sessions: [], soundOn: false });
  assert.deepEqual(saveResult, { ok: true });

  const reloaded = await ipcMain.invoke('chimiq:load-user-data');
  assert.equal(reloaded.soundOn, false);
});

test('registerChimiqIpc save handler rejects non-object payloads', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chimiq-ipc-reject-'));
  const app = { getPath: () => tmp };
  const ipcMain = fakeIpcMain();
  registerChimiqIpc({ ipcMain, app });
  const result = await ipcMain.invoke('chimiq:save-user-data', 'not-an-object');
  assert.deepEqual(result, { ok: false });
});

test('resolveQuizzesDir creates and returns a "quizzes" subdirectory', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chimiq-quizzes-dir-'));
  const dir = resolveQuizzesDir(tmp);
  assert.equal(dir, path.join(tmp, 'quizzes'));
  assert.equal(fs.existsSync(dir), true);
});

test('listQuizMetadata returns an empty array when the directory has no quiz files', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chimiq-quizzes-empty-'));
  const dir = resolveQuizzesDir(tmp);
  assert.deepEqual(listQuizMetadata(dir), []);
});

test('saveQuizFile then loadQuizFile round-trips the same quiz object', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chimiq-quizzes-roundtrip-'));
  const dir = resolveQuizzesDir(tmp);
  const quiz = { id: 'quiz-abc', title: 'Моя викторина', passwordHash: null, questions: [] };
  saveQuizFile(dir, quiz);
  assert.deepEqual(loadQuizFile(dir, 'quiz-abc'), quiz);
});

test('loadQuizFile returns null for a missing quiz id', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chimiq-quizzes-missing-'));
  const dir = resolveQuizzesDir(tmp);
  assert.equal(loadQuizFile(dir, 'does-not-exist'), null);
});

test('listQuizMetadata reflects saved quizzes with title, hasPassword and updatedAt', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chimiq-quizzes-list-'));
  const dir = resolveQuizzesDir(tmp);
  saveQuizFile(dir, { id: 'quiz-1', title: 'Без пароля', passwordHash: null, questions: [] });
  saveQuizFile(dir, { id: 'quiz-2', title: 'С паролем', passwordHash: 'deadbeef', questions: [] });
  const list = listQuizMetadata(dir).sort((a, b) => a.id.localeCompare(b.id));
  assert.equal(list.length, 2);
  assert.equal(list[0].id, 'quiz-1');
  assert.equal(list[0].title, 'Без пароля');
  assert.equal(list[0].hasPassword, false);
  assert.equal(typeof list[0].updatedAt, 'string');
  assert.equal(list[1].id, 'quiz-2');
  assert.equal(list[1].hasPassword, true);
});

test('listQuizMetadata skips a corrupted quiz file instead of throwing', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chimiq-quizzes-corrupt-'));
  const dir = resolveQuizzesDir(tmp);
  saveQuizFile(dir, { id: 'quiz-good', title: 'Хорошая', passwordHash: null, questions: [] });
  fs.writeFileSync(path.join(dir, 'quiz-bad.json'), '{not valid json');
  const list = listQuizMetadata(dir);
  assert.deepEqual(list.map((q) => q.id), ['quiz-good']);
});

test('deleteQuizFile removes an existing file and returns true', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chimiq-quizzes-delete-'));
  const dir = resolveQuizzesDir(tmp);
  saveQuizFile(dir, { id: 'quiz-x', title: 'X', passwordHash: null, questions: [] });
  assert.equal(deleteQuizFile(dir, 'quiz-x'), true);
  assert.equal(loadQuizFile(dir, 'quiz-x'), null);
});

test('deleteQuizFile returns false for a missing quiz id', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chimiq-quizzes-delete-missing-'));
  const dir = resolveQuizzesDir(tmp);
  assert.equal(deleteQuizFile(dir, 'does-not-exist'), false);
});

// Отличие от rusiq: изображения хранятся в quiz.images (по уровню), не в
// одном quiz.image — deleteQuizFile должна пройти по ВСЕМ ключам объекта.
test('deleteQuizFile removes all per-level images named in quiz.images', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chimiq-quizzes-delete-images-'));
  const dir = resolveQuizzesDir(tmp);
  const img1 = saveQuizLevelImage(dir, 'quiz-with-images', 1, Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'image/png');
  const img2 = saveQuizLevelImage(dir, 'quiz-with-images', 2, Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'image/png');
  const img3 = saveQuizLevelImage(dir, 'quiz-with-images', 3, Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'image/png');
  saveQuizFile(dir, {
    id: 'quiz-with-images',
    title: 'С тремя картами',
    passwordHash: null,
    images: {
      '1': { fileName: img1.fileName, width: 100, height: 100 },
      '2': { fileName: img2.fileName, width: 100, height: 100 },
      '3': { fileName: img3.fileName, width: 100, height: 100 },
    },
    questions: [],
  });
  assert.equal(fs.existsSync(path.join(dir, img1.fileName)), true);
  assert.equal(fs.existsSync(path.join(dir, img2.fileName)), true);
  assert.equal(fs.existsSync(path.join(dir, img3.fileName)), true);

  assert.equal(deleteQuizFile(dir, 'quiz-with-images'), true);

  assert.equal(loadQuizFile(dir, 'quiz-with-images'), null);
  assert.equal(fs.existsSync(path.join(dir, img1.fileName)), false);
  assert.equal(fs.existsSync(path.join(dir, img2.fileName)), false);
  assert.equal(fs.existsSync(path.join(dir, img3.fileName)), false);
});

test('deleteQuizFile still removes the quiz JSON when a referenced level image is already missing from disk', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chimiq-quizzes-delete-img-missing-'));
  const dir = resolveQuizzesDir(tmp);
  saveQuizFile(dir, {
    id: 'quiz-orphan-ref',
    title: 'Ссылка на отсутствующую карту',
    passwordHash: null,
    images: { '1': { fileName: 'quiz-orphan-ref-level1.png', width: 100, height: 100 } },
    questions: [],
  });

  assert.equal(deleteQuizFile(dir, 'quiz-orphan-ref'), true);
  assert.equal(loadQuizFile(dir, 'quiz-orphan-ref'), null);
});

test('deleteQuizFile removes only the JSON when the quiz has no images', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chimiq-quizzes-delete-no-img-'));
  const dir = resolveQuizzesDir(tmp);
  saveQuizFile(dir, { id: 'quiz-no-img', title: 'Без карт', passwordHash: null, questions: [] });
  assert.equal(deleteQuizFile(dir, 'quiz-no-img'), true);
  assert.equal(loadQuizFile(dir, 'quiz-no-img'), null);
});

test('registerChimiqIpc wires quiz catalog handlers end-to-end', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chimiq-quizzes-e2e-'));
  const app = { getPath: () => tmp };
  const ipcMain = fakeIpcMain();
  registerChimiqIpc({ ipcMain, app });

  assert.deepEqual(await ipcMain.invoke('chimiq:list-quizzes'), []);

  const saveResult = await ipcMain.invoke('chimiq:save-quiz', { id: 'quiz-e2e', title: 'E2E', passwordHash: null, questions: [] });
  assert.deepEqual(saveResult, { ok: true });

  const loaded = await ipcMain.invoke('chimiq:load-quiz', 'quiz-e2e');
  assert.equal(loaded.title, 'E2E');

  const list = await ipcMain.invoke('chimiq:list-quizzes');
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 'quiz-e2e');

  const deleteResult = await ipcMain.invoke('chimiq:delete-quiz', 'quiz-e2e');
  assert.deepEqual(deleteResult, { ok: true });
  assert.equal(await ipcMain.invoke('chimiq:load-quiz', 'quiz-e2e'), null);
});

test('registerChimiqIpc save-quiz handler rejects a payload without a string id', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chimiq-quizzes-reject-'));
  const app = { getPath: () => tmp };
  const ipcMain = fakeIpcMain();
  registerChimiqIpc({ ipcMain, app });
  const result = await ipcMain.invoke('chimiq:save-quiz', { title: 'Без id' });
  assert.deepEqual(result, { ok: false });
});

test('saveQuizLevelImage writes a file named "<quizId>-level<N>.<ext>" and returns its fileName', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chimiq-lvl-'));
  const dir = resolveQuizzesDir(tmp);
  const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const result = saveQuizLevelImage(dir, 'quiz-lvl-1', 2, buffer, 'image/png');
  assert.deepEqual(result, { ok: true, fileName: 'quiz-lvl-1-level2.png' });
  assert.equal(fs.existsSync(path.join(dir, 'quiz-lvl-1-level2.png')), true);
});

test('saveQuizLevelImage rejects an out-of-range level', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chimiq-lvl-badlevel-'));
  const dir = resolveQuizzesDir(tmp);
  const result = saveQuizLevelImage(dir, 'quiz-lvl-2', 4, Buffer.from([1, 2, 3]), 'image/png');
  assert.deepEqual(result, { ok: false });
});

test('saveQuizLevelImage rejects an unsupported mime type', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chimiq-lvl-reject-'));
  const dir = resolveQuizzesDir(tmp);
  const result = saveQuizLevelImage(dir, 'quiz-lvl-3', 1, Buffer.from([1, 2, 3]), 'application/pdf');
  assert.deepEqual(result, { ok: false });
});

test('registerChimiqIpc save-quiz-level-image handler round-trips through IPC', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chimiq-lvl-ipc-'));
  const app = { getPath: () => tmp };
  const ipcMain = fakeIpcMain();
  const { quizzesDir } = registerChimiqIpc({ ipcMain, app });
  const buffer = new Uint8Array([0xff, 0xd8, 0xff]).buffer;
  const result = await ipcMain.invoke('chimiq:save-quiz-level-image', 'quiz-lvl-4', 3, buffer, 'image/jpeg');
  assert.deepEqual(result, { ok: true, fileName: 'quiz-lvl-4-level3.jpg' });
  assert.equal(fs.existsSync(path.join(quizzesDir, 'quiz-lvl-4-level3.jpg')), true);
});

test('saveQuizItemImage writes a file named "<quizId>-<questionId>-<kind>.<ext>" and returns its fileName', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chimiq-item-img-'));
  const dir = resolveQuizzesDir(tmp);
  const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const result = saveQuizItemImage(dir, 'quiz-1', 'q-1', 'question', buffer, 'image/png');
  assert.deepEqual(result, { ok: true, fileName: 'quiz-1-q-1-question.png' });
  assert.equal(fs.existsSync(path.join(dir, 'quiz-1-q-1-question.png')), true);
});

test('saveQuizItemImage rejects an unknown kind', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chimiq-item-img-badkind-'));
  const dir = resolveQuizzesDir(tmp);
  const result = saveQuizItemImage(dir, 'quiz-1', 'q-1', 'explanation', Buffer.from([1]), 'image/png');
  assert.deepEqual(result, { ok: false });
});

test('saveQuizItemImage rejects an unsupported mime type', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chimiq-item-img-badmime-'));
  const dir = resolveQuizzesDir(tmp);
  const result = saveQuizItemImage(dir, 'quiz-1', 'q-1', 'answer', Buffer.from([1]), 'application/pdf');
  assert.deepEqual(result, { ok: false });
});

test('deleteQuizItemImage removes an existing file and returns true', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chimiq-item-img-delete-'));
  const dir = resolveQuizzesDir(tmp);
  const saved = saveQuizItemImage(dir, 'quiz-1', 'q-1', 'hint', Buffer.from([1]), 'image/png');
  assert.equal(deleteQuizItemImage(dir, saved.fileName), true);
  assert.equal(fs.existsSync(path.join(dir, saved.fileName)), false);
});

test('deleteQuizItemImage returns false for a missing file without throwing', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chimiq-item-img-delete-missing-'));
  const dir = resolveQuizzesDir(tmp);
  assert.equal(deleteQuizItemImage(dir, 'does-not-exist.png'), false);
});

test('registerChimiqIpc save/delete-quiz-item-image handlers round-trip through IPC', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chimiq-item-img-ipc-'));
  const app = { getPath: () => tmp };
  const ipcMain = fakeIpcMain();
  const { quizzesDir } = registerChimiqIpc({ ipcMain, app });
  const buffer = new Uint8Array([0xff, 0xd8, 0xff]).buffer;
  const saveResult = await ipcMain.invoke('chimiq:save-quiz-item-image', 'quiz-9', 'q-9', 'answer', buffer, 'image/jpeg');
  assert.deepEqual(saveResult, { ok: true, fileName: 'quiz-9-q-9-answer.jpg' });
  assert.equal(fs.existsSync(path.join(quizzesDir, saveResult.fileName)), true);

  const deleteResult = await ipcMain.invoke('chimiq:delete-quiz-item-image', saveResult.fileName);
  assert.deepEqual(deleteResult, { ok: true });
  assert.equal(fs.existsSync(path.join(quizzesDir, saveResult.fileName)), false);
});

test('deleteQuizFile also removes question/answer/hint images referenced by questions', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chimiq-quizzes-delete-itemimgs-'));
  const dir = resolveQuizzesDir(tmp);
  const q = saveQuizItemImage(dir, 'quiz-imgs', 'q-1', 'question', Buffer.from([1]), 'image/png');
  const a = saveQuizItemImage(dir, 'quiz-imgs', 'q-1', 'answer', Buffer.from([1]), 'image/png');
  const h = saveQuizItemImage(dir, 'quiz-imgs', 'q-1', 'hint', Buffer.from([1]), 'image/png');
  saveQuizFile(dir, {
    id: 'quiz-imgs',
    title: 'С картинками вопроса',
    passwordHash: null,
    questions: [{ id: 'q-1', questionImage: q.fileName, answerImage: a.fileName, hintImage: h.fileName }],
  });

  assert.equal(deleteQuizFile(dir, 'quiz-imgs'), true);

  assert.equal(fs.existsSync(path.join(dir, q.fileName)), false);
  assert.equal(fs.existsSync(path.join(dir, a.fileName)), false);
  assert.equal(fs.existsSync(path.join(dir, h.fileName)), false);
});

test('loadQuizFile and deleteQuizFile reject a path-traversal quiz id instead of touching files outside quizzesDir', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chimiq-quizzes-traversal-'));
  const dir = resolveQuizzesDir(tmp);
  const outsideFile = path.join(tmp, 'outside.json');
  fs.writeFileSync(outsideFile, JSON.stringify({ secret: true }));
  const maliciousId = '../outside';
  assert.equal(loadQuizFile(dir, maliciousId), null);
  assert.equal(deleteQuizFile(dir, maliciousId), false);
  assert.equal(fs.existsSync(outsideFile), true);
});
