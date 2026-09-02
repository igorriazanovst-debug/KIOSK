import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mediaFileExtension, mediaDiskFileName } from './media';

test('mediaFileExtension returns the extension with a leading dot, lowercased', () => {
  assert.equal(mediaFileExtension('photo.JPG'), '.jpg');
  assert.equal(mediaFileExtension('clip.mp4'), '.mp4');
});

test('mediaFileExtension returns empty string for a file with no extension', () => {
  assert.equal(mediaFileExtension('README'), '');
});

test('mediaFileExtension treats a dotfile with no extension as having no extension (matches Node path.extname)', () => {
  assert.equal(mediaFileExtension('.gitignore'), '');
});

test('mediaFileExtension handles multiple dots by taking only the last segment', () => {
  assert.equal(mediaFileExtension('archive.tar.gz'), '.gz');
});

test('mediaDiskFileName combines sha256 and the extension of the original filename', () => {
  const media = { sha256: 'abc123', fileName: 'Photo.PNG' };
  assert.equal(mediaDiskFileName(media), 'abc123.png');
});

test('mediaDiskFileName is identical for two records with the same sha256 regardless of original filename casing/name', () => {
  const a = mediaDiskFileName({ sha256: 'deadbeef', fileName: 'a.jpg' });
  const b = mediaDiskFileName({ sha256: 'deadbeef', fileName: 'totally-different-name.JPG' });
  assert.equal(a, b);
});
