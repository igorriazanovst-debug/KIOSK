// Тесты пути сохранения скачиваний (AAA).
const test = require('node:test');
const assert = require('node:assert');
const { uniqueDownloadPath } = require('./downloads.js');

test('uniqueDownloadPath: свободное имя — путь как есть', () => {
  // Arrange
  const exists = () => false;
  // Act
  const p = uniqueDownloadPath('/home/u/Загрузки', 'итоги-группы.csv', exists);
  // Assert
  assert.strictEqual(p, '/home/u/Загрузки/итоги-группы.csv');
});

test('uniqueDownloadPath: коллизия — суффикс (1)', () => {
  // Arrange
  const exists = (p) => p === '/dl/итоги-группы.csv';
  // Act
  const p = uniqueDownloadPath('/dl', 'итоги-группы.csv', exists);
  // Assert
  assert.strictEqual(p, '/dl/итоги-группы (1).csv');
});

test('uniqueDownloadPath: серия коллизий — следующий свободный', () => {
  // Arrange
  const taken = new Set(['/dl/a.csv', '/dl/a (1).csv', '/dl/a (2).csv']);
  const exists = (p) => taken.has(p);
  // Act
  const p = uniqueDownloadPath('/dl', 'a.csv', exists);
  // Assert
  assert.strictEqual(p, '/dl/a (3).csv');
});

test('uniqueDownloadPath: разделители пути в имени зачищаются (обход каталогов невозможен)', () => {
  // Arrange
  const exists = () => false;
  // Act
  const p = uniqueDownloadPath('/dl', '..\\..\\etc\\итоги.csv', exists);
  // Assert: все сепараторы заменены — итог состоит ровно из /dl + одного
  // имени файла, выйти из каталога загрузок нельзя.
  const parts = p.split(require('node:path').sep).filter(Boolean);
  assert.strictEqual(parts.length, 2, 'ровно каталог + одно имя файла: ' + p);
  assert.strictEqual(parts[0], 'dl');
  assert.ok(!/[\\/]/.test(parts[1]), 'в имени файла нет сепараторов');
});

test('uniqueDownloadPath: пустое имя — заглушка download', () => {
  // Arrange
  const exists = () => false;
  // Act
  const p = uniqueDownloadPath('/dl', '', exists);
  // Assert
  assert.strictEqual(p, '/dl/download');
});
