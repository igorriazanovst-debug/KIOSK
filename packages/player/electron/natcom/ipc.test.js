// packages/player/electron/natcom/ipc.test.js
// registerNatComIpc принимает ipcMain/app/dialog как параметры (не берёт их
// глобально из 'electron') - специально для этого: тест строит рабочие
// подставные объекты (не мокает саму функцию) и вызывает
// ЗАРЕГИСТРИРОВАННЫЕ РЕАЛЬНЫЕ обработчики напрямую, с реальной файловой
// системой (временный каталог), реальной библиотекой (packages/natcom-library,
// та же, что использует настоящий Electron) и реальной валидацией схемой.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { registerNatComIpc, parseImportedProject } from './ipc.js';

function tmpUserDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'natcom-ipc-userdata-'));
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

function makeFakeApp(userDataDir) {
  return { getPath: () => userDataDir };
}

function makeFakeDialog({ saveResult, openResult } = {}) {
  return {
    showSaveDialog: async () => saveResult ?? { canceled: true },
    showOpenDialog: async () => openResult ?? { canceled: true },
  };
}

const CONTEXT = { ownerId: 'owner-1', organizationId: 'org-1' };

test('parseImportedProject rejects malformed JSON with a clear message, not a raw parse error', () => {
  assert.throws(() => parseImportedProject('{not json', null), /повреждён/);
});

test('parseImportedProject rejects a document that fails schema validation', () => {
  assert.throws(() => parseImportedProject(JSON.stringify({ not: 'a project' }), null));
});

