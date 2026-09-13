// packages/player/electron/alphabet/setArchive.js
// Экспорт и импорт комплекта слов (ТЗ строка 77 — две из пяти операций).
//
// ZIP с фиксированной, проверяемой белым списком структурой:
//   manifest.json              — { formatVersion, exportedAt }
//   set.json                   — комплект, свои слова и свои слоги
//   media/<32hex>.<ext>        — картинки своих слов
//   voice/<род>-<id>.webm      — записи: слово, «без последнего слога», слоги
//
// ОБОРОНА ОБЩАЯ — electron/common/zipGuard.js. Формат архива у виджетов
// разный, а zip-slip и zip-bomb одни и те же, и код защиты дублировать
// нельзя: найдись дыра в одной копии, вторая сохранила бы её.
//
// ЧТО ЕДЕТ, А ЧТО НЕТ. Комплект может смешивать поставочные слова и свои —
// прямое требование ТЗ строки 77. Поставочные в архив НЕ кладутся: едет
// только идентификатор, а на принимающем устройстве слово берётся из его
// собственного пакета контента. Свои слова едут целиком.
//
// СЛОГИ ЕДУТ ТОЖЕ, и это главное отличие от Тип 2. Своё слово ссылается на
// слоги, а те могут быть своими же — на чужом устройстве их нет. Привези
// слово без слогов, и оно окажется сломанным ровно тем способом, который
// ловит checkGraph: ссылка в пустоту. Поэтому в архив кладутся все свои
// слоги, на которые ссылаются едущие слова.
//
// ЕСЛИ ПОСТАВОЧНОГО СЛОВА НА ПРИНИМАЮЩЕМ УСТРОЙСТВЕ НЕТ (другая версия
// пакета контента) — слово молча выпадает из комплекта, а импорт
// продолжается. Тот же принцип «деградация, не отказ», что и везде в этом
// коде. Отказ только если после выпадения играть стало нечем.

const fs = require('fs');
const path = require('path');
const yazl = require('yazl');
const zipGuard = require('../common/zipGuard');
const mediaFiles = require('../common/mediaFiles');
const contentStore = require('./contentStore');
const { alphabet } = require('@kiosk/shared');

const ARCHIVE_FORMAT_VERSION = 1;
const MANIFEST_ENTRY = 'manifest.json';
const SET_ENTRY = 'set.json';
/** Имя файла медиа в архиве — то же, что в хранилище: хеш содержимого */
const MEDIA_ENTRY_RE = /^media\/([0-9a-f]{32})\.([a-z0-9]{2,4})$/;
/** Запись голоса: род, идентификатор сущности, webm */
const VOICE_ENTRY_RE = /^voice\/(word|bgn|syllable)-([a-z0-9_]{1,40})\.webm$/;

/** Комплект меньше двух слов играть нечем */
const MIN_SET_WORDS = 2;

class AlphabetSetArchiveError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AlphabetSetArchiveError';
  }
}

const asError = (message) => new AlphabetSetArchiveError(message);

/** Основа имени файла из названия комплекта — подсказка в диалоге сохранения */
function safeFileStem(title) {
  const cleaned = String(title || '')
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .trim()
    .slice(0, 60);
  return cleaned || 'Комплект';
}

// ─── Экспорт ────────────────────────────────────────────────────────────

/**
 * Собирает комплект в ZIP по указанному пути.
 * @returns {Promise<{title: string, words: number, ownWords: number, files: number}>}
 */
