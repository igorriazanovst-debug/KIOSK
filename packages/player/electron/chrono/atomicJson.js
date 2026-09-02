// packages/player/electron/chrono/atomicJson.js
// Атомарная запись JSON (временный файл + rename) - общая для
// projectStore.js и auth.js, вынесена, чтобы не дублировать одну и ту же
// пару функций в каждом файле, который хранит состояние на диске.

const fs = require('fs');

function atomicWriteJson(filePath, data) {
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

/**
 * Читает и парсит JSON-файл, РАЗЛИЧАЯ "файла нет" (легитимно - ничего ещё
 * не настраивали) от "файл есть, но испорчен" (диск/AV/ручная правка) -
 * найдено security-review Фазы 4: readJsonOrNull, которая была здесь
 * раньше, схлопывала оба случая в null, из-за чего auth.js трактовал
 * повреждённый auth.json как "пароль не задан" и молча открывал
 * редактирование (fail-open вместо fail-closed).
 *
 * @returns {{ exists: false } | { exists: true, valid: false } | { exists: true, valid: true, data: unknown }}
 */
function readJsonStatus(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return { exists: false };
    return { exists: true, valid: false };
  }

  try {
    return { exists: true, valid: true, data: JSON.parse(raw) };
  } catch {
    return { exists: true, valid: false };
  }
}

module.exports = { atomicWriteJson, readJsonStatus };
