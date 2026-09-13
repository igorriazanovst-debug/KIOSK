// packages/player/electron/alphabet/contentLibrary.js
// Загрузка поставочной (read-only) библиотеки виджета «АзбукоСлов» из
// packages/alphabet-library/ — вшивается в сборку через extraResources, тем же
// способом, что words-library, natcom-library и chrono-templates.
//
// Библиотека статична на всё время жизни процесса: читается и проверяется
// один раз при старте, а не на каждый IPC-вызов. Поиск файла — тот же паттерн
// множественных путей: packaged-сборка кладёт пакет в process.resourcesPath,
// dev-запуск берёт его из монорепо.

const fs = require('fs');
const path = require('path');
const { alphabet } = require('@kiosk/shared');

function findLibraryIndexPathSync() {
  const searchPaths = [
    path.join(process.resourcesPath || '', 'alphabet-library', 'index.json'),
    path.join(__dirname, '..', '..', '..', 'alphabet-library', 'index.json'),
  ];
  for (const candidate of searchPaths) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Рекурсивный обход каталога ресурсов — пути в POSIX-форме относительно
 * корня assets, как их записывает манифест.
 * @param {string} root
 * @param {string} [prefix]
 * @returns {string[]}
 */
function listFilesSync(root, prefix = '') {
  if (!fs.existsSync(root)) return [];
  const out = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listFilesSync(path.join(root, entry.name), rel));
    else out.push(rel);
  }
  return out;
}

/**
 * @returns {{ library: object, assetsDir: string, completeness: object,
 *   graph: object, illustrations: object } | null}
 *   null — пакет не найден ни по одному пути.
 *
 * Комплектность, целостность графа и требование ТЗ строки 71 проверяются на
 * старте и репортятся в лог, но НЕ роняют приложение: на устройстве у
 * педагога уронить занятие из-за одного недостающего файла хуже, чем провести
 * его без этого файла. Жёсткими эти проверки должны быть на СБОРКЕ пакета.
 */
function loadLibrarySync() {
  const indexPath = findLibraryIndexPathSync();
  if (!indexPath) return null;

  const raw = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const library = alphabet.parseAlphabetLibrary(raw);
  const assetsDir = path.join(path.dirname(indexPath), 'assets');

  return {
    library,
    assetsDir,
    completeness: alphabet.checkLibraryCompleteness(library, listFilesSync(assetsDir)),
    graph: alphabet.checkGraph(library),
    illustrations: alphabet.checkLetterIllustrations(library),
  };
}

module.exports = { loadLibrarySync, findLibraryIndexPathSync, listFilesSync };
