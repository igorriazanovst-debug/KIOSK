// packages/player/electron/words/wordStore.js
// Хранилище контента педагога: свои слова (ТЗ строки 55, 57) и свои
// комплекты (строка 56).
//
// Как и profileStore, правила здесь НЕ живут — они в
// @kiosk/shared/words/store/contentRules, общие для Windows и нативной
// Android-реализации. Здесь только чтение, запись и работа с файлами медиа.
//
// Целостность связей: удаление слова вычищает его из всех комплектов и
// подчищает осиротевшие файлы медиа — одной транзакцией, а не в три
// отдельных вызова, иначе обрыв посередине оставит хранилище рассогласованным.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { atomicWriteJson, readJsonStatus } = require('../chrono/atomicJson');
const {
  applyCreateUserWord,
  applyUpdateUserWord,
  applyDeleteUserWord,
  applyCreateSet,
  applyUpdateSet,
  applyDeleteSet,
  applySetWordImage,
  applyClearWordImage,
  parseWordImageOverrides,
} = require('@kiosk/shared');
const mediaFiles = require('./mediaFiles');

const USER_WORDS_FILE = 'my_words.json';
const SETS_FILE = 'my_sets.json';
/**
 * Свои картинки педагога для ПОСТАВОЧНЫХ слов. Отдельный файл, а не правка
 * пакета контента: пакет read-only и приезжает в дистрибутиве, его замена при
 * обновлении снесла бы работу педагога.
 */
const WORD_IMAGES_FILE = 'word_images.json';

class WordStoreError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WordStoreError';
  }
}

function filePath(baseDir, name) {
  return path.join(baseDir, name);
}

function readList(baseDir, fileName, what) {
  const status = readJsonStatus(filePath(baseDir, fileName));
  if (!status.exists) return [];
  if (!status.valid) throw new WordStoreError(`Файл ${what} повреждён: ${fileName}`);
  if (!Array.isArray(status.data)) {
    throw new WordStoreError(`Файл ${what} повреждён: ожидался список`);
  }
  return status.data;
}

function writeList(baseDir, fileName, list) {
  fs.mkdirSync(baseDir, { recursive: true });
  atomicWriteJson(filePath(baseDir, fileName), list);
}

/** Идентификатор своего слова: префикс "u" + hex, чтобы не столкнуться с поставочными */
function newUserWordId() {
  return `u${crypto.randomBytes(8).toString('hex')}`;
}

/** Идентификатор комплекта: строчная латиница и цифры — как у поставочных тем */
function newSetId() {
  return `set-${crypto.randomBytes(6).toString('hex')}`;
}

// ─── Свои слова ─────────────────────────────────────────────────────────

function listUserWords(baseDir) {
  return readList(baseDir, USER_WORDS_FILE, 'своих слов').filter(
    (w) => w && typeof w === 'object' && typeof w.id === 'string' && typeof w.name === 'string'
  );
}

function listSets(baseDir) {
  return readList(baseDir, SETS_FILE, 'комплектов').filter(
    (s) => s && typeof s === 'object' && typeof s.id === 'string' && Array.isArray(s.wordIds)
  );
}

function createUserWord(baseDir, draft) {
  const { words, created } = applyCreateUserWord(listUserWords(baseDir), draft, newUserWordId());
  writeList(baseDir, USER_WORDS_FILE, words);
  return created;
}

function updateUserWord(baseDir, wordId, draft) {
  const before = listUserWords(baseDir);
  const { words, updated } = applyUpdateUserWord(before, wordId, draft);

  // Файлы, которые слово перестало использовать и никто другой не занял
  const previous = before.find((w) => w.id === wordId);
  const stillUsed = new Set();
  for (const w of words) {
    if (w.imageFile) stillUsed.add(w.imageFile);
    if (w.audioFile) stillUsed.add(w.audioFile);
  }
  const dropped = [previous?.imageFile, previous?.audioFile].filter(
    (f) => f && !stillUsed.has(f)
  );

  writeList(baseDir, USER_WORDS_FILE, words);
  for (const file of dropped) mediaFiles.deleteMediaFile(baseDir, file);
  return updated;
}

