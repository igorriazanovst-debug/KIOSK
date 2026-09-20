import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withWindowsInstallIdentity } from './installIdentity.js';

const basePackageJson = () => ({ name: '@kiosk-platform/player', version: '1.0.0', build: { appId: 'x' } });

test('на Windows имя пакета берётся из appId — у каждого приложения своя папка установки', () => {
  const result = withWindowsInstallIdentity(basePackageJson(), 'com.kiosk.physastroiq', 'win');
  assert.equal(result.name, 'com.kiosk.physastroiq');
});

test('два приложения с разными appId получают разные имена', () => {
  const a = withWindowsInstallIdentity(basePackageJson(), 'com.kiosk.bioiq', 'win');
  const b = withWindowsInstallIdentity(basePackageJson(), 'com.kiosk.chimiq', 'win');
  assert.notEqual(a.name, b.name);
});

test('имя не совпадает с каталогами данных виджетов (kiosk-<виджет>): иначе профиль приложения и викторины педагога легли бы в одну папку', () => {
  const result = withWindowsInstallIdentity(basePackageJson(), 'com.kiosk.physastroiq', 'win');
  assert.ok(!/^kiosk-[a-z0-9]+$/.test(result.name), result.name);
});

test('appId, сводящийся к «kiosk-<что-то>», получает префикс и тоже не совпадает с каталогом данных виджета', () => {
  const result = withWindowsInstallIdentity(basePackageJson(), 'kiosk-bioiq', 'win');
  assert.equal(result.name, 'app-kiosk-bioiq');
});

test('кириллический appId даёт допустимое ASCII-имя', () => {
  const result = withWindowsInstallIdentity(basePackageJson(), 'Музей СВО', 'win');
  assert.match(result.name, /^[a-z0-9][a-z0-9+.-]*$/);
});

test('на Linux имя пакета не меняется: там пути задаются executableName/packageName', () => {
  for (const platform of ['deb', 'rpm', 'linux']) {
    assert.equal(withWindowsInstallIdentity(basePackageJson(), 'com.kiosk.bioiq', platform).name, '@kiosk-platform/player');
  }
});

test('исходный объект не изменяется', () => {
  const original = basePackageJson();
  const result = withWindowsInstallIdentity(original, 'com.kiosk.bioiq', 'win');
  assert.equal(original.name, '@kiosk-platform/player');
  assert.notEqual(result, original);
  assert.deepEqual(result.build, original.build);
});

test('зарезервированные имена устройств Windows не становятся именем каталога установки', () => {
  for (const appId of ['CON', 'nul', 'com1', 'LPT9', 'aux', 'prn', 'con.kiosk']) {
    const { name } = withWindowsInstallIdentity(basePackageJson(), appId, 'win');
    assert.ok(!/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/.test(name), `${appId} → ${name}`);
  }
});

test('сверхдлинный appId обрезается: путь установки не должен упереться в MAX_PATH', () => {
  const { name } = withWindowsInstallIdentity(basePackageJson(), 'com.kiosk.' + 'a'.repeat(500), 'win');
  assert.ok(name.length <= 60, String(name.length));
  assert.match(name, /^[a-z0-9][a-z0-9+.-]*[a-z0-9]$/);
});
