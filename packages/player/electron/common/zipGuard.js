// packages/player/electron/common/zipGuard.js
// Безопасное чтение ZIP-архива с контентом педагога — общее для виджетов.
//
// ВЫНЕСЕНО ИЗ electron/words/setArchive.js при работе над Тип 3. Причина не
// в экономии строк: это КОД ЗАЩИТЫ. Найдись дыра в одной копии — вторая
// сохранила бы её, и никто бы не заметил, потому что чинили бы первую.
// Форматы архивов у виджетов разные (у «слов» едут слова и темы, у
// «АзбукоСлов» ещё и слоги с тремя записями на слово), а оборона одна.
//
// ТРИ РУБЕЖА, все из ТЗ раздела 9 («входные файлы и импортируемый контент
// должны проверяться по типу/формату», «пользовательские файлы не должны
// исполняться как код»):
//
//  1. ZIP-SLIP. Белый список ТОЧНЫХ имён, а не проверка «путь не содержит
//     ..». Разница принципиальна: обходов проверки на «..» придумано много
//     (обратные слэши, юникодные точки, абсолютные пути, символические
//     ссылки внутри архива), а совпадение с ожидаемым именем обойти нечем.
//     Ни одно имя из архива не доходит до fs.* раньше этой проверки.
//
//  2. ZIP-BOMB. Заявленный размер из центрального каталога проверяется ДО
//     открытия потока, и отдельно считаются РЕАЛЬНО прочитанные байты:
//     заявленному размеру в архиве верить нельзя, его пишет тот же, кто
//     собрал архив. Плюс потолок на число записей.
//
//  3. СОДЕРЖИМОЕ. Проверку сигнатур этот модуль не делает — её делает
//     mediaFiles.storeMediaBuffer, через который обязан пройти каждый файл
//     медиа из архива. Здесь только доставка байтов.

const yauzl = require('yauzl');

/** Потолки на файл и на архив: выше лимитов обычного импорта, но конечные */
const MAX_ENTRY_UNCOMPRESSED_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 512 * 1024 * 1024;
/** Слова, слоги и по три записи на слово — с запасом */
const MAX_ENTRY_COUNT = 4000;

class ZipGuardError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ZipGuardError';
  }
}

/**
 * @param {string} sourceFilePath
 * @param {(message: string) => Error} [wrap] — как называть ошибки наружу:
 *   у каждого виджета свой тип ошибки и свои формулировки для педагога
 */
function openZip(sourceFilePath, wrap = (m) => new ZipGuardError(m)) {
  return new Promise((resolve, reject) => {
    yauzl.open(sourceFilePath, { lazyEntries: true, autoClose: false }, (err, zipfile) => {
      if (err) reject(wrap('Файл не является архивом комплекта'));
      else resolve(zipfile);
    });
  });
}

/**
 * Читает запись целиком в память, считая РЕАЛЬНО прочитанные байты.
 *
 * Заявленному в каталоге размеру верить нельзя: его пишет тот, кто собрал
 * архив. Поэтому счётчик здесь — не дубликат проверки в collectEntries,
 * а второй, независимый рубеж.
 */
function readEntry(zipfile, entry, maxBytes, wrap = (m) => new ZipGuardError(m)) {
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (err, stream) => {
      if (err) return reject(wrap(`Не удалось прочитать ${entry.fileName}`));
      const chunks = [];
      let total = 0;
      stream.on('data', (chunk) => {
        total += chunk.length;
        if (total > maxBytes) {
          stream.destroy();
          reject(wrap(`Файл в архиве больше заявленного размера: ${entry.fileName}`));
        } else {
          chunks.push(chunk);
        }
      });
      stream.on('error', () => reject(wrap(`Ошибка чтения ${entry.fileName}`)));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  });
}

/**
 * Проходит по каталогу архива, отбирая ТОЛЬКО записи, которые разрешил
 * вызывающий. Всё остальное — ошибка, а не молчаливый пропуск: чужая
 * структура значит, что это не наш архив, и продолжать разбор нечего.
 *
 * @param {import('yauzl').ZipFile} zipfile
 * @param {(name: string) => boolean} isAllowed — белый список ТОЧНЫХ имён
 * @param {(message: string) => Error} [wrap]
 * @param {{ maxEntries?: number, maxEntryBytes?: number, maxTotalBytes?: number }} [limits]
 * @returns {Promise<Map<string, import('yauzl').Entry>>}
 */
function collectEntries(zipfile, isAllowed, wrap = (m) => new ZipGuardError(m), limits = {}) {
  const maxEntries = limits.maxEntries ?? MAX_ENTRY_COUNT;
  const maxEntryBytes = limits.maxEntryBytes ?? MAX_ENTRY_UNCOMPRESSED_BYTES;
  const maxTotalBytes = limits.maxTotalBytes ?? MAX_TOTAL_UNCOMPRESSED_BYTES;

  return new Promise((resolve, reject) => {
    const found = new Map();
    let count = 0;
    let totalBytes = 0;

    zipfile.on('error', () => reject(wrap('Архив повреждён')));
    zipfile.on('entry', (entry) => {
      count += 1;
      if (count > maxEntries) return reject(wrap('В архиве слишком много файлов'));
      if (/\/$/.test(entry.fileName)) return zipfile.readEntry(); // каталог

      const name = entry.fileName;
      if (!isAllowed(name)) return reject(wrap(`Неожиданный файл в архиве: ${name}`));
      if (entry.uncompressedSize > maxEntryBytes) {
        return reject(wrap(`Файл в архиве слишком большой: ${name}`));
      }
      totalBytes += entry.uncompressedSize;
      if (totalBytes > maxTotalBytes) return reject(wrap('Архив слишком большой'));

      found.set(name, entry);
      zipfile.readEntry();
    });
    zipfile.on('end', () => resolve(found));
    zipfile.readEntry();
  });
}

function parseJsonEntry(buffer, what, wrap = (m) => new ZipGuardError(m)) {
  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch {
    throw wrap(`Файл ${what} в архиве повреждён`);
  }
}

module.exports = {
  ZipGuardError,
  MAX_ENTRY_UNCOMPRESSED_BYTES,
  MAX_TOTAL_UNCOMPRESSED_BYTES,
  MAX_ENTRY_COUNT,
  openZip,
  readEntry,
  collectEntries,
  parseJsonEntry,
};
