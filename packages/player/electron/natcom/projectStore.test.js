import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  listProjects,
  createProject,
  loadProject,
  saveProject,
  deleteProject,
  projectsRoot,
} from './projectStore.js';
import { PathGuardError } from '../chrono/pathGuard.js';

function tmpBaseDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'natcom-projects-'));
}

function makeParams(overrides = {}) {
  return {
    title: 'Тайга сибирская',
    backgroundId: 'b1',
    ownerId: 'u1',
    organizationId: 'org1',
    ...overrides,
  };
}

test('listProjects returns an empty array when nothing was ever created', () => {
  assert.deepEqual(listProjects(tmpBaseDir()), []);
});

test('createProject persists a project that shows up in listProjects', () => {
  const baseDir = tmpBaseDir();
  const created = createProject(baseDir, makeParams());

  assert.equal(created.title, 'Тайга сибирская');
  assert.equal(created.ownerId, 'u1');
  assert.equal(created.organizationId, 'org1');
  assert.equal(created.isDefault, false);
  assert.equal(created.createdAt, created.updatedAt);
  assert.ok(created.id);

  const list = listProjects(baseDir);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, created.id);
});

test('createProject falls back to a default title when given an empty one', () => {
  const created = createProject(tmpBaseDir(), makeParams({ title: '   ' }));
  assert.equal(created.title, 'Без названия');
});

test('loadProject returns the same project that createProject persisted', () => {
  const baseDir = tmpBaseDir();
  const created = createProject(baseDir, makeParams());
  const loaded = loadProject(baseDir, created.id);
  assert.deepEqual(loaded, created);
});

test('saveProject validates before writing and bumps updatedAt', async () => {
  const baseDir = tmpBaseDir();
  const created = createProject(baseDir, makeParams());

  // Гарантируем, что updatedAt реально изменится (ISO-строка с секундной точностью).
  await new Promise((r) => setTimeout(r, 10));

  const withOneObject = {
    ...created,
    objects: [{ id: 'po1', libraryObjectId: 'o1', xFraction: 0.1, yFraction: 0.1, widthFraction: 0.2, heightFraction: 0.2 }],
  };
  const saved = saveProject(baseDir, created.id, withOneObject);

  assert.equal(saved.objects.length, 1);
  assert.notEqual(saved.updatedAt, created.updatedAt);

  const reloaded = loadProject(baseDir, created.id);
  assert.deepEqual(reloaded, saved);
});

test('saveProject rejects a malformed document and leaves the file on disk untouched', () => {
  const baseDir = tmpBaseDir();
  const created = createProject(baseDir, makeParams());

  assert.throws(() => saveProject(baseDir, created.id, { ...created, backgroundId: '' }));

  const stillOnDisk = loadProject(baseDir, created.id);
  assert.deepEqual(stillOnDisk, created);
});

test('a corrupted project directory is silently skipped by listProjects, not thrown', () => {
  const baseDir = tmpBaseDir();
  createProject(baseDir, makeParams());

  const brokenDir = path.join(projectsRoot(baseDir), 'broken-id');
  fs.mkdirSync(brokenDir, { recursive: true });
  fs.writeFileSync(path.join(brokenDir, 'project.json'), 'not json at all {{{');

  assert.equal(listProjects(baseDir).length, 1);
});

test('deleteProject removes the project directory entirely', () => {
  const baseDir = tmpBaseDir();
  const created = createProject(baseDir, makeParams());
  deleteProject(baseDir, created.id);

  assert.equal(listProjects(baseDir).length, 0);
  assert.throws(() => loadProject(baseDir, created.id));
});

test('a projectId that attempts path traversal is rejected by pathGuard, not resolved outside the root', () => {
  const baseDir = tmpBaseDir();
  assert.throws(() => loadProject(baseDir, '../../etc'), PathGuardError);
});
