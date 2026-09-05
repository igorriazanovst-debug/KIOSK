import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { computeSharedDataDir, canWrite, resolveStorageDir, APP_DIR_NAME } from './storageDir.js';

test('computeSharedDataDir returns a ProgramData path on win32', () => {
  const dir = computeSharedDataDir('win32');
  assert.ok(dir.includes(APP_DIR_NAME));
  assert.ok(dir.toLowerCase().includes('programdata'));
});

test('computeSharedDataDir returns /var/lib path on linux', () => {
  assert.equal(computeSharedDataDir('linux'), path.join('/var/lib', APP_DIR_NAME));
});

test('computeSharedDataDir returns /Library path on darwin', () => {
  assert.equal(computeSharedDataDir('darwin'), path.join('/Library/Application Support', APP_DIR_NAME));
});

test('computeSharedDataDir throws for an unsupported platform', () => {
  assert.throws(() => computeSharedDataDir('freebsd'));
});

test('canWrite returns true for a writable directory, creating it if missing', () => {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'chrono-write-')), 'nested', 'dir');
  assert.equal(fs.existsSync(dir), false);
  assert.equal(canWrite(dir), true);
  assert.equal(fs.existsSync(dir), true);
});

test('canWrite returns false (not throws) when the path cannot be created as a directory', () => {
  // A regular file sitting where canWrite expects to mkdir makes fs.mkdirSync
  // fail with EEXIST/ENOTDIR - a portable way to force the failure branch
  // without needing real permission manipulation.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chrono-write-'));
  const blockingFile = path.join(tmp, 'blocked');
  fs.writeFileSync(blockingFile, 'not a directory');
  const dirThatCannotBeCreated = path.join(blockingFile, 'nested');

  assert.equal(canWrite(dirThatCannotBeCreated), false);
});

test('canWrite cleans up its own probe file and leaves no trace', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrono-write-'));
  canWrite(dir);
  const leftovers = fs.readdirSync(dir).filter((f) => f.startsWith('.write-test-'));
  assert.deepEqual(leftovers, []);
});

test('resolveStorageDir returns an existing directory and a boolean isFallback flag', () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrono-userdata-'));
  const result = resolveStorageDir({ platform: process.platform, userDataDir });

  assert.equal(typeof result.dir, 'string');
  assert.equal(fs.existsSync(result.dir), true);
  assert.equal(typeof result.isFallback, 'boolean');
});

test('resolveStorageDir falls back under userDataDir when the shared location is unwritable', () => {
  // sharedDirOverride points at a path that canWrite() cannot turn into a
  // directory (a file sits in the way) - the portable way to force the
  // fallback branch deterministically, without real permission manipulation.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chrono-shared-'));
  const blockingFile = path.join(tmp, 'blocked');
  fs.writeFileSync(blockingFile, 'not a directory');
  const unwritableShared = path.join(blockingFile, 'kiosk-chrono');

  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrono-userdata-'));
  const result = resolveStorageDir({
    platform: process.platform,
    userDataDir,
    sharedDirOverride: unwritableShared,
  });

  assert.equal(result.isFallback, true);
  assert.equal(result.dir, path.join(userDataDir, 'chrono'));
  assert.equal(fs.existsSync(result.dir), true);
});

test('resolveStorageDir still throws for a genuinely unsupported platform with no override', () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrono-userdata-'));
  assert.throws(() => resolveStorageDir({ platform: 'freebsd', userDataDir }));
});

// ─── appDirName override - naturalcommunities uses its own storage dir ─────

test('computeSharedDataDir with a custom appDirName does not use the default APP_DIR_NAME', () => {
  const dir = computeSharedDataDir('win32', 'kiosk-natcom');
  assert.ok(dir.includes('kiosk-natcom'));
  assert.ok(!dir.includes(APP_DIR_NAME));
});

test('resolveStorageDir with a custom appDirName/fallbackSubdir keeps naturalcommunities data separate from chrono', () => {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'natcom-userdata-'));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'natcom-shared-'));
  const blockingFile = path.join(tmp, 'blocked');
  fs.writeFileSync(blockingFile, 'not a directory');
  const unwritableShared = path.join(blockingFile, 'kiosk-natcom');

  const result = resolveStorageDir({
    platform: process.platform,
    userDataDir,
    sharedDirOverride: unwritableShared,
    appDirName: 'kiosk-natcom',
    fallbackSubdir: 'natcom',
  });

  assert.equal(result.isFallback, true);
  assert.equal(result.dir, path.join(userDataDir, 'natcom'));
});