/**
 * Удаление слова: вычистка из всех комплектов и подчистка осиротевших файлов.
 * Порядок важен — сначала оба списка на диск, потом файлы: если процесс
 * оборвётся между ними, останется лишний файл, а не битая ссылка.
 */
function deleteUserWord(baseDir, wordId) {
  const { words, sets, affectedSetIds, orphanedFiles } = applyDeleteUserWord(
    listUserWords(baseDir),
    listSets(baseDir),
    wordId
  );

  writeList(baseDir, USER_WORDS_FILE, words);
  if (affectedSetIds.length > 0) writeList(baseDir, SETS_FILE, sets);
  for (const file of orphanedFiles) mediaFiles.deleteMediaFile(baseDir, file);

  return { words, sets, affectedSetIds };
}

// ─── Комплекты ──────────────────────────────────────────────────────────

/**
 * Слова, из которых можно собирать комплект: поставочные плюс свои.
 * Список поставочных приходит снаружи — библиотека читается один раз при
 * старте и хранилищу знать о ней незачем.
 */
function knownWordIds(baseDir, libraryWordIds) {
  const ids = new Set(libraryWordIds || []);
  for (const word of listUserWords(baseDir)) ids.add(word.id);
  return ids;
}

function createSet(baseDir, draft, libraryWordIds) {
  const { sets, created } = applyCreateSet(
    listSets(baseDir),
    draft,
    newSetId(),
    knownWordIds(baseDir, libraryWordIds)
  );
  writeList(baseDir, SETS_FILE, sets);
  return created;
}

function updateSet(baseDir, setId, draft, libraryWordIds) {
  const { sets, updated } = applyUpdateSet(
    listSets(baseDir),
    setId,
    draft,
    knownWordIds(baseDir, libraryWordIds)
  );
  writeList(baseDir, SETS_FILE, sets);
  return updated;
}

function deleteSet(baseDir, setId) {
  const sets = applyDeleteSet(listSets(baseDir), setId);
  writeList(baseDir, SETS_FILE, sets);
  return sets;
}

// ─── Свои картинки для поставочных слов (ТЗ строка 42) ──────────────────

function listWordImages(baseDir) {
  const status = readJsonStatus(filePath(baseDir, WORD_IMAGES_FILE));
  if (!status.exists) return {};
  if (!status.valid) throw new WordStoreError('Файл своих картинок повреждён');
  return parseWordImageOverrides(status.data);
}

/**
 * Порядок важен: сначала список на диск, потом удаление осиротевшего файла.
 * Оборвись процесс между шагами — останется лишний файл, а не битая ссылка.
 */
function setWordImage(baseDir, wordId, fileName) {
  const { overrides, orphanedFile } = applySetWordImage(listWordImages(baseDir), wordId, fileName);
  writeList(baseDir, WORD_IMAGES_FILE, overrides);
  if (orphanedFile) mediaFiles.deleteMediaFile(baseDir, orphanedFile);
  return overrides;
}

function clearWordImage(baseDir, wordId) {
  const { overrides, orphanedFile } = applyClearWordImage(listWordImages(baseDir), wordId);
  writeList(baseDir, WORD_IMAGES_FILE, overrides);
  if (orphanedFile) mediaFiles.deleteMediaFile(baseDir, orphanedFile);
  return overrides;
}

module.exports = {
  WordStoreError,
  USER_WORDS_FILE,
  SETS_FILE,
  WORD_IMAGES_FILE,
  listUserWords,
  listWordImages,
  setWordImage,
  clearWordImage,
  listSets,
  createUserWord,
  updateUserWord,
  deleteUserWord,
  createSet,
  updateSet,
  deleteSet,
  knownWordIds,
  newUserWordId,
  newSetId,
};
