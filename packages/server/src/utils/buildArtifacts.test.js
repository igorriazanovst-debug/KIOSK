import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getBuildScript, selectBuildArtifacts } from './buildArtifacts.js';

test('getBuildScript maps known platforms to their npm script', () => {
  assert.equal(getBuildScript('win'), 'electron:build:win');
  assert.equal(getBuildScript('deb'), 'electron:build:deb');
  assert.equal(getBuildScript('rpm'), 'electron:build:rpm');
});

test('getBuildScript returns null for an unknown platform', () => {
  assert.equal(getBuildScript('mac'), null);
  assert.equal(getBuildScript('linux'), null); // replaced by separate 'deb'/'rpm' platforms
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

test('selectBuildArtifacts picks only .deb artifacts for the deb platform, ignoring .rpm', () => {
  const files = [
    'kiosk-app_1.0.0_amd64.deb',
    'kiosk-app_1.0.0_arm64.deb',
    'kiosk-app-1.0.0.x86_64.rpm',
    'builder-effective-config.yaml',
  ];

  const result = selectBuildArtifacts(files, 'deb');

  assert.deepEqual(result, [
    { fileName: 'kiosk-app_1.0.0_arm64.deb', label: 'deb (arm64)' },
    { fileName: 'kiosk-app_1.0.0_amd64.deb', label: 'deb (x64)' },
  ]);
});

test('selectBuildArtifacts picks only .rpm artifacts for the rpm platform, ignoring .deb', () => {
  const files = [
    'kiosk-app_1.0.0_amd64.deb',
    'kiosk-app-1.0.0.x86_64.rpm',
    'kiosk-app-1.0.0.aarch64.rpm',
  ];

  const result = selectBuildArtifacts(files, 'rpm');

  assert.deepEqual(result, [
    { fileName: 'kiosk-app-1.0.0.aarch64.rpm', label: 'rpm (arm64)' },
    { fileName: 'kiosk-app-1.0.0.x86_64.rpm', label: 'rpm (x64)' },
  ]);
});

test('selectBuildArtifacts returns an empty array when nothing matches', () => {
  assert.deepEqual(selectBuildArtifacts(['readme.txt'], 'deb'), []);
});

test('selectBuildArtifacts returns an empty array for an unsupported platform', () => {
  assert.deepEqual(selectBuildArtifacts(['app_1.0.0.deb'], 'linux'), []);
});
