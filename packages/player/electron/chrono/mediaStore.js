// packages/player/electron/chrono/mediaStore.js
// Локальная медиатека проекта «Хронолинии» — файлы лежат в
// projects/<id>/media/ (каталог уже создаётся projectStore.createProject),
// имя на диске = sha256(содержимого) + расширение исходного файла. Это
// одновременно и естественная дедупликация (строка 8 плана Фазы 5 -
// "локальная медиатека с дедупликацией по sha256"): один и тот же файл,
// импортированный дважды (или на два разных события), физически хранится
// один раз - importMedia видит, что файл с таким именем уже есть, и не
// копирует повторно.
//
// Метаданные (ChronoMedia: id/fileName/mimeType/fileSize/sha256) НЕ
// хранятся здесь отдельным индексом - они уже часть ChronoProject.media[]
// в content.json (schema.ts, Фаза 2), сохраняются через обычный
// saveProjectData. mediaStore отвечает только за содержимое ФАЙЛОВ на
// диске: скопировать/продублировать/посчитать путь для раздачи.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { resolveWithinRoot } = require('./pathGuard');
const { projectsRoot } = require('./projectStore');
const { mediaDiskFileName } = require('@kiosk/shared');

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
};

/** 500 МБ - щедрый потолок для фото/аудио/короткого видео в музейном экспонате, но не "скопировать что угодно с диска" */
const MAX_IMPORT_SIZE_BYTES = 500 * 1024 * 1024;

class MediaImportError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MediaImportError';
  }
}

function mediaDir(baseDir, projectId) {
  return path.join(resolveWithinRoot(projectsRoot(baseDir), projectId), 'media');
}

function sha256OfFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

/**
 * Имя файла НА ДИСКЕ для данной записи медиа - sha256 + расширение
 * оригинального имени, вычисляется через @kiosk/shared (mediaDiskFileName),
 * не собственной строковой операцией - та же функция используется и в
 * рендерере для построения chronomedia:// URL, единственный источник.
 *
 * @param {{ sha256: string, fileName: string }} media
 */
function diskFileName(media) {
  return mediaDiskFileName(media);
}

function guessMimeType(ext) {
  return MIME_BY_EXT[ext.toLowerCase()] || 'application/octet-stream';
}

/**
 * Копирует файл в медиатеку проекта, если такого содержимого там ещё нет
 * (дедупликация по sha256). Возвращает метаданные для добавления в
 * ChronoProject.media[] - сама запись в content.json НЕ делает, это
 * ответственность вызывающего кода (через обычный saveProjectData).
 *
 * @param {string} baseDir
 * @param {string} projectId
 * @param {string} sourceFilePath Абсолютный путь к файлу - ожидается результат dialog.showOpenDialog (chrono:pick-media-file), но IPC-канал (chrono:import-media) физически получает произвольную строку от рендерера, поэтому расширение и размер проверяются здесь, а не только доверяются вызывающему коду
 * @returns {{ id: string, fileName: string, mimeType: string, fileSize: number, sha256: string }}
 * @throws {MediaImportError} на неизвестное расширение или файл больше MAX_IMPORT_SIZE_BYTES
 */
function importMedia(baseDir, projectId, sourceFilePath) {
  const ext = path.extname(sourceFilePath).toLowerCase();
  if (!MIME_BY_EXT[ext]) {
    throw new MediaImportError(`Неподдерживаемый тип файла: ${ext || '(без расширения)'}`);
  }

  const sourceStat = fs.statSync(sourceFilePath);
  if (sourceStat.size > MAX_IMPORT_SIZE_BYTES) {
    throw new MediaImportError(`Файл слишком большой (максимум ${MAX_IMPORT_SIZE_BYTES / (1024 * 1024)} МБ)`);
  }

  const dir = mediaDir(baseDir, projectId);
  fs.mkdirSync(dir, { recursive: true });

  const fileName = path.basename(sourceFilePath);
  const sha256 = sha256OfFile(sourceFilePath);
  const targetName = sha256 + ext;
  const targetPath = path.join(dir, targetName);

  if (!fs.existsSync(targetPath)) {
    // Копия через tmp+rename - тот же принцип атомарности, что и у
    // остального хранилища (atomicJson.js), только для бинарных файлов:
    // обрыв питания посреди копирования крупного видео не должен
    // оставить наполовину записанный файл под финальным именем.
    const tmpPath = `${targetPath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    fs.copyFileSync(sourceFilePath, tmpPath);
    fs.renameSync(tmpPath, targetPath);
  }

  const fileSize = fs.statSync(targetPath).size;

  return {
    id: crypto.randomUUID(),
    fileName,
    mimeType: guessMimeType(ext),
    fileSize,
    sha256,
  };
}

/**
 * Абсолютный путь на диске для уже импортированной записи медиа - для
 * раздачи через протокол chronomedia:// (electron/main.js). Бросает
 * PathGuardError на попытку обхода через некорректный projectId (тот же
 * guard, что и у остального хранилища), но НЕ проверяет существование
 * файла - это дело вызывающего кода (у него разные допустимые реакции на
 * "нет файла": 404 в протоколе, тихий пропуск в списке и т.д.).
 *
 * @param {string} baseDir
 * @param {string} projectId
 * @param {{ sha256: string, fileName: string }} media
 */
function mediaFilePath(baseDir, projectId, media) {
  return path.join(mediaDir(baseDir, projectId), diskFileName(media));
}

/**
 * Удаляет осиротевшие `*.tmp-*` файлы во всех медиатеках проекта -
 * найдено security-review: если процесс убит между copyFileSync и
 * renameSync (импорт крупного видео, обрыв питания киоска), временный
 * файл остаётся на диске навсегда - без подчистки они копятся без
 * ограничения при повторных сбоях. Вызывается один раз при старте
 * (registerChronoIpc), не на каждый импорт.
 *
 * @param {string} baseDir
 * @returns {number} сколько файлов удалено
 */
function sweepOrphanedTmpFiles(baseDir) {
  const root = projectsRoot(baseDir);
  if (!fs.existsSync(root)) return 0;

  let removed = 0;
  for (const projectId of fs.readdirSync(root)) {
    const dir = path.join(root, projectId, 'media');
    if (!fs.existsSync(dir)) continue;

    for (const entry of fs.readdirSync(dir)) {
      if (!entry.includes('.tmp-')) continue;
      try {
        fs.unlinkSync(path.join(dir, entry));
        removed++;
      } catch {
        // Гонка с параллельным импортом или файл уже удалён - не фатально.
      }
    }
  }
  return removed;
}

module.exports = {
  importMedia,
  mediaFilePath,
  mediaDir,
  diskFileName,
  guessMimeType,
  sweepOrphanedTmpFiles,
  MediaImportError,
  MAX_IMPORT_SIZE_BYTES,
};
