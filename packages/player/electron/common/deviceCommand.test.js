const { test } = require('node:test');
const assert = require('node:assert/strict');
const { signUninstallCommand, verifyUninstallCommand } = require('./deviceCommand.js');

const issuedAt = 1_800_000_000_000;
const base = {
  licenseKeyHash: 'a'.repeat(64),
  deviceId: 'device-1',
  commandId: 'command-1',
  issuedAt
};

test('подпись команды воспроизводима и зависит от deviceId/commandId', () => {
  const first = signUninstallCommand(base);
  const second = signUninstallCommand(base);
  assert.equal(first, second);
  assert.notEqual(first, signUninstallCommand({ ...base, deviceId: 'device-2' }));
  assert.notEqual(first, signUninstallCommand({ ...base, commandId: 'command-2' }));
  assert.notEqual(first, signUninstallCommand({ ...base, licenseKeyHash: 'b'.repeat(64) }));
});

test('верная подпись принимается', () => {
  const signature = signUninstallCommand(base);
  assert.equal(verifyUninstallCommand({ ...base, signature, now: issuedAt }), true);
});

test('подделка, пустая и чужая подпись отклоняются', () => {
  const signature = signUninstallCommand(base);
  assert.equal(verifyUninstallCommand({ ...base, signature: 'deadbeef', now: issuedAt }), false);
  assert.equal(verifyUninstallCommand({ ...base, signature: '', now: issuedAt }), false);
  assert.equal(verifyUninstallCommand({ ...base, commandId: 'other', signature, now: issuedAt }), false);
  assert.equal(verifyUninstallCommand({ ...base, deviceId: 'other', signature, now: issuedAt }), false);
  assert.equal(verifyUninstallCommand({ ...base, licenseKeyHash: '', signature, now: issuedAt }), false);
});

test('устаревшая команда отклоняется', () => {
  const signature = signUninstallCommand(base);
  assert.equal(
    verifyUninstallCommand({ ...base, signature, now: issuedAt + 61 * 60 * 1000 }),
    false
  );
});

test('без ключа подпись не создаётся', () => {
  assert.equal(signUninstallCommand({ ...base, licenseKeyHash: '' }), '');
});
