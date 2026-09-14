// packages/player/electron/inophone/profileStore.js
// Локальное хранилище виджета «Инофон» (Тип 4): профили учеников, настройки
// и статистика (ТЗ строки 91, 93).
//
// Переиспользует готовую инфраструктуру, а не заводит свою: atomicJson.js
// (запись через временный файл + rename) и storageDir.js (общий на машину
// каталог с запасным путём на userData) — обе из Хронолинии. Своё здесь
// только имя каталога: данные виджетов на одной машине не смешиваются.
//
// ПРАВИЛА ПРОФИЛЕЙ ТОЖЕ ПЕРЕИСПОЛЬЗУЮТСЯ — sanitizeProfiles и
// applyCreateProfile из @kiosk/shared. «Профиль ребёнка на устройстве» у
// Типов 2, 3 и 4 буквально одно понятие с одними ограничениями: непустое имя,
// предел числа профилей, нормализация пробелов. Третий экземпляр тех же
// правил гарантированно разъехался бы с первыми двумя.
//
// СТАТИСТИКА СВОЯ, и это не срезание угла в обратную сторону. У Типа 2 это
// ступень достижения на тему, у Типа 3 — пары «верно / всего» на 33 буквы,
// здесь — результат по СЦЕНЕ и по ИЗУЧАЕМОМУ ЯЗЫКУ. Общего между ними ничего,
// кроме слова «результаты».

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { atomicWriteJson, readJsonStatus } = require('../chrono/atomicJson');
const {
  sanitizeProfiles,
  applyCreateProfile,
  WordsRulesError,
  MAX_PROFILES,
  inophone,
} = require('@kiosk/shared');

const INOPHONE_APP_DIR_NAME = 'kiosk-inophone';

const PROFILES_FILE = 'profiles.json';
const SETTINGS_FILE = 'settings.json';
const STATISTICS_FILE = 'statistics.json';

class InophoneStoreError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InophoneStoreError';
  }
}

function filePath(baseDir, name) {
  return path.join(baseDir, name);
}

function ensureBaseDir(baseDir) {
  fs.mkdirSync(baseDir, { recursive: true });
}

/**
 * Читает JSON, различая «файла ещё нет» и «файл есть, но испорчен».
 *
 * Контракт readJsonStatus — { exists, valid, data }, а НЕ { kind }. Я сначала
 * написал по второму, выдуманному: проверка несуществующего поля тихо
 * проваливалась в обе стороны — битый файл не падал, а целые настройки
 * читались как пустые. Поймали тесты хранилища.
 *
 * Разница принципиальная. Список профилей, молча обнулившийся после сбоя
 * диска, педагог прочитает как потерю работы детей — поэтому испорченный файл
 * это ЯВНАЯ ОШИБКА, а не «пусто». Для настроек правило обратное: там потеря
 * не страшна, а запертое приложение страшно.
 */
function readOrThrow(file, fallback) {
  const status = readJsonStatus(file);
  if (!status.exists) return fallback;
  if (!status.valid) {
    throw new InophoneStoreError(
      `файл ${path.basename(file)} повреждён. Восстановите его из резервной копии — ` +
        'молча начать с пустого списка нельзя, это выглядело бы как потеря данных'
    );
  }
  return status.data;
}

function readOrDefault(file, fallback) {
  const status = readJsonStatus(file);
  return status.exists && status.valid ? status.data : fallback;
}

// ─── профили ─────────────────────────────────────────────────────────────

function listProfiles(baseDir) {
  return sanitizeProfiles(readOrThrow(filePath(baseDir, PROFILES_FILE), []));
}

/**
 * Создать профиль. Возвращает ПОЛНЫЙ СПИСОК, а не созданную запись.
 *
 * Общее правило applyCreateProfile отдаёт и то и другое; здесь наружу уходит
 * список, потому что вызывающий экран всё равно перерисовывает его целиком, а
 * возвращать одну запись значило бы заставить его дочитывать остальное вторым
 * вызовом.
 */
function createProfile(baseDir, name) {
  ensureBaseDir(baseDir);
  const { profiles } = applyCreateProfile(
    listProfiles(baseDir),
    name,
    crypto.randomUUID(),
    new Date().toISOString()
  );
  atomicWriteJson(filePath(baseDir, PROFILES_FILE), profiles);
  return profiles;
}

function deleteProfile(baseDir, profileId) {
  ensureBaseDir(baseDir);
  const next = listProfiles(baseDir).filter((p) => p.id !== profileId);
  atomicWriteJson(filePath(baseDir, PROFILES_FILE), next);

  // Статистика удаляется ВМЕСТЕ с профилем. Оставить её значило бы копить
  // данные ребёнка, которого в списке уже нет, и однажды показать их
  // тёзке — новый профиль с тем же именем получил бы чужие результаты
  const stats = readOrDefault(filePath(baseDir, STATISTICS_FILE), {});
  if (stats && typeof stats === 'object' && profileId in stats) {
    delete stats[profileId];
    atomicWriteJson(filePath(baseDir, STATISTICS_FILE), stats);
  }
  return next;
}

// ─── настройки ───────────────────────────────────────────────────────────

/**
 * Настройки: язык интерфейса, изучаемые языки, громкость (ТЗ строки 87, 88).
 *
 * Испорченный файл даёт значения по умолчанию, а НЕ ошибку — в отличие от
 * профилей. Строгость намеренно обратная: потерянные настройки педагог
 * выставит заново за минуту, а приложение, которое не открывается из-за
 * битого файла настроек, срывает занятие целиком.
 */
function readSettings(baseDir) {
  const raw = readOrDefault(filePath(baseDir, SETTINGS_FILE), null);
  return inophone.parseInophoneSettings(raw);
}

function saveSettings(baseDir, settings) {
  ensureBaseDir(baseDir);
  const clean = inophone.parseInophoneSettings(settings);
  atomicWriteJson(filePath(baseDir, SETTINGS_FILE), clean);
  return clean;
}

// ─── статистика ──────────────────────────────────────────────────────────

function readStatistics(baseDir) {
  return inophone.parseInophoneStatistics(readOrDefault(filePath(baseDir, STATISTICS_FILE), {}));
}

/**
 * Записать итог партии. Возвращает новое состояние статистики.
 *
 * Слияние делает ДОМЕН (inophone/model/statistics), а не этот файл: правило
 * «последняя партия замещается, итог накапливается» — предметное, и место ему
 * там, где его можно проверить тестом без диска.
 */
function recordSession(baseDir, profileId, sceneId, byLanguage) {
  ensureBaseDir(baseDir);
  const current = readStatistics(baseDir);
  const next = inophone.mergeStatistics(current, profileId, sceneId, byLanguage);
  atomicWriteJson(filePath(baseDir, STATISTICS_FILE), next);
  return next;
}

function clearStatistics(baseDir, profileId) {
  ensureBaseDir(baseDir);
  const current = readStatistics(baseDir);
  if (profileId in current) delete current[profileId];
  atomicWriteJson(filePath(baseDir, STATISTICS_FILE), current);
  return current;
}

module.exports = {
  INOPHONE_APP_DIR_NAME,
  InophoneStoreError,
  listProfiles,
  createProfile,
  deleteProfile,
  readSettings,
  saveSettings,
  readStatistics,
  recordSession,
  clearStatistics,
  MAX_PROFILES,
  WordsRulesError,
};
