// K2-F10: пути токена активации. Токен пишется в userData (профиль
// приложения): на Linux каталог установки (/opt) принадлежит root, и
// запись рядом с exe молча падает (EACCES) - киоск после рестарта снова
// просил активацию. Имя файла привязано к projectId: смена проекта =
// новая активация (инвариант K2). Чистые функции - тестируются без Electron.

const path = require('node:path');
const fs = require('node:fs');

function tokenFileName(projectId) {
  const pid = (projectId && typeof projectId === 'string') ? projectId.slice(0, 8) : 'noproj';
  return `player-token-${pid}.json`;
}

function resolveTokenPath(userDataDir, projectId) {
  return path.join(userDataDir, tokenFileName(projectId));
}

// Одноразовая миграция: перенести токены из каталога установки (старое
// место до K2-F10) в userData, иначе обновление разлогинило бы киоски.
// Более новый файл в userData не перезаписывается устаревшим из exe-каталога.
function migrateLegacyTokenFiles({ execDir, userDataDir }) {
  const moved = [];
  let entries;
  try {
    entries = fs.readdirSync(execDir);
  } catch {
    return moved; // каталога нет или не читается - мигрировать нечего
  }
  fs.mkdirSync(userDataDir, { recursive: true });
  for (const name of entries) {
    if (!/^player-token-.*\.json$/.test(name)) continue;
    const from = path.join(execDir, name);
    const to = path.join(userDataDir, name);
    try {
      if (!fs.existsSync(to)) {
        fs.copyFileSync(from, to);
      }
      fs.unlinkSync(from);
      moved.push(name);
    } catch {
      // не смогли перенести - токен просто перезапросит активацию, не беда
    }
  }
  return moved;
}

// Удаление ПО (подписанная команда device:uninstall): токены устройства
// очищаются, данные пользователей (результаты ЭУМК и т.п.) не трогаются (P-03).
function cleanupTokenFiles(userDataDir) {
  const removed = [];
  let entries;
  try {
    entries = fs.readdirSync(userDataDir);
  } catch {
    return removed;
  }
  for (const name of entries) {
    if (!/^player-token-.*\.json$/.test(name)) continue;
    try {
      fs.unlinkSync(path.join(userDataDir, name));
      removed.push(name);
    } catch {}
  }
  return removed;
}

module.exports = { tokenFileName, resolveTokenPath, migrateLegacyTokenFiles, cleanupTokenFiles };
