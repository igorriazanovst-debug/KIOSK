// packages/player/electron/natcom/templates.js
// Загрузка готовых презентаций «Конструктора природных сообществ» из
// packages/natcom-templates/ - вшиты в сборку через extraResources, тот же
// принцип, что library.js. Читаются и валидируются один раз при регистрации
// IPC-канала (T5-103, ТЗ FR-009/FR-016), не на каждый вызов.

const fs = require('fs');
const path = require('path');
const { parseNatComProject, assertProjectReferencesExist } = require('@kiosk/shared');

function findTemplatesDirSync() {
  const searchPaths = [
    path.join(process.resourcesPath || '', 'natcom-templates'),
    path.join(__dirname, '..', '..', '..', 'natcom-templates'),
  ];
  for (const candidate of searchPaths) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * @param {import('@kiosk/shared').NatComLibrary | null} library
 * @returns {import('@kiosk/shared').NatComProject[]}
 *   Пустой массив - каталог не найден (dev-запуск без packages/natcom-templates
 *   на диске) или библиотека ещё не загружена (без неё нечем проверить
 *   ссылочную целостность шаблонов).
 */
function loadTemplatesSync(library) {
  if (!library) return [];
  const dir = findTemplatesDirSync();
  if (!dir) return [];

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.natcom.json')).sort();
  return files.map((fileName) => {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, fileName), 'utf8'));
    const project = parseNatComProject(raw);
    assertProjectReferencesExist(project, library);
    return project;
  });
}

module.exports = { loadTemplatesSync, findTemplatesDirSync };
