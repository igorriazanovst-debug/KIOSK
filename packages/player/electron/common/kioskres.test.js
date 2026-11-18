// Тесты разрешения путей kioskres:// (AAA).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { resolveKioskresPath, guessMime } = require('./kioskres.js');

test('resolveKioskresPath: обычное имя — файл внутри root', () => {
  // Arrange
  const root = path.join(path.sep, 'opt', 'Музей ВОВ', 'resources', 'museum-media');
  // Act
  const p = resolveKioskresPath('kioskres://m001.jpg', root);
  // Assert
  assert.equal(p, path.join(root, 'm001.jpg'));
});

test('resolveKioskresPath: имя с пробелами/процентами — декодируется', () => {
  // Arrange
  const root = '/r';
  // Act
  const p = resolveKioskresPath('kioskres://video%20parade.mp4', root);
  // Assert
  assert.equal(p, path.join('/r', 'video parade.mp4'));
});

test('resolveKioskresPath: обход каталогов пресекается', () => {
  // Arrange
  const root = '/r';
  // Act + Assert
  assert.equal(resolveKioskresPath('kioskres://..%2F..%2Fetc%2Fpasswd', root), null);
  assert.equal(resolveKioskresPath('kioskres:///../../x', root), null);
});

test('resolveKioskresPath: пустое имя и битный URL — null', () => {
  // Arrange
  const root = '/r';
  // Act + Assert
  assert.equal(resolveKioskresPath('kioskres://', root), null);
  assert.equal(resolveKioskresPath('kioskres://%zz', root), null);
  assert.equal(resolveKioskresPath('kioskres://a.jpg', ''), null);
});

test('guessMime: расширения медиа', () => {
  // Arrange + Act + Assert
  assert.equal(guessMime('a.jpg'), 'image/jpeg');
  assert.equal(guessMime('a.PNG'), 'image/png');
  assert.equal(guessMime('a.mp3'), 'audio/mpeg');
  assert.equal(guessMime('a.mp4'), 'video/mp4');
  assert.equal(guessMime('a.bin'), 'application/octet-stream');
});
