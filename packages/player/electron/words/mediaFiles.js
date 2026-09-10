// packages/player/electron/words/mediaFiles.js
// Хранение картинок и записей педагога ФАЙЛАМИ на диске.
//
// Осознанное отличие от эталона ОС3: у него медиа своих слов лежат строками
// base64 внутри JSON, и весь файл переписывается целиком при каждой правке —
// разбор назвал это узким местом. Здесь файл есть файл.
//
// БЕЗОПАСНОСТЬ ГРАНИЦЫ (ТЗ раздел 9: «входные файлы и импортируемый контент
// должны проверяться по типу/формату», «пользовательские файлы не должны
// исполняться как код»). Три рубежа:
//   1. расширение исходного файла — по белому списку;
//   2. РЕАЛЬНОЕ содержимое — по сигнатуре первых байтов, а не по расширению:
//      переименованный .exe с расширением .png расширением не ловится;
//   3. размер — до чтения файла целиком в память.
//
// Имя файла в хранилище выводится из хеша содержимого, а не берётся от
// пользователя: это разом снимает и обход пути, и коллизии имён, и даёт
// дедупликацию — одна и та же картинка, добавленная дважды, лежит один раз.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { atomicWriteJson } = require('../chrono/atomicJson');

const MEDIA_DIR = 'media';

/** Пределы. Картинка для карточки и короткая запись слова — обе маленькие */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif'];
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.webm', '.m4a', '.aac'];

class MediaError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MediaError';
  }
}

function startsWith(buffer, bytes, offset = 0) {
  if (buffer.length < offset + bytes.length) return false;
  for (let i = 0; i < bytes.length; i++) {
    if (buffer[offset + i] !== bytes[i]) return false;
  }
  return true;
}

/**
 * Определяет РЕАЛЬНЫЙ тип по сигнатуре содержимого. Чистая функция —
 * тестируется без файловой системы.
 *
 * @param {Buffer} head первые байты файла (достаточно 64)
 * @returns {'png'|'jpeg'|'gif'|'webp'|'svg'|'mp3'|'wav'|'ogg'|'webm'|'mp4'|null}
 */
function sniffMediaType(head) {
  if (!head || head.length < 4) return null;

  if (startsWith(head, [0x89, 0x50, 0x4e, 0x47])) return 'png';
  if (startsWith(head, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(head, [0x47, 0x49, 0x46, 0x38])) return 'gif';
  // RIFF....WEBP и RIFF....WAVE различаются четырьмя байтами на позиции 8
  if (startsWith(head, [0x52, 0x49, 0x46, 0x46])) {
    if (startsWith(head, [0x57, 0x45, 0x42, 0x50], 8)) return 'webp';
    if (startsWith(head, [0x57, 0x41, 0x56, 0x45], 8)) return 'wav';
    return null;
  }
  if (startsWith(head, [0x1a, 0x45, 0xdf, 0xa3])) return 'webm'; // EBML: webm и mkv
  if (startsWith(head, [0x4f, 0x67, 0x67, 0x53])) return 'ogg';
  if (startsWith(head, [0x49, 0x44, 0x33])) return 'mp3'; // ID3
  if (head[0] === 0xff && (head[1] & 0xe0) === 0xe0) return 'mp3'; // MPEG-фрейм без тега
  if (startsWith(head, [0x66, 0x74, 0x79, 0x70], 4)) return 'mp4'; // ....ftyp — m4a/mp4

  // SVG — текст, а не двоичный формат: ищем начало XML или сам тег
  const text = head.toString('utf8', 0, Math.min(head.length, 64)).trimStart().toLowerCase();
  if (text.startsWith('<?xml') || text.startsWith('<svg')) return 'svg';

  return null;
}

const IMAGE_TYPES = ['png', 'jpeg', 'gif', 'webp', 'svg'];
const AUDIO_TYPES = ['mp3', 'wav', 'ogg', 'webm', 'mp4'];

/** Расширение, под которым файл кладётся в хранилище */
const EXTENSION_BY_TYPE = {
  png: '.png',
  jpeg: '.jpg',
  gif: '.gif',
  webp: '.webp',
  svg: '.svg',
  mp3: '.mp3',
  wav: '.wav',
  ogg: '.ogg',
  webm: '.webm',
  mp4: '.m4a',
};

function mediaDir(baseDir) {
  return path.join(baseDir, MEDIA_DIR);
}

/**
 * Проверяет содержимое и кладёт файл в хранилище под именем-хешем.
 * @param {string} baseDir
 * @param {Buffer} content
 * @param {'image'|'audio'} kind
 * @returns {{ fileName: string, type: string, bytes: number, deduplicated: boolean }}
 */
function storeMediaBuffer(baseDir, content, kind) {
  const limit = kind === 'image' ? MAX_IMAGE_BYTES : MAX_AUDIO_BYTES;
  if (content.length === 0) throw new MediaError('Файл пустой');
  if (content.length > limit) {
    throw new MediaError(
      `Файл больше ${Math.round(limit / 1024 / 1024)} МБ — выберите файл поменьше`
    );
  }

  const type = sniffMediaType(content.subarray(0, 64));
  if (!type) {
    throw new MediaError('Не удалось распознать формат файла — похоже, это не картинка и не звук');
  }
  const allowed = kind === 'image' ? IMAGE_TYPES : AUDIO_TYPES;
  if (!allowed.includes(type)) {
    throw new MediaError(
      kind === 'image'
        ? `Это не изображение (распознано как ${type})`
        : `Это не звуковой файл (распознано как ${type})`
    );
  }

  const hash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 32);
  const fileName = `${hash}${EXTENSION_BY_TYPE[type]}`;
  const dir = mediaDir(baseDir);
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, fileName);

  if (fs.existsSync(target)) {
    return { fileName, type, bytes: content.length, deduplicated: true };
  }

  // Тот же приём, что и у atomicWriteJson: пишем во временный, потом
  // переименовываем — оборванная запись не оставит полуфайл под рабочим именем
  const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, target);
  return { fileName, type, bytes: content.length, deduplicated: false };
}

