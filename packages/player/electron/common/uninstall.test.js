const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const {
  isWindowsUninstaller,
  findWindowsUninstaller,
  detectLinuxPackageManagers,
  buildUninstallPlan,
  runUninstallAttempt,
  runUninstallAttempts
} = require('./uninstall.js');

const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'kiosk-uninstall-'));

test('распознаёт только Uninstall*.exe', () => {
  assert.equal(isWindowsUninstaller('Uninstall Музей ВОВ.exe'), true);
  assert.equal(isWindowsUninstaller('uninstall.exe'), true);
  assert.equal(isWindowsUninstaller('app.exe'), false);
  assert.equal(isWindowsUninstaller('Uninstall.exe.bak'), false);
  assert.equal(isWindowsUninstaller(''), false);
});

test('находит uninstaller в каталоге установки и предпочитает точное имя', () => {
  const dir = tempDir();
  try {
    fs.writeFileSync(path.join(dir, 'app.exe'), '');
    fs.writeFileSync(path.join(dir, 'Uninstall Old.exe'), '');
    fs.writeFileSync(path.join(dir, 'Uninstall Новый.exe'), '');
    const found = findWindowsUninstaller({
      installDir: dir,
      preferredName: 'Uninstall Новый.exe'
    });
    assert.equal(found, path.join(dir, 'Uninstall Новый.exe'));
    // Без точного имени и при нескольких кандидатах — не угадываем.
    assert.equal(findWindowsUninstaller({ installDir: dir }), null);
    assert.equal(findWindowsUninstaller({ installDir: path.join(dir, 'missing') }), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('единственный uninstaller находится и без точного имени', () => {
  const dir = tempDir();
  try {
    fs.writeFileSync(path.join(dir, 'Uninstall Единственный.exe'), '');
    assert.equal(
      findWindowsUninstaller({ installDir: dir }),
      path.join(dir, 'Uninstall Единственный.exe')
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('план Windows: silent /S и путь uninstaller', () => {
  const plan = buildUninstallPlan({ platform: 'win32', uninstallerPath: 'C:\\App\\Uninstall App.exe' });
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.attempts, [{ command: 'C:\\App\\Uninstall App.exe', args: ['/S'] }]);
});

test('план Windows без uninstaller возвращает ошибку', () => {
  const plan = buildUninstallPlan({ platform: 'win32', uninstallerPath: null });
  assert.equal(plan.ok, false);
  assert.match(plan.error, /not found/);
});

test('план Linux: pkexec, затем sudo -n, пакет из package.json', () => {
  const plan = buildUninstallPlan({ platform: 'linux', packageName: 'com.kiosk.vmvov' });
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.attempts[0], { command: 'pkexec', args: ['dpkg', '-r', 'com.kiosk.vmvov'], waitForExit: true });
  assert.deepEqual(plan.attempts[1], { command: 'sudo', args: ['-n', 'dpkg', '-r', 'com.kiosk.vmvov'], waitForExit: true });
  assert.deepEqual(plan.attempts[2], { command: 'pkexec', args: ['rpm', '-e', 'com.kiosk.vmvov'], waitForExit: true });
  assert.deepEqual(plan.attempts[3], { command: 'sudo', args: ['-n', 'rpm', '-e', 'com.kiosk.vmvov'], waitForExit: true });
});

test('план Linux использует только обнаруженный пакетный менеджер', () => {
  const plan = buildUninstallPlan({
    platform: 'linux',
    packageName: 'com.kiosk.vmvov',
    packageManagers: ['rpm']
  });
  assert.equal(plan.ok, true);
  assert.equal(plan.attempts.length, 2);
  assert.deepEqual(plan.attempts[0], { command: 'pkexec', args: ['rpm', '-e', 'com.kiosk.vmvov'], waitForExit: true });
  assert.deepEqual(plan.attempts[1], { command: 'sudo', args: ['-n', 'rpm', '-e', 'com.kiosk.vmvov'], waitForExit: true });
});

test('detectLinuxPackageManagers определяет dpkg/rpm по наличию файлов', () => {
  const fakeFs = (present) => ({ existsSync: (p) => present.includes(p) });
  assert.deepEqual(detectLinuxPackageManagers({ fsModule: fakeFs(['/usr/bin/dpkg']) }), ['dpkg']);
  assert.deepEqual(detectLinuxPackageManagers({ fsModule: fakeFs(['/usr/bin/rpm']) }), ['rpm']);
  assert.deepEqual(
    detectLinuxPackageManagers({ fsModule: fakeFs(['/usr/bin/dpkg', '/usr/bin/rpm']) }),
    ['dpkg', 'rpm']
  );
  assert.deepEqual(detectLinuxPackageManagers({ fsModule: fakeFs([]) }), ['dpkg', 'rpm']);
});

test('план Linux без имени пакета возвращает ошибку', () => {
  const plan = buildUninstallPlan({ platform: 'linux' });
  assert.equal(plan.ok, false);
  assert.match(plan.error, /package name/);
});

test('неизвестная платформа не падает', () => {
  const plan = buildUninstallPlan({ platform: 'freebsd' });
  assert.equal(plan.ok, false);
  assert.match(plan.error, /unsupported platform/);
});

function fakeChild() {
  const child = new EventEmitter();
  child.killed = false;
  child.kill = () => { child.killed = true; };
  child.unref = () => {};
  return child;
}

test('runUninstallAttempt: успех по spawn без ожидания', async () => {
  const child = fakeChild();
  const promise = runUninstallAttempt({
    attempt: { command: 'uninstall.exe', args: ['/S'] },
    spawnImpl: () => child
  });
  setTimeout(() => child.emit('spawn'), 0);
  const result = await promise;
  assert.equal(result.ok, true);
  assert.equal(result.command, 'uninstall.exe');
});

test('runUninstallAttempt: ошибка spawn возвращает ошибку', async () => {
  const child = fakeChild();
  const promise = runUninstallAttempt({
    attempt: { command: 'missing', args: [], waitForExit: true },
    spawnImpl: () => child
  });
  setTimeout(() => child.emit('error', new Error('ENOENT')), 0);
  const result = await promise;
  assert.equal(result.ok, false);
  assert.match(result.error, /ENOENT/);
});

test('runUninstallAttempts: ненулевой exit первого способа — переход ко второму', async () => {
  const first = fakeChild();
  const second = fakeChild();
  const children = [first, second];
  const promise = runUninstallAttempts({
    attempts: [
      { command: 'pkexec', args: ['dpkg'], waitForExit: true },
      { command: 'sudo', args: ['dpkg'], waitForExit: true }
    ],
    spawnImpl: () => children.shift(),
    timeoutMs: 1000
  });
  setTimeout(() => first.emit('exit', 1, null), 0);
  setTimeout(() => second.emit('exit', 0, null), 10);
  const result = await promise;
  assert.equal(result.ok, true);
  assert.equal(result.command, 'sudo');
});

test('runUninstallAttempt: таймаут убивает процесс и возвращает ошибку', async () => {
  const child = fakeChild();
  const result = await runUninstallAttempt({
    attempt: { command: 'pkexec', args: ['dpkg'], waitForExit: true },
    spawnImpl: () => child,
    timeoutMs: 20
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'timeout');
  assert.equal(child.killed, true);
});
