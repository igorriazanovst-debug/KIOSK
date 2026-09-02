import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import yazl from 'yazl';
import { exportProjectToZip, importProjectFromZip, ArchiveError, ARCHIVE_FORMAT_VERSION } from './archive.js';
import { createProject, loadProjectData, saveProjectData, listProjects } from './projectStore.js';
import { importMedia, mediaFilePath } from './mediaStore.js';

function tmpBaseDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'chrono-archive-'));
}

function tmpArchivePath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrono-archive-out-'));
  return path.join(dir, 'export.chronoline');
}

function tmpSourceFile(name, content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrono-archive-src-'));
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, content);
  return filePath;
}

/** Собирает произвольный .zip напрямую через yazl - для тестов атак, минуя exportProjectToZip. */
function writeRawZip(entries) {
  return new Promise((resolve, reject) => {
    const zipfile = new yazl.ZipFile();
    for (const e of entries) zipfile.addBuffer(Buffer.from(e.content), e.name);
    zipfile.end();

    const target = tmpArchivePath();
    const out = fs.createWriteStream(target);
    zipfile.outputStream.pipe(out);
    out.on('close', () => resolve(target));
    out.on('error', reject);
    zipfile.outputStream.on('error', reject);
  });
}

test('exportProjectToZip + importProjectFromZip round-trips an empty project (name/timelines/media preserved, id changes)', async () => {
  const baseDir = tmpBaseDir();
  const original = createProject(baseDir, 'Мой проект');
  const archivePath = tmpArchivePath();

  await exportProjectToZip(baseDir, original.id, archivePath);
  const imported = await importProjectFromZip(baseDir, archivePath);

  assert.notEqual(imported.id, original.id, 'импорт создаёт НОВЫЙ проект, не перезаписывает существующий id');
  assert.equal(imported.name, 'Мой проект');

  const importedContent = loadProjectData(baseDir, imported.id);
  assert.equal(importedContent.id, imported.id);
  assert.deepEqual(importedContent.timelines, []);
  assert.deepEqual(importedContent.media, []);
});

test('round-trips a project with a real media file, verifying content and sha256 integrity', async () => {
  const baseDir = tmpBaseDir();
  const original = createProject(baseDir, 'С медиа');
  const media = importMedia(baseDir, original.id, tmpSourceFile('photo.jpg', 'real photo bytes'));
  const content = loadProjectData(baseDir, original.id);
  saveProjectData(baseDir, original.id, { ...content, media: [media] });

  const archivePath = tmpArchivePath();
  await exportProjectToZip(baseDir, original.id, archivePath);
  const imported = await importProjectFromZip(baseDir, archivePath);

  const importedContent = loadProjectData(baseDir, imported.id);
  assert.equal(importedContent.media.length, 1);
  assert.equal(importedContent.media[0].sha256, media.sha256);

  const importedFilePath = mediaFilePath(baseDir, imported.id, media);
  assert.ok(fs.existsSync(importedFilePath));
  assert.equal(fs.readFileSync(importedFilePath, 'utf8'), 'real photo bytes');
});

test('two projects can be exported and imported independently without id collisions', async () => {
  const baseDir = tmpBaseDir();
  const a = createProject(baseDir, 'A');
  const b = createProject(baseDir, 'B');

  const archiveA = tmpArchivePath();
  const archiveB = tmpArchivePath();
  await exportProjectToZip(baseDir, a.id, archiveA);
  await exportProjectToZip(baseDir, b.id, archiveB);

  const importedA = await importProjectFromZip(baseDir, archiveA);
  const importedB = await importProjectFromZip(baseDir, archiveB);

  assert.notEqual(importedA.id, importedB.id);
  assert.equal(listProjects(baseDir).length, 4); // a, b, importedA, importedB
});

/**
 * Hand-built STORED-mode (uncompressed) ZIP, bypassing yazl entirely -
 * yazl's own addBuffer() refuses to write a traversal path
 * (validateMetadataPath), so it can't be used to construct the very
 * attack payload this test needs to prove the READER (yauzl.validateFileName
 * inside collectEntries) rejects. A real attacker isn't constrained by
 * yazl's cooperation either - they'd craft raw bytes exactly like this.
 */
