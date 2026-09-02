import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  listProjects,
  createProject,
  renameProject,
  deleteProject,
  readManifest,
  loadProjectData,
  saveProjectData,
  projectsRoot,
  MAX_NAME_LENGTH,
} from './projectStore.js';
import { PathGuardError } from './pathGuard.js';

function tmpBaseDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'chrono-projects-'));
}

test('listProjects returns an empty array when nothing was ever created', () => {
  const baseDir = tmpBaseDir();
  assert.deepEqual(listProjects(baseDir), []);
});

test('createProject creates a manifest that shows up in listProjects', () => {
  const baseDir = tmpBaseDir();
  const created = createProject(baseDir, 'Вторая мировая война');

  assert.equal(created.name, 'Вторая мировая война');
  assert.equal(created.schemaVersion, 1);
  assert.ok(created.id);
  assert.equal(created.createdAt, created.updatedAt);

  const list = listProjects(baseDir);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, created.id);
});

test('createProject creates the timelines/ and media/ subdirectories', () => {
  const baseDir = tmpBaseDir();
  const created = createProject(baseDir, 'Проект');
  const dir = path.join(projectsRoot(baseDir), created.id);

  assert.equal(fs.existsSync(path.join(dir, 'timelines')), true);
  assert.equal(fs.existsSync(path.join(dir, 'media')), true);
});

test('createProject falls back to a default name for empty/blank input', () => {
  const baseDir = tmpBaseDir();
  assert.equal(createProject(baseDir, '').name, 'Без названия');
  assert.equal(createProject(baseDir, '   ').name, 'Без названия');
  assert.equal(createProject(baseDir, undefined).name, 'Без названия');
});

test('createProject truncates an excessively long name', () => {
  const baseDir = tmpBaseDir();
  const created = createProject(baseDir, 'a'.repeat(500));
  assert.equal(created.name.length, MAX_NAME_LENGTH);
});

test('listProjects sorts by updatedAt, most recent first', async () => {
  const baseDir = tmpBaseDir();
  const first = createProject(baseDir, 'Первый');
  await new Promise((r) => setTimeout(r, 5));
  const second = createProject(baseDir, 'Второй');

  const list = listProjects(baseDir);
  assert.equal(list[0].id, second.id);
  assert.equal(list[1].id, first.id);
});

test('renameProject updates the name and updatedAt, keeps id and createdAt', async () => {
  const baseDir = tmpBaseDir();
  const created = createProject(baseDir, 'Старое имя');
  await new Promise((r) => setTimeout(r, 5));

  const renamed = renameProject(baseDir, created.id, 'Новое имя');

  assert.equal(renamed.name, 'Новое имя');
  assert.equal(renamed.id, created.id);
  assert.equal(renamed.createdAt, created.createdAt);
  assert.notEqual(renamed.updatedAt, created.updatedAt);
});

test('renameProject persists to disk (re-reading finds the new name)', () => {
  const baseDir = tmpBaseDir();
  const created = createProject(baseDir, 'A');
  renameProject(baseDir, created.id, 'B');

  assert.equal(readManifest(baseDir, created.id).name, 'B');
});

test('deleteProject removes the project entirely', () => {
  const baseDir = tmpBaseDir();
  const created = createProject(baseDir, 'Удалить меня');

  deleteProject(baseDir, created.id);

  assert.deepEqual(listProjects(baseDir), []);
  assert.equal(fs.existsSync(path.join(projectsRoot(baseDir), created.id)), false);
});

test('deleteProject on a non-existent id does not throw', () => {
  const baseDir = tmpBaseDir();
  assert.doesNotThrow(() => deleteProject(baseDir, 'never-existed'));
});

test('a manifest left over from a crashed write (leftover .tmp-* file) does not corrupt the real manifest', () => {
  // Atomic write = write to a .tmp file, then rename. If the process died
  // between those two steps, a stray .tmp-* file can be left behind - it
  // must never be picked up as if it were the real project.json.
  const baseDir = tmpBaseDir();
  const created = createProject(baseDir, 'Оригинал');
  const dir = path.join(projectsRoot(baseDir), created.id);
  fs.writeFileSync(path.join(dir, `${created.id}.tmp-leftover`), 'garbage, not json');

  assert.equal(readManifest(baseDir, created.id).name, 'Оригинал');
  assert.equal(listProjects(baseDir).length, 1);
});

