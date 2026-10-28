import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyUserData, type TestResult } from './model/schema.ts';
import {
  addAccount, removeAccount, recordResult, signaturesFor, resultsFor, markTask, loadUserData, saveUserData, storageKey,
  type KeyValueStorage,
} from './userData.ts';

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { map: Record<string, string> } {
  const map = { ...initial };
  return {
    map,
    getItem: (k) => (k in map ? map[k] : null),
    setItem: (k, v) => { map[k] = v; },
  };
}

function result(accountId: string, signature: string, finishedAt = 1): TestResult {
  return { id: `r-${signature}-${finishedAt}`, accountId, finishedAt, durationSeconds: 60, correct: 5, total: 10, grade: 3, signature, questionIds: ['a'] };
}

test('addAccount trims the name and returns a new object', () => {
  const before = emptyUserData();
  const { data, account } = addAccount(before, '  Мария  ', 100);
  assert.equal(account.name, 'Мария');
  assert.equal(data.accounts.length, 1);
  assert.equal(before.accounts.length, 0);
});

test('addAccount rejects an empty name', () => {
  assert.throws(() => addAccount(emptyUserData(), '   ', 1));
});

test('addAccount rejects a duplicate name regardless of case', () => {
  const { data } = addAccount(emptyUserData(), 'Мария', 1);
  assert.throws(() => addAccount(data, 'мария', 2));
});

test('removeAccount drops the account together with its results and progress', () => {
  let { data, account } = addAccount(emptyUserData(), 'Пётр', 1);
  data = recordResult(data, result(account.id, 's1'));
  data = markTask(data, account.id, 'task-1', true);
  const after = removeAccount(data, account.id);
  assert.equal(after.accounts.length, 0);
  assert.equal(after.results.length, 0);
  assert.deepEqual(after.taskProgress, {});
});

test('signaturesFor lists only signatures of the given account', () => {
  let data = emptyUserData();
  data = recordResult(data, result('a', 's1'));
  data = recordResult(data, result('b', 's2'));
  assert.deepEqual(signaturesFor(data, 'a'), ['s1']);
});

test('resultsFor returns newest first', () => {
  let data = emptyUserData();
  data = recordResult(data, result('a', 's1', 10));
  data = recordResult(data, result('a', 's2', 20));
  assert.deepEqual(resultsFor(data, 'a').map((r) => r.signature), ['s2', 's1']);
});

test('markTask stores progress per account and can clear it', () => {
  let data = markTask(emptyUserData(), 'a', 't1', true);
  assert.equal(data.taskProgress.a.t1, true);
  data = markTask(data, 'a', 't1', false);
  assert.equal(data.taskProgress.a.t1, false);
});

test('saveUserData then loadUserData round-trips', () => {
  const storage = memoryStorage();
  const { data } = addAccount(emptyUserData(), 'Ольга', 5);
  saveUserData(storage, 'eumk-nach', data);
  assert.deepEqual(loadUserData(storage, 'eumk-nach'), { status: 'ok', data });
});

test('loadUserData gives empty data when nothing is stored', () => {
  const loaded = loadUserData(memoryStorage(), 'eumk-nach');
  assert.equal(loaded.status, 'empty');
  assert.deepEqual(loaded.data, emptyUserData());
});

test('loadUserData reports corruption instead of silently resetting', () => {
  const storage = memoryStorage({ [storageKey('eumk-nach')]: '{broken' });
  const loaded = loadUserData(storage, 'eumk-nach');
  assert.equal(loaded.status, 'corrupt');
  assert.deepEqual(loaded.data, emptyUserData());
});

test('corrupt data is kept under a backup key before it can be overwritten', () => {
  const storage = memoryStorage({ [storageKey('eumk-nach')]: '{broken' });
  loadUserData(storage, 'eumk-nach');
  assert.equal(storage.map[`${storageKey('eumk-nach')}:corrupt`], '{broken');
});

test('different complexes keep separate storage keys', () => {
  assert.notEqual(storageKey('eumk-nach'), storageKey('eumk-dosh'));
});

test('saveUserData swallows storage failures and reports them', () => {
  const failing: KeyValueStorage = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
  assert.equal(saveUserData(failing, 'x', emptyUserData()), false);
});
