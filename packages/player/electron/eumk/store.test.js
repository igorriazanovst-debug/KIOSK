const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createEumkStore, isValidKey, MAX_VALUE_BYTES } = require('./store');

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'eumk-store-'));
}

test('setItem then getItem returns the same string', () => {
  const store = createEumkStore(tmp());
  store.setItem('eumk:userdata:eumk-nach', '{"a":1}');
  assert.equal(store.getItem('eumk:userdata:eumk-nach'), '{"a":1}');
});

test('getItem returns null for a key that was never written', () => {
  assert.equal(createEumkStore(tmp()).getItem('eumk:userdata:none'), null);
});

test('the value survives a new store instance on the same directory (a restart)', () => {
  const dir = tmp();
  createEumkStore(dir).setItem('eumk:userdata:eumk-dosh', 'сохранено');
  assert.equal(createEumkStore(dir).getItem('eumk:userdata:eumk-dosh'), 'сохранено');
});

test('keys are independent and a rewrite replaces the old value', () => {
  const store = createEumkStore(tmp());
  store.setItem('eumk:userdata:a', '1');
  store.setItem('eumk:userdata:b', '2');
  store.setItem('eumk:userdata:a', '3');
  assert.equal(store.getItem('eumk:userdata:a'), '3');
  assert.equal(store.getItem('eumk:userdata:b'), '2');
});

test('a corrupted file makes getItem throw instead of looking like an empty store', () => {
  const dir = tmp();
  const store = createEumkStore(dir);
  store.setItem('eumk:userdata:x', 'ok');
  for (const f of fs.readdirSync(dir)) fs.writeFileSync(path.join(dir, f), '{broken');
  assert.throws(() => store.getItem('eumk:userdata:x'));
});

test('keys that could escape the directory or are malformed are rejected', () => {
  const store = createEumkStore(tmp());
  for (const bad of ['../etc/passwd', 'eumk:../x', '', 'other:key', 'eumk:' + 'a'.repeat(200), 42, null]) {
    assert.equal(isValidKey(bad), false, String(bad));
    assert.throws(() => store.setItem(bad, 'v'));
    assert.throws(() => store.getItem(bad));
  }
});

test('non-string and oversized values are rejected', () => {
  const store = createEumkStore(tmp());
  assert.throws(() => store.setItem('eumk:userdata:x', 123));
  assert.throws(() => store.setItem('eumk:userdata:x', 'a'.repeat(MAX_VALUE_BYTES + 1)));
});

test('no temporary files are left behind after writes', () => {
  const dir = tmp();
  const store = createEumkStore(dir);
  for (let i = 0; i < 5; i++) store.setItem('eumk:userdata:x', String(i));
  assert.deepEqual(fs.readdirSync(dir).filter((f) => f.includes('.tmp-')), []);
});

test('the directory is created when it does not exist yet', () => {
  const dir = path.join(tmp(), 'nested', 'eumk-data');
  createEumkStore(dir).setItem('eumk:userdata:x', 'v');
  assert.equal(createEumkStore(dir).getItem('eumk:userdata:x'), 'v');
});
