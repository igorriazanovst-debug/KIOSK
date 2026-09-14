// packages/player/electron/inophone/profileStore.test.js
//
// Тесты идут на НАСТОЯЩЕМ временном каталоге, а не на заглушке файловой
// системы: проверяется в том числе поведение при повреждённом файле, а
// заглушка повреждение подделывает и потому ничего не доказывает.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const store = require('./profileStore');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'inophone-test-'));
}

test('пустой каталог даёт пустой список профилей', () => {
  const dir = tempDir();
  assert.deepEqual(store.listProfiles(dir), []);
});

test('профиль создаётся и переживает повторное чтение', () => {
  const dir = tempDir();
  const after = store.createProfile(dir, 'Аня');
  assert.equal(after.length, 1);
  assert.equal(after[0].name, 'Аня');
  assert.deepEqual(store.listProfiles(dir), after);
});

test('пустое имя отвергается', () => {
  const dir = tempDir();
  assert.throws(() => store.createProfile(dir, '   '), store.WordsRulesError);
});

test('ПОВРЕЖДЁННЫЙ файл профилей — ошибка, а не пустой список', () => {
  // Молча начать с нуля значило бы показать педагогу потерю работы детей
  const dir = tempDir();
  store.createProfile(dir, 'Аня');
  fs.writeFileSync(path.join(dir, 'profiles.json'), '{ это не json', 'utf8');
  assert.throws(() => store.listProfiles(dir), store.InophoneStoreError);
});

test('повреждённые НАСТРОЙКИ дают значения по умолчанию', () => {
  // Строгость намеренно обратная профилям: приложение, не открывающееся из-за
  // битого файла настроек, срывает занятие целиком
  const dir = tempDir();
  fs.writeFileSync(path.join(dir, 'settings.json'), 'не json', 'utf8');
  const s = store.readSettings(dir);
  assert.equal(s.interfaceLanguage, 'ru');
  assert.ok(s.studyLanguages.length >= 1);
});

test('настройки сохраняются и читаются обратно', () => {
  const dir = tempDir();
  const saved = store.saveSettings(dir, {
    schemaVersion: 1,
    interfaceLanguage: 'ru',
    studyLanguages: ['en', 'de'],
    volume: 55,
  });
  assert.equal(saved.volume, 55);
  assert.deepEqual(store.readSettings(dir).studyLanguages, ['en', 'de']);
});

test('удаление профиля уносит и его статистику', () => {
  // Иначе новый профиль с тем же именем однажды получил бы чужие результаты
  const dir = tempDir();
  const [p] = store.createProfile(dir, 'Аня');
  store.recordSession(dir, p.id, 'bedroom', { en: [2, 3] });
  assert.ok(store.readStatistics(dir)[p.id], 'статистика записалась');

  store.deleteProfile(dir, p.id);
  assert.deepEqual(store.listProfiles(dir), []);
  assert.ok(!store.readStatistics(dir)[p.id], 'статистика ушла вместе с профилем');
});

test('итог партии накапливается по сценам и языкам', () => {
  const dir = tempDir();
  const [p] = store.createProfile(dir, 'Миша');
  store.recordSession(dir, p.id, 'bedroom', { en: [3, 4] });
  const stats = store.recordSession(dir, p.id, 'bedroom', { en: [1, 4] });
  assert.deepEqual(stats[p.id].byScene.bedroom.lastSession, [1, 4]);
  assert.deepEqual(stats[p.id].byScene.bedroom.total, [4, 8]);
  assert.deepEqual(stats[p.id].byLanguage.en.total, [4, 8]);
});

test('очистка статистики не трогает профиль', () => {
  const dir = tempDir();
  const [p] = store.createProfile(dir, 'Катя');
  store.recordSession(dir, p.id, 'city', { fr: [1, 1] });
  store.clearStatistics(dir, p.id);
  assert.ok(!store.readStatistics(dir)[p.id]);
  assert.equal(store.listProfiles(dir).length, 1, 'сам профиль остался');
});

test('запись переживает обрыв: временный файл не остаётся видимым', () => {
  // atomicWriteJson пишет во временный файл и переименовывает; каталог после
  // записи обязан содержать только сам файл
  const dir = tempDir();
  store.createProfile(dir, 'Аня');
  const files = fs.readdirSync(dir);
  assert.deepEqual(files, ['profiles.json'], `в каталоге лишнее: ${files.join(', ')}`);
});