function buildRawZipWithTraversalEntry(entryName, content) {
  const nameBuf = Buffer.from(entryName, 'utf8');
  const dataBuf = Buffer.from(content, 'utf8');
  const crc = zlib.crc32(dataBuf) >>> 0;

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4); // version needed
  localHeader.writeUInt16LE(0, 6); // flags
  localHeader.writeUInt16LE(0, 8); // compression = stored
  localHeader.writeUInt16LE(0, 10); // mod time
  localHeader.writeUInt16LE(0x21, 12); // mod date (valid nonzero DOS date)
  localHeader.writeUInt32LE(crc, 14);
  localHeader.writeUInt32LE(dataBuf.length, 18); // compressed size
  localHeader.writeUInt32LE(dataBuf.length, 22); // uncompressed size
  localHeader.writeUInt16LE(nameBuf.length, 26);
  localHeader.writeUInt16LE(0, 28); // extra field length

  const localOffset = 0;
  const localEntry = Buffer.concat([localHeader, nameBuf, dataBuf]);

  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(20, 4); // version made by
  centralHeader.writeUInt16LE(20, 6); // version needed
  centralHeader.writeUInt16LE(0, 8); // flags
  centralHeader.writeUInt16LE(0, 10); // compression
  centralHeader.writeUInt16LE(0, 12); // mod time
  centralHeader.writeUInt16LE(0x21, 14); // mod date
  centralHeader.writeUInt32LE(crc, 16);
  centralHeader.writeUInt32LE(dataBuf.length, 20);
  centralHeader.writeUInt32LE(dataBuf.length, 24);
  centralHeader.writeUInt16LE(nameBuf.length, 28);
  centralHeader.writeUInt16LE(0, 30); // extra field length
  centralHeader.writeUInt16LE(0, 32); // comment length
  centralHeader.writeUInt16LE(0, 34); // disk number
  centralHeader.writeUInt16LE(0, 36); // internal attrs
  centralHeader.writeUInt32LE(0, 38); // external attrs
  centralHeader.writeUInt32LE(localOffset, 42);
  const centralEntry = Buffer.concat([centralHeader, nameBuf]);

  const centralDirOffset = localEntry.length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // disk with central dir
  eocd.writeUInt16LE(1, 8); // entries on this disk
  eocd.writeUInt16LE(1, 10); // total entries
  eocd.writeUInt32LE(centralEntry.length, 12); // size of central dir
  eocd.writeUInt32LE(centralDirOffset, 16); // offset of central dir
  eocd.writeUInt16LE(0, 20); // comment length

  const zipBuffer = Buffer.concat([localEntry, centralEntry, eocd]);
  const target = tmpArchivePath();
  fs.writeFileSync(target, zipBuffer);
  return target;
}

test('rejects an archive with a path-traversal entry name (zip-slip)', async () => {
  const baseDir = tmpBaseDir();
  const archivePath = buildRawZipWithTraversalEntry('../../../../evil.txt', 'pwned');

  await assert.rejects(() => importProjectFromZip(baseDir, archivePath), ArchiveError);
  assert.equal(listProjects(baseDir).length, 0, 'no project directory created from a rejected archive');
});

test('rejects an archive with an absolute-path entry name (zip-slip variant)', async () => {
  const baseDir = tmpBaseDir();
  const archivePath = buildRawZipWithTraversalEntry('/etc/passwd', 'pwned');

  await assert.rejects(() => importProjectFromZip(baseDir, archivePath), ArchiveError);
});

test('rejects an archive with an unexpected (non-whitelisted) entry name', async () => {
  const baseDir = tmpBaseDir();
  const archivePath = await writeRawZip([
    { name: 'manifest.json', content: JSON.stringify({ formatVersion: ARCHIVE_FORMAT_VERSION }) },
    { name: 'content.json', content: JSON.stringify(minimalProject()) },
    { name: 'evil.js', content: 'require("child_process").exec("rm -rf /")' },
  ]);

  await assert.rejects(() => importProjectFromZip(baseDir, archivePath), ArchiveError);
});

test('rejects an archive missing content.json', async () => {
  const baseDir = tmpBaseDir();
  const archivePath = await writeRawZip([{ name: 'manifest.json', content: JSON.stringify({ formatVersion: ARCHIVE_FORMAT_VERSION }) }]);

  await assert.rejects(() => importProjectFromZip(baseDir, archivePath), ArchiveError);
});

test('rejects an archive with an unsupported format version', async () => {
  const baseDir = tmpBaseDir();
  const archivePath = await writeRawZip([
    { name: 'manifest.json', content: JSON.stringify({ formatVersion: 999 }) },
    { name: 'content.json', content: JSON.stringify(minimalProject()) },
  ]);

  await assert.rejects(() => importProjectFromZip(baseDir, archivePath), ArchiveError);
});

