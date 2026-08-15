import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getBuildScript, selectBuildArtifacts } from './buildArtifacts.js';

test('getBuildScript maps known platforms to their npm script', () => {
  assert.equal(getBuildScript('win'), 'electron:build:win');
  assert.equal(getBuildScript('linux'), 'electron:build:linux');
});

test('getBuildScript returns null for an unknown platform', () => {
  assert.equal(getBuildScript('mac'), null);
  assert.equal(getBuildScript(undefined), null);
});

test('getBuildScript does not resolve prototype-chain property names to an inherited value', () => {
  assert.equal(getBuildScript('constructor'), null);
  assert.equal(getBuildScript('__proto__'), null);
  assert.equal(getBuildScript('toString'), null);
});

test('selectBuildArtifacts picks only the Setup .exe for win, ignoring blockmap/unpacked leftovers', () => {
  const files = [
    'Kiosk App-Setup-1.0.0.exe',
    'Kiosk App-Setup-1.0.0.exe.blockmap',
    'builder-effective-config.yaml',
    'win-unpacked',
  ];

  const result = selectBuildArtifacts(files, 'win');

  assert.deepEqual(result, [{ fileName: 'Kiosk App-Setup-1.0.0.exe', label: 'Windows' }]);
});

test('selectBuildArtifacts picks all deb/rpm artifacts for linux, labeled by format and arch', () => {
  const files = [
    'kiosk-app_1.0.0_amd64.deb',
    'kiosk-app_1.0.0_arm64.deb',
    'kiosk-app-1.0.0.x86_64.rpm',
    'kiosk-app-1.0.0.aarch64.rpm',
    'builder-effective-config.yaml',
  ];

  const result = selectBuildArtifacts(files, 'linux');

  assert.deepEqual(result, [
    { fileName: 'kiosk-app_1.0.0_arm64.deb', label: 'deb (arm64)' },
    { fileName: 'kiosk-app_1.0.0_amd64.deb', label: 'deb (x64)' },
    { fileName: 'kiosk-app-1.0.0.aarch64.rpm', label: 'rpm (arm64)' },
    { fileName: 'kiosk-app-1.0.0.x86_64.rpm', label: 'rpm (x64)' },
  ]);
});

test('selectBuildArtifacts returns an empty array when nothing matches', () => {
  assert.deepEqual(selectBuildArtifacts(['readme.txt'], 'linux'), []);
});
