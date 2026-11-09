const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  autostartFilePath,
  buildDesktopEntry,
  quoteDesktopExec,
  setLinuxAutostart,
  readLinuxAutostart,
  readAutostartPreference,
  resolveStartupEnabled,
  writeAutostartPreference,
  applyAutostart,
  getAutostartState
} = require('./autostart.js');

const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'kiosk-autostart-'));

test('путь autostart: configDir/autostart/<appId>.desktop, небезопасные символы заменяются', () => {
  assert.equal(
    autostartPathForTest('/home/u/.config', 'com.kiosk.vmvov'),
    path.join('/home/u/.config', 'autostart', 'com.kiosk.vmvov.desktop')
  );
  assert.equal(
    autostartPathForTest('/home/u/.config', 'Музей ВОВ/1'),
    path.join('/home/u/.config', 'autostart', '1.desktop')
  );
});

function autostartPathForTest(configDir, appId) {
  return autostartFilePath(configDir, appId);
}

test('Exec в .desktop экранирует пробелы, кавычки, обратные слэши и процент', () => {
  assert.equal(quoteDesktopExec('/opt/Музей ВОВ/app'), '"/opt/Музей ВОВ/app"');
  assert.equal(quoteDesktopExec('a"b\\c$d`e'), '"a\\"b\\\\c\\$d\\`e"');
  assert.equal(quoteDesktopExec('100%/app'), '"100%%/app"');
});

test('buildDesktopEntry содержит обязательные поля XDG Autostart', () => {
  const entry = buildDesktopEntry({
    name: 'Музей ВОВ',
    execPath: '/opt/museum/app',
    args: ['--no-sandbox']
  });
  assert.match(entry, /^\[Desktop Entry\]/);
  assert.match(entry, /Type=Application/);
  assert.match(entry, /Name=Музей ВОВ/);
  assert.match(entry, /Exec="\/opt\/museum\/app" "--no-sandbox"/);
  assert.match(entry, /X-GNOME-Autostart-enabled=true/);
});

test('setLinuxAutostart создаёт файл, повторный вызов идемпотентен, disable удаляет', () => {
  const dir = tempDir();
  try {
    const first = setLinuxAutostart({
      enabled: true, configDir: dir, appId: 'com.kiosk.vmvov',
      appName: 'Музей ВОВ', execPath: '/opt/museum/app'
    });
    assert.equal(first.ok, true);
    assert.equal(fs.existsSync(first.path), true);
    assert.match(fs.readFileSync(first.path, 'utf8'), /X-GNOME-Autostart-enabled=true/);

    const second = setLinuxAutostart({
      enabled: true, configDir: dir, appId: 'com.kiosk.vmvov',
      appName: 'Музей ВОВ', execPath: '/opt/museum/app'
    });
    assert.equal(second.ok, true);
    assert.equal(fs.existsSync(first.path), true);

    const off = setLinuxAutostart({ enabled: false, configDir: dir, appId: 'com.kiosk.vmvov' });
    assert.equal(off.ok, true);
    assert.equal(fs.existsSync(first.path), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('disable для отсутствующего файла не считается ошибкой', () => {
  const dir = tempDir();
  try {
    const result = setLinuxAutostart({ enabled: false, configDir: dir, appId: 'missing' });
    assert.equal(result.ok, true);
    assert.equal(result.enabled, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('readLinuxAutostart различает наличие, отсутствие и отключённый флаг', () => {
  const dir = tempDir();
  try {
    assert.equal(readLinuxAutostart({ configDir: dir, appId: 'x' }).enabled, false);
    const file = autostartFilePath(dir, 'x');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '[Desktop Entry]\nX-GNOME-Autostart-enabled=false\n');
    assert.equal(readLinuxAutostart({ configDir: dir, appId: 'x' }).enabled, false);
    fs.writeFileSync(file, '[Desktop Entry]\nX-GNOME-Autostart-enabled=true\n');
    assert.equal(readLinuxAutostart({ configDir: dir, appId: 'x' }).enabled, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('applyAutostart на win32 вызывает setLoginItemSettings, на linux пишет файл', () => {
  const calls = [];
  const app = {
    setLoginItemSettings: (settings) => calls.push(settings),
    getLoginItemSettings: () => ({ openAtLogin: true })
  };
  const win = applyAutostart({
    platform: 'win32', enabled: true, app, execPath: 'C:\\App\\app.exe'
  });
  assert.equal(win.ok, true);
  assert.deepEqual(calls[0], { openAtLogin: true, path: 'C:\\App\\app.exe', args: [] });
  assert.equal(getAutostartState({ platform: 'win32', app }).enabled, true);

  const dir = tempDir();
  try {
    const linux = applyAutostart({
      platform: 'linux', enabled: true, configDir: dir, appId: 'com.kiosk.eumknach',
      appName: 'ЭУМК', execPath: '/opt/eumk/app'
    });
    assert.equal(linux.ok, true);
    assert.equal(fs.existsSync(linux.path), true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('applyAutostart на неизвестной платформе возвращает ошибку, а не падает', () => {
  const result = applyAutostart({ platform: 'freebsd', enabled: true });
  assert.equal(result.ok, false);
  assert.match(result.error, /unsupported platform/);
});

test('настройка автозапуска: отсутствие, true и false сохраняются и читаются', () => {
  const dir = tempDir();
  try {
    assert.equal(readAutostartPreference({ userDataDir: dir }), null);
    assert.equal(writeAutostartPreference({ userDataDir: dir, enabled: false }), true);
    assert.deepEqual(readAutostartPreference({ userDataDir: dir }), { configured: true, enabled: false });
    assert.equal(writeAutostartPreference({ userDataDir: dir, enabled: true }), true);
    assert.deepEqual(readAutostartPreference({ userDataDir: dir }), { configured: true, enabled: true });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('решение при старте: нет настройки — включить; false и повреждённая — не включать', () => {
  assert.equal(resolveStartupEnabled(null), true);
  assert.equal(resolveStartupEnabled({ configured: true, enabled: true }), true);
  assert.equal(resolveStartupEnabled({ configured: true, enabled: false }), false);
  assert.equal(resolveStartupEnabled({ configured: true, enabled: false, corrupt: true }), false);
});

test('повреждённая настройка автозапуска трактуется как «выключено», а не падает', () => {
  const dir = tempDir();
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'autostart-preference.json'), '{broken');
    assert.deepEqual(
      readAutostartPreference({ userDataDir: dir }),
      { configured: true, enabled: false, corrupt: true }
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
