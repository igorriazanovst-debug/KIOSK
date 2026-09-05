import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseNatComProject,
  parseNatComLibrary,
  assertProjectReferencesExist,
  NatComParseError,
} from './project';

function makeLibrary() {
  return {
    schemaVersion: 1,
    backgrounds: [{ id: 'b1', name: 'Тайга', imageMediaId: 'm1' }],
    categories: [{ id: 'c1', name: 'Млекопитающие' }],
    objects: [{ id: 'o1', categoryId: 'c1', name: 'Медведь', description: 'Хищник', imageMediaId: 'm2' }],
    media: [],
  };
}

function makeProject(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    id: 'p1',
    title: 'Тайга',
    backgroundId: 'b1',
    objects: [{ id: 'po1', libraryObjectId: 'o1', xFraction: 0.1, yFraction: 0.1, widthFraction: 0.2, heightFraction: 0.2 }],
    ownerId: 'u1',
    organizationId: 'org1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

test('parseNatComProject accepts a well-formed document', () => {
  const project = parseNatComProject(makeProject());
  assert.equal(project.id, 'p1');
  assert.equal(project.objects.length, 1);
});

test('parseNatComProject throws NatComParseError (not a raw zod error) for a malformed document', () => {
  assert.throws(() => parseNatComProject({ not: 'a project' }), NatComParseError);
});

test('parseNatComProject throws a descriptive error for a document from a newer, unknown schema version', () => {
  assert.throws(() => parseNatComProject(makeProject({ schemaVersion: 999 })), /более новой версией/);
});

test('parseNatComProject does not crash on completely garbage input (null, array, primitive)', () => {
  // НФТ "Надёжность" (ТЗ раздел 9) - битый импорт не должен ронять процесс,
  // должен дать понятную ошибку.
  for (const garbage of [null, undefined, 42, 'string', [], () => {}]) {
    assert.throws(() => parseNatComProject(garbage), NatComParseError);
  }
});

test('parseNatComLibrary accepts a well-formed document and rejects garbage', () => {
  const library = parseNatComLibrary(makeLibrary());
  assert.equal(library.objects.length, 1);
  assert.throws(() => parseNatComLibrary({ backgrounds: 'not-an-array' }), NatComParseError);
});

test('assertProjectReferencesExist passes for a project whose references exist in the library', () => {
  assert.doesNotThrow(() => assertProjectReferencesExist(parseNatComProject(makeProject()), parseNatComLibrary(makeLibrary())));
});

test('assertProjectReferencesExist throws for a dangling backgroundId', () => {
  const project = parseNatComProject(makeProject({ backgroundId: 'does-not-exist' }));
  assert.throws(() => assertProjectReferencesExist(project, parseNatComLibrary(makeLibrary())), NatComParseError);
});

test('assertProjectReferencesExist throws for a dangling libraryObjectId on a scene object', () => {
  const project = parseNatComProject(makeProject({
    objects: [{ id: 'po1', libraryObjectId: 'ghost', xFraction: 0, yFraction: 0, widthFraction: 1, heightFraction: 1 }],
  }));
  assert.throws(() => assertProjectReferencesExist(project, parseNatComLibrary(makeLibrary())), NatComParseError);
});
