// packages/player/electron/chrono/projectStore.js
// Локальное хранилище проектов «Хронолинии» — несколько сохранённых
// проектов на устройстве (решение: Хронолайнер_план_реализации.md, раздел 8),
// не один перезаписываемый холст. Формат — распакованная папка проекта, не
// ZIP (ZIP только для экспорта, Фаза 8).
//
// Это только манифесты проектов (список/создание/переименование/удаление) —
// сами хронолинии/события (timelines/*.json) появятся в Фазе 2-3. Каждая
// операция идёт через pathGuard, а запись манифеста — временный файл + rename
// (атомарно на одной файловой системе), чтобы обрыв питания посреди записи
// не оставил битый project.json.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { resolveWithinRoot } = require('./pathGuard');

const MANIFEST_FILE = 'project.json';
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
  return manifest;
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
  projectsRoot,
  MAX_NAME_LENGTH,
};
