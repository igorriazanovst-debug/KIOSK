// packages/player/electron/chrono/archive.js
// Экспорт/импорт проекта «Хронолинии» в свой архивный формат (Фаза 8
// плана) — ZIP с фиксированной, белым списком проверяемой структурой:
//   manifest.json  — { formatVersion, exportedAt } — метаданные формата
//   content.json   — ChronoProject (тот же формат, что и content.json на
//                    диске проекта), проходит parseChronoProject на выходе
//   media/<sha256>.<ext> — файлы, на которые ссылается content.media[]
//
// Импорт `.tlx3`/`.tlx2` эталона НЕ делаем (решено, не по ТЗ) — это
// собственный формат, без обратной совместимости с чужими архивами.
//
// Защита от zip-slip: yauzl.validateFileName() (встроенная в библиотеку
// проверка на ".."/абсолютные пути/бэкслеши) + собственный БЕЛЫЙ СПИСОК
// точных имён (manifest.json/content.json/media/<sha256>.<ext>) — не
// "не содержит traversal", а "точно совпадает с ожидаемой структурой",
// что строже. Ни один путь из архива не передаётся в fs.* до этой проверки.
//
// Защита от zip-bomb: entry.uncompressedSize (доверенное поле из
// центрального каталога ZIP, см. README yauzl) проверяется ДО открытия
// потока чтения - на per-file и суммарный потолок. yauzl сама же (опция
// validateEntrySizes, включена по умолчанию) сверяет заявленный размер с
// РЕАЛЬНЫМ числом байт при распаковке - если архив лжёт о размере,
// поток чтения сам оборвётся с ошибкой. Плюс собственный подсчёт байт по
// мере чтения - оборона в глубину на случай ошибки/будущей регрессии в
// самой библиотеке.
//
// Целостность медиа: sha256 извлечённого файла пересчитывается и
// сверяется с sha256, зашитым и в имя файла В АРХИВЕ, и в
// content.media[].sha256 - несовпадающий файл просто пропускается (не
// импортируется), не роняя весь импорт целиком - тот же принцип
// "деградация, не отказ", что и у остального кода с отсутствующими медиа
// (mediaStore.js).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const yauzl = require('yauzl');
const yazl = require('yazl');
const { parseChronoProject, assertProjectSerializable } = require('@kiosk/shared');
const projectStore = require('./projectStore');
const mediaStore = require('./mediaStore');

const ARCHIVE_FORMAT_VERSION = 1;
/** Тот же потолок на файл, что и у mediaStore.MAX_IMPORT_SIZE_BYTES - архив не должен позволять больше, чем обычный импорт медиа */
const MAX_ENTRY_UNCOMPRESSED_BYTES = 500 * 1024 * 1024;
/** Суммарный потолок на весь архив в распакованном виде */
const MAX_TOTAL_UNCOMPRESSED_BYTES = 2 * 1024 * 1024 * 1024;
/** Разумный потолок на число файлов - защита от архива с миллионом пустых записей */
const MAX_ENTRY_COUNT = 10_000;
const MEDIA_ENTRY_RE = /^media\/([0-9a-f]{64})\.([a-z0-9]{1,10})$/;

class ArchiveError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ArchiveError';
  }
}

