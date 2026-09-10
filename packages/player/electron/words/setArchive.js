// packages/player/electron/words/setArchive.js
// Экспорт и импорт комплекта слов педагога (ТЗ строка 56, FR-017) — ZIP с
// фиксированной, проверяемой белым списком структурой:
//   manifest.json        — { formatVersion, exportedAt, appVersion }
//   set.json             — { title, wordIds[], words[] } — состав комплекта
//   media/<32hex>.<ext>  — файлы своих слов, на которые ссылается set.json
//
// Устроен по образцу chrono/archive.js — тот же формат защиты, те же имена
// сущностей. Отдельный модуль, а не общий с Хронолинией: у неё в архиве
// целый проект с версионированной схемой и sha256 в 64 символа, у нас —
// комплект слов и имена файлов в 32 символа (см. mediaFiles.js). Общего
// кода получилось бы меньше, чем швов между двумя форматами.
//
// ЧТО ЕДЕТ В АРХИВЕ, А ЧТО НЕТ. Комплект может смешивать поставочные слова
// и свои (прямое требование строки 56). Поставочные — часть пакета
// контента, они в архив НЕ кладутся: едет только идентификатор, а на
// принимающем устройстве слово берётся из его собственной библиотеки. Свои
// слова едут целиком, вместе с картинкой и записью.
//
// Если на принимающем устройстве поставочного слова нет (другая версия
// пакета контента) — слово молча выпадает из комплекта, а импорт
// продолжается. Тот же принцип «деградация, не отказ», что и у остального
// кода с недостающими медиа. Отказ только если после выпадения в комплекте
// осталось меньше двух слов — играть таким нечем.
//
// Защита от zip-slip: белый список ТОЧНЫХ имён (manifest.json/set.json/
// media/<32hex>.<ext>) — не «путь не содержит ..», а «путь совпадает с
// ожидаемым». Ни одно имя из архива не попадает в fs.* до этой проверки, и
// имя файла на диске всё равно выводится из хеша содержимого, а не из
// архива.
//
// Защита от zip-bomb: entry.uncompressedSize из центрального каталога
// проверяется ДО открытия потока, плюс собственный счётчик прочитанных
// байт — оборона в глубину.
//
// Безопасность содержимого: каждый файл медиа из архива проходит тот же
// storeMediaBuffer(), что и файл, выбранный педагогом в диалоге — проверка
// по СИГНАТУРЕ содержимого, а не по имени. Переименованный .exe внутри
// архива отвергается ровно так же, как при обычном импорте (ТЗ раздел 9).

const fs = require('fs');
const path = require('path');
const yauzl = require('yauzl');
const yazl = require('yazl');
const { parseUserWords, MIN_SET_WORDS } = require('@kiosk/shared');
const mediaFiles = require('./mediaFiles');
const wordStore = require('./wordStore');

const ARCHIVE_FORMAT_VERSION = 1;
const MANIFEST_ENTRY = 'manifest.json';
const SET_ENTRY = 'set.json';
/** Имя файла медиа в архиве — то же, что и в хранилище: хеш содержимого + расширение */
const MEDIA_ENTRY_RE = /^media\/([0-9a-f]{32})\.([a-z0-9]{2,4})$/;

/** Потолки на файл и на архив: чуть выше лимитов обычного импорта медиа, но конечные */
const MAX_ENTRY_UNCOMPRESSED_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 512 * 1024 * 1024;
/** 500 слов по два файла плюс два json — с запасом */
const MAX_ENTRY_COUNT = 1200;

class SetArchiveError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SetArchiveError';
  }
}

// ─── Экспорт ────────────────────────────────────────────────────────────

/**
 * Собирает комплект в ZIP по указанному пути.
 * @returns {Promise<{ title: string, words: number, ownWords: number, files: number }>}
 */
async function exportSetToZip(baseDir, setId, targetFilePath) {
  const set = wordStore.listSets(baseDir).find((s) => s.id === setId);
  if (!set) throw new SetArchiveError('Такого комплекта нет');

  const userWords = wordStore.listUserWords(baseDir);
  const own = [];
  for (const wordId of set.wordIds) {
    const word = userWords.find((w) => w.id === wordId);
    if (word) own.push(word);
  }

  // Файлы, на которые ссылаются свои слова комплекта. Set — одно и то же
  // изображение может стоять у нескольких слов (дедупликация по хешу).
  const fileNames = new Set();
  for (const word of own) {
    if (word.imageFile) fileNames.add(word.imageFile);
    if (word.audioFile) fileNames.add(word.audioFile);
  }

  const zip = new yazl.ZipFile();
  zip.addBuffer(
    Buffer.from(
      JSON.stringify(
        { formatVersion: ARCHIVE_FORMAT_VERSION, exportedAt: new Date().toISOString() },
        null,
        2
      ),
      'utf8'
    ),
    MANIFEST_ENTRY
  );
  zip.addBuffer(
    Buffer.from(
      JSON.stringify({ title: set.title, wordIds: set.wordIds, words: own }, null, 2),
      'utf8'
    ),
    SET_ENTRY
  );

  let added = 0;
  for (const fileName of fileNames) {
    let filePath;
    try {
      filePath = mediaFiles.mediaFilePath(baseDir, fileName);
    } catch {
      continue; // некорректное имя в хранилище — пропускаем, экспорт не роняем
    }
    if (!fs.existsSync(filePath)) continue; // файл потерян — слово уедет без него
    zip.addFile(filePath, `media/${fileName}`);
    added += 1;
  }
  zip.end();

  // Пишем во временный файл и переименовываем: оборванный экспорт не
  // оставит полуархив под именем, которое педагог примет за готовый.
  const tmp = `${targetFilePath}.tmp-${process.pid}-${Date.now()}`;
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(tmp);
    out.on('error', reject);
    out.on('close', resolve);
    zip.outputStream.on('error', reject);
    zip.outputStream.pipe(out);
  });
  fs.renameSync(tmp, targetFilePath);

  return { title: set.title, words: set.wordIds.length, ownWords: own.length, files: added };
}

