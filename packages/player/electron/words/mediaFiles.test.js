// packages/player/electron/words/mediaFiles.test.js
// Проверка границы системы: что принимается и что отвергается при добавлении
// картинки или записи педагогом (ТЗ раздел 9).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const media = require('./mediaFiles');

const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'kiosk-words-media-'));

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20, 7)]);
const GIF = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(20, 7)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(20)]);
const WAV = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE'), Buffer.alloc(20)]);
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(20, 3)]);
const OGG = Buffer.concat([Buffer.from('OggS'), Buffer.alloc(20)]);
const MP3_ID3 = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(20)]);
const MP3_FRAME = Buffer.concat([Buffer.from([0xff, 0xfb]), Buffer.alloc(20)]);
const M4A = Buffer.concat([Buffer.alloc(4), Buffer.from('ftypM4A '), Buffer.alloc(12)]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>');
const SVG_XML = Buffer.from('<?xml version="1.0"?>\n<svg></svg>');
const EXE = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(30, 0x90)]);
const TEXT = Buffer.from('просто текст, не медиа вовсе');

// ─── Распознавание формата по содержимому ───────────────────────────────

test('сигнатуры изображений распознаются', () => {
  assert.equal(media.sniffMediaType(PNG), 'png');
  assert.equal(media.sniffMediaType(JPEG), 'jpeg');
  assert.equal(media.sniffMediaType(GIF), 'gif');
  assert.equal(media.sniffMediaType(WEBP), 'webp');
  assert.equal(media.sniffMediaType(SVG), 'svg');
  assert.equal(media.sniffMediaType(SVG_XML), 'svg');
});

test('сигнатуры звука распознаются', () => {
  assert.equal(media.sniffMediaType(WAV), 'wav');
  assert.equal(media.sniffMediaType(WEBM), 'webm');
  assert.equal(media.sniffMediaType(OGG), 'ogg');
  assert.equal(media.sniffMediaType(MP3_ID3), 'mp3');
  assert.equal(media.sniffMediaType(MP3_FRAME), 'mp3');
  assert.equal(media.sniffMediaType(M4A), 'mp4');
});

test('RIFF-контейнер различается по внутреннему типу, а не по первым байтам', () => {
  // WEBP и WAV начинаются одинаково — если различать только по «RIFF»,
  // картинка пройдёт как звук и наоборот
  assert.equal(media.sniffMediaType(WEBP), 'webp');
  assert.equal(media.sniffMediaType(WAV), 'wav');
  const riffUnknown = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('XXXX'), Buffer.alloc(20)]);
  assert.equal(media.sniffMediaType(riffUnknown), null);
});

test('исполняемый файл и простой текст не распознаются как медиа', () => {
  assert.equal(media.sniffMediaType(EXE), null);
  assert.equal(media.sniffMediaType(TEXT), null);
  assert.equal(media.sniffMediaType(Buffer.alloc(0)), null);
});

// ─── Приём файла в хранилище ────────────────────────────────────────────

test('картинка принимается и получает имя-хеш', () => {
  const dir = tempDir();
  const res = media.storeMediaBuffer(dir, PNG, 'image');
  assert.match(res.fileName, /^[0-9a-f]{32}\.png$/);
  assert.equal(res.type, 'png');
  assert.ok(fs.existsSync(path.join(dir, 'media', res.fileName)));
});

test('одинаковое содержимое кладётся один раз (дедупликация)', () => {
  const dir = tempDir();
  const first = media.storeMediaBuffer(dir, PNG, 'image');
  const second = media.storeMediaBuffer(dir, PNG, 'image');
  assert.equal(first.fileName, second.fileName);
  assert.equal(second.deduplicated, true);
  assert.equal(fs.readdirSync(path.join(dir, 'media')).length, 1);
});

test('ПЕРЕИМЕНОВАННЫЙ .exe с расширением .png отвергается по содержимому', () => {
  // Главная проверка границы: расширению не доверяем
  const dir = tempDir();
  const src = path.join(dir, 'вирус.png');
  fs.writeFileSync(src, EXE);
  assert.throws(() => media.importMediaFile(dir, src, 'image'), media.MediaError);
});

