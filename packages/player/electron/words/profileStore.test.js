// packages/player/electron/words/profileStore.test.js
// Тесты локального хранилища виджета «Я знаю много слов». Работают на
// временном каталоге, без Electron — тот же приём, что у chrono/natcom.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const store = require('./profileStore');
// Правила общие для Windows и Android и живут в @kiosk/shared: их нарушение —
// WordsRulesError. WordsStoreError остаётся за поломками самого хранилища.
const { WordsRulesError } = require('@kiosk/shared');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'kiosk-words-test-'));
}

test('на свежем устройстве список игроков пуст, а не падает', () => {
  const dir = tempDir();
  assert.deepEqual(store.listProfiles(dir), []);
});

test('созданный игрок переживает перезапуск (читается с диска заново)', () => {
  const dir = tempDir();
  const created = store.createProfile(dir, 'Аня');
  const reread = store.listProfiles(dir);
  assert.equal(reread.length, 1);
  assert.equal(reread[0].id, created.id);
  assert.equal(reread[0].name, 'Аня');
});

test('имя игрока обрезается по краям, пустое имя отклоняется', () => {
  const dir = tempDir();
  assert.equal(store.createProfile(dir, '  Боря  ').name, 'Боря');
  assert.throws(() => store.createProfile(dir, '   '), WordsRulesError);
  assert.throws(() => store.createProfile(dir, ''), WordsRulesError);
});

test('двух игроков с одинаковым именем завести нельзя', () => {
  const dir = tempDir();
  store.createProfile(dir, 'Вика');
  assert.throws(() => store.createProfile(dir, 'вика'), WordsRulesError);
});

test('слишком длинное имя отклоняется', () => {
  const dir = tempDir();
  assert.throws(() => store.createProfile(dir, 'я'.repeat(41)), WordsRulesError);
});

test('четыре игрока за столом создаются и читаются в порядке добавления', () => {
  // Сценарий приёмки строки 54 ТЗ: рассадка на четверых
  const dir = tempDir();
  for (const name of ['Аня', 'Боря', 'Вика', 'Гриша']) store.createProfile(dir, name);
  assert.deepEqual(
    store.listProfiles(dir).map((p) => p.name),
    ['Аня', 'Боря', 'Вика', 'Гриша'],
  );
});

test('удаление игрока убирает и его достижения', () => {
  const dir = tempDir();
  const anya = store.createProfile(dir, 'Аня');
  const borya = store.createProfile(dir, 'Боря');
  store.saveScore(dir, anya.id, 'digits', 'gold');
  store.saveScore(dir, borya.id, 'digits', 'silver');

  store.deleteProfile(dir, anya.id);

  assert.deepEqual(
    store.listProfiles(dir).map((p) => p.name),
    ['Боря'],
  );
  const scores = store.readScores(dir);
  assert.equal(scores[anya.id], undefined, 'осиротевших достижений не остаётся');
  assert.equal(scores[borya.id].digits, 'silver');
});

test('удаление несуществующего игрока — явная ошибка, а не тихий успех', () => {
  const dir = tempDir();
  assert.throws(() => store.deleteProfile(dir, 'нет-такого'), WordsRulesError);
});

test('повреждённый файл профилей — ошибка, а не «список пуст»', () => {
  // Молча обнулившийся список для педагога выглядит как потеря работы детей
  const dir = tempDir();
  store.createProfile(dir, 'Аня');
  fs.writeFileSync(path.join(dir, store.PROFILES_FILE), '{ это не json', 'utf8');
  assert.throws(() => store.listProfiles(dir), store.WordsStoreError);
});

test('битая запись внутри списка отбрасывается, остальные игроки выживают', () => {
  const dir = tempDir();
  fs.writeFileSync(
    path.join(dir, store.PROFILES_FILE),
    JSON.stringify([{ id: 'a', name: 'Аня', createdAt: 'x' }, { id: 42 }, null]),
    'utf8',
  );
  assert.deepEqual(
    store.listProfiles(dir).map((p) => p.name),
    ['Аня'],
  );
});

test('запись атомарная: временный файл не остаётся в каталоге', () => {
  const dir = tempDir();
  store.createProfile(dir, 'Аня');
  store.writeSettings(dir, { ...store.DEFAULT_SETTINGS, volume: 30 });
  const leftovers = fs.readdirSync(dir).filter((f) => f.includes('.tmp-'));
  assert.deepEqual(leftovers, []);
});

test('настройки: без файла отдаются дефолты, после записи — сохранённые', () => {
  const dir = tempDir();
  assert.equal(store.readSettings(dir).volume, 70);
  store.writeSettings(dir, { ...store.DEFAULT_SETTINGS, volume: 25, device: 'table' });
  const settings = store.readSettings(dir);
  assert.equal(settings.volume, 25);
  assert.equal(settings.device, 'table');
});

test('настройки старой версии дополняются дефолтами недостающих полей', () => {
  const dir = tempDir();
  fs.writeFileSync(path.join(dir, store.SETTINGS_FILE), JSON.stringify({ volume: 10 }), 'utf8');
  const settings = store.readSettings(dir);
  assert.equal(settings.volume, 10);
  assert.equal(settings.device, 'board');
  assert.deepEqual(settings.levelOverrides, {});
});

test('достижение сохраняется и повышается', () => {
  const dir = tempDir();
  assert.deepEqual(store.saveScore(dir, 'p1', 'digits', 'wooden'), { changed: true, tier: 'wooden' });
  assert.deepEqual(store.saveScore(dir, 'p1', 'digits', 'gold'), { changed: true, tier: 'gold' });
  assert.equal(store.readScores(dir).p1.digits, 'gold');
});

test('понизить ступень нельзя даже прямым вызовом хранилища', () => {
  // Монотонность обеспечивается на уровне диска, а не только в интерфейсе
  const dir = tempDir();
  store.saveScore(dir, 'p1', 'digits', 'gold');
  assert.deepEqual(store.saveScore(dir, 'p1', 'digits', 'wooden'), { changed: false, tier: 'gold' });
  assert.equal(store.readScores(dir).p1.digits, 'gold');
});

test('достижения разных тем и разных игроков не смешиваются', () => {
  const dir = tempDir();
  store.saveScore(dir, 'p1', 'digits', 'gold');
  store.saveScore(dir, 'p1', 'pets', 'wooden');
  store.saveScore(dir, 'p2', 'digits', 'silver');
  const scores = store.readScores(dir);
  assert.equal(scores.p1.digits, 'gold');
  assert.equal(scores.p1.pets, 'wooden');
  assert.equal(scores.p2.digits, 'silver');
});

test('неизвестная ступень отклоняется', () => {
  const dir = tempDir();
  assert.throws(() => store.saveScore(dir, 'p1', 'digits', 'platinum'), WordsRulesError);
});

test('повреждённый файл достижений — ошибка, а не пустой объект', () => {
  const dir = tempDir();
  fs.writeFileSync(path.join(dir, store.SCORES_FILE), '[]', 'utf8');
  assert.throws(() => store.readScores(dir), store.WordsStoreError);
});

test('каталог создаётся сам, если его ещё нет', () => {
  const dir = path.join(tempDir(), 'вложенный', 'каталог');
  assert.equal(fs.existsSync(dir), false);
  store.createProfile(dir, 'Аня');
  assert.equal(store.listProfiles(dir).length, 1);
});
