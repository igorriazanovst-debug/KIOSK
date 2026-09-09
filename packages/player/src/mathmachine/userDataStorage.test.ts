import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadUserData, saveUserData } from './userDataStorage';
import { MATHMACHINE_USERDATA_SCHEMA_VERSION } from '@kiosk/shared';

test('loadUserData returns a valid default when no file exists yet', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-test-'));
  const data = loadUserData(dir);
  assert.equal(data.schemaVersion, MATHMACHINE_USERDATA_SCHEMA_VERSION);
  assert.deepEqual(data.progress, {});
  assert.equal(data.soundOn, true);
});

test('saveUserData then loadUserData round-trips the same data', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-test-'));
  const data = {
    schemaVersion: MATHMACHINE_USERDATA_SCHEMA_VERSION as const,
    progress: { g1: { doneTaskIds: ['t1'], currentTaskId: 't2' } },
    soundOn: false,
  };
  saveUserData(data, dir);
  const loaded = loadUserData(dir);
  assert.deepEqual(loaded, data);
});

test('loadUserData falls back to defaults when the file on disk is corrupt', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-test-'));
  fs.writeFileSync(path.join(dir, 'userdata.json'), 'not valid json{{{', 'utf-8');
  const data = loadUserData(dir);
  assert.deepEqual(data.progress, {});
});

test('saveUserData does not leave a stray .tmp file behind', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-test-'));
  saveUserData({ schemaVersion: MATHMACHINE_USERDATA_SCHEMA_VERSION, progress: {}, soundOn: true }, dir);
  assert.equal(fs.existsSync(path.join(dir, 'userdata.json.tmp')), false);
  assert.equal(fs.existsSync(path.join(dir, 'userdata.json')), true);
});
