// packages/player/electron/chrono/projectStore.js
// Локальное хранилище проектов «Хронолинии» — несколько сохранённых
// проектов на устройстве (решение: Хронолайнер_план_реализации.md, раздел 8),
// не один перезаписываемый холст. Формат — распакованная папка проекта, не
// ZIP (ZIP только для экспорта, Фаза 8).
//
// Манифест (список/создание/переименование/удаление) хранится отдельно от
// содержимого — timelines/события лежат в content.json того же каталога
// проекта (loadProjectData/saveProjectData ниже), провалидированные через
// @kiosk/shared (parseChronoProject/assertProjectSerializable) — граница
// системы, файлу на диске не доверяем, как и данным из IPC-вызова
// сохранения. Каждая операция идёт через pathGuard, а запись — временный
// файл + rename (атомарно на одной файловой системе), чтобы обрыв питания
// посреди записи не оставил битый файл.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { resolveWithinRoot } = require('./pathGuard');
const { parseChronoProject, assertProjectSerializable, CHRONO_PROJECT_SCHEMA_VERSION } = require('@kiosk/shared');

const MANIFEST_FILE = 'project.json';
const CONTENT_FILE = 'content.json';
const SCHEMA_VERSION = 1;
const MAX_NAME_LENGTH = 200;

function projectsRoot(baseDir) {
  return path.join(baseDir, 'projects');
}

function atomicWriteJson(filePath, data) {
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function sanitizeName(name, fallback) {
  const trimmed = String(name ?? '').trim();
  return (trimmed.length > 0 ? trimmed : fallback).slice(0, MAX_NAME_LENGTH);
}

function readManifest(baseDir, projectId) {
  const dir = resolveWithinRoot(projectsRoot(baseDir), projectId);
  const manifestPath = path.join(dir, MANIFEST_FILE);
  const raw = fs.readFileSync(manifestPath, 'utf8');
  return JSON.parse(raw);
}

/**
 * @param {string} baseDir
 * @returns {Array<object>} манифесты проектов, свежие сверху; повреждённые
 *   записи молча пропускаются, а не роняют весь список
 */
function listProjects(baseDir) {
  const root = projectsRoot(baseDir);
  if (!fs.existsSync(root)) return [];

  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      try {
        return readManifest(baseDir, entry.name);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

/**
 * @param {string} baseDir
 * @param {string} name
 * @returns {object} манифест созданного проекта
 */
function createProject(baseDir, name) {
  const id = crypto.randomUUID();
  const dir = resolveWithinRoot(projectsRoot(baseDir), id);

  fs.mkdirSync(path.join(dir, 'timelines'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'media'), { recursive: true });

  const now = new Date().toISOString();
  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    id,
    name: sanitizeName(name, 'Без названия'),
    createdAt: now,
    updatedAt: now,
  };

  atomicWriteJson(path.join(dir, MANIFEST_FILE), manifest);

  /** @type {import('@kiosk/shared').ChronoProject} */
  const content = {
    schemaVersion: CHRONO_PROJECT_SCHEMA_VERSION,
    id,
    name: manifest.name,
    timelines: [],
    media: [],
    createdAt: now,
    updatedAt: now,
  };
  atomicWriteJson(path.join(dir, CONTENT_FILE), content);

  return manifest;
}

/**
 * Читает и валидирует содержимое проекта (хронолинии/события). Бросает,
 * если content.json повреждён или не проходит схему — граница системы,
 * не отдаём вызывающему коду сырой, потенциально некорректный объект.
 *
 * @param {string} baseDir
 * @param {string} projectId
 * @returns {import('@kiosk/shared').ChronoProject}
 */
function loadProjectData(baseDir, projectId) {
  const dir = resolveWithinRoot(projectsRoot(baseDir), projectId);
  const raw = fs.readFileSync(path.join(dir, CONTENT_FILE), 'utf8');
  return parseChronoProject(JSON.parse(raw));
}

/**
 * Валидирует (схема + защита от NaN/Infinity в моментах) и атомарно
 * записывает содержимое проекта, затем обновляет updatedAt манифеста.
 * Валидация выполняется ДО записи — при отказе content.json на диске
 * не трогается.
 *
 * @param {string} baseDir
 * @param {string} projectId
 * @param {unknown} data
 * @returns {import('@kiosk/shared').ChronoProject} провалидированный документ
 */
function saveProjectData(baseDir, projectId, data) {
  const dir = resolveWithinRoot(projectsRoot(baseDir), projectId);
  const parsed = parseChronoProject(data);
  assertProjectSerializable(parsed);

  atomicWriteJson(path.join(dir, CONTENT_FILE), parsed);

  const manifest = readManifest(baseDir, projectId);
  atomicWriteJson(path.join(dir, MANIFEST_FILE), { ...manifest, updatedAt: new Date().toISOString() });

  return parsed;
}

/**
 * @param {string} baseDir
 * @param {string} projectId
 * @param {string} newName
 * @returns {object} обновлённый манифест
 */
function renameProject(baseDir, projectId, newName) {
  const manifest = readManifest(baseDir, projectId);
  const dir = resolveWithinRoot(projectsRoot(baseDir), projectId);

  const updated = {
    ...manifest,
    name: sanitizeName(newName, manifest.name),
    updatedAt: new Date().toISOString(),
  };

  atomicWriteJson(path.join(dir, MANIFEST_FILE), updated);
  return updated;
}

/**
 * @param {string} baseDir
 * @param {string} projectId
 */
function deleteProject(baseDir, projectId) {
  const dir = resolveWithinRoot(projectsRoot(baseDir), projectId);
  fs.rmSync(dir, { recursive: true, force: true });
}

module.exports = {
  listProjects,
  createProject,
  renameProject,
  deleteProject,
  readManifest,
  loadProjectData,
  saveProjectData,
  projectsRoot,
  MAX_NAME_LENGTH,
};
