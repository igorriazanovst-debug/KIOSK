import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyUserData, type PasswordRecord, type TestResult } from './model/schema.ts';
import {
  addAccount, removeAccount, recordResult, signaturesFor, resultsFor, markTask, loadUserData, saveUserData, setAccountPassword, storageKey,
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

// ---------- K5-1: пароль учётной записи ----------

const record: PasswordRecord = {
  version: 1,
  algo: 'pbkdf2-sha256',
  iterations: 1000,
  salt: 'ab'.repeat(16),
  hash: 'cd'.repeat(32),
  keyLen: 32,
};

test('setAccountPassword stores the record on exactly that account and mutates nothing', () => {
  const withFirst = addAccount(emptyUserData(), 'Ученик 1', 1).data;
  const withBoth = addAccount(withFirst, 'Ученик 2', 2).data;
  const firstId = withFirst.accounts[0].id;
  const next = setAccountPassword(withBoth, firstId, record);
  assert.equal(withBoth.accounts[0].password, null); // исходный объект не тронут
  assert.deepEqual(next.accounts.find((a) => a.id === firstId)!.password, record);
  assert.equal(next.accounts.find((a) => a.id !== firstId)!.password, null);
});

test('setAccountPassword throws for an unknown account id', () => {
  assert.throws(() => setAccountPassword(emptyUserData(), 'acc-nope', record), /не найдена/);
});

test('addAccount can create an account with a password record from the start', () => {
  const { data, account } = addAccount(emptyUserData(), 'Ученик 1', 5, record);
  assert.deepEqual(data.accounts[0].password, record);
  assert.deepEqual(account.password, record);
});

test('a user-data blob with a password record round-trips through save/load', () => {
  const storage = memoryStorage();
  const created = addAccount(emptyUserData(), 'Ученик 1', 5, record).data;
  saveUserData(storage, 'eumk-nach', created);
  const loaded = loadUserData(storage, 'eumk-nach');
  assert.equal(loaded.status, 'ok');
  assert.deepEqual(loaded.data.accounts[0].password, record);
});
