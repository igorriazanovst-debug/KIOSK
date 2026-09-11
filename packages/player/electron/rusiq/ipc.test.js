// packages/player/electron/rusiq/ipc.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { registerRusiqIpc, readUserData, writeUserDataAtomic, resolveBaseDir } from './ipc.js';

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
