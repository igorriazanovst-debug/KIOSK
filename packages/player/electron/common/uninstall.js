// Удалённое удаление клиента по команде сервера.
//
// Windows: запускаем штатный Uninstall <App>.exe с /S (NSIS silent).
// Linux: штатный пакетный менеджер. Приложение работает от пользователя,
// поэтому сначала pkexec (политика polkit), затем sudo -n (если настроен
// passwordless sudo для kiosk-пользователя). Если ни один способ не
// разрешён, команда не выполняется — это фиксируется в журнале.
//
// Данные пользователя (профиль приложения, результаты ЭУМК) не удаляются:
// решение P-03 — удалять только приложение, данные сохранять.

const fs = require('node:fs');
const path = require('node:path');
const { spawn: defaultSpawn } = require('node:child_process');

function isWindowsUninstaller(name) {
  return /^Uninstall.*\.exe$/i.test(String(name || ''));
}

function findWindowsUninstaller({ installDir, fsModule = fs, preferredName = '' }) {
  if (!installDir) return null;
  try {
    const entries = fsModule.readdirSync(installDir, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry && entry.isFile() && isWindowsUninstaller(entry.name))
      .map((entry) => entry.name);
    if (preferredName) {
      const exact = files.find((name) => name.toLowerCase() === String(preferredName).toLowerCase());
      if (exact) return path.join(installDir, exact);
    }
    // Если точного имени нет, запускать первый попавшийся Uninstall*.exe
    // опасно: в каталоге мог остаться деинсталлятор другого приложения.
    // Допускаем только единственный вариант.
    return files.length === 1 ? path.join(installDir, files[0]) : null;
  } catch {
    return null;
  }
}

function detectLinuxPackageManagers({ fsModule = fs } = {}) {
  const has = (paths) => paths.some((p) => {
    try { return fsModule.existsSync(p); } catch { return false; }
  });
  const found = [];
  if (has(['/usr/bin/dpkg', '/bin/dpkg'])) found.push('dpkg');
  if (has(['/usr/bin/rpm', '/bin/rpm'])) found.push('rpm');
  return found.length > 0 ? found : ['dpkg', 'rpm'];
}

function buildUninstallPlan({ platform, uninstallerPath, packageName, packageManagers = ['dpkg', 'rpm'], installDir = '' }) {
  if (platform === 'win32') {
    if (!uninstallerPath) return { ok: false, error: 'Windows uninstaller not found' };
    // K2-F5: --_?=<installDir> заставляет NSIS-деинсталлятор работать
    // синхронно (не копировать себя в temp): код выхода = итог удаления.
    if (!installDir) return { ok: false, error: 'Windows uninstall requires installDir for the synchronous --_?= flag' };
    return {
      ok: true,
      attempts: [{ command: uninstallerPath, args: ['/S', `--_?=${installDir}`], waitForExit: true }]
    };
  }
  if (platform === 'linux') {
    if (!packageName) return { ok: false, error: 'Linux package name is required' };
    const managers = packageManagers.length > 0 ? packageManagers : ['dpkg', 'rpm'];
    const attempts = [];
    for (const manager of managers) {
      const args = manager === 'rpm' ? ['-e', packageName] : ['-r', packageName];
      attempts.push({ command: 'pkexec', args: [manager, ...args], waitForExit: true });
      attempts.push({ command: 'sudo', args: ['-n', manager, ...args], waitForExit: true });
    }
    return { ok: true, attempts };
  }
  return { ok: false, error: `unsupported platform: ${platform}` };
}

function runUninstallAttempt({ attempt, spawnImpl = defaultSpawn, timeoutMs = 60000 }) {
  return new Promise((resolve) => {
    let timer = null;
    let child;
    try {
      child = spawnImpl(attempt.command, attempt.args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      });
    } catch (err) {
      resolve({ ok: false, error: err && err.message ? err.message : String(err) });
      return;
    }
    child.once('error', (err) => {
      if (timer) clearTimeout(timer);
      resolve({ ok: false, error: err && err.message ? err.message : String(err) });
    });
    if (attempt.waitForExit) {
      timer = setTimeout(() => {
        try { child.kill(); } catch (_e) {}
        resolve({ ok: false, error: 'timeout', command: attempt.command, args: attempt.args });
      }, timeoutMs);
      child.once('exit', (code, signal) => {
        if (timer) clearTimeout(timer);
        resolve({
          ok: code === 0,
          code,
          signal,
          command: attempt.command,
          args: attempt.args
        });
      });
      return;
    }
    child.once('spawn', () => {
      try { if (typeof child.unref === 'function') child.unref(); } catch (_e) {}
      resolve({ ok: true, command: attempt.command, args: attempt.args });
    });
  });
}

async function runUninstallAttempts({ attempts, spawnImpl = defaultSpawn, timeoutMs = 60000 }) {
  const failed = [];
  for (const attempt of attempts) {
    const result = await runUninstallAttempt({ attempt, spawnImpl, timeoutMs });
    if (result.ok) return result;
    failed.push({ command: attempt.command, error: result.error });
  }
  return { ok: false, error: 'all uninstall attempts failed', failed };
}

module.exports = {
  isWindowsUninstaller,
  findWindowsUninstaller,
  detectLinuxPackageManagers,
  buildUninstallPlan,
  runUninstallAttempt,
  runUninstallAttempts
};
