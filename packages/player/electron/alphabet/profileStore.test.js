// packages/player/electron/alphabet/profileStore.test.js
// Тесты локального хранилища виджета «АзбукоСлов». Работают на временном
// каталоге, без Electron — тот же приём, что у chrono/natcom/words.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const store = require('./profileStore');
const { WordsRulesError, alphabet } = require('@kiosk/shared');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'kiosk-alphabet-test-'));
}

// ─── Профили ────────────────────────────────────────────────────────────

test('на свежем устройстве список игроков пуст, а не падает', () => {
  assert.deepEqual(store.listProfiles(tempDir()), []);
});

test('созданный игрок переживает перезапуск', () => {
  const dir = tempDir();
  const created = store.createProfile(dir, 'Аня');
  const reread = store.listProfiles(dir);
  assert.equal(reread.length, 1);
  assert.equal(reread[0].id, created.id);
  assert.equal(reread[0].name, 'Аня');
});

test('правила имени — те же, что у виджета «слов»', () => {
  // Не срезание угла: «профиль ребёнка на устройстве» у Тип 2 и Тип 3 —
  // буквально одно понятие с одними ограничениями
  const dir = tempDir();
  assert.equal(store.createProfile(dir, '  Боря  ').name, 'Боря');
  assert.throws(() => store.createProfile(dir, '   '), WordsRulesError);
});

test('повреждённый файл профилей — ошибка, а не «список пуст»', () => {
  // Молча обнулившийся список для педагога выглядит как потеря работы детей
  const dir = tempDir();
  store.createProfile(dir, 'Аня');
  fs.writeFileSync(path.join(dir, store.PROFILES_FILE), '{ это не json');
  assert.throws(() => store.listProfiles(dir), store.AlphabetStoreError);
});

test('удаление игрока уносит и его статистику', () => {
  const dir = tempDir();
  const anya = store.createProfile(dir, 'Аня');
  const borya = store.createProfile(dir, 'Боря');
  store.saveSessionStatistics(dir, anya.id, [{ letterNumber: 1, correct: true }]);
  store.saveSessionStatistics(dir, borya.id, [{ letterNumber: 2, correct: false }]);

  store.deleteProfile(dir, anya.id);
  const statistics = store.readStatistics(dir);
  assert.equal(statistics[anya.id], undefined, 'новый игрок с тем же именем не унаследует график');
  assert.ok(statistics[borya.id], 'чужая статистика не тронута');
});

test('удаление несуществующего игрока — ошибка правил', () => {
  assert.throws(() => store.deleteProfile(tempDir(), 'нет-такого'), WordsRulesError);
});

// ─── Настройки ──────────────────────────────────────────────────────────

test('настройки на свежем устройстве — дефолт, а не ошибка', () => {
  assert.deepEqual(store.readSettings(tempDir()), alphabet.DEFAULT_ALPHABET_SETTINGS);
});

test('сохранённые настройки читаются обратно', () => {
  const dir = tempDir();
  store.writeSettings(dir, { volume: 40, questionCount: 20, device: 'tablet' });
  const read = store.readSettings(dir);
  assert.equal(read.volume, 40);
  assert.equal(read.questionCount, 20);
  assert.equal(read.device, 'tablet');
});

test('мусор в настройках на диск не попадает', () => {
  const dir = tempDir();
  assert.throws(() => store.writeSettings(dir, { volume: 500 }));
  assert.throws(() => store.writeSettings(dir, { questionCount: 7 }));
});

test('повреждённые настройки дают дефолт, в отличие от профилей', () => {
  // Потерянная громкость восстанавливается за пять секунд, потерянный
  // список детей — нет; поэтому строгость тут разная осознанно
  const dir = tempDir();
  store.writeSettings(dir, { volume: 40 });
  fs.writeFileSync(path.join(dir, store.SETTINGS_FILE), '{ битый');
  assert.deepEqual(store.readSettings(dir), alphabet.DEFAULT_ALPHABET_SETTINGS);
});

test('настройки с чужой версией схемы откатываются к дефолту', () => {
  const dir = tempDir();
  fs.writeFileSync(
    path.join(dir, store.SETTINGS_FILE),
    JSON.stringify({ schemaVersion: 99, volume: 40, device: 'board', questionCount: 10 })
  );
  assert.deepEqual(store.readSettings(dir), alphabet.DEFAULT_ALPHABET_SETTINGS);
});

// ─── Статистика ─────────────────────────────────────────────────────────

test('статистика копится между партиями, сессия при этом замещается', () => {
  const dir = tempDir();
  const anya = store.createProfile(dir, 'Аня');
  store.saveSessionStatistics(dir, anya.id, [
    { letterNumber: 1, correct: true },
    { letterNumber: 1, correct: false },
  ]);
  const after = store.saveSessionStatistics(dir, anya.id, [{ letterNumber: 1, correct: true }]);
  assert.deepEqual(after['1'], { lastSession: [1, 1], total: [2, 3] });
});

test('статистика переживает перезапуск', () => {
  const dir = tempDir();
  const anya = store.createProfile(dir, 'Аня');
  store.saveSessionStatistics(dir, anya.id, [{ letterNumber: 5, correct: true }]);
  assert.deepEqual(store.readStatistics(dir)[anya.id]['5'], {
    lastSession: [1, 1],
    total: [1, 1],
  });
});

test('битая запись по одной букве не уносит остальные', () => {
  const dir = tempDir();
  fs.writeFileSync(
    path.join(dir, store.STATISTICS_FILE),
    JSON.stringify({
      u1: {
        1: { lastSession: [1, 2], total: [3, 4] },
        2: { lastSession: 'сломано', total: [1, 1] },
      },
    })
  );
  const statistics = store.readStatistics(dir);
  assert.deepEqual(Object.keys(statistics.u1), ['1']);
});

test('очистка статистики не трогает профили', () => {
  const dir = tempDir();
  const anya = store.createProfile(dir, 'Аня');
  store.saveSessionStatistics(dir, anya.id, [{ letterNumber: 1, correct: true }]);
  store.clearStatistics(dir, anya.id);
  assert.equal(store.readStatistics(dir)[anya.id], undefined);
  assert.equal(store.listProfiles(dir).length, 1);
});
