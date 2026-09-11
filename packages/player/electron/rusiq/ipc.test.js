// packages/player/electron/rusiq/ipc.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { registerRusiqIpc, readUserData, writeUserDataAtomic, resolveBaseDir, listQuizMetadata, loadQuizFile, saveQuizFile, deleteQuizFile, resolveQuizzesDir, saveQuizBackground } from './ipc.js';

function fakeIpcMain() {
  const handlers = new Map();
  return {
    handle: (channel, fn) => handlers.set(channel, fn),
    invoke: (channel, ...args) => handlers.get(channel)({}, ...args),
  };
}

test('resolveBaseDir creates and returns a directory under app.getPath("appData")', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rusiq-ipc-appdata-'));
  const app = { getPath: () => tmp };
  const { baseDir, isFallback } = resolveBaseDir(app);
  assert.equal(isFallback, false);
  assert.equal(fs.existsSync(baseDir), true);
  assert.equal(baseDir, path.join(tmp, 'kiosk-rusiq'));
});

test('readUserData returns the fallback when the file does not exist', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rusiq-ipc-read-'));
  const result = readUserData(path.join(tmp, 'userdata.json'));
  assert.deepEqual(result, { schemaVersion: 1, sessions: [], soundOn: true });
});

test('writeUserDataAtomic then readUserData round-trips the same data', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rusiq-ipc-roundtrip-'));
  const filePath = path.join(tmp, 'userdata.json');
  const data = { schemaVersion: 1, sessions: [{ id: 's1', quizId: 'q1', playedAtIso: '2026-01-01T00:00:00.000Z', players: [] }], soundOn: false };
  writeUserDataAtomic(filePath, data);
  assert.deepEqual(readUserData(filePath), data);
});

test('registerRusiqIpc wires load/save handlers end-to-end', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rusiq-ipc-register-'));
  const app = { getPath: () => tmp };
  const ipcMain = fakeIpcMain();
  registerRusiqIpc({ ipcMain, app });

  const initial = await ipcMain.invoke('rusiq:load-user-data');
  assert.deepEqual(initial, { schemaVersion: 1, sessions: [], soundOn: true });

  const saveResult = await ipcMain.invoke('rusiq:save-user-data', { schemaVersion: 1, sessions: [], soundOn: false });
  assert.deepEqual(saveResult, { ok: true });

  const reloaded = await ipcMain.invoke('rusiq:load-user-data');
  assert.equal(reloaded.soundOn, false);
});

test('registerRusiqIpc save handler rejects non-object payloads', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rusiq-ipc-reject-'));
  const app = { getPath: () => tmp };
  const ipcMain = fakeIpcMain();
  registerRusiqIpc({ ipcMain, app });
  const result = await ipcMain.invoke('rusiq:save-user-data', 'not-an-object');
  assert.deepEqual(result, { ok: false });
});

test('resolveQuizzesDir creates and returns a "quizzes" subdirectory', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rusiq-quizzes-dir-'));
  const dir = resolveQuizzesDir(tmp);
  assert.equal(dir, path.join(tmp, 'quizzes'));
  assert.equal(fs.existsSync(dir), true);
});

test('listQuizMetadata returns an empty array when the directory has no quiz files', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rusiq-quizzes-empty-'));
  const dir = resolveQuizzesDir(tmp);
  assert.deepEqual(listQuizMetadata(dir), []);
});

test('saveQuizFile then loadQuizFile round-trips the same quiz object', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rusiq-quizzes-roundtrip-'));
  const dir = resolveQuizzesDir(tmp);
  const quiz = { id: 'quiz-abc', title: 'Моя викторина', passwordHash: null, questions: [] };
  saveQuizFile(dir, quiz);
  assert.deepEqual(loadQuizFile(dir, 'quiz-abc'), quiz);
});

test('loadQuizFile returns null for a missing quiz id', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rusiq-quizzes-missing-'));
  const dir = resolveQuizzesDir(tmp);
  assert.equal(loadQuizFile(dir, 'does-not-exist'), null);
});