function tmpPathFor(targetPath) {
  return `${targetPath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ─── Экспорт ────────────────────────────────────────────────────────────

/**
 * @param {string} baseDir
 * @param {string} projectId
 * @param {string} targetFilePath - куда писать .chronoline (выбрано dialog.showSaveDialog на уровне ipc.js)
 */
async function exportProjectToZip(baseDir, projectId, targetFilePath) {
  const content = projectStore.loadProjectData(baseDir, projectId);

  const zipfile = new yazl.ZipFile();
  zipfile.addBuffer(
    Buffer.from(JSON.stringify({ formatVersion: ARCHIVE_FORMAT_VERSION, exportedAt: new Date().toISOString() }, null, 2)),
    'manifest.json'
  );
  zipfile.addBuffer(Buffer.from(JSON.stringify(content, null, 2)), 'content.json');

  for (const media of content.media) {
    const filePath = mediaStore.mediaFilePath(baseDir, projectId, media);
    // Отсутствующий на диске файл медиа пропускаем молча - та же
    // деградация, что и везде в mediaStore/рендерере; экспорт не обязан
    // падать из-за одной пропавшей картинки.
    if (!fs.existsSync(filePath)) continue;
    zipfile.addFile(filePath, `media/${mediaStore.diskFileName(media)}`);
  }
  zipfile.end();

  const tmp = tmpPathFor(targetFilePath);
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(tmp);
    // targetFilePath - произвольное место на диске, выбранное пользователем
    // в showSaveDialog (Рабочий стол, флешка и т.п.), НЕ внутри baseDir -
    // mediaStore.sweepOrphanedTmpFiles его не видит и никогда не подчистит.
    // Поэтому здесь, в отличие от остального кода хранилища, tmp-файл
    // обязан удаляться явно при любом отказе (security-review, MEDIUM) - не
    // полагаемся на внешний sweep, которого для этого пути не существует.
    const fail = (err) => {
      fs.unlink(tmp, () => {});
      reject(err);
    };
    zipfile.outputStream.on('error', fail);
    out.on('error', fail);
    out.on('close', resolve);
    zipfile.outputStream.pipe(out);
  });
  fs.renameSync(tmp, targetFilePath);
}

// ─── Импорт ─────────────────────────────────────────────────────────────

function readEntryToBuffer(zipfile, entry, maxBytes) {
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (err, readStream) => {
      if (err) return reject(err);
      const chunks = [];
      let total = 0;
      readStream.on('data', (chunk) => {
        total += chunk.length;
        if (total > maxBytes) {
          readStream.destroy();
          reject(new ArchiveError(`Файл в архиве оказался больше заявленного размера: ${entry.fileName}`));
          return;
        }
        chunks.push(chunk);
      });
      readStream.on('end', () => resolve(Buffer.concat(chunks)));
      readStream.on('error', reject);
    });
  });
}

/** Извлекает entry на диск, считая sha256 по пути (без второго прохода чтения) - resolve(sha256hex) */
function extractEntryToFile(zipfile, entry, targetPath, maxBytes) {
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (err, readStream) => {
      if (err) return reject(err);
      const tmp = tmpPathFor(targetPath);
      const out = fs.createWriteStream(tmp);
      const hash = crypto.createHash('sha256');
      let total = 0;
      let failed = false;

      const fail = (error) => {
        if (failed) return;
        failed = true;
        readStream.destroy();
        out.destroy();
        fs.unlink(tmp, () => {});
        reject(error);
      };

      readStream.on('data', (chunk) => {
        total += chunk.length;
        if (total > maxBytes) {
          fail(new ArchiveError(`Файл в архиве оказался больше заявленного размера: ${entry.fileName}`));
          return;
        }
        hash.update(chunk);
      });
      readStream.on('error', fail);
      out.on('error', fail);
      out.on('close', () => {
        if (failed) return;
        fs.renameSync(tmp, targetPath);
        resolve(hash.digest('hex'));
      });
      readStream.pipe(out);
    });
  });
}

/**
 * Перечисляет все entries архива ОДНИМ проходом, применяя белый список +
 * лимиты размера ДО того, как что-либо реально читается с диска (кроме
 * самого перечисления - central directory ZIP читается yauzl всегда, это
 * не обходится, но это метаданные, не содержимое файлов).
 *
 * @param {{ maxEntryBytes: number, maxTotalBytes: number, maxEntryCount: number }} limits
 * @returns {Promise<{ manifestEntry: object | null, contentEntry: object, mediaEntries: Map<string, object> }>}
 */
function collectEntries(zipfile, limits) {
  return new Promise((resolve, reject) => {
    let manifestEntry = null;
    let contentEntry = null;
    const mediaEntries = new Map();
    let entryCount = 0;
    let totalUncompressed = 0;

    const fail = (error) => {
      zipfile.removeAllListeners('entry');
      zipfile.removeAllListeners('end');
      // yauzl сама валидирует имена файлов (strictFileNames) ДО эмиссии
      // события 'entry' и в этом случае эмитит обычный Error через 'error',
      // не через наш путь ниже - оборачиваем в ArchiveError, чтобы
      // importProjectFromZip всегда возвращал предсказуемый тип ошибки,
      // независимо от того, чья именно проверка её поймала.
      reject(error instanceof ArchiveError ? error : new ArchiveError(error.message));
    };

    zipfile.on('error', fail);
    zipfile.on('end', () => resolve({ manifestEntry, contentEntry, mediaEntries }));
    zipfile.on('entry', (entry) => {
      entryCount++;
      if (entryCount > limits.maxEntryCount) return fail(new ArchiveError('Слишком много файлов в архиве'));

      // Записи-каталоги (fileName оканчивается на '/') в нашем формате не
      // используются - пропускаем, не добавляя в белый список ниже.
      if (entry.fileName.endsWith('/')) {
        zipfile.readEntry();
        return;
      }

      const nameError = yauzl.validateFileName(entry.fileName);
      if (nameError) return fail(new ArchiveError(`Небезопасное имя файла в архиве: ${nameError}`));

      if (entry.uncompressedSize > limits.maxEntryBytes) {
        return fail(new ArchiveError(`Файл в архиве слишком большой: ${entry.fileName}`));
      }
      totalUncompressed += entry.uncompressedSize;
      if (totalUncompressed > limits.maxTotalBytes) {
        return fail(new ArchiveError('Архив слишком большой в распакованном виде'));
      }

      if (entry.fileName === 'manifest.json') {
        manifestEntry = entry;
      } else if (entry.fileName === 'content.json') {
        contentEntry = entry;
      } else if (MEDIA_ENTRY_RE.test(entry.fileName)) {
        mediaEntries.set(entry.fileName, entry);
      } else {
        return fail(new ArchiveError(`Файл не похож на архив Хронолинии (неожиданная запись: ${entry.fileName})`));
      }

      zipfile.readEntry();
    });
    zipfile.readEntry();
  });
}

const DEFAULT_LIMITS = {
  maxEntryBytes: MAX_ENTRY_UNCOMPRESSED_BYTES,
  maxTotalBytes: MAX_TOTAL_UNCOMPRESSED_BYTES,
  maxEntryCount: MAX_ENTRY_COUNT,
};

/**
 * @param {string} baseDir
 * @param {string} sourceFilePath - .chronoline, выбранный dialog.showOpenDialog на уровне ipc.js
 * @param {Partial<typeof DEFAULT_LIMITS>} [limitsOverride] - только для тестов (не аллоцировать сотни МБ, чтобы проверить отказ по размеру)
 * @returns {Promise<object>} манифест НОВОГО проекта (свежий id, не переиспользует id из архива)
 */
async function importProjectFromZip(baseDir, sourceFilePath, limitsOverride) {
  const limits = { ...DEFAULT_LIMITS, ...limitsOverride };
  const zipfile = await yauzl.openPromise(sourceFilePath, {
    autoClose: false,
    lazyEntries: true,
    strictFileNames: true,
  });

  let newManifest = null;
  try {
    const { manifestEntry, contentEntry, mediaEntries } = await collectEntries(zipfile, limits);

    if (!manifestEntry || !contentEntry) {
      throw new ArchiveError('Файл не похож на архив Хронолинии (нет manifest.json/content.json)');
    }

    const archiveManifest = JSON.parse(
      (await readEntryToBuffer(zipfile, manifestEntry, limits.maxEntryBytes)).toString('utf8')
    );
    if (archiveManifest.formatVersion !== ARCHIVE_FORMAT_VERSION) {
      throw new ArchiveError(`Неподдерживаемая версия формата архива: ${archiveManifest.formatVersion}`);
    }

    const rawContent = JSON.parse((await readEntryToBuffer(zipfile, contentEntry, limits.maxEntryBytes)).toString('utf8'));
    const content = parseChronoProject(rawContent);
    assertProjectSerializable(content);

    newManifest = projectStore.createProject(baseDir, content.name);

    const importedMedia = [];
    for (const media of content.media) {
      const archiveName = `media/${mediaStore.diskFileName(media)}`;
      const entry = mediaEntries.get(archiveName);
      if (!entry) continue; // тот же файл отсутствует в архиве, что и "нет на диске" - пропускаем, не рушим импорт

      const targetPath = mediaStore.mediaFilePath(baseDir, newManifest.id, media);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      const actualSha256 = await extractEntryToFile(zipfile, entry, targetPath, limits.maxEntryBytes);

      // Целостность: имя файла в архиве, sha256 реального содержимого и
      // media.sha256 из content.json обязаны совпадать втроём - иначе
      // это либо повреждённый, либо намеренно подделанный архив.
      if (actualSha256 !== media.sha256) {
        fs.unlink(targetPath, () => {});
        continue;
      }
      importedMedia.push(media);
    }

    const finalContent = {
      ...content,
      id: newManifest.id,
      media: importedMedia,
    };
    projectStore.saveProjectData(baseDir, newManifest.id, finalContent);

    return projectStore.readManifest(baseDir, newManifest.id);
  } catch (err) {
    if (newManifest) {
      // Частично созданный проект не должен остаться сиротой на диске.
      try {
        projectStore.deleteProject(baseDir, newManifest.id);
      } catch {
        // Лучшее из возможного - не даём вторичной ошибке скрыть исходную.
      }
    }
    throw err;
  } finally {
    zipfile.close();
  }
}

module.exports = {
  ArchiveError,
  ARCHIVE_FORMAT_VERSION,
  MAX_ENTRY_UNCOMPRESSED_BYTES,
  MAX_TOTAL_UNCOMPRESSED_BYTES,
  MAX_ENTRY_COUNT,
  exportProjectToZip,
  importProjectFromZip,
};
