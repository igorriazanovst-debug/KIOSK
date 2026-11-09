import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildUninstallSignature } from './deviceCommand.js';

const base = { licenseKey: 'LICENSE-KEY', deviceId: 'device-1', commandId: 'command-1', issuedAt: 1_800_000_000_000 };

test('подпись воспроизводима и зависит от ключа/устройства/команды', () => {
  const first = buildUninstallSignature(base);
  const second = buildUninstallSignature(base);
  assert.deepEqual(first, second);
  assert.equal(first.licenseKeyHash.length, 64);
  assert.equal(first.signature.length, 64);
  assert.notEqual(first.signature, buildUninstallSignature({ ...base, deviceId: 'device-2' }).signature);
  assert.notEqual(first.signature, buildUninstallSignature({ ...base, commandId: 'command-2' }).signature);
  assert.notEqual(first.signature, buildUninstallSignature({ ...base, licenseKey: 'OTHER' }).signature);
});

test('без обязательных полей подпись пустая', () => {
  assert.deepEqual(buildUninstallSignature({}), { licenseKeyHash: '', signature: '' });
  assert.deepEqual(buildUninstallSignature({ licenseKey: 'k' }), { licenseKeyHash: '', signature: '' });
});
