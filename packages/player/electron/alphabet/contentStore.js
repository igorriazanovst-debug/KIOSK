// packages/player/electron/alphabet/contentStore.js
// Контент педагога: свои слова, свои слоги и комплекты (ТЗ строки 76–78).
//
// ПРАВИЛА ЗДЕСЬ НЕ ЖИВУТ. Целостность графа, проверка написания, судьба
// удалённого слова в комплектах — всё в @kiosk/shared/alphabet/store/
// contentRules, потому что продукт по ТЗ (строка 67) выходит и на Android.
// Здесь остаётся сохранение и чтение.
//
// ОДИН ФАЙЛ НА ВЕСЬ СВОЙ КОНТЕНТ, а не три. У эталона это три отдельных файла
// (myWords.json, mySyllables.json, collections.json), и там это стоило ему
// целостности: удаление слова должно править и слова, и комплекты, а два
// файла нельзя переписать одной атомарной операцией. Здесь всё в
// `content.json` — правка графа атомарна по построению.
//
// МЕДИА ЛЕЖАТ ФАЙЛАМИ, а не base64 внутри JSON (как у эталона): разбор назвал
// это узким местом — весь файл переписывается при каждой правке. Хранилище
// общее, electron/common/mediaFiles.js, имя файла выводится из хеша
// содержимого, поэтому одна и та же картинка лежит один раз.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { atomicWriteJson, readJsonStatus } = require('../chrono/atomicJson');
const media = require('../common/mediaFiles');
const { alphabet } = require('@kiosk/shared');

const CONTENT_FILE = 'content.json';

class AlphabetContentStoreError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AlphabetContentStoreError';
  }
}

/** Идентификатор своей сущности: «u» и 16 hex — форма, которой нет у поставочных */
function newUserId() {
  return `u${crypto.randomBytes(8).toString('hex')}`;
}

function filePath(baseDir) {
  return path.join(baseDir, CONTENT_FILE);
}

/**
 * Читает контент педагога. Повреждённый файл НЕ роняет приложение и не
 * трактуется как «пусто» молча: разбор терпимый по каждому списку отдельно
 * (parseUserContent), битая запись отбрасывается, остальные выживают.
 *
 * Почему здесь терпимость, а у профилей — строгость: профилей единицы и
 * потеря списка равна потере работы класса, а свой контент — сотни записей,
 * и уронить их все из-за одной испорченной несоразмерно.
 */
function readContent(baseDir) {
  const status = readJsonStatus(filePath(baseDir));
  if (!status.exists) return { words: [], syllables: [], sets: [] };
  return alphabet.parseUserContent(status.valid ? status.data : null);
}

function writeContent(baseDir, content) {
  fs.mkdirSync(baseDir, { recursive: true });
  atomicWriteJson(filePath(baseDir), content);
  return content;
}

// ─── Слоги ──────────────────────────────────────────────────────────────

function createSyllable(baseDir, draft) {
  const content = readContent(baseDir);
  const { syllables, created } = alphabet.applyCreateSyllable(
    content.syllables,
    draft,
    newUserId()
  );
  writeContent(baseDir, { ...content, syllables });
  return created;
}

function deleteSyllable(baseDir, syllableId, libraryWords = []) {
  const content = readContent(baseDir);
  // Проверять надо против ВСЕХ слов, а не только своих: поставочное слово
  // сослаться на свой слог не может, но так правило не зависит от того,
  // откуда пришло слово, и не сломается, если это когда-нибудь изменится
  const syllables = alphabet.applyDeleteSyllable(
    content.syllables,
    [...libraryWords, ...content.words],
    syllableId
  );
  writeContent(baseDir, { ...content, syllables });
  return syllables;
}

// ─── Слова ──────────────────────────────────────────────────────────────

/** Все слоги, из которых можно собрать слово: поставочные плюс свои */
function allSyllables(content, librarySyllables) {
  return [...librarySyllables, ...content.syllables];
}

function createWord(baseDir, draft, librarySyllables = []) {
  const content = readContent(baseDir);
  const { words, created } = alphabet.applyCreateWord(
    content.words,
    allSyllables(content, librarySyllables),
    draft,
    newUserId()
  );
  writeContent(baseDir, { ...content, words });
  return created;
}

function updateWord(baseDir, wordId, draft, librarySyllables = []) {
  const content = readContent(baseDir);
  const before = content.words.find((w) => w.id === wordId);
  const { words, updated } = alphabet.applyUpdateWord(
    content.words,
    allSyllables(content, librarySyllables),
    wordId,
    draft
  );
  writeContent(baseDir, { ...content, words });
  // Старая картинка убирается, только если её больше никто не держит:
  // хранилище дедуплицирует по хешу, и один файл могут делить два слова
  if (before && before.imageFile && before.imageFile !== updated.imageFile) {
    dropMediaIfUnused(baseDir, before.imageFile, { ...content, words });
  }
  return updated;
}

function deleteWord(baseDir, wordId) {
  const content = readContent(baseDir);
  const before = content.words.find((w) => w.id === wordId);
  const { words, sets } = alphabet.applyDeleteWord(content.words, content.sets, wordId);
  const next = { ...content, words, sets };
  writeContent(baseDir, next);
  if (before && before.imageFile) dropMediaIfUnused(baseDir, before.imageFile, next);
  dropAudioIfUnused(baseDir, wordId);
  return next;
}

/**
 * Удаляет файл медиа, если на него не осталось ссылок.
 *
 * Проверка обязательна: хранилище дедуплицирует по хешу содержимого, и одна
 * и та же картинка, добавленная к двум словам, лежит одним файлом. Удалить
 * её вместе с первым словом значило бы оставить второе без иллюстрации.
 */
