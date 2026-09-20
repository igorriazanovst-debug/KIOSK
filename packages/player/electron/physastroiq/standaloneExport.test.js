// packages/player/electron/physastroiq/standaloneExport.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const {
  STANDALONE_DIR, PLAYER_FILE_NAME, BUILTIN_FILES, quizToWorkbookBuffer, exportStandalone, readWorkbookRows,
} = require('./standaloneExport.js');

const REPO_PACKAGES = path.join(__dirname, '..', '..', '..');
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'kiosk-standalone-'));

const quiz = (over = {}) => ({
  id: 'q-1', title: 'Оптика, 8 класс', intro: 'Проверочная викторина',
  questions: [
    { id: 'a', text: 'Что собирает лучи в точку?', answer: 'Собирающая линза', helpText: 'Она толще в середине.', level: 3, theme: 'Линзы', price: 170, timeSeconds: 25, x: 1, y: 2 },
    { id: 'b', text: 'Что разлагает свет в спектр?', answer: 'Призма', helpText: '', level: 3, theme: 'Дисперсия', price: 150, timeSeconds: 20 },
  ],
  ...over,
});

test('поставка рядом с кодом: проигрыватель, библиотека, лицензия и оба готовых банка на месте', () => {
  for (const name of [PLAYER_FILE_NAME, 'xlsx.mini.min.js', 'LICENSE-xlsx.txt', ...Object.values(BUILTIN_FILES)]) {
    const file = path.join(STANDALONE_DIR, name);
    assert.ok(fs.existsSync(file) && fs.statSync(file).size > 1000, name);
  }
});

test('вшитые копии совпадают с источником в packages/quiz-mini-player — иначе в поставку уйдёт устаревший проигрыватель', () => {
  const release = path.join(REPO_PACKAGES, 'quiz-mini-player', 'release');
  for (const name of [PLAYER_FILE_NAME, ...Object.values(BUILTIN_FILES)]) {
    assert.equal(sha(path.join(STANDALONE_DIR, name)), sha(path.join(release, name)), name);
  }
});

test('викторина педагога превращается в таблицу того формата, который читает проигрыватель', () => {
  const rows = readWorkbookRows(quizToWorkbookBuffer(quiz()));
  assert.deepEqual(rows.questions[0], ['№', 'Уровень', 'Тема', 'Вопрос', 'Ответ', 'Неверный 1', 'Неверный 2', 'Неверный 3', 'Подсказка', 'Вес', 'Время, с']);
  assert.deepEqual(rows.questions[1], [1, 3, 'Линзы', 'Что собирает лучи в точку?', 'Собирающая линза', '', '', '', 'Она толще в середине.', 170, 25]);
  assert.equal(rows.questions.length, 3);
  assert.deepEqual(rows.about[0], ['Название', 'Оптика, 8 класс']);
  assert.deepEqual(rows.about[1], ['Описание', 'Проверочная викторина']);
});

test('в таблицу не попадает ничего, кроме текста: ни координат, ни картинок', () => {
  const withMedia = quiz();
  withMedia.questions[0].questionImage = 'secret.png';
  const flat = JSON.stringify(readWorkbookRows(quizToWorkbookBuffer(withMedia)));
  assert.ok(!flat.includes('secret.png'));
});

test('негодные данные от окна приложения отклоняются, а не записываются на диск', () => {
  assert.throws(() => quizToWorkbookBuffer(null), /викторин/i);
  assert.throws(() => quizToWorkbookBuffer({ title: 'x', questions: [] }), /нет вопросов/i);
  assert.throws(() => quizToWorkbookBuffer(quiz({ questions: [{ text: 'Без ответа?', level: 1 }] })), /вопрос 1/i);
  assert.throws(() => quizToWorkbookBuffer(quiz({ questions: [{ text: 'я'.repeat(600), answer: 'а', level: 1 }] })), /длинн/i);
  assert.throws(() => quizToWorkbookBuffer(quiz({ questions: new Array(2001).fill({ text: 'В?', answer: 'о', level: 1 }) })), /слишком много/i);
});

