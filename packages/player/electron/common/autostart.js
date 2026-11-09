// Автозапуск клиента после входа в ОС.
//
// Windows/macOS: Electron app.setLoginItemSettings (запись в автозагрузку ОС).
// Linux: файл ~/.config/autostart/<appId>.desktop — штатный механизм
// XDG Autostart, который понимают GNOME, KDE, XFCE и киоск-сессии.
//
// Модуль намеренно не импортирует electron: логика проверяется node:test,
// а конкретный app/execPath передаются из main.js.

const fs = require('node:fs');
const path = require('node:path');

const AUTOSTART_SUBDIR = 'autostart';
const DEFAULT_FILE_NAME = 'kiosk-player';

function sanitizeFilePart(value) {
  const cleaned = String(value || '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return cleaned || DEFAULT_FILE_NAME;
}

function autostartFilePath(configDir, appId) {
  return path.join(configDir, AUTOSTART_SUBDIR, `${sanitizeFilePart(appId)}.desktop`);
}

// Настройка «включён/выключен», заданная администратором. Нужна, чтобы
// выключенный автозапуск не включался снова при следующем старте: файла
// .desktop может не быть и по причине «ещё не настроено», и по причине
// «администратор выключил» — это разные состояния.
function preferenceFilePath(userDataDir) {
  return path.join(userDataDir, 'autostart-preference.json');
}

function readAutostartPreference({ userDataDir }) {
  if (!userDataDir) return null;
  const filePath = preferenceFilePath(userDataDir);
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    // Файл есть, но прочитать нельзя: безопаснее считать, что автозапуск
    // выключен, чем неожиданно включить его снова.
    return { configured: true, enabled: false, corrupt: true };
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.enabled === 'boolean') {
      return { configured: true, enabled: parsed.enabled };
    }
  } catch {
    // повреждённый JSON
  }
  return { configured: true, enabled: false, corrupt: true };
}

function resolveStartupEnabled(preference) {
  // Первый запуск (настройки нет) — включаем. Сохранённый выбор, включая
  // false и повреждённый файл, уважаем.
  return preference ? preference.enabled === true : true;
}

function writeAutostartPreference({ userDataDir, enabled }) {
  if (!userDataDir) return false;
  const filePath = preferenceFilePath(userDataDir);
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify({ enabled: enabled === true }), 'utf8');
    fs.renameSync(tmpPath, filePath);
    return true;
  } catch {
    return false;
  }
}

// Exec в .desktop — это командная строка. Пробелы/кавычки/обратные слэши
// экранируются, «%» — field code, поэтому удваивается.
function quoteDesktopExec(value) {
  const escaped = String(value)
    .replace(/([\\"`$])/g, '\\$1')
    .replace(/%/g, '%%');
  return `"${escaped}"`;
}

function sanitizeDesktopValue(value) {
  return String(value || '').replace(/[\r\n\0]/g, ' ').trim();
}

function buildDesktopEntry({ name, execPath, args = [] }) {
  const exec = [quoteDesktopExec(execPath), ...args.map(quoteDesktopExec)].join(' ');
  return [
    '[Desktop Entry]',
    'Type=Application',
    `Name=${sanitizeDesktopValue(name) || 'Инфосреда'}`,
    'Comment=Инфосреда: клиент KIOSK',
    `Exec=${exec}`,
    'Terminal=false',
    'X-GNOME-Autostart-enabled=true',
    'X-GNOME-Autostart-Delay=5',
    ''
  ].join('\n');
}

function setLinuxAutostart({ enabled, configDir, appId, appName, execPath, args = [] }) {
  if (!configDir) return { ok: false, error: 'configDir is required' };
  const filePath = autostartFilePath(configDir, appId);
  try {
    if (!enabled) {
      fs.rmSync(filePath, { force: true });
      return { ok: true, enabled: false, path: filePath };
    }
    if (!execPath) return { ok: false, error: 'execPath is required' };
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const content = buildDesktopEntry({ name: appName, execPath, args });
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, content, 'utf8');
    fs.renameSync(tmpPath, filePath);
    return { ok: true, enabled: true, path: filePath };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
}

function readLinuxAutostart({ configDir, appId }) {
  const filePath = autostartFilePath(configDir, appId);
  try {
    if (!fs.existsSync(filePath)) return { enabled: false, path: filePath };
    const content = fs.readFileSync(filePath, 'utf8');
    if (/X-GNOME-Autostart-enabled\s*=\s*false/i.test(content)) {
      return { enabled: false, path: filePath };
    }
    return { enabled: true, path: filePath };
  } catch {
    return { enabled: false, path: filePath };
  }
}

function applyAutostart({ platform, enabled, app, configDir, appId, appName, execPath, args = [] }) {
  if (platform === 'win32' || platform === 'darwin') {
    if (!app || typeof app.setLoginItemSettings !== 'function') {
      return { ok: false, error: 'Electron app API is unavailable' };
    }
    try {
      app.setLoginItemSettings({
        openAtLogin: enabled === true,
        path: execPath || process.execPath,
        args: Array.isArray(args) ? args : []
      });
      return { ok: true, enabled: enabled === true };
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) };
    }
  }
  if (platform === 'linux') {
    return setLinuxAutostart({ enabled: enabled === true, configDir, appId, appName, execPath, args });
  }
  return { ok: false, error: `unsupported platform: ${platform}` };
}

function getAutostartState({ platform, app, configDir, appId, execPath }) {
  if (platform === 'win32' || platform === 'darwin') {
    if (!app || typeof app.getLoginItemSettings !== 'function') {
      return { enabled: false, supported: false };
    }
    try {
      const state = app.getLoginItemSettings({ path: execPath || process.execPath });
      return { enabled: !!(state && state.openAtLogin), supported: true };
    } catch {
      return { enabled: false, supported: false };
    }
  }
  if (platform === 'linux') {
    return { ...readLinuxAutostart({ configDir, appId }), supported: true };
  }
  return { enabled: false, supported: false };
}

module.exports = {
  AUTOSTART_SUBDIR,
  sanitizeFilePart,
  autostartFilePath,
  preferenceFilePath,
  readAutostartPreference,
  resolveStartupEnabled,
  writeAutostartPreference,
  quoteDesktopExec,
  buildDesktopEntry,
  setLinuxAutostart,
  readLinuxAutostart,
  applyAutostart,
  getAutostartState
};
