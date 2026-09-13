// packages/player/electron/alphabet/profileStore.js
// Локальное хранилище виджета «АзбукоСлов» (Тип 3): профили детей, настройки
// занятия и статистика по буквам.
//
// Переиспользует готовую инфраструктуру, а не заводит свою: atomicJson.js
// (запись через временный файл + rename) и storageDir.js (общий на машину
// каталог с fallback на userData) — обе из Хронолинии. Свой здесь только
// appDirName: данные виджетов на одной машине не смешиваются.
//
// ПРАВИЛА ПРОФИЛЕЙ ТОЖЕ ПЕРЕИСПОЛЬЗУЮТСЯ — sanitizeProfiles и
// applyCreateProfile из @kiosk/shared/words/store/rules. Это не срезание угла:
// «профиль ребёнка на устройстве» у Тип 2 и Тип 3 буквально одно и то же
// понятие с одними ограничениями (непустое имя, предел числа профилей,
// нормализация пробелов). Заводить второй экземпляр тех же правил значило бы
// гарантированно их разводить — как только кто-то поправит предел в одном
// месте.
//
// А вот СТАТИСТИКА своя: у Тип 2 это ступень достижения на тему, здесь — две
// пары «верно / всего» на каждую из 33 букв. Общего между ними нет ничего,
// кроме слова «результаты», и слияние делает домен (alphabet/game/statistics),
// а не этот файл.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { atomicWriteJson, readJsonStatus } = require('../chrono/atomicJson');
const {
  sanitizeProfiles,
  applyCreateProfile,
  WordsRulesError,
  MAX_PROFILES,
  MAX_PROFILE_NAME_LENGTH,
  alphabet,
} = require('@kiosk/shared');

const ALPHABET_APP_DIR_NAME = 'kiosk-alphabet';

const PROFILES_FILE = 'profiles.json';
const SETTINGS_FILE = 'settings.json';
const STATISTICS_FILE = 'statistics.json';

class AlphabetStoreError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AlphabetStoreError';
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
 * «файл есть, но испорчен» (диск, антивирус, ручная правка). Второе — явная
 * ошибка, а не «пусто»: список профилей, молча обнулившийся после сбоя, для
 * педагога выглядит как потеря работы детей, а не как поломка файла.
 * @param {string} file
 * @param {unknown} fallback
 * @param {string} what
 */
function readOrDefault(file, fallback, what) {
  const status = readJsonStatus(file);
  if (!status.exists) return fallback;
  if (!status.valid) {
    throw new AlphabetStoreError(`Файл ${what} повреждён: ${path.basename(file)}`);
  }
  return status.data;
}

// ─── Профили ────────────────────────────────────────────────────────────

function listProfiles(baseDir) {
  const data = readOrDefault(filePath(baseDir, PROFILES_FILE), [], 'профилей');
  if (!Array.isArray(data)) {
    throw new AlphabetStoreError('Файл профилей повреждён: ожидался список');
  }
  return sanitizeProfiles(data);
}

function writeProfiles(baseDir, profiles) {
  ensureBaseDir(baseDir);
  atomicWriteJson(filePath(baseDir, PROFILES_FILE), profiles);
}

function createProfile(baseDir, name) {
  const { profiles, created } = applyCreateProfile(
    listProfiles(baseDir),
    name,
    crypto.randomUUID(),
    new Date().toISOString()
  );
  writeProfiles(baseDir, profiles);
  return created;
}

/**
 * Удаляет профиль вместе с его статистикой: новый профиль с тем же именем
 * получит новый идентификатор и не должен унаследовать чужой график.
 */
function deleteProfile(baseDir, profileId) {
  const profiles = listProfiles(baseDir);
  const remaining = profiles.filter((p) => p.id !== profileId);
  if (remaining.length === profiles.length) {
    throw new WordsRulesError('Такого игрока нет в списке');
  }
  writeProfiles(baseDir, remaining);
  writeStatistics(baseDir, alphabet.clearUserStatistics(readStatistics(baseDir), profileId));
  return remaining;
}

// ─── Настройки ──────────────────────────────────────────────────────────

/**
 * Настройки занятия. Отсутствие файла — дефолт, а не ошибка: на свежем
 * устройстве никто ещё ничего не настраивал. Повреждённый файл тоже даёт
 * дефолт, в отличие от профилей: потерянная громкость восстанавливается за
 * пять секунд, потерянный список детей — нет.
 */
function readSettings(baseDir) {
  // readOrDefault здесь НЕ подходит: он бросает на повреждённом файле, а нам
  // нужен дефолт. Читаем статус сами
  const status = readJsonStatus(filePath(baseDir, SETTINGS_FILE));
  if (!status.exists || !status.valid) return { ...alphabet.DEFAULT_ALPHABET_SETTINGS };
  const data = status.data;
  if (!data || typeof data !== 'object') return { ...alphabet.DEFAULT_ALPHABET_SETTINGS };
  try {
    return alphabet.parseAlphabetSettings({ ...alphabet.DEFAULT_ALPHABET_SETTINGS, ...data });
  } catch {
    // Чужая версия схемы или значение вне допустимого — тоже дефолт
    return { ...alphabet.DEFAULT_ALPHABET_SETTINGS };
  }
}

/** Запись настроек проверяется схемой — мусор на диск не попадает */
function writeSettings(baseDir, settings) {
  const checked = alphabet.parseAlphabetSettings({
    ...alphabet.DEFAULT_ALPHABET_SETTINGS,
    ...settings,
  });
  ensureBaseDir(baseDir);
  atomicWriteJson(filePath(baseDir, SETTINGS_FILE), checked);
  return checked;
}

// ─── Статистика ─────────────────────────────────────────────────────────

/**
 * @returns {Record<string, Record<string, {lastSession: [number, number], total: [number, number]}>>}
 * профиль → номер буквы → результат
 */
function readStatistics(baseDir) {
  const data = readOrDefault(filePath(baseDir, STATISTICS_FILE), {}, 'статистики');
  // Разбор терпимый: битая запись по одной букве отбрасывается, остальные
  // выживают. Потерять прогресс класса из-за одной испорченной строки —
  // несоразмерная цена
  return alphabet.parseStatistics(data);
}

function writeStatistics(baseDir, statistics) {
  ensureBaseDir(baseDir);
  atomicWriteJson(filePath(baseDir, STATISTICS_FILE), statistics);
  return statistics;
}

/** Вписывает результаты партии одного игрока: сессия замещается, итог растёт */
function saveSessionStatistics(baseDir, profileId, answers) {
  const next = alphabet.mergeSessionStatistics(readStatistics(baseDir), profileId, answers);
  writeStatistics(baseDir, next);
  return next[profileId] ?? {};
}

function clearStatistics(baseDir, profileId) {
  const next = alphabet.clearUserStatistics(readStatistics(baseDir), profileId);
  writeStatistics(baseDir, next);
  return next;
}

module.exports = {
  AlphabetStoreError,
  ALPHABET_APP_DIR_NAME,
  PROFILES_FILE,
  SETTINGS_FILE,
  STATISTICS_FILE,
  MAX_PROFILES,
  MAX_PROFILE_NAME_LENGTH,
  listProfiles,
  createProfile,
  deleteProfile,
  readSettings,
  writeSettings,
  readStatistics,
  writeStatistics,
  saveSessionStatistics,
  clearStatistics,
};