test('экспорт своей викторины кладёт рядом таблицу и проигрыватель', () => {
  const dir = tempDir();
  try {
    const target = path.join(dir, 'Оптика.xlsx');
    const result = exportStandalone({ targetPath: target, quiz: quiz() });
    assert.deepEqual(result, { ok: true, quizFile: target, playerFile: path.join(dir, PLAYER_FILE_NAME) });
    assert.equal(sha(result.playerFile), sha(path.join(STANDALONE_DIR, PLAYER_FILE_NAME)));
    assert.equal(readWorkbookRows(fs.readFileSync(target)).questions.length, 3);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('экспорт встроенной викторины отдаёт готовый текстовый банк, а не пересказ карты', () => {
  const dir = tempDir();
  try {
    const target = path.join(dir, 'астрономия.xlsx');
    const result = exportStandalone({ targetPath: target, builtinId: 'physastroiq-astronomy' });
    assert.equal(result.ok, true);
    assert.equal(sha(target), sha(path.join(STANDALONE_DIR, BUILTIN_FILES['physastroiq-astronomy'])));
    assert.equal(readWorkbookRows(fs.readFileSync(target)).questions.length, 391);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('вшитая библиотека — именно та версия, в которой закрыты известные уязвимости', () => {
  const { libraryVersion } = require('./standaloneExport.js');
  assert.equal(libraryVersion(), '0.20.3');
});

test('текст, похожий на формулу, остаётся текстом: Excel его не вычисляет', () => {
  const tricky = quiz({ questions: [{ text: '=1+1', answer: '@SUM(A1)', helpText: '+cmd|calc', theme: '-2+3', level: 1 }] });
  const row = readWorkbookRows(quizToWorkbookBuffer(tricky)).questions[1];
  assert.deepEqual([row[2], row[3], row[4], row[8]], ['-2+3', '=1+1', '@SUM(A1)', '+cmd|calc']);
  const X = require(path.join(STANDALONE_DIR, 'xlsx.mini.min.js'));
  const sheet = X.read(quizToWorkbookBuffer(tricky), { type: 'buffer' }).Sheets['Вопросы'];
  for (const cell of ['C2', 'D2', 'E2', 'I2']) {
    assert.equal(sheet[cell].t, 's', cell);
    assert.equal(sheet[cell].f, undefined, cell);
  }
});

test('чужой player.html в папке не затирается — проигрыватель ложится под другим именем', () => {
  const dir = tempDir();
  try {
    fs.writeFileSync(path.join(dir, PLAYER_FILE_NAME), 'чужой файл педагога');
    const result = exportStandalone({ targetPath: path.join(dir, 'Оптика.xlsx'), quiz: quiz() });
    assert.equal(fs.readFileSync(path.join(dir, PLAYER_FILE_NAME), 'utf8'), 'чужой файл педагога');
    assert.notEqual(result.playerFile, path.join(dir, PLAYER_FILE_NAME));
    assert.equal(sha(result.playerFile), sha(path.join(STANDALONE_DIR, PLAYER_FILE_NAME)));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('свой прежний player.html обновляется на месте, копии не плодятся', () => {
  const dir = tempDir();
  try {
    exportStandalone({ targetPath: path.join(dir, 'a.xlsx'), quiz: quiz() });
    const second = exportStandalone({ targetPath: path.join(dir, 'b.xlsx'), quiz: quiz() });
    assert.equal(second.playerFile, path.join(dir, PLAYER_FILE_NAME));
    assert.deepEqual(fs.readdirSync(dir).sort(), ['a.xlsx', 'b.xlsx', PLAYER_FILE_NAME].sort());
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('если таблицу записать не удалось, в папке не остаётся одинокого проигрывателя', () => {
  const dir = tempDir();
  try {
    // Каталог на месте файла: запись таблицы упадёт уже после записи проигрывателя
    const target = path.join(dir, 'Занято.xlsx');
    fs.mkdirSync(target);
    assert.throws(() => exportStandalone({ targetPath: target, quiz: quiz() }));
    assert.deepEqual(fs.readdirSync(dir), ['Занято.xlsx']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('зарезервированные имена устройств Windows не становятся именем файла', () => {
  const { sanitizeFileName } = require('./standaloneExport.js');
  for (const name of ['CON', 'nul', 'Com1', 'LPT9', 'aux.', 'PRN.txt']) {
    assert.ok(!/^(con|prn|aux|nul|com[1-9]|lpt[1-9])([.]|$)/i.test(sanitizeFileName(name)), name + ' → ' + sanitizeFileName(name));
  }
  assert.equal(sanitizeFileName('Контрольная'), 'Контрольная');
});

test('имя файла из окна приложения не может увести из выбранной папки', () => {
  const { sanitizeFileName } = require('./standaloneExport.js');
  const BACKSLASH = String.fromCharCode(92);
  const NUL = String.fromCharCode(0);
  assert.equal(sanitizeFileName('Оптика, 8 класс'), 'Оптика, 8 класс');
  assert.equal(sanitizeFileName('..' + BACKSLASH + '..' + BACKSLASH + 'Windows' + BACKSLASH + 'evil'), '.. .. Windows evil');
  assert.equal(sanitizeFileName('../../etc/passwd'), '.. .. etc passwd');
  assert.equal(sanitizeFileName('a' + NUL + 'b:c*d?"<>|'), 'a b c d');
  assert.equal(sanitizeFileName('..'), 'Викторина');
  assert.equal(sanitizeFileName(''), 'Викторина');
  assert.equal(sanitizeFileName(null), 'Викторина');
  assert.equal(sanitizeFileName('я'.repeat(300)).length, 80);
  for (const name of ['x' + BACKSLASH + 'y', 'x/y']) assert.ok(!/[/]/.test(sanitizeFileName(name)) && !sanitizeFileName(name).includes(BACKSLASH));
});

test('незнакомая встроенная викторина и путь не к .xlsx отклоняются', () => {
  const dir = tempDir();
  try {
    assert.throws(() => exportStandalone({ targetPath: path.join(dir, 'a.xlsx'), builtinId: '../../etc/passwd' }), /встроенн/i);
    assert.throws(() => exportStandalone({ targetPath: path.join(dir, 'a.exe'), quiz: quiz() }), /xlsx/i);
    assert.deepEqual(fs.readdirSync(dir), []);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
