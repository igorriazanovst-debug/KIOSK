// Тесты локального пароля админрежима автономных сборок (AAA).
// Все пароли ниже — синтетика #пдн-ок.
const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_ADMIN_PASSWORD, localAdminPasswordFromFile, verifyLocalAdminPassword } = require('./localAdmin.js');

test('localAdminPasswordFromFile: нет файла → null (будет пароль по умолчанию)', () => {
  // Arrange
  const exists = () => false;
  // Act
  const v = localAdminPasswordFromFile('/res', exists, () => '');
  // Assert
  assert.equal(v, null);
});

test('localAdminPasswordFromFile: файл с паролем и переводом строки → чистое значение', () => {
  // Arrange
  const files = { '/res/admin.password': 'S3cret!\n' };
  const exists = (p) => p in files;
  const read = (p) => files[p];
  // Act
  const v = localAdminPasswordFromFile('/res', exists, read);
  // Assert
  assert.equal(v, 'S3cret!');
});

test('verifyLocalAdminPassword: файл есть — сверяется с файлом, не с умолчанием', () => {
  // Arrange
  const files = { '/res/admin.password': 'custom-pass' };
  const deps = { existsSync: (p) => p in files, readFileSync: (p) => files[p] };
  // Act + Assert
  assert.equal(verifyLocalAdminPassword('custom-pass', '/res', deps), true);
  assert.equal(verifyLocalAdminPassword(DEFAULT_ADMIN_PASSWORD, '/res', deps), false);
});

test('verifyLocalAdminPassword: файла нет — работает пароль по умолчанию из инструкции', () => {
  // Arrange
  const deps = { existsSync: () => false, readFileSync: () => '' };
  // Act + Assert
  assert.equal(verifyLocalAdminPassword('admin', '/res', deps), true);
  assert.equal(verifyLocalAdminPassword('wrong', '/res', deps), false);
});

test('verifyLocalAdminPassword: пустой файл → пароль по умолчанию', () => {
  // Arrange
  const files = { '/res/admin.password': '   \n' };
  const deps = { existsSync: (p) => p in files, readFileSync: (p) => files[p] };
  // Act + Assert
  assert.equal(verifyLocalAdminPassword('admin', '/res', deps), true);
});
