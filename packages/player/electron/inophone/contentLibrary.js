// packages/player/electron/inophone/contentLibrary.js
// Поиск и чтение поставочного пакета контента «Инофон».
//
// packages/inophone-library/ вшивается в сборку через extraResources, тем же
// способом, что пакеты «слов» и «АзбукоСлов». Отсюда поиск по нескольким
// путям: собранная поставка кладёт пакет в process.resourcesPath, а при
// запуске из исходников он лежит рядом в монорепозитории.
//
// БИБЛИОТЕКА ЧИТАЕТСЯ ОДИН РАЗ ПРИ СТАРТЕ, а не на каждый запрос: она
// статична всё время жизни процесса, а разбор словаря на три с лишним тысячи
// переводов на каждый щелчок по объекту — это заметная пауза на доске.
//
// ОТСУТСТВИЕ ПАКЕТА НЕ РОНЯЕТ ПРИЛОЖЕНИЕ. Рантайм покажет внятное сообщение
// вместо пустого экрана: «пакет контента не найден» педагог передаст
// администратору, а белый экран — нет.

const fs = require('fs');
const path = require('path');
const { inophone } = require('@kiosk/shared');

const LIBRARY_DIR_NAME = 'inophone-library';
const INDEX_FILE = 'index.json';
const ASSETS_DIR = 'assets';

function candidatePaths() {
  return [
    path.join(process.resourcesPath || '', LIBRARY_DIR_NAME, INDEX_FILE),
    path.join(__dirname, '..', '..', '..', LIBRARY_DIR_NAME, INDEX_FILE),
  ];
}

/**
 * Читает пакет. Возвращает { library, assetsDir } либо { error } с текстом,
 * пригодным для показа педагогу.
 *
 * Ошибку НЕ бросает: отсутствие контента — штатная ситуация при разработке и
 * при неполной установке, и обрушить на ней запуск приложения значит сделать
 * диагностику невозможной.
 */
function loadLibrarySync() {
  const tried = [];
  for (const indexPath of candidatePaths()) {
    tried.push(indexPath);
    if (!indexPath || !fs.existsSync(indexPath)) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      const library = inophone.parseInophoneLibrary(raw);
      return { library, assetsDir: path.join(path.dirname(indexPath), ASSETS_DIR) };
    } catch (err) {
      // Пакет НАЙДЕН, но испорчен — это другая беда, чем «пакета нет», и
      // искать дальше по списку путей нельзя: вторым найдётся старая копия,
      // и подмена пройдёт незамеченной
      return {
        error:
          `Пакет контента найден, но испорчен: ${indexPath}. ` +
          `${err && err.message ? err.message : String(err)}`,
      };
    }
  }
  return { error: `Пакет контента не найден. Искали: ${tried.filter(Boolean).join(', ')}` };
}

/**
 * Список файлов пакета в терминах путей ресурсов — для проверки
 * комплектности. Возвращает множество, а не массив: проверка спрашивает
 * «есть ли такой путь» тысячи раз.
 */
function listAssetFiles(assetsDir) {
  const out = new Set();
  if (!assetsDir || !fs.existsSync(assetsDir)) return out;
  const walk = (dir, prefix) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(dir, entry.name), rel);
      else out.add(rel);
    }
  };
  walk(assetsDir, '');
  return out;
}

module.exports = { loadLibrarySync, listAssetFiles, LIBRARY_DIR_NAME };
