// Сохранение скачиваний браузерной части (CSV-экспорт ЭУМК и т.п.) в
// «Загрузки» пользователя без диалога сохранения: у киоска нет файловых
// диалогов для обучающихся. Без обработчика will-download Electron может
// молча отбросить скачивание blob-ссылки — найдено вживую (кнопка
// «Экспорт CSV» не создавала файл, V-128).
//
// Модуль намеренно не импортирует electron: логика пути проверяется
// node:test, а конкретная session передаётся из main.js.

const fs = require('node:fs');
const path = require('node:path');

// Путь для сохранения: дедупликация «имя (1).csv», зачистка разделителей.
function uniqueDownloadPath(downloadsDir, filename, existsSync = fs.existsSync) {
  const safe =
    String(filename || '')
      .replace(/[\\/\0]+/g, '_')
      .trim()
      .slice(0, 120) || 'download';
  const candidate = path.join(downloadsDir, safe);
  if (!existsSync(candidate)) return candidate;
  const ext = path.extname(safe);
  const base = safe.slice(0, safe.length - ext.length);
  for (let i = 1; i < 1000; i++) {
    const next = path.join(downloadsDir, base + ' (' + i + ')' + ext);
    if (!existsSync(next)) return next;
  }
  return path.join(downloadsDir, Date.now() + '-' + safe);
}

module.exports = { uniqueDownloadPath };
