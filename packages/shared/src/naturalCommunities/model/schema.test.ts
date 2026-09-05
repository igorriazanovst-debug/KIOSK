import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MediaFileSchema,
  BackgroundSchema,
  CategorySchema,
  LibraryObjectSchema,
  NatComLibrarySchema,
  NATCOM_LIBRARY_SCHEMA_VERSION,
  ProjectObjectSchema,
  NatComProjectSchema,
  NATCOM_PROJECT_SCHEMA_VERSION,
  ConnectionSessionSchema,
  ConnectionStatsSchema,
} from './schema';

test('MediaFileSchema accepts a well-formed media file', () => {
  const result = MediaFileSchema.safeParse({
    id: 'm1',
    fileName: 'bear.png',
    mimeType: 'image/png',
    fileSize: 12345,
    sha256: 'a'.repeat(64),
  });
  assert.equal(result.success, true);
});

test('MediaFileSchema rejects a sha256 that is not 64 lowercase hex chars', () => {
  assert.equal(MediaFileSchema.safeParse({
    id: 'm1', fileName: 'bear.png', mimeType: 'image/png', fileSize: 1, sha256: 'ABCDEF',
  }).success, false);
});

test('MediaFileSchema rejects a fileName containing a path separator', () => {
  assert.equal(MediaFileSchema.safeParse({
    id: 'm1', fileName: '../etc/passwd', mimeType: 'image/png', fileSize: 1, sha256: 'a'.repeat(64),
  }).success, false);
});

test('BackgroundSchema and CategorySchema accept minimal well-formed records', () => {
  assert.equal(BackgroundSchema.safeParse({ id: 'b1', name: 'Тайга сибирская', imageMediaId: 'm1' }).success, true);
  assert.equal(CategorySchema.safeParse({ id: 'c1', name: 'Млекопитающие' }).success, true);
});

test('LibraryObjectSchema requires a description (ТЗ FR-017) and accepts a missing animation', () => {
  const withoutAnimation = LibraryObjectSchema.safeParse({
    id: 'o1', categoryId: 'c1', name: 'Бурый медведь', description: 'Крупный хищник...', imageMediaId: 'm1',
  });
  assert.equal(withoutAnimation.success, true);

  const noDescription = LibraryObjectSchema.safeParse({
    id: 'o1', categoryId: 'c1', name: 'Бурый медведь', description: '', imageMediaId: 'm1',
  });
  assert.equal(noDescription.success, false);
});

test('NatComLibrarySchema fills in empty defaults and rejects the wrong schemaVersion', () => {
  const minimal = NatComLibrarySchema.safeParse({ schemaVersion: NATCOM_LIBRARY_SCHEMA_VERSION });
  assert.equal(minimal.success, true);
  if (minimal.success) {
    assert.deepEqual(minimal.data.backgrounds, []);
    assert.deepEqual(minimal.data.categories, []);
    assert.deepEqual(minimal.data.objects, []);
  }

  assert.equal(NatComLibrarySchema.safeParse({ schemaVersion: 999 }).success, false);
});

test('ProjectObjectSchema rejects fractional coordinates outside 0..1', () => {
  const base = { id: 'po1', libraryObjectId: 'o1', xFraction: 0.1, yFraction: 0.1, widthFraction: 0.2, heightFraction: 0.2 };
  assert.equal(ProjectObjectSchema.safeParse(base).success, true);
  assert.equal(ProjectObjectSchema.safeParse({ ...base, xFraction: 1.5 }).success, false);
  assert.equal(ProjectObjectSchema.safeParse({ ...base, widthFraction: 0 }).success, false);
});

test('ProjectObjectSchema defaults rotation/flip when omitted', () => {
  const result = ProjectObjectSchema.safeParse({
    id: 'po1', libraryObjectId: 'o1', xFraction: 0, yFraction: 0, widthFraction: 1, heightFraction: 1,
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.rotation, 0);
    assert.equal(result.data.flip, false);
  }
});

test('NatComProjectSchema accepts a minimal well-formed presentation and rejects the wrong schemaVersion', () => {
  const project = {
    schemaVersion: NATCOM_PROJECT_SCHEMA_VERSION,
    id: 'p1',
    title: 'Тайга',
    backgroundId: 'b1',
    ownerId: 'u1',
    organizationId: 'org1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  assert.equal(NatComProjectSchema.safeParse(project).success, true);
  assert.equal(NatComProjectSchema.safeParse({ ...project, schemaVersion: 2 }).success, false);
});

test('ConnectionSessionSchema/ConnectionStatsSchema accept well-formed records', () => {
  assert.equal(ConnectionSessionSchema.safeParse({
    id: 's1', socketId: 'sock1', connectedAt: '2026-01-01T00:00:00.000Z', disconnectedAt: null,
  }).success, true);
  assert.equal(ConnectionStatsSchema.safeParse({ updatedAt: '2026-01-01T00:00:00.000Z' }).success, true);
});