async function exportSetToZip(baseDir, setId, targetFilePath) {
  const content = contentStore.readContent(baseDir);
  const set = content.sets.find((s) => s.id === setId);
  if (!set) throw asError('Такого комплекта нет');

  const ownWords = set.wordIds
    .map((id) => content.words.find((w) => w.id === id))
    .filter(Boolean);

  // Свои слоги, на которые ссылаются едущие слова. Поставочные не кладём:
  // они есть на любом устройстве с тем же пакетом контента
  const neededSyllableIds = new Set();
  for (const word of ownWords) {
    for (const id of word.syllableIds) neededSyllableIds.add(id);
  }
  const ownSyllables = content.syllables.filter((s) => neededSyllableIds.has(s.id));

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
      JSON.stringify(
        { title: set.title, wordIds: set.wordIds, words: ownWords, syllables: ownSyllables },
        null,
        2
      ),
      'utf8'
    ),
    SET_ENTRY
  );

  let files = 0;

  // Картинки. Set — одна и та же может стоять у нескольких слов
  const imageFiles = new Set(ownWords.map((w) => w.imageFile).filter(Boolean));
  for (const fileName of imageFiles) {
    const filePath = mediaFiles.mediaFilePath(baseDir, fileName);
    if (!fs.existsSync(filePath)) continue; // файла нет — едем без него
    zip.addFile(filePath, `media/${fileName}`);
    files += 1;
  }

  // Записи: слово целиком, без последнего слога, каждый слог
  const voices = [];
  for (const word of ownWords) {
    voices.push(['word', word.id], ['bgn', word.id]);
  }
  for (const syllable of ownSyllables) voices.push(['syllable', syllable.id]);
  for (const [kind, id] of voices) {
    const filePath = contentStore.voicePath(baseDir, kind, id);
    if (!fs.existsSync(filePath)) continue;
    zip.addFile(filePath, `voice/${path.basename(filePath)}`);
    files += 1;
  }

  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(targetFilePath);
    out.on('error', () => reject(asError('Не удалось записать файл комплекта')));
    out.on('close', resolve);
    zip.outputStream.pipe(out);
    zip.end();
  });

  return { title: set.title, words: set.wordIds.length, ownWords: ownWords.length, files };
}

// ─── Импорт ─────────────────────────────────────────────────────────────

/**
 * Разбирает архив и добавляет комплект. Возвращает отчёт: что приехало и
 * что выпало — педагог должен знать, если комплект приехал не целиком.
 *
 * @param {string[]} libraryWordIds — идентификаторы поставочных слов ЭТОГО
 *   устройства. Слово, которого здесь нет, выпадает из комплекта
 */
