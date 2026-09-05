// packages/player/electron/natcom/library.js
// Загрузка поставочной (read-only) библиотеки «Конструктора природных
// сообществ» из packages/natcom-library/ - вшита в сборку через
// extraResources (package.json), по тому же принципу, что chrono-templates
// у Хронолинии. Библиотека статична на всё время жизни процесса (как
// resetConfig у chrono/ipc.js) - читается и валидируется один раз, не на
// каждый IPC-вызов.
//
// Поиск файла - тот же паттерн множественных путей, что
// findProjectJsonForWindowModeSync в main.js: разные пути для packaged-сборки
// (process.resourcesPath) и dev-режима (относительно __dirname).

const fs = require('fs');
const path = require('path');
const { parseNatComLibrary } = require('@kiosk/shared');

function findLibraryIndexPathSync() {
  const searchPaths = [
    path.join(process.resourcesPath || '', 'natcom-library', 'index.json'),
    path.join(__dirname, '..', '..', '..', 'natcom-library', 'index.json'),
  ];
  for (const candidate of searchPaths) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * @returns {{ library: import('@kiosk/shared').NatComLibrary, assetsDir: string } | null}
 *   null - библиотека не найдена ни по одному из путей поиска (не должно
 *   случаться в реальной сборке - extraResources всегда её кладёт рядом;
 *   возможно при "голом" dev-запуске без packages/natcom-library на диске).
 */
function loadLibrarySync() {
  const indexPath = findLibraryIndexPathSync();
  if (!indexPath) return null;

  const raw = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const library = parseNatComLibrary(raw);
  return { library, assetsDir: path.join(path.dirname(indexPath), 'assets') };
}

module.exports = { loadLibrarySync, findLibraryIndexPathSync };
