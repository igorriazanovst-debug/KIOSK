const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { sharedDeviceIdDir, readOrCreateDeviceId } = require('./deviceIdStore.js');

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
