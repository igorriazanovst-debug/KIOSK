// packages/player/electron/mathmachine/ipc.test.js
// registerMathmachineIpc принимает ipcMain/app как параметры (не берёт их
// глобально из 'electron') - тест строит рабочие подставные объекты и
// вызывает ЗАРЕГИСТРИРОВАННЫЕ обработчики напрямую, с реальной файловой
// системой (временный каталог на каждый тест).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { registerMathmachineIpc } from './ipc.js';

function tmpAppDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mathmachine-ipc-userdata-'));
}

function makeFakeIpcMain() {
  const handlers = new Map();
  return {
    handle(channel, listener) {
      handlers.set(channel, listener);
    },
    invoke(channel, ...args) {
      const listener = handlers.get(channel);
      if (!listener) throw new Error('no handler registered for ' + channel);
      return listener({}, ...args);
    },
  };
}

function makeFakeApp(appDataDir) {
  return { getPath: () => appDataDir };
}

test('registerMathmachineIpc: load-user-data channel delegates to the store', async () => {
  const appDataDir = tmpAppDataDir();
  const ipcMain = makeFakeIpcMain();
  registerMathmachineIpc({ ipcMain, app: makeFakeApp(appDataDir) });

  const result = await ipcMain.invoke('mathmachine:load-user-data');
  assert.deepEqual(result, { schemaVersion: 1, progress: {}, soundOn: true });
});

test('registerMathmachineIpc: save-user-data then load-user-data round-trips real data', async () => {
  const appDataDir = tmpAppDataDir();
  const ipcMain = makeFakeIpcMain();
  registerMathmachineIpc({ ipcMain, app: makeFakeApp(appDataDir) });

  const data = { schemaVersion: 1, progress: { grp_add_1: { doneTaskIds: ['add1_intro'], currentTaskId: 'add1_1' } }, soundOn: false };
  const saveResult = await ipcMain.invoke('mathmachine:save-user-data', data);
  assert.equal(saveResult.ok, true);

  const loaded = await ipcMain.invoke('mathmachine:load-user-data');
  assert.deepEqual(loaded, data);
});

test('registerMathmachineIpc: save-user-data writes atomically (tmp file does not linger)', async () => {
  const appDataDir = tmpAppDataDir();
  const ipcMain = makeFakeIpcMain();
  registerMathmachineIpc({ ipcMain, app: makeFakeApp(appDataDir) });

  await ipcMain.invoke('mathmachine:save-user-data', { schemaVersion: 1, progress: {}, soundOn: true });

  const files = fs.readdirSync(path.join(appDataDir, 'kiosk-mathmachine'));
  assert.deepEqual(files, ['userdata.json']);
});

test('registerMathmachineIpc: save-user-data rejects non-object payloads', async () => {
  const appDataDir = tmpAppDataDir();
  const ipcMain = makeFakeIpcMain();
  registerMathmachineIpc({ ipcMain, app: makeFakeApp(appDataDir) });

  const result = await ipcMain.invoke('mathmachine:save-user-data', 'not an object');
  assert.equal(result.ok, false);
});

test('registerMathmachineIpc: load-user-data returns the fallback for a corrupted file', async () => {
  const appDataDir = tmpAppDataDir();
  fs.mkdirSync(path.join(appDataDir, 'kiosk-mathmachine'), { recursive: true });
  fs.writeFileSync(path.join(appDataDir, 'kiosk-mathmachine', 'userdata.json'), 'not json', 'utf-8');

  const ipcMain = makeFakeIpcMain();
  registerMathmachineIpc({ ipcMain, app: makeFakeApp(appDataDir) });

  const result = await ipcMain.invoke('mathmachine:load-user-data');
  assert.deepEqual(result, { schemaVersion: 1, progress: {}, soundOn: true });
});