test('parseImportedProject rejects a project referencing a background/object absent from the given library', () => {
  const library = { schemaVersion: 1, backgrounds: [{ id: 'b-real', name: 'x', imageMediaId: 'm1' }], categories: [], objects: [], media: [] };
  const project = {
    schemaVersion: 1,
    id: 'p1',
    title: 'Импорт',
    backgroundId: 'b-does-not-exist',
    objects: [],
    ownerId: 'u1',
    organizationId: 'org1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  assert.throws(() => parseImportedProject(JSON.stringify(project), library), /несуществующий фон/);
});

test('export: writes the loaded project as pretty JSON to the chosen path, using its title as the suggested filename', async () => {
  const userDataDir = tmpUserDataDir();
  const ipcMain = makeFakeIpcMain();
  const savePath = path.join(userDataDir, 'exported.natcom');
  const dialog = makeFakeDialog({ saveResult: { canceled: false, filePath: savePath } });
  registerNatComIpc({ ipcMain, app: makeFakeApp(userDataDir), dialog });

  const created = await ipcMain.invoke('natcom:create-project', { title: 'Тайга (тест экспорта)', backgroundId: 'b1', ...CONTEXT });
  try {
    const result = await ipcMain.invoke('natcom:export-project', created.id);
    assert.deepEqual(result, { success: true, filePath: savePath });

    const written = JSON.parse(fs.readFileSync(savePath, 'utf8'));
    assert.equal(written.id, created.id);
    assert.equal(written.title, 'Тайга (тест экспорта)');
  } finally {
    await ipcMain.invoke('natcom:delete-project', created.id);
  }
});

test('export: a canceled save dialog does not write any file and reports canceled', async () => {
  const userDataDir = tmpUserDataDir();
  const ipcMain = makeFakeIpcMain();
  const dialog = makeFakeDialog({ saveResult: { canceled: true } });
  registerNatComIpc({ ipcMain, app: makeFakeApp(userDataDir), dialog });

  const created = await ipcMain.invoke('natcom:create-project', { title: 'X (тест экспорта)', backgroundId: 'b1', ...CONTEXT });
  try {
    const result = await ipcMain.invoke('natcom:export-project', created.id);
    assert.deepEqual(result, { success: false, canceled: true });
  } finally {
    await ipcMain.invoke('natcom:delete-project', created.id);
  }
});

// resolveStorageDir предпочитает ОБЩИЙ путь на диске (C:\ProgramData\kiosk-natcom
// на Windows), а не переданный userDataDir - тот только запасной вариант,
// когда общий путь не пишется (см. storageDir.js, Эпик 3). На реальной
// машине разработчика общий путь пишется всегда, поэтому list-projects в
// этих тестах видит ОБЩЕЕ состояние, а не изолированный временный каталог -
// проверяем по id созданного объекта, а не по длине списка, и подчищаем за
// собой, чтобы не засорять реальный C:\ProgramData\kiosk-natcom\ на машине.

test('import: a valid exported file round-trips into a brand-new project (new id, current context, same objects)', async () => {
  const userDataDir = tmpUserDataDir();
  const ipcMain = makeFakeIpcMain();
  const importFile = path.join(userDataDir, 'to-import.natcom');
  const sourceProject = {
    schemaVersion: 1,
    id: 'original-id-from-someone-elses-device',
    title: 'Тайга сибирская (тест импорта)',
    backgroundId: 'b1',
    objects: [
      { id: 'obj-1', libraryObjectId: 'o1', xFraction: 0.1, yFraction: 0.1, widthFraction: 0.2, heightFraction: 0.2, rotation: 0, flip: false },
    ],
    ownerId: 'someone-elses-owner-id',
    organizationId: 'someone-elses-org-id',
    createdAt: '2020-01-01T00:00:00.000Z',
    updatedAt: '2020-01-01T00:00:00.000Z',
  };
  fs.writeFileSync(importFile, JSON.stringify(sourceProject));
  const dialog = makeFakeDialog({ openResult: { canceled: false, filePaths: [importFile] } });
  registerNatComIpc({ ipcMain, app: makeFakeApp(userDataDir), dialog });

  const imported = await ipcMain.invoke('natcom:import-project', CONTEXT);
  try {
    assert.notEqual(imported.id, sourceProject.id);
    assert.equal(imported.title, 'Тайга сибирская (тест импорта)');
    assert.equal(imported.backgroundId, 'b1');
    assert.equal(imported.ownerId, CONTEXT.ownerId);
    assert.equal(imported.organizationId, CONTEXT.organizationId);
    assert.deepEqual(imported.objects, sourceProject.objects);

    const listed = await ipcMain.invoke('natcom:list-projects');
    assert.ok(listed.some((p) => p.id === imported.id));
  } finally {
    await ipcMain.invoke('natcom:delete-project', imported.id);
  }
});

test('import: a canceled open dialog returns null and creates nothing', async () => {
  const userDataDir = tmpUserDataDir();
  const ipcMain = makeFakeIpcMain();
  const dialog = makeFakeDialog({ openResult: { canceled: true, filePaths: [] } });
  registerNatComIpc({ ipcMain, app: makeFakeApp(userDataDir), dialog });

  const result = await ipcMain.invoke('natcom:import-project', CONTEXT);
  assert.equal(result, null);
});

test('import: a file with an unresolvable library reference is rejected and creates nothing', async () => {
  const userDataDir = tmpUserDataDir();
  const ipcMain = makeFakeIpcMain();
  const importFile = path.join(userDataDir, 'broken.natcom');
  const sourceProject = {
    schemaVersion: 1,
    id: 'p1',
    title: 'Битая презентация (тест импорта)',
    backgroundId: 'b1',
    objects: [
      { id: 'obj-1', libraryObjectId: 'o-does-not-exist', xFraction: 0.1, yFraction: 0.1, widthFraction: 0.2, heightFraction: 0.2, rotation: 0, flip: false },
    ],
    ownerId: 'x',
    organizationId: 'y',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(importFile, JSON.stringify(sourceProject));
  const dialog = makeFakeDialog({ openResult: { canceled: false, filePaths: [importFile] } });
  registerNatComIpc({ ipcMain, app: makeFakeApp(userDataDir), dialog });

  await assert.rejects(() => ipcMain.invoke('natcom:import-project', CONTEXT), /несуществующий объект/);

  const listed = await ipcMain.invoke('natcom:list-projects');
  assert.ok(!listed.some((p) => p.title === 'Битая презентация (тест импорта)'));
});