test('listQuizMetadata reflects saved quizzes with title, hasPassword and updatedAt', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rusiq-quizzes-list-'));
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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rusiq-quizzes-corrupt-'));
  const dir = resolveQuizzesDir(tmp);
  saveQuizFile(dir, { id: 'quiz-good', title: 'Хорошая', passwordHash: null, questions: [] });
  fs.writeFileSync(path.join(dir, 'quiz-bad.json'), '{not valid json');
  const list = listQuizMetadata(dir);
  assert.deepEqual(list.map((q) => q.id), ['quiz-good']);
});

test('deleteQuizFile removes an existing file and returns true', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rusiq-quizzes-delete-'));
  const dir = resolveQuizzesDir(tmp);
  saveQuizFile(dir, { id: 'quiz-x', title: 'X', passwordHash: null, questions: [] });
  assert.equal(deleteQuizFile(dir, 'quiz-x'), true);
  assert.equal(loadQuizFile(dir, 'quiz-x'), null);
});

test('deleteQuizFile returns false for a missing quiz id', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rusiq-quizzes-delete-missing-'));
  const dir = resolveQuizzesDir(tmp);
  assert.equal(deleteQuizFile(dir, 'does-not-exist'), false);
});

test('registerRusiqIpc wires quiz catalog handlers end-to-end', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rusiq-quizzes-e2e-'));
  const app = { getPath: () => tmp };
  const ipcMain = fakeIpcMain();
  registerRusiqIpc({ ipcMain, app });

  assert.deepEqual(await ipcMain.invoke('rusiq:list-quizzes'), []);

  const saveResult = await ipcMain.invoke('rusiq:save-quiz', { id: 'quiz-e2e', title: 'E2E', passwordHash: null, questions: [] });
  assert.deepEqual(saveResult, { ok: true });

  const loaded = await ipcMain.invoke('rusiq:load-quiz', 'quiz-e2e');
  assert.equal(loaded.title, 'E2E');

  const list = await ipcMain.invoke('rusiq:list-quizzes');
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 'quiz-e2e');

  const deleteResult = await ipcMain.invoke('rusiq:delete-quiz', 'quiz-e2e');
  assert.deepEqual(deleteResult, { ok: true });
  assert.equal(await ipcMain.invoke('rusiq:load-quiz', 'quiz-e2e'), null);
});

test('registerRusiqIpc save-quiz handler rejects a payload without a string id', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rusiq-quizzes-reject-'));
  const app = { getPath: () => tmp };
  const ipcMain = fakeIpcMain();
  registerRusiqIpc({ ipcMain, app });
  const result = await ipcMain.invoke('rusiq:save-quiz', { title: 'Без id' });
  assert.deepEqual(result, { ok: false });
});

test('saveQuizBackground writes a file named "<quizId>-background.<ext>" and returns its fileName', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rusiq-bg-'));
  const dir = resolveQuizzesDir(tmp);
  const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG-сигнатура, содержимое не проверяется
  const result = saveQuizBackground(dir, 'quiz-bg-1', buffer, 'image/png');
  assert.deepEqual(result, { ok: true, fileName: 'quiz-bg-1-background.png' });
  assert.equal(fs.existsSync(path.join(dir, 'quiz-bg-1-background.png')), true);
});

test('saveQuizBackground rejects an unsupported mime type', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rusiq-bg-reject-'));
  const dir = resolveQuizzesDir(tmp);
  const result = saveQuizBackground(dir, 'quiz-bg-2', Buffer.from([1, 2, 3]), 'application/pdf');
  assert.deepEqual(result, { ok: false });
});

test('registerRusiqIpc save-quiz-background handler round-trips through IPC', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rusiq-bg-ipc-'));
  const app = { getPath: () => tmp };
  const ipcMain = fakeIpcMain();
  const { quizzesDir } = registerRusiqIpc({ ipcMain, app });
  const buffer = new Uint8Array([0xff, 0xd8, 0xff]).buffer; // JPEG-сигнатура
  const result = await ipcMain.invoke('rusiq:save-quiz-background', 'quiz-bg-3', buffer, 'image/jpeg');
  assert.deepEqual(result, { ok: true, fileName: 'quiz-bg-3-background.jpg' });
  assert.equal(fs.existsSync(path.join(quizzesDir, 'quiz-bg-3-background.jpg')), true);
});