// ─── Импорт ─────────────────────────────────────────────────────────────

function openZip(sourceFilePath) {
  return new Promise((resolve, reject) => {
    yauzl.open(sourceFilePath, { lazyEntries: true, autoClose: false }, (err, zipfile) => {
      if (err) reject(new SetArchiveError('Файл не является архивом комплекта'));
      else resolve(zipfile);
    });
  });
}

/** Читает entry целиком в память, считая реально прочитанные байты */
function readEntry(zipfile, entry, maxBytes) {
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (err, stream) => {
      if (err) return reject(new SetArchiveError(`Не удалось прочитать ${entry.fileName}`));
      const chunks = [];
      let total = 0;
      stream.on('data', (chunk) => {
        total += chunk.length;
        if (total > maxBytes) {
          stream.destroy();
          reject(new SetArchiveError(`Файл в архиве больше заявленного размера: ${entry.fileName}`));
        } else {
          chunks.push(chunk);
        }
      });
      stream.on('error', () => reject(new SetArchiveError(`Ошибка чтения ${entry.fileName}`)));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  });
}

/**
 * Проходит по каталогу архива, отбирая ТОЛЬКО записи из белого списка.
 * Всё остальное — ошибка, а не молчаливый пропуск: чужая структура значит,
 * что это не наш архив, и продолжать разбор нечего.
 */
function collectEntries(zipfile) {
  return new Promise((resolve, reject) => {
    const found = new Map();
    let count = 0;
    let totalBytes = 0;

    zipfile.on('error', () => reject(new SetArchiveError('Архив повреждён')));
    zipfile.on('entry', (entry) => {
      count += 1;
      if (count > MAX_ENTRY_COUNT) {
        return reject(new SetArchiveError('В архиве слишком много файлов'));
      }
      if (/\/$/.test(entry.fileName)) return zipfile.readEntry(); // каталог

      const name = entry.fileName;
      const allowed = name === MANIFEST_ENTRY || name === SET_ENTRY || MEDIA_ENTRY_RE.test(name);
      if (!allowed) {
        return reject(new SetArchiveError(`Неожиданный файл в архиве: ${name}`));
      }
      if (entry.uncompressedSize > MAX_ENTRY_UNCOMPRESSED_BYTES) {
        return reject(new SetArchiveError(`Файл в архиве слишком большой: ${name}`));
      }
      totalBytes += entry.uncompressedSize;
      if (totalBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
        return reject(new SetArchiveError('Архив слишком большой'));
      }
      found.set(name, entry);
      zipfile.readEntry();
    });
    zipfile.on('end', () => resolve(found));
    zipfile.readEntry();
  });
}

function parseJsonEntry(buffer, what) {
  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch {
    throw new SetArchiveError(`Файл ${what} в архиве повреждён`);
  }
}