/**
 * Импорт файла, выбранного педагогом в диалоге.
 * Размер проверяется ДО чтения содержимого в память.
 */
function importMediaFile(baseDir, sourcePath, kind) {
  let stat;
  try {
    stat = fs.statSync(sourcePath);
  } catch {
    throw new MediaError('Файл не найден или недоступен');
  }
  if (!stat.isFile()) throw new MediaError('Это не файл');

  const limit = kind === 'image' ? MAX_IMAGE_BYTES : MAX_AUDIO_BYTES;
  if (stat.size > limit) {
    throw new MediaError(
      `Файл больше ${Math.round(limit / 1024 / 1024)} МБ — выберите файл поменьше`
    );
  }

  const ext = path.extname(sourcePath).toLowerCase();
  const allowedExt = kind === 'image' ? IMAGE_EXTENSIONS : AUDIO_EXTENSIONS;
  if (!allowedExt.includes(ext)) {
    throw new MediaError(`Формат ${ext || 'без расширения'} не поддерживается`);
  }

  return storeMediaBuffer(baseDir, fs.readFileSync(sourcePath), kind);
}

/** Путь к файлу медиа внутри хранилища; имя всегда наше, не пользовательское */
function mediaFilePath(baseDir, fileName) {
  if (typeof fileName !== 'string' || !/^[0-9a-f]{32}\.[a-z0-9]{2,4}$/.test(fileName)) {
    throw new MediaError('Некорректное имя файла медиа');
  }
  return path.join(mediaDir(baseDir), fileName);
}

function deleteMediaFile(baseDir, fileName) {
  try {
    fs.unlinkSync(mediaFilePath(baseDir, fileName));
    return true;
  } catch {
    // Файла может не быть — это не ошибка: удаление идёмпотентно
    return false;
  }
}

module.exports = {
  MediaError,
  MEDIA_DIR,
  MAX_IMAGE_BYTES,
  MAX_AUDIO_BYTES,
  IMAGE_EXTENSIONS,
  AUDIO_EXTENSIONS,
  sniffMediaType,
  storeMediaBuffer,
  importMediaFile,
  mediaDir,
  mediaFilePath,
  deleteMediaFile,
  atomicWriteJson,
};
