import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickStorage, type EumkBridge } from './persistentStorage.ts';

test('uses the file-backed bridge when the app provides it', () => {
  const calls: string[] = [];
  const bridge: EumkBridge = {
    getItem: (k) => { calls.push(`get ${k}`); return { ok: true, value: 'v' }; },
    setItem: (k, v) => { calls.push(`set ${k}=${v}`); return { ok: true }; },
  };
  const storage = pickStorage({ eumkAPI: bridge, localStorage: undefined })!;
  storage.setItem('eumk:x', 'a');
  assert.equal(storage.getItem('eumk:x'), 'v');
  assert.deepEqual(calls, ['set eumk:x=a', 'get eumk:x']);
});

test('a bridge error is raised, not hidden as an empty value', () => {
  const bridge: EumkBridge = { getItem: () => ({ ok: false, error: 'Файл данных повреждён' }), setItem: () => ({ ok: false, error: 'диск' }) };
  const storage = pickStorage({ eumkAPI: bridge, localStorage: undefined })!;
  assert.throws(() => storage.getItem('eumk:x'), /повреждён/);
  assert.throws(() => storage.setItem('eumk:x', 'a'), /диск/);
});

test('falls back to localStorage in a plain browser', () => {
  const map: Record<string, string> = {};
  const ls = { getItem: (k: string) => map[k] ?? null, setItem: (k: string, v: string) => { map[k] = v; } };
  const storage = pickStorage({ localStorage: ls })!;
  storage.setItem('eumk:x', 'b');
  assert.equal(storage.getItem('eumk:x'), 'b');
});

test('returns null when neither storage is reachable', () => {
  const win = { get localStorage(): never { throw new Error('denied'); } };
  assert.equal(pickStorage(win), null);
});

test('prefers the bridge even when localStorage exists', () => {
  const bridge: EumkBridge = { getItem: () => ({ ok: true, value: 'from-bridge' }), setItem: () => ({ ok: true }) };
  const ls = { getItem: () => 'from-ls', setItem: () => undefined };
  assert.equal(pickStorage({ eumkAPI: bridge, localStorage: ls })!.getItem('k'), 'from-bridge');
});
