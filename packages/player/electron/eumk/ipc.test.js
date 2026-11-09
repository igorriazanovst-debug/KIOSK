// Тесты IPC-моста K5-1: рендерер просит главный процесс захэшировать пароль
// или проверить его. Ответ - всегда конверт {ok, ...}, исключение обработчика
// не должно оставлять рендерер без ответа.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { registerEumkIpc } from './ipc.js';
import { hashPassword, PBKDF2_ITERATIONS } from './passwords.js';

function register() {
  const handlers = new Map();
  const ipcMain = {
    on: (name, fn) => handlers.set(name, { kind: 'on', fn }),
    handle: (name, fn) => handlers.set(name, { kind: 'handle', fn }),
  };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eumk-ipc-'));
  registerEumkIpc({ ipcMain, app: { getPath: () => dir } });
  return handlers;
}

test('eumk:hash-password hashes in the main process and returns the record', async () => {
  const handlers = register();
  assert.ok(handlers.has('eumk:hash-password'));
  const reply = await handlers.get('eumk:hash-password').fn(null, 'синтетика-1234');
  assert.equal(reply.ok, true);
  assert.equal(reply.value.iterations, PBKDF2_ITERATIONS);
  assert.equal(reply.value.algo, 'pbkdf2-sha256');
});

test('eumk:hash-password rejects a too-short password with a clear error', async () => {
  const handlers = register();
  const reply = await handlers.get('eumk:hash-password').fn(null, 'abc');
  assert.equal(reply.ok, false);
  assert.match(reply.error, /не короче/);
});

test('eumk:verify-password answers ok/valid for a password check', async () => {
  const handlers = register();
  const record = await hashPassword('верный-пароль-теста');
  const wrong = await handlers.get('eumk:verify-password').fn(null, 'неверный-пароль', record);
  assert.deepEqual(wrong, { ok: true, value: false });
  const right = await handlers.get('eumk:verify-password').fn(null, 'верный-пароль-теста', record);
  assert.deepEqual(right, { ok: true, value: true });
});

test('eumk:verify-password turns a corrupted record into an error reply, not a crash', async () => {
  const handlers = register();
  const reply = await handlers.get('eumk:verify-password').fn(null, 'x', { broken: true });
  assert.equal(reply.ok, false);
  assert.match(reply.error, /парол/i);
});