test('звук вместо картинки отвергается', () => {
  const dir = tempDir();
  assert.throws(
    () => media.storeMediaBuffer(dir, WEBM, 'image'),
    (e) => e instanceof media.MediaError && /не изображение/.test(e.message),
  );
});

test('картинка вместо звука отвергается', () => {
  const dir = tempDir();
  assert.throws(
    () => media.storeMediaBuffer(dir, PNG, 'audio'),
    (e) => e instanceof media.MediaError && /не звуковой/.test(e.message),
  );
});

test('пустой файл отвергается', () => {
  const dir = tempDir();
  assert.throws(() => media.storeMediaBuffer(dir, Buffer.alloc(0), 'image'), media.MediaError);
});

test('слишком большой файл отвергается с понятным текстом', () => {
  const dir = tempDir();
  const huge = Buffer.concat([PNG, Buffer.alloc(media.MAX_IMAGE_BYTES)]);
  assert.throws(
    () => media.storeMediaBuffer(dir, huge, 'image'),
    (e) => e instanceof media.MediaError && /МБ/.test(e.message),
  );
});

test('импорт: размер проверяется до чтения файла в память', () => {
  const dir = tempDir();
  const src = path.join(dir, 'большой.png');
  fs.writeFileSync(src, Buffer.alloc(media.MAX_IMAGE_BYTES + 1024));
  assert.throws(() => media.importMediaFile(dir, src, 'image'), media.MediaError);
});

test('импорт: неподдерживаемое расширение отвергается до чтения', () => {
  const dir = tempDir();
  const src = path.join(dir, 'документ.docx');
  fs.writeFileSync(src, PNG);
  assert.throws(
    () => media.importMediaFile(dir, src, 'image'),
    (e) => e instanceof media.MediaError && /не поддерживается/.test(e.message),
  );
});

test('импорт несуществующего файла — понятная ошибка', () => {
  const dir = tempDir();
  assert.throws(
    () => media.importMediaFile(dir, path.join(dir, 'нет.png'), 'image'),
    (e) => e instanceof media.MediaError && /не найден/.test(e.message),
  );
});

test('импорт настоящей картинки проходит', () => {
  const dir = tempDir();
  const src = path.join(dir, 'ёлка.png');
  fs.writeFileSync(src, PNG);
  const res = media.importMediaFile(dir, src, 'image');
  assert.equal(res.type, 'png');
});

test('запись с микрофона (webm) принимается как звук', () => {
  // Формат, в котором реально пишет MediaRecorder в Electron — проверено спайком
  const dir = tempDir();
  const res = media.storeMediaBuffer(dir, WEBM, 'audio');
  assert.equal(res.type, 'webm');
  assert.match(res.fileName, /\.webm$/);
});

// ─── Пути и удаление ────────────────────────────────────────────────────

test('имя файла медиа не может быть произвольным — обход пути невозможен', () => {
  const dir = tempDir();
  for (const bad of ['../../secret.txt', 'a/b.png', '..\\evil.png', 'обычное.png', '']) {
    assert.throws(() => media.mediaFilePath(dir, bad), media.MediaError, `имя ${JSON.stringify(bad)}`);
  }
});

test('корректное имя-хеш резолвится внутрь каталога медиа', () => {
  const dir = tempDir();
  const name = 'a'.repeat(32) + '.png';
  const resolved = media.mediaFilePath(dir, name);
  assert.ok(resolved.startsWith(path.join(dir, 'media')));
});

test('удаление файла идёмпотентно', () => {
  const dir = tempDir();
  const { fileName } = media.storeMediaBuffer(dir, PNG, 'image');
  assert.equal(media.deleteMediaFile(dir, fileName), true);
  assert.equal(media.deleteMediaFile(dir, fileName), false, 'повторное удаление не ошибка');
});

test('временных файлов после записи не остаётся', () => {
  const dir = tempDir();
  media.storeMediaBuffer(dir, PNG, 'image');
  media.storeMediaBuffer(dir, JPEG, 'image');
  const leftovers = fs.readdirSync(path.join(dir, 'media')).filter((f) => f.includes('.tmp-'));
  assert.deepEqual(leftovers, []);
});