/** Название, свободное среди существующих комплектов: «Урок», «Урок (2)», … */
function freeTitle(existing, wanted) {
  const taken = new Set(existing.map((s) => s.title.toLowerCase()));
  if (!taken.has(wanted.toLowerCase())) return wanted;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${wanted} (${n})`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  throw new SetArchiveError('Слишком много комплектов с таким названием');
}

/**
 * Разбирает архив и добавляет комплект в хранилище устройства.
 *
 * Идентификаторы своих слов выдаются заново — идентификатор из чужого
 * устройства мог бы совпасть с уже существующим здесь. Слово, полностью
 * совпадающее с уже имеющимся (то же название и те же файлы), повторно не
 * заводится: педагог, импортировавший один и тот же комплект дважды, не
 * должен получить две копии каждого слова.
 *
 * @returns {Promise<{ set, addedWords: number, reusedWords: number, skippedWords: string[] }>}
 */
async function importSetFromZip(baseDir, sourceFilePath, libraryWordIds) {
  const zipfile = await openZip(sourceFilePath);
  let entries;
  try {
    entries = await collectEntries(zipfile);

    if (!entries.has(MANIFEST_ENTRY) || !entries.has(SET_ENTRY)) {
      throw new SetArchiveError('Это не архив комплекта: нет manifest.json или set.json');
    }

    const manifest = parseJsonEntry(
      await readEntry(zipfile, entries.get(MANIFEST_ENTRY), MAX_ENTRY_UNCOMPRESSED_BYTES),
      'manifest.json'
    );
    if (manifest?.formatVersion !== ARCHIVE_FORMAT_VERSION) {
      throw new SetArchiveError(
        `Версия формата архива ${manifest?.formatVersion ?? '(нет)'} не поддерживается`
      );
    }

    const payload = parseJsonEntry(
      await readEntry(zipfile, entries.get(SET_ENTRY), MAX_ENTRY_UNCOMPRESSED_BYTES),
      'set.json'
    );
    if (typeof payload?.title !== 'string' || !Array.isArray(payload?.wordIds)) {
      throw new SetArchiveError('Файл set.json в архиве повреждён');
    }

    // Свои слова архива — через ту же валидацию схемой, что и данные с
    // диска: недоверенный вход не идёт мимо parseUserWords (правило
    // сценария, раздел 4).
    const incoming = parseUserWords(Array.isArray(payload.words) ? payload.words : []);
    const incomingById = new Map(incoming.map((w) => [w.id, w]));

    const known = new Set(libraryWordIds || []);
    const existingWords = wordStore.listUserWords(baseDir);

    /** Файлы, уже разложенные по хранилищу в этом импорте: имя в архиве → имя на диске */
    const storedFiles = new Map();
    const skipped = [];
    let addedWords = 0;
    let reusedWords = 0;
    const resultIds = [];

    for (const wordId of payload.wordIds) {
      if (typeof wordId !== 'string') continue;

      // Поставочное слово: в архиве его нет, ищем в библиотеке устройства
      if (!incomingById.has(wordId)) {
        if (known.has(wordId)) resultIds.push(wordId);
        else skipped.push(wordId);
        continue;
      }

      const word = incomingById.get(wordId);

      // Медиа слова: каждый файл — через проверку по сигнатуре
      const files = {};
      let lost = false;
      for (const kind of ['image', 'audio']) {
        const fileName = kind === 'image' ? word.imageFile : word.audioFile;
        if (!fileName) {
          files[kind] = null;
          continue;
        }
        if (storedFiles.has(fileName)) {
          files[kind] = storedFiles.get(fileName);
          continue;
        }
        const entry = entries.get(`media/${fileName}`);
        if (!entry) {
          // Файл заявлен, но в архив не попал — слово без него бессмысленно
          files[kind] = null;
          lost = true;
          continue;
        }
        const content = await readEntry(zipfile, entry, MAX_ENTRY_UNCOMPRESSED_BYTES);
        const stored = mediaFiles.storeMediaBuffer(baseDir, content, kind);
        storedFiles.set(fileName, stored.fileName);
        files[kind] = stored.fileName;
      }

      if (lost && !files.image && !files.audio) {
        skipped.push(word.name);
        continue;
      }

      // Такое слово здесь уже есть — берём существующее, не плодим копию
      const twin = existingWords.find(
        (w) =>
          w.name.toLowerCase() === word.name.toLowerCase() &&
          (w.imageFile ?? null) === (files.image ?? null) &&
          (w.audioFile ?? null) === (files.audio ?? null)
      );
      if (twin) {
        resultIds.push(twin.id);
        reusedWords += 1;
        continue;
      }

      const created = wordStore.createUserWord(baseDir, {
        name: word.name,
        imageFile: files.image ?? null,
        audioFile: files.audio ?? null,
      });
      existingWords.push(created);
      resultIds.push(created.id);
      addedWords += 1;
    }

    const unique = [...new Set(resultIds)];
    if (unique.length < MIN_SET_WORDS) {
      throw new SetArchiveError(
        `После импорта в комплекте осталось слов: ${unique.length}. Нужно хотя бы ${MIN_SET_WORDS} — часть слов этого комплекта отсутствует на устройстве`
      );
    }

    const title = freeTitle(wordStore.listSets(baseDir), payload.title.trim() || 'Комплект');
    const set = wordStore.createSet(baseDir, { title, wordIds: unique }, libraryWordIds);

    return { set, addedWords, reusedWords, skippedWords: skipped };
  } finally {
    zipfile.close();
  }
}

module.exports = {
  SetArchiveError,
  ARCHIVE_FORMAT_VERSION,
  MANIFEST_ENTRY,
  SET_ENTRY,
  MEDIA_ENTRY_RE,
  MAX_ENTRY_UNCOMPRESSED_BYTES,
  MAX_TOTAL_UNCOMPRESSED_BYTES,
  MAX_ENTRY_COUNT,
  exportSetToZip,
  importSetFromZip,
};