test('rejects an archive whose content.json fails schema validation', async () => {
  const baseDir = tmpBaseDir();
  const archivePath = await writeRawZip([
    { name: 'manifest.json', content: JSON.stringify({ formatVersion: ARCHIVE_FORMAT_VERSION }) },
    { name: 'content.json', content: JSON.stringify({ not: 'a valid project' }) },
  ]);

  await assert.rejects(() => importProjectFromZip(baseDir, archivePath));
  assert.equal(listProjects(baseDir).length, 0);
});

test('rejects a media entry whose actual sha256 does not match its claimed name/metadata (tampered archive)', async () => {
  const baseDir = tmpBaseDir();
  const fakeSha256 = crypto.createHash('sha256').update('claimed content').digest('hex');
  const project = {
    ...minimalProject(),
    media: [{ id: 'm1', fileName: 'photo.jpg', mimeType: 'image/jpeg', fileSize: 5, sha256: fakeSha256 }],
  };
  const archivePath = await writeRawZip([
    { name: 'manifest.json', content: JSON.stringify({ formatVersion: ARCHIVE_FORMAT_VERSION }) },
    { name: 'content.json', content: JSON.stringify(project) },
    { name: `media/${fakeSha256}.jpg`, content: 'DIFFERENT actual bytes, not matching the claimed hash' },
  ]);

  // Импорт не падает целиком - несовпавший файл просто не попадает в проект.
  const imported = await importProjectFromZip(baseDir, archivePath);
  const importedContent = loadProjectData(baseDir, imported.id);
  assert.equal(importedContent.media.length, 0);
});

test('rejects an entry whose declared uncompressedSize exceeds the per-file limit', async () => {
  const baseDir = tmpBaseDir();
  const archivePath = await writeRawZip([
    { name: 'manifest.json', content: JSON.stringify({ formatVersion: ARCHIVE_FORMAT_VERSION }) },
    { name: 'content.json', content: 'x'.repeat(200) }, // валидным content.json не является, но до парсинга JSON лимит уже отсекает
  ]);

  await assert.rejects(() => importProjectFromZip(baseDir, archivePath, { maxEntryBytes: 50 }), ArchiveError);
});

test('rejects an archive whose total uncompressed size exceeds the aggregate limit', async () => {
  const baseDir = tmpBaseDir();
  const archivePath = await writeRawZip([
    { name: 'manifest.json', content: JSON.stringify({ formatVersion: ARCHIVE_FORMAT_VERSION }) },
    { name: 'content.json', content: JSON.stringify(minimalProject()) },
    { name: `media/${'a'.repeat(64)}.jpg`, content: 'x'.repeat(80) },
  ]);

  await assert.rejects(() => importProjectFromZip(baseDir, archivePath, { maxEntryBytes: 1000, maxTotalBytes: 100 }), ArchiveError);
});

test('rejects an archive with more entries than the entry-count limit', async () => {
  const baseDir = tmpBaseDir();
  const entries = [
    { name: 'manifest.json', content: JSON.stringify({ formatVersion: ARCHIVE_FORMAT_VERSION }) },
    { name: 'content.json', content: JSON.stringify(minimalProject()) },
  ];
  for (let i = 0; i < 10; i++) {
    entries.push({ name: `media/${i.toString().padStart(64, '0')}.jpg`, content: 'x' });
  }
  const archivePath = await writeRawZip(entries);

  await assert.rejects(() => importProjectFromZip(baseDir, archivePath, { maxEntryCount: 5 }), ArchiveError);
});

test('does not leave an orphaned project directory behind when import fails partway through', async () => {
  const baseDir = tmpBaseDir();
  // content.json валиден (проходит parseChronoProject), но архив после
  // этого содержит запись, которая ловится только при подсчёте суммарного
  // размера - т.е. отказ происходит ДО createProject (лимиты проверяются
  // на этапе collectEntries, раньше самого createProject).
  const archivePath = await writeRawZip([
    { name: 'manifest.json', content: JSON.stringify({ formatVersion: ARCHIVE_FORMAT_VERSION }) },
    { name: 'content.json', content: JSON.stringify(minimalProject()) },
    { name: `media/${'b'.repeat(64)}.jpg`, content: 'x'.repeat(80) },
  ]);

  await assert.rejects(() => importProjectFromZip(baseDir, archivePath, { maxEntryBytes: 1000, maxTotalBytes: 50 }));
  assert.equal(listProjects(baseDir).length, 0);
});

function minimalProject() {
  const now = new Date().toISOString();
  return { schemaVersion: 1, id: 'ignored-replaced-on-import', name: 'Минимальный', timelines: [], media: [], createdAt: now, updatedAt: now };
}
