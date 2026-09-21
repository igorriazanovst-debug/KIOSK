const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { sharedDeviceIdDir, resolveDeviceIdDir, readOrCreateDeviceId } = require('./deviceIdStore.js');

const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'kiosk-deviceid-'));

test('каталог идентификатора общий для всех приложений KIOSK и совпадает с прежним userData плеера', () => {
  const appData = path.join('C:', 'Users', 'u', 'AppData', 'Roaming');
  assert.equal(sharedDeviceIdDir(appData), path.join(appData, '@kiosk-platform', 'player'));
});

test('существующий идентификатор сохраняется — обновление приложения не занимает новое место лицензии', () => {
  const dir = tempDir();
  try {
    fs.writeFileSync(path.join(dir, 'device-id.txt'), 'existing-id\n');
    assert.equal(readOrCreateDeviceId(dir, () => 'new-id'), 'existing-id');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('при первом запуске идентификатор создаётся и сохраняется', () => {
  const root = tempDir();
  try {
    const dir = path.join(root, 'nested', 'player');
    assert.equal(readOrCreateDeviceId(dir, () => 'fresh-id'), 'fresh-id');
    assert.equal(fs.readFileSync(path.join(dir, 'device-id.txt'), 'utf-8'), 'fresh-id');
    assert.equal(readOrCreateDeviceId(dir, () => 'another-id'), 'fresh-id');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('пустой файл идентификатора считается отсутствующим', () => {
  const dir = tempDir();
  try {
    fs.writeFileSync(path.join(dir, 'device-id.txt'), '  \n');
    assert.equal(readOrCreateDeviceId(dir, () => 'fresh-id'), 'fresh-id');
    assert.equal(fs.readFileSync(path.join(dir, 'device-id.txt'), 'utf-8'), 'fresh-id', 'и записывается, иначе менялся бы при каждом запуске');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('если каталог недоступен для записи, идентификатор всё равно возвращается', () => {
  const root = tempDir();
  try {
    const blocker = path.join(root, 'file');
    fs.writeFileSync(blocker, 'x');
    assert.equal(readOrCreateDeviceId(path.join(blocker, 'sub'), () => 'volatile-id'), 'volatile-id');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('гонка первого запуска: если файл появился между проверкой и записью, берётся уже записанный идентификатор', () => {
  const dir = tempDir();
  try {
    // Второе приложение успело записать свой идентификатор, пока первое его генерировало
    const makeId = () => {
      fs.writeFileSync(path.join(dir, 'device-id.txt'), 'winner-id');
      return 'loser-id';
    };
    assert.equal(readOrCreateDeviceId(dir, makeId), 'winner-id');
    assert.equal(fs.readFileSync(path.join(dir, 'device-id.txt'), 'utf-8'), 'winner-id');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('по умолчанию идентификатор общий на компьютер — поведение прежних сборок не меняется', () => {
  const appData = path.join('C:', 'Users', 'u', 'AppData', 'Roaming');
  const userData = path.join(appData, 'Своё приложение');
  assert.equal(resolveDeviceIdDir({ appDataDir: appData, userDataDir: userData }), sharedDeviceIdDir(appData));
  assert.equal(resolveDeviceIdDir({ perApp: false, appDataDir: appData, userDataDir: userData }), sharedDeviceIdDir(appData));
});

test('perApp=true — идентификатор лежит в профиле самого приложения, у каждого приложения свой', () => {
  const appData = path.join('C:', 'Users', 'u', 'AppData', 'Roaming');
  const chem = path.join(appData, 'Химия');
  const bio = path.join(appData, 'Биология');
  assert.equal(resolveDeviceIdDir({ perApp: true, appDataDir: appData, userDataDir: chem }), chem);
  assert.notEqual(
    resolveDeviceIdDir({ perApp: true, appDataDir: appData, userDataDir: chem }),
    resolveDeviceIdDir({ perApp: true, appDataDir: appData, userDataDir: bio })
  );
});

test('perApp включается только строгим true — строка "false" или 1 не должны его включать', () => {
  const appData = path.join('C:', 'a');
  const userData = path.join('C:', 'a', 'app');
  for (const bad of ['true', 'false', 1, {}, null]) {
    assert.equal(resolveDeviceIdDir({ perApp: bad, appDataDir: appData, userDataDir: userData }), sharedDeviceIdDir(appData));
  }
});

test('два приложения с perApp получают разные идентификаторы на одном компьютере', () => {
  const root = tempDir();
  try {
    const a = readOrCreateDeviceId(resolveDeviceIdDir({ perApp: true, appDataDir: root, userDataDir: path.join(root, 'A') }), () => 'id-a');
    const b = readOrCreateDeviceId(resolveDeviceIdDir({ perApp: true, appDataDir: root, userDataDir: path.join(root, 'B') }), () => 'id-b');
    assert.equal(a, 'id-a');
    assert.equal(b, 'id-b');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