async function importSetFromZip(baseDir, sourceFilePath, libraryWordIds = []) {
  const zipfile = await zipGuard.openZip(sourceFilePath, asError);
  try {
    const entries = await zipGuard.collectEntries(
      zipfile,
      (name) =>
        name === MANIFEST_ENTRY ||
        name === SET_ENTRY ||
        MEDIA_ENTRY_RE.test(name) ||
        VOICE_ENTRY_RE.test(name),
      asError
    );

    const manifestEntry = entries.get(MANIFEST_ENTRY);
    const setEntry = entries.get(SET_ENTRY);
    if (!manifestEntry || !setEntry) throw asError('Это не архив комплекта «АзбукоСлов»');

    const manifest = zipGuard.parseJsonEntry(
      await zipGuard.readEntry(zipfile, manifestEntry, zipGuard.MAX_ENTRY_UNCOMPRESSED_BYTES, asError),
      'описания',
      asError
    );
    if (manifest.formatVersion !== ARCHIVE_FORMAT_VERSION) {
      throw asError(
        `Комплект создан другой версией программы (формат ${manifest.formatVersion})`
      );
    }

    const payload = zipGuard.parseJsonEntry(
      await zipGuard.readEntry(zipfile, setEntry, zipGuard.MAX_ENTRY_UNCOMPRESSED_BYTES, asError),
      'комплекта',
      asError
    );
    if (!payload || typeof payload.title !== 'string' || !Array.isArray(payload.wordIds)) {
      throw asError('Описание комплекта в архиве повреждено');
    }

    // Разбор своего контента из архива — тем же терпимым разбором, что и с
    // диска: битая запись отбрасывается, остальные выживают
    const incoming = alphabet.parseUserContent({
      words: payload.words,
      syllables: payload.syllables,
      sets: [],
    });

    const content = contentStore.readContent(baseDir);

    // Новые идентификаторы: на принимающем устройстве уже может быть слово
    // с тем же id — например, комплект возвращается туда, откуда уехал,
    // после правок. Переименовываем всё приезжее, чтобы ничего не затереть
    const syllableIdMap = new Map();
    const newSyllables = [];
    for (const syllable of incoming.syllables) {
      // Слог с тем же написанием уже есть — используем его, а не заводим
      // второй: два одинаковых слога дали бы два файла на один звук
      const existing = content.syllables.find((s) => s.name === syllable.name);
      if (existing) {
        syllableIdMap.set(syllable.id, existing.id);
        continue;
      }
      const id = contentStore.newUserId();
      syllableIdMap.set(syllable.id, id);
      newSyllables.push({ ...syllable, id });
    }

    const wordIdMap = new Map();
    const newWords = [];
    for (const word of incoming.words) {
      const id = contentStore.newUserId();
      wordIdMap.set(word.id, id);
      newWords.push({
        ...word,
        id,
        syllableIds: word.syllableIds.map((sid) => syllableIdMap.get(sid) ?? sid),
        imageFile: null, // проставится ниже, после проверки файла
      });
    }

    // Медиа: каждый файл проходит тот же storeMediaBuffer, что и файл из
    // диалога — проверка по СИГНАТУРЕ, а не по имени. Переименованный .exe
    // внутри архива отвергается ровно так же (ТЗ раздел 9)
    const storedByArchiveName = new Map();
    for (const [name, entry] of entries) {
      if (!MEDIA_ENTRY_RE.test(name)) continue;
      const buffer = await zipGuard.readEntry(
        zipfile,
        entry,
        zipGuard.MAX_ENTRY_UNCOMPRESSED_BYTES,
        asError
      );
      try {
        const stored = mediaFiles.storeMediaBuffer(baseDir, buffer, 'image');
        storedByArchiveName.set(name.slice('media/'.length), stored.fileName);
      } catch {
        // Негодный файл — слово приедет без картинки, но приедет
      }
    }
    for (let i = 0; i < newWords.length; i += 1) {
      const original = incoming.words[i];
      if (original.imageFile && storedByArchiveName.has(original.imageFile)) {
        newWords[i].imageFile = storedByArchiveName.get(original.imageFile);
      }
    }

    // Записи голоса — под новыми идентификаторами
    let voicesRestored = 0;
    for (const [name, entry] of entries) {
      const match = VOICE_ENTRY_RE.exec(name);
      if (!match) continue;
      const [, kind, oldId] = match;
      const newId = kind === 'syllable' ? syllableIdMap.get(oldId) : wordIdMap.get(oldId);
      if (!newId) continue;
      const buffer = await zipGuard.readEntry(
        zipfile,
        entry,
        zipGuard.MAX_ENTRY_UNCOMPRESSED_BYTES,
        asError
      );
      try {
        contentStore.saveVoice(baseDir, kind, newId, buffer);
        voicesRestored += 1;
      } catch {
        // Негодная запись — слово приедет молчащим, но приедет
      }
    }

    // Состав комплекта: свои слова под новыми id, поставочные — как есть,
    // если они есть на этом устройстве
    const known = new Set(libraryWordIds);
    const dropped = [];
    const wordIds = [];
    for (const oldId of payload.wordIds) {
      const mapped = wordIdMap.get(oldId);
      if (mapped) {
        wordIds.push(mapped);
      } else if (known.has(oldId)) {
        wordIds.push(oldId);
      } else {
        dropped.push(oldId);
      }
    }
    if (wordIds.length < MIN_SET_WORDS) {
      throw asError(
        `В комплекте осталось слов: ${wordIds.length}. Похоже, он собран для другой версии программы`
      );
    }

    const { title, renamed } = alphabet.resolveImportedSetTitle(content.sets, payload.title);
    const created = {
      id: contentStore.newUserId(),
      title,
      wordIds,
    };

    contentStore.writeContent(baseDir, {
      words: [...content.words, ...newWords],
      syllables: [...content.syllables, ...newSyllables],
      sets: [...content.sets, created],
    });

    return {
      set: created,
      renamed,
      words: wordIds.length,
      ownWords: newWords.length,
      syllables: newSyllables.length,
      voices: voicesRestored,
      dropped,
    };
  } finally {
    try {
      zipfile.close();
    } catch {
      /* уже закрыт */
    }
  }
}

module.exports = {
  AlphabetSetArchiveError,
  ARCHIVE_FORMAT_VERSION,
  MANIFEST_ENTRY,
  SET_ENTRY,
  MEDIA_ENTRY_RE,
  VOICE_ENTRY_RE,
  MIN_SET_WORDS,
  safeFileStem,
  exportSetToZip,
  importSetFromZip,
};
