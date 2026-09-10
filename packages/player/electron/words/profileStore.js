// packages/player/electron/words/profileStore.js
// Локальное хранилище виджета «Я знаю много слов» (Тип 2): профили детей,
// настройки занятия и заработанные достижения.
//
// Переиспользует уже существующую инфраструктуру Хронолинии, а не заводит
// свою: atomicJson.js (запись через временный файл + rename) и storageDir.js
// (общий на машину каталог с fallback на userData). Свой у нас только
// appDirName — данные двух виджетов не смешиваются на одной машине.
//
// ПРАВИЛА (имя игрока, монотонность достижений, судьба достижений удалённого
// игрока) живут НЕ здесь, а в @kiosk/shared/words/store/rules — общие для
// Windows и Android. Здесь остаётся только сохранение и чтение: продукт по ТЗ
// (строка 44) выходит на две платформы, а Electron под Android не работает,
// и дублировать правила во втором шеле значит гарантированно разойтись.
//
// Три отличия от эталона ОС3, принятые осознанно:
//  1. Запись атомарная. У эталона обрыв во время fs.writeFile оставляет
//     повреждённый JSON без всякого восстановления.
//  2. Повреждённый файл не трактуется как «пусто»: список профилей,
//     который молча обнулился после сбоя диска, для педагога выглядит как
//     потеря работы детей, а не как ошибка — поэтому это явная ошибка.
//  3. Достижения обновляются монотонно на уровне хранилища тоже, а не
//     только в UI: понизить ступень нельзя ничем, включая прямой вызов IPC.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { atomicWriteJson, readJsonStatus } = require('../chrono/atomicJson');
const {
  sanitizeProfiles,
  applyCreateProfile,
  applyDeleteProfile,
  applySaveScore,
  WordsRulesError,
  MAX_PROFILES,
  MAX_PROFILE_NAME_LENGTH,
} = require('@kiosk/shared');

const WORDS_APP_DIR_NAME = 'kiosk-words';

const PROFILES_FILE = 'profiles.json';
const SETTINGS_FILE = 'settings.json';
const SCORES_FILE = 'scores.json';

class WordsStoreError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WordsStoreError';
  }
}

function filePath(baseDir, name) {
  return path.join(baseDir, name);
}

function ensureBaseDir(baseDir) {
  fs.mkdirSync(baseDir, { recursive: true });
}

/**
 * Читает JSON, различая «файла ещё нет» (нормально — ничего не создавали) и
 * «файл есть, но испорчен» (диск, антивирус, ручная правка).
 * @param {string} file
 * @param {unknown} fallback
 * @param {string} what
 */
function readOrDefault(file, fallback, what) {
  const status = readJsonStatus(file);
  if (!status.exists) return fallback;
  if (!status.valid) {
    throw new WordsStoreError(`Файл ${what} повреждён: ${path.basename(file)}`);
  }
  return status.data;
}

// ─── Профили ────────────────────────────────────────────────────────────

/**
 * @param {string} baseDir
 * @returns {Array<{id: string, name: string, createdAt: string}>}
 */
function listProfiles(baseDir) {
  const data = readOrDefault(filePath(baseDir, PROFILES_FILE), [], 'профилей');
  if (!Array.isArray(data)) {
    throw new WordsStoreError('Файл профилей повреждён: ожидался список');
  }
  return sanitizeProfiles(data);
}

function writeProfiles(baseDir, profiles) {
  ensureBaseDir(baseDir);
  atomicWriteJson(filePath(baseDir, PROFILES_FILE), profiles);
}

/**
 * Создаёт профиль ребёнка. Имя нормализуется (обрезаются пробелы), пустое имя
 * отклоняется — на сенсорной клавиатуре легко случайно нажать «сохранить».
 * @param {string} baseDir
 * @param {string} name
 */
function createProfile(baseDir, name) {
  const profiles = listProfiles(baseDir);
  const { profiles: next, created } = applyCreateProfile(
    profiles,
    name,
    crypto.randomUUID(),
    new Date().toISOString()
  );
  writeProfiles(baseDir, next);
  return created;
}

/**
 * Удаляет профиль вместе с его достижениями: оставлять осиротевшие записи в
 * scores.json незачем — новый профиль с тем же именем получит новый id и не
 * должен унаследовать чужое золото.
 */
function deleteProfile(baseDir, profileId) {
  const { profiles, scores } = applyDeleteProfile(
    listProfiles(baseDir),
    readScores(baseDir),
    profileId
  );
  writeProfiles(baseDir, profiles);
  ensureBaseDir(baseDir);
  atomicWriteJson(filePath(baseDir, SCORES_FILE), scores);
  return profiles;
}

// ─── Настройки ──────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  schemaVersion: 1,
  volume: 70,
  device: 'board',
  levelOverrides: {},
};

/**
 * Настройки занятия. Отсутствие файла — это дефолт, а не ошибка: на свежем
 * устройстве никто ещё ничего не настраивал.
 */
function readSettings(baseDir) {
  const data = readOrDefault(filePath(baseDir, SETTINGS_FILE), null, 'настроек');
  if (!data || typeof data !== 'object') return { ...DEFAULT_SETTINGS };
  return { ...DEFAULT_SETTINGS, ...data };
}

function writeSettings(baseDir, settings) {
  ensureBaseDir(baseDir);
  atomicWriteJson(filePath(baseDir, SETTINGS_FILE), settings);
  return settings;
}

// ─── Достижения ─────────────────────────────────────────────────────────

/** @returns {Record<string, Record<string, string>>} профиль → тема → ступень */
function readScores(baseDir) {
  const data = readOrDefault(filePath(baseDir, SCORES_FILE), {}, 'достижений');
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new WordsStoreError('Файл достижений повреждён: ожидался объект');
  }
  return data;
}

function saveScore(baseDir, profileId, themeId, tier) {
  const { scores, changed, tier: resulting } = applySaveScore(
    readScores(baseDir),
    profileId,
    themeId,
    tier
  );
  if (!changed) return { changed: false, tier: resulting };

  ensureBaseDir(baseDir);
  atomicWriteJson(filePath(baseDir, SCORES_FILE), scores);
  return { changed: true, tier: resulting };
}

module.exports = {
  WordsStoreError,
  WORDS_APP_DIR_NAME,
  PROFILES_FILE,
  SETTINGS_FILE,
  SCORES_FILE,
  MAX_PROFILES,
  DEFAULT_SETTINGS,
  listProfiles,
  createProfile,
  deleteProfile,
  readSettings,
  writeSettings,
  readScores,
  saveScore,
};
