// packages/player/electron/words/contentLibrary.js
// Загрузка поставочной (read-only) библиотеки виджета «Я знаю много слов» из
// packages/words-library/ — вшита в сборку через extraResources, тем же
// способом, что natcom-library и chrono-templates.
//
// Библиотека статична на всё время жизни процесса: читается и валидируется
// один раз при старте, а не на каждый IPC-вызов — как loadLibrarySync у
// natcom. Поиск файла — тот же паттерн множественных путей: packaged-сборка
// кладёт пакет в process.resourcesPath, dev-запуск берёт его из монорепо.

const fs = require('fs');
const path = require('path');
const { parseWordsLibrary, checkLibraryCompleteness } = require('@kiosk/shared');

function findLibraryIndexPathSync() {
  const searchPaths = [
    path.join(process.resourcesPath || '', 'words-library', 'index.json'),
    path.join(__dirname, '..', '..', '..', 'words-library', 'index.json'),
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
 * @returns {{
 *   library: import('@kiosk/shared').WordsLibrary,
 *   assetsDir: string,
 *   completeness: ReturnType<typeof checkLibraryCompleteness>
 * } | null} null — пакет не найден ни по одному пути (в реальной сборке
 *   extraResources кладёт его всегда; возможно при «голом» dev-запуске).
 */
function loadLibrarySync() {
  const indexPath = findLibraryIndexPathSync();
  if (!indexPath) return null;

  const raw = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const library = parseWordsLibrary(raw);
  const assetsDir = path.join(path.dirname(indexPath), 'assets');

  // Комплектность проверяется на старте и репортится в лог, но НЕ роняет
  // приложение: на устройстве у педагога уронить занятие из-за одного
  // недостающего файла хуже, чем провести его без этого файла. Жёсткой
  // проверка должна быть на сборке пакета, а не в рантайме у пользователя.
  const completeness = checkLibraryCompleteness(library, listFilesSync(assetsDir));

  return { library, assetsDir, completeness };
}

module.exports = { loadLibrarySync, findLibraryIndexPathSync, listFilesSync };
