// packages/player/electron/natcom/projectStore.js
// Локальное хранилище презентаций «Конструктора природных сообществ» —
// несколько сохранённых пользовательских презентаций на устройстве, по
// прямой аналогии с packages/player/electron/chrono/projectStore.js
// (та же дисциплина: pathGuard на каждую операцию, атомарная запись,
// валидация схемой на чтении И на записи, битая запись не роняет весь
// список). Библиотека (фоны/категории/объекты) НЕ хранится здесь — она
// поставочная, read-only, грузится отдельно (см. library.js).
//
// ownerId/organizationId презентации - обязательные параметры создания
// (не подставляются здесь по умолчанию): устраняет находку оригинала
// "общий файл презентаций на всех" (Тип5_план_реализации.md, раздел 3, п.4)
// - кто вызывает createProject, тот и знает текущую роль/сессию.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { resolveWithinRoot } = require('../chrono/pathGuard');
const { atomicWriteJson } = require('../chrono/atomicJson');
const { parseNatComProject, NATCOM_PROJECT_SCHEMA_VERSION } = require('@kiosk/shared');

const PROJECT_FILE = 'project.json';
const MAX_TITLE_LENGTH = 200;

function projectsRoot(baseDir) {
  return path.join(baseDir, 'projects');
}

function sanitizeTitle(title, fallback) {
  const trimmed = String(title ?? '').trim();
  return (trimmed.length > 0 ? trimmed : fallback).slice(0, MAX_TITLE_LENGTH);
}

function readProjectFile(baseDir, projectId) {
  const dir = resolveWithinRoot(projectsRoot(baseDir), projectId);
  const raw = fs.readFileSync(path.join(dir, PROJECT_FILE), 'utf8');
  return parseNatComProject(JSON.parse(raw));
}

/**
 * @param {string} baseDir
 * @returns {Array<import('@kiosk/shared').NatComProject>} презентации, свежие
 *   сверху; повреждённые записи молча пропускаются, а не роняют весь список
 *   (та же дисциплина, что у chrono/projectStore.js listProjects).
 */
function listProjects(baseDir) {
  const root = projectsRoot(baseDir);
  if (!fs.existsSync(root)) return [];

  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      try {
        return readProjectFile(baseDir, entry.name);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

/**
 * @param {string} baseDir
 * @param {{ title: string, backgroundId: string, ownerId: string, organizationId: string }} params
 * @returns {import('@kiosk/shared').NatComProject}
 */
function createProject(baseDir, { title, backgroundId, ownerId, organizationId }) {
  const id = crypto.randomUUID();
  const dir = resolveWithinRoot(projectsRoot(baseDir), id);
  fs.mkdirSync(dir, { recursive: true });

  const now = new Date().toISOString();
  const project = parseNatComProject({
    schemaVersion: NATCOM_PROJECT_SCHEMA_VERSION,
    id,
    title: sanitizeTitle(title, 'Без названия'),
    backgroundId,
    objects: [],
    ownerId,
    organizationId,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  });

  atomicWriteJson(path.join(dir, PROJECT_FILE), project);
  return project;
}

/**
 * @param {string} baseDir
 * @param {string} projectId
 * @returns {import('@kiosk/shared').NatComProject}
 */
function loadProject(baseDir, projectId) {
  return readProjectFile(baseDir, projectId);
}

/**
 * Валидирует схемой ДО записи - при отказе файл на диске не трогается
 * (та же дисциплина, что chrono/projectStore.js saveProjectData).
 *
 * @param {string} baseDir
 * @param {string} projectId
 * @param {unknown} data
 * @returns {import('@kiosk/shared').NatComProject} провалидированный документ
 */
function saveProject(baseDir, projectId, data) {
  const dir = resolveWithinRoot(projectsRoot(baseDir), projectId);
  const parsed = parseNatComProject({ ...data, updatedAt: new Date().toISOString() });
  atomicWriteJson(path.join(dir, PROJECT_FILE), parsed);
  return parsed;
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
  loadProject,
  saveProject,
  deleteProject,
  projectsRoot,
  MAX_TITLE_LENGTH,
};