function dropMediaIfUnused(baseDir, fileName, content) {
  const stillUsed = content.words.some((w) => w.imageFile === fileName);
  if (stillUsed) return false;
  try {
    media.deleteMediaFile(baseDir, fileName);
    return true;
  } catch {
    // Файла может не быть — например, каталог чистили руками. Это не повод
    // отменять уже сделанную правку контента
    return false;
  }
}

// ─── Озвучка своих слов и слогов ────────────────────────────────────────
//
// Записи адресуются ПО ИДЕНТИФИКАТОРУ сущности, а не хешем содержимого:
// дедупликация здесь вредна — две записи одного слова разными голосами
// должны остаться разными файлами, а совпадение байтов у голосовых записей
// не встречается. Имя файла выводится из id, поэтому запись всегда находится
// без всякого индекса.

const AUDIO_DIR = 'voice';

function voiceDir(baseDir) {
  return path.join(baseDir, AUDIO_DIR);
}

/** Три рода записей на слово — ровно то, что требует ТЗ строка 76 */
function voicePath(baseDir, kind, id) {
  const safe = String(id).replace(/[^a-z0-9_]/gi, '');
  if (!safe) throw new AlphabetContentStoreError('Неверный идентификатор записи');
  return path.join(voiceDir(baseDir), `${kind}-${safe}.webm`);
}

function saveVoice(baseDir, kind, id, bytes) {
  if (!['word', 'bgn', 'syllable'].includes(kind)) {
    throw new AlphabetContentStoreError(`Неизвестный род записи: ${kind}`);
  }
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (buffer.length === 0) throw new AlphabetContentStoreError('Пустая запись');
  if (buffer.length > media.MAX_AUDIO_BYTES) {
    throw new AlphabetContentStoreError('Запись слишком длинная');
  }
  // Сигнатура проверяется тем же механизмом, что и для файлов с диска:
  // запись приходит из рендерера, а рендерер — граница системы.
  //
  // sniffMediaType возвращает ФОРМАТ ('webm', 'mp3'), а не род — первая
  // версия сравнивала его со строкой 'audio' и потому отвергала бы всё
  const format = media.sniffMediaType(buffer.subarray(0, 64));
  if (!format || !media.AUDIO_TYPES.includes(format)) {
    throw new AlphabetContentStoreError('Это не звуковая запись');
  }
  fs.mkdirSync(voiceDir(baseDir), { recursive: true });
  const target = voicePath(baseDir, kind, id);
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, buffer);
  fs.renameSync(tmp, target);
  return path.basename(target);
}

function hasVoice(baseDir, kind, id) {
  try {
    return fs.statSync(voicePath(baseDir, kind, id)).size > 0;
  } catch {
    return false;
  }
}

function deleteVoice(baseDir, kind, id) {
  try {
    fs.unlinkSync(voicePath(baseDir, kind, id));
    return true;
  } catch {
    return false;
  }
}

/** Записи удалённого слова: и целиком, и «без последнего слога» */
function dropAudioIfUnused(baseDir, wordId) {
  deleteVoice(baseDir, 'word', wordId);
  deleteVoice(baseDir, 'bgn', wordId);
}

/**
 * Чего не хватает каждому своему слову. Считается здесь, а не в рантайме:
 * наличие файла знает только главный процесс.
 */
function wordReadiness(baseDir, librarySyllables = []) {
  const content = readContent(baseDir);
  const syllablesWithAudio = new Set(
    allSyllables(content, librarySyllables)
      .filter((s) => hasVoice(baseDir, 'syllable', s.id))
      .map((s) => s.id)
  );
  const out = {};
  for (const word of content.words) {
    out[word.id] = alphabet.checkUserWordReadiness(word, {
      hasImage: !!word.imageFile,
      hasWholeAudio: hasVoice(baseDir, 'word', word.id),
      syllablesWithAudio,
    });
  }
  return out;
}

// ─── Комплекты ──────────────────────────────────────────────────────────

function createSet(baseDir, draft, libraryWords = []) {
  const content = readContent(baseDir);
  const { sets, created } = alphabet.applyCreateSet(
    content.sets,
    [...libraryWords, ...content.words],
    draft,
    newUserId()
  );
  writeContent(baseDir, { ...content, sets });
  return created;
}

function updateSet(baseDir, setId, draft, libraryWords = []) {
  const content = readContent(baseDir);
  const { sets, updated } = alphabet.applyUpdateSet(
    content.sets,
    [...libraryWords, ...content.words],
    setId,
    draft
  );
  writeContent(baseDir, { ...content, sets });
  return updated;
}

function deleteSet(baseDir, setId) {
  const content = readContent(baseDir);
  const sets = alphabet.applyDeleteSet(content.sets, setId);
  writeContent(baseDir, { ...content, sets });
  return sets;
}

// ─── Картинка слова ─────────────────────────────────────────────────────

/** Кладёт файл с диска в хранилище медиа и возвращает его имя */
function importImage(baseDir, sourcePath) {
  return media.importMediaFile(baseDir, sourcePath, 'image');
}

module.exports = {
  AlphabetContentStoreError,
  CONTENT_FILE,
  AUDIO_DIR,
  newUserId,
  readContent,
  writeContent,
  createSyllable,
  deleteSyllable,
  createWord,
  updateWord,
  deleteWord,
  createSet,
  updateSet,
  deleteSet,
  importImage,
  saveVoice,
  hasVoice,
  deleteVoice,
  voicePath,
  wordReadiness,
};
