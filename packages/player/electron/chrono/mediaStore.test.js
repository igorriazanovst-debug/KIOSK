import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  importMedia,
  mediaFilePath,
  diskFileName,
  deleteMediaFile,
  sweepOrphanedTmpFiles,
  MediaImportError,
  MAX_IMPORT_SIZE_BYTES,
} from './mediaStore.js';
import { createProject, projectsRoot } from './projectStore.js';
import { PathGuardError } from './pathGuard.js';

function tmpBaseDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'chrono-media-'));
}

function tmpSourceFile(name, content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrono-media-src-'));
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, content);
  return filePath;
}

test('importMedia copies the file into the project media dir and returns matching metadata', () => {
  const baseDir = tmpBaseDir();
  const project = createProject(baseDir, 'Проект');
  const source = tmpSourceFile('photo.jpg', 'fake jpeg bytes');

  const media = importMedia(baseDir, project.id, source);

  assert.equal(media.fileName, 'photo.jpg');
  assert.equal(media.mimeType, 'image/jpeg');
  assert.equal(media.fileSize, Buffer.byteLength('fake jpeg bytes'));
  assert.equal(media.sha256.length, 64, 'sha256 hex digest is 64 chars');
  assert.ok(fs.existsSync(mediaFilePath(baseDir, project.id, media)));
});

test('deleteMediaFile removes the file on disk', () => {
  const baseDir = tmpBaseDir();
  const project = createProject(baseDir, 'Проект');
  const media = importMedia(baseDir, project.id, tmpSourceFile('photo.jpg', 'fake jpeg bytes'));
  const filePath = mediaFilePath(baseDir, project.id, media);
  assert.ok(fs.existsSync(filePath));

  deleteMediaFile(baseDir, project.id, media);
  assert.equal(fs.existsSync(filePath), false);
});

test('deleteMediaFile on an already-missing file does not throw', () => {
  const baseDir = tmpBaseDir();
  const project = createProject(baseDir, 'Проект');
  assert.doesNotThrow(() =>
    deleteMediaFile(baseDir, project.id, { sha256: 'a'.repeat(64), fileName: 'never-imported.jpg' })
  );
});

test('importing the exact same content twice does not duplicate the file on disk (dedup by sha256)', () => {
  const baseDir = tmpBaseDir();
  const project = createProject(baseDir, 'Проект');
  const source = tmpSourceFile('a.jpg', 'identical content');
  const source2 = tmpSourceFile('a-renamed.jpg', 'identical content');

  const first = importMedia(baseDir, project.id, source);
  const second = importMedia(baseDir, project.id, source2);

  assert.equal(first.sha256, second.sha256);
  assert.equal(diskFileName(first), diskFileName(second), 'same content -> same on-disk filename regardless of original name');
  assert.equal(mediaFilePath(baseDir, project.id, first), mediaFilePath(baseDir, project.id, second));
});

test('importing different content with the same original filename does not collide', () => {
  const baseDir = tmpBaseDir();
  const project = createProject(baseDir, 'Проект');
  const source = tmpSourceFile('photo.jpg', 'content A');

  const first = importMedia(baseDir, project.id, source);

  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'chrono-media-src2-'));
  const source2 = path.join(dir2, 'photo.jpg');
  fs.writeFileSync(source2, 'content B - totally different');
  const second = importMedia(baseDir, project.id, source2);

  assert.notEqual(first.sha256, second.sha256);
  assert.notEqual(mediaFilePath(baseDir, project.id, first), mediaFilePath(baseDir, project.id, second));
  assert.ok(fs.existsSync(mediaFilePath(baseDir, project.id, first)));
  assert.ok(fs.existsSync(mediaFilePath(baseDir, project.id, second)));
});

test('mimeType is guessed from the file extension for common image/audio/video types', () => {
  const baseDir = tmpBaseDir();
  const project = createProject(baseDir, 'Проект');

  const png = importMedia(baseDir, project.id, tmpSourceFile('x.png', 'png'));
  const mp4 = importMedia(baseDir, project.id, tmpSourceFile('x.mp4', 'mp4'));
  const mp3 = importMedia(baseDir, project.id, tmpSourceFile('x.mp3', 'mp3'));

  assert.equal(png.mimeType, 'image/png');
  assert.equal(mp4.mimeType, 'video/mp4');
  assert.equal(mp3.mimeType, 'audio/mpeg');
});

test('importMedia rejects a file with an unrecognized/disallowed extension (import channel receives an arbitrary renderer-supplied path, not just dialog picks)', () => {
  const baseDir = tmpBaseDir();
  const project = createProject(baseDir, 'Проект');
  const source = tmpSourceFile('secret.exe', 'not a media file');

  assert.throws(() => importMedia(baseDir, project.id, source), MediaImportError);
});

test('importMedia rejects a file with no extension at all', () => {
  const baseDir = tmpBaseDir();
  const project = createProject(baseDir, 'Проект');
  const source = tmpSourceFile('noext', 'x');

  assert.throws(() => importMedia(baseDir, project.id, source), MediaImportError);
});

test('importMedia rejects a file larger than MAX_IMPORT_SIZE_BYTES, without copying it', () => {
  const baseDir = tmpBaseDir();
  const project = createProject(baseDir, 'Проект');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrono-media-big-'));
  const source = path.join(dir, 'huge.jpg');
  // Sparse file - avoid actually writing 500MB+1 of real bytes to disk for the test.
  const fd = fs.openSync(source, 'w');
  fs.writeSync(fd, Buffer.from('x'), 0, 1, MAX_IMPORT_SIZE_BYTES);
  fs.closeSync(fd);

  assert.throws(() => importMedia(baseDir, project.id, source), MediaImportError);
});

test('importMedia rejects a projectId that attempts path traversal', () => {
  const baseDir = tmpBaseDir();
  const source = tmpSourceFile('x.jpg', 'x');
  assert.throws(() => importMedia(baseDir, '../../etc', source), PathGuardError);
});

test('mediaFilePath rejects a projectId that attempts path traversal, same as importMedia', () => {
  const baseDir = tmpBaseDir();
  assert.throws(
    () => mediaFilePath(baseDir, '../../etc', { sha256: 'a'.repeat(64), fileName: 'x.jpg' }),
    PathGuardError
  );
});

// ─── sweepOrphanedTmpFiles ─────────────────────────────────────────────

test('sweepOrphanedTmpFiles removes a leftover .tmp-* file from a crashed import', () => {
  const baseDir = tmpBaseDir();
  const project = createProject(baseDir, 'Проект');
  const dir = path.join(projectsRoot(baseDir), project.id, 'media');
  const orphan = path.join(dir, 'deadbeef.jpg.tmp-1234-5678-abcd');
  fs.writeFileSync(orphan, 'half-copied');

  const removed = sweepOrphanedTmpFiles(baseDir);

  assert.equal(removed, 1);
  assert.equal(fs.existsSync(orphan), false);
});

test('sweepOrphanedTmpFiles leaves real (non-tmp) media files untouched', () => {
  const baseDir = tmpBaseDir();
  const project = createProject(baseDir, 'Проект');
  const source = tmpSourceFile('real.jpg', 'real content');
  const imported = importMedia(baseDir, project.id, source);

  sweepOrphanedTmpFiles(baseDir);

  assert.ok(fs.existsSync(mediaFilePath(baseDir, project.id, imported)));
});

test('sweepOrphanedTmpFiles on a baseDir with no projects at all does not throw', () => {
  const baseDir = tmpBaseDir();
  assert.doesNotThrow(() => sweepOrphanedTmpFiles(baseDir));
});