test('listProjects skips a directory with a corrupted manifest instead of throwing', () => {
  const baseDir = tmpBaseDir();
  const good = createProject(baseDir, 'Хороший');
  const badDir = path.join(projectsRoot(baseDir), 'corrupted-project-id');
  fs.mkdirSync(badDir, { recursive: true });
  fs.writeFileSync(path.join(badDir, 'project.json'), '{ not valid json');

  const list = listProjects(baseDir);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, good.id);
});

test('projectId path traversal is rejected by every operation that takes one', () => {
  const baseDir = tmpBaseDir();
  const evil = '../../etc';

  assert.throws(() => readManifest(baseDir, evil), PathGuardError);
  assert.throws(() => renameProject(baseDir, evil, 'x'), PathGuardError);
  assert.throws(() => deleteProject(baseDir, evil), PathGuardError);
  assert.throws(() => loadProjectData(baseDir, evil), PathGuardError);
  assert.throws(() => saveProjectData(baseDir, evil, {}), PathGuardError);
});

test('createProject seeds content.json with an empty, schema-valid project matching the manifest', () => {
  const baseDir = tmpBaseDir();
  const created = createProject(baseDir, 'Музей СВО');

  const data = loadProjectData(baseDir, created.id);
  assert.equal(data.id, created.id);
  assert.equal(data.name, created.name);
  assert.equal(data.schemaVersion, 1);
  assert.deepEqual(data.timelines, []);
  assert.deepEqual(data.media, []);
  assert.equal(data.createdAt, created.createdAt);
});

test('saveProjectData persists a timeline and is visible on the next loadProjectData', () => {
  const baseDir = tmpBaseDir();
  const created = createProject(baseDir, 'Проект');
  const data = loadProjectData(baseDir, created.id);

  const withTimeline = {
    ...data,
    timelines: [
      {
        id: 'tl-1',
        name: 'Основная линия',
        events: [],
        attributes: [],
        collapsed: false,
      },
    ],
  };
  saveProjectData(baseDir, created.id, withTimeline);

  const reloaded = loadProjectData(baseDir, created.id);
  assert.equal(reloaded.timelines.length, 1);
  assert.equal(reloaded.timelines[0].name, 'Основная линия');
});

test('saveProjectData bumps the manifest updatedAt', async () => {
  const baseDir = tmpBaseDir();
  const created = createProject(baseDir, 'Проект');
  const data = loadProjectData(baseDir, created.id);
  await new Promise((r) => setTimeout(r, 5));

  saveProjectData(baseDir, created.id, data);

  assert.notEqual(readManifest(baseDir, created.id).updatedAt, created.updatedAt);
});

test('saveProjectData rejects a document that fails schema validation and does not touch the file on disk', () => {
  const baseDir = tmpBaseDir();
  const created = createProject(baseDir, 'Проект');
  const before = loadProjectData(baseDir, created.id);

  assert.throws(() => saveProjectData(baseDir, created.id, { ...before, schemaVersion: 999 }));

  assert.deepEqual(loadProjectData(baseDir, created.id), before);
});

test('saveProjectData rejects a moment with NaN/Infinity (assertProjectSerializable) before writing', () => {
  const baseDir = tmpBaseDir();
  const created = createProject(baseDir, 'Проект');
  const before = loadProjectData(baseDir, created.id);

  const withBadMoment = {
    ...before,
    timelines: [
      {
        id: 'tl-1',
        name: 'Линия',
        events: [
          {
            id: 'ev-1',
            interval: {
              start: {
                kind: 'epoch',
                yearsBeforeEpoch: Number.NaN,
                precision: 'millionYears',
                approximate: false,
              },
              end: null,
            },
            name: 'Событие',
            mediaIds: [],
            attributeValues: {},
            view: 'compact',
            verticalPriority: 1000,
          },
        ],
        attributes: [],
        collapsed: false,
      },
    ],
  };

  assert.throws(() => saveProjectData(baseDir, created.id, withBadMoment));
  assert.deepEqual(loadProjectData(baseDir, created.id), before);
});

test('loadProjectData on a project with a corrupted content.json throws a clear error instead of returning garbage', () => {
  const baseDir = tmpBaseDir();
  const created = createProject(baseDir, 'Проект');
  const dir = path.join(projectsRoot(baseDir), created.id);
  fs.writeFileSync(path.join(dir, 'content.json'), '{ not valid json');

  assert.throws(() => loadProjectData(baseDir, created.id));
});
