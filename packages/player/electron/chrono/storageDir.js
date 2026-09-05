// packages/player/electron/chrono/storageDir.js
// Резолвер каталога локальных данных «Хронолинии».
//
// Решение (Хронолайнер_vs_KIOSK_анализ.md, раздел 8): каталог общий на
// машину, как у эталона (%ProgramData%\chronoliner у ОС3), а не на
// пользователя Windows — в компьютерном классе за одним ПК работают под
// разными учётками, и хронолинии должны быть видны независимо от того, кто
// вошёл в систему. Fallback на userData — только защита от отсутствия прав
// записи, не рабочий режим по умолчанию.
//
// computeSharedDataDir/canWrite — чистые функции, тестируются без Electron.
// resolveStorageDir принимает platform/userDataDir как параметры (а не читает
// их сама из app.*) специально для тестируемости.

const fs = require('fs');
const path = require('path');

const APP_DIR_NAME = 'kiosk-chrono';

/**
 * @param {NodeJS.Platform} platform
 * @param {string} [appDirName] - имя каталога приложения; по умолчанию — Хронолиния
 *   (APP_DIR_NAME). Виджет "naturalcommunities" передаёт своё имя — тот же резолвер,
 *   отдельный каталог на диске, не пересекается с данными Хронолинии на одной машине.
 * @returns {string}
 */
function computeSharedDataDir(platform, appDirName = APP_DIR_NAME) {
  if (platform === 'win32') {
    const programData = process.env.PROGRAMDATA || 'C:\\ProgramData';
    return path.join(programData, appDirName);
  }
  if (platform === 'linux') {
    return path.join('/var/lib', appDirName);
  }
  if (platform === 'darwin') {
    return path.join('/Library/Application Support', appDirName);
  }
  throw new Error(`computeSharedDataDir: unsupported platform "${platform}"`);
}

/**
 * Проверяет, можно ли реально писать в dir (создаёт при необходимости).
 * Не полагается на права владения/чтения — только на попытку записи, это
 * единственный надёжный способ узнать про ACL заранее.
 * @param {string} dir
 * @returns {boolean}
 */
function canWrite(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probePath = path.join(dir, `.write-test-${process.pid}`);
    fs.writeFileSync(probePath, '');
    fs.unlinkSync(probePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {{ platform: NodeJS.Platform, userDataDir: string, sharedDirOverride?: string,
 *   appDirName?: string, fallbackSubdir?: string }} deps
 *   sharedDirOverride нужен только для теста fallback-ветки без реальной
 *   манипуляции правами доступа — в проде не используется (undefined).
 *   appDirName/fallbackSubdir — см. computeSharedDataDir; по умолчанию — Хронолиния.
 * @returns {{ dir: string, isFallback: boolean }}
 */
function resolveStorageDir({ platform, userDataDir, sharedDirOverride, appDirName = APP_DIR_NAME, fallbackSubdir = 'chrono' }) {
  const shared = sharedDirOverride ?? computeSharedDataDir(platform, appDirName);

  if (canWrite(shared)) {
    return { dir: shared, isFallback: false };
  }

  const fallback = path.join(userDataDir, fallbackSubdir);
  fs.mkdirSync(fallback, { recursive: true });
  return { dir: fallback, isFallback: true };
}

module.exports = { computeSharedDataDir, canWrite, resolveStorageDir, APP_DIR_NAME };
