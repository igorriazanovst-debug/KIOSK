// packages/player/electron/physastroiq/standaloneExport.js
//
// Экспорт викторины «для запуска без установки» (FR-019, строка 340 ТЗ:
// «экспорт викторины в отдельный файл для запуска на любом компьютере»).
//
// На выходе ДВА файла в одной папке: таблица Excel с текстом вопросов и
// player.html — мини-проигрыватель, который открывается в любом браузере без
// установки и сети (packages/quiz-mini-player). Карты уровней, координаты и
// картинки не выгружаются намеренно: проигрыватель текстовый, ответ в нём —
// выбор из четырёх вариантов, а не щелчок по схеме.
//
// У ВСТРОЕННЫХ викторин отдаётся готовый текстовый банк, а не пересказ карты:
// вопросы «по карте» без карты теряют смысл («что на схеме слева от линзы?»),
// а готовый банк написан под выбор из вариантов и отрецензирован.
//
// БИБЛИОТЕКА ЛЕЖИТ В РЕПОЗИТОРИИ, а не в node_modules: сборка приложения идёт
// на сервере, где новую зависимость пришлось бы ставить руками, а забытая
// установка даёт приложение, падающее только при нажатии этой кнопки.
// SheetJS 0.20.3, мини-сборка, Apache-2.0 — текст лицензии рядом.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const STANDALONE_DIR = path.join(__dirname, 'standalone');
const PLAYER_FILE_NAME = 'player.html';
const FALLBACK_PLAYER_FILE_NAME = 'player-physastroiq.html';
const OWN_PLAYER_MARKER = '<title>Мини-проигрыватель викторин</title>';
const MAX_OWN_PLAYER_BYTES = 5 * 1024 * 1024;
const BUILTIN_FILES = Object.freeze({
  'physastroiq-physics': 'physastroiq-physics-90.xlsx',
  'physastroiq-astronomy': 'physastroiq-astronomy-390.xlsx',
});

// Те же пределы, что у разбора в проигрывателе: файл, который он откажется
// открыть, не должен получиться уже на выходе.
const MAX_QUESTIONS = 2000;
const MAX_TEXT_LENGTH = 500;
const HEADER = ['№', 'Уровень', 'Тема', 'Вопрос', 'Ответ', 'Неверный 1', 'Неверный 2', 'Неверный 3', 'Подсказка', 'Вес', 'Время, с'];
const COLUMN_WIDTHS = [5, 9, 30, 70, 34, 34, 34, 34, 70, 7, 10];

let xlsxLib = null;
function xlsx() {
  if (!xlsxLib) xlsxLib = require(path.join(STANDALONE_DIR, 'xlsx.mini.min.js'));
  return xlsxLib;
}

function textField(value, what, index, required) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new Error(`Вопрос ${index}: нет поля «${what}».`);
    return '';
  }
  if (typeof value !== 'string') throw new Error(`Вопрос ${index}: поле «${what}» должно быть текстом.`);
  if (value.length > MAX_TEXT_LENGTH) throw new Error(`Вопрос ${index}: поле «${what}» слишком длинное.`);
  return value.trim();
}

const MAX_FILE_NAME_LENGTH = 80;
const DEFAULT_FILE_NAME = 'Викторина';
// Знаки, недопустимые в имени файла Windows. Обратная косая и управляющие
// знаки заданы кодами, а не литералами: в литерале их слишком легко потерять
// при правке, и тогда имя из окна приложения стало бы путём в чужую папку.
const FORBIDDEN_NAME_CHARS = new Set(['/', ':', '*', '?', '"', '<', '>', '|', String.fromCharCode(92)]);
const FIRST_PRINTABLE_CODE = 32;
const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])([.]|$)/i;

/** Имя файла приходит из окна приложения — из него вычищается всё, что может увести из папки */
function sanitizeFileName(wished) {
  const cleaned = Array.from(typeof wished === 'string' ? wished : '')
    .map((ch) => (FORBIDDEN_NAME_CHARS.has(ch) || ch.charCodeAt(0) < FIRST_PRINTABLE_CODE ? ' ' : ch))
    .join('')
    .split(' ').filter(Boolean).join(' ')
    .slice(0, MAX_FILE_NAME_LENGTH)
    .trim();
  // Имя из одних точек — это «текущая папка» или «папка выше»
  if (!cleaned || Array.from(cleaned).every((ch) => ch === '.')) return DEFAULT_FILE_NAME;
  // CON, NUL, COM1… — имена устройств Windows: файл с таким именем не создать
  return WINDOWS_RESERVED_NAME.test(cleaned) ? DEFAULT_FILE_NAME + ' ' + cleaned : cleaned;
}

function positiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : '';
}

/** Данные приходят из окна приложения — проверяются как любые чужие. */
function quizToRows(quiz) {
  if (!quiz || typeof quiz !== 'object' || !Array.isArray(quiz.questions)) throw new Error('Это не викторина: нет списка вопросов.');
  if (quiz.questions.length === 0) throw new Error('В викторине нет вопросов — экспортировать нечего.');
  if (quiz.questions.length > MAX_QUESTIONS) throw new Error(`В викторине слишком много вопросов: больше ${MAX_QUESTIONS}.`);
  const rows = quiz.questions.map((q, i) => {
    const n = i + 1;
    if (!q || typeof q !== 'object') throw new Error(`Вопрос ${n}: неверный формат.`);
    const level = [1, 2, 3].includes(q.level) ? q.level : 1;
    return [
      n, level, textField(q.theme, 'тема', n, false), textField(q.text, 'текст', n, true), textField(q.answer, 'ответ', n, true),
      '', '', '', textField(q.helpText, 'подсказка', n, false), positiveNumber(q.price), positiveNumber(q.timeSeconds),
    ];
  });
  const title = typeof quiz.title === 'string' && quiz.title.trim() ? quiz.title.trim().slice(0, MAX_TEXT_LENGTH) : 'Викторина';
  const intro = typeof quiz.intro === 'string' ? quiz.intro.trim().slice(0, MAX_TEXT_LENGTH) : '';
  return { questions: [HEADER, ...rows], about: [['Название', title], ['Описание', intro],
    ['Как пользоваться', 'Откройте player.html в любом браузере и выберите этот файл. Установка и интернет не нужны.'],
    ['Неверные варианты', 'Столбцы «Неверный 1–3» пусты: проигрыватель сам подберёт варианты из ответов той же темы. Их можно вписать вручную.']] };
}

function quizToWorkbookBuffer(quiz) {
  const X = xlsx();
  const rows = quizToRows(quiz);
  const workbook = X.utils.book_new();
  const sheet = X.utils.aoa_to_sheet(rows.questions);
  sheet['!cols'] = COLUMN_WIDTHS.map((wch) => ({ wch }));
  X.utils.book_append_sheet(workbook, sheet, 'Вопросы');
  const about = X.utils.aoa_to_sheet(rows.about);
  about['!cols'] = [{ wch: 20 }, { wch: 120 }];
  X.utils.book_append_sheet(workbook, about, 'О викторине');
  return X.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function readWorkbookRows(buffer) {
  const X = xlsx();
  const workbook = X.read(buffer, { type: 'buffer' });
  const rowsOf = (name) => X.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '', raw: true });
  return { questions: rowsOf('Вопросы'), about: rowsOf('О викторине') };
}

/**
 * targetPath выбирает человек в системном диалоге сохранения; проигрыватель
 * ложится рядом. Сначала всё готовится в памяти, и только потом пишется на
 * диск: при негодных данных в папке педагога не остаётся половины поставки.
 */
function exportStandalone({ targetPath, quiz, builtinId }) {
  if (typeof targetPath !== 'string' || path.extname(targetPath).toLowerCase() !== '.xlsx') {
    throw new Error('Файл викторины должен иметь расширение .xlsx.');
  }
  let content;
  if (builtinId !== undefined && builtinId !== null) {
    const fileName = Object.prototype.hasOwnProperty.call(BUILTIN_FILES, builtinId) ? BUILTIN_FILES[builtinId] : null;
    if (!fileName) throw new Error('Неизвестная встроенная викторина.');
    content = fs.readFileSync(path.join(STANDALONE_DIR, fileName));
  } else {
    content = quizToWorkbookBuffer(quiz);
  }
  const player = fs.readFileSync(path.join(STANDALONE_DIR, PLAYER_FILE_NAME));
  const playerSlot = choosePlayerFile(path.dirname(targetPath), player);

  // Перезапись таблицы человек подтвердил в системном диалоге; про
  // проигрыватель его никто не спрашивал — отсюда вся осторожность с ним.
  if (playerSlot.needsWrite) fs.writeFileSync(playerSlot.file, player);
  try {
    fs.writeFileSync(targetPath, content);
  } catch (err) {
    // Одинокий проигрыватель без таблицы — полпоставки. Убираем только то,
    // что создали сами: файл, лежавший тут раньше, не трогаем.
    if (playerSlot.created) {
      try { fs.unlinkSync(playerSlot.file); } catch (cleanupError) { /* папка недоступна — исходная ошибка важнее */ }
    }
    throw err;
  }
  return { ok: true, quizFile: targetPath, playerFile: playerSlot.file };
}

/**
 * Куда положить проигрыватель. Свой прежний файл обновляется на месте; ЧУЖОЙ
 * player.html (другое содержимое) не затирается — проигрыватель ложится рядом
 * под запасным именем.
 */
function choosePlayerFile(dir, player) {
  for (const name of [PLAYER_FILE_NAME, FALLBACK_PLAYER_FILE_NAME]) {
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) return { file, needsWrite: true, created: true };
    const existing = fs.readFileSync(file);
    if (existing.equals(player)) return { file, needsWrite: false, created: false };
    if (isOwnPlayer(existing)) return { file, needsWrite: true, created: false };
  }
  throw new Error(`В папке уже есть чужие файлы «${PLAYER_FILE_NAME}» и «${FALLBACK_PLAYER_FILE_NAME}» — выберите другую папку.`);
}

/** Прежняя версия НАШЕГО проигрывателя узнаётся по заголовку страницы */
function isOwnPlayer(buffer) {
  return buffer.length < MAX_OWN_PLAYER_BYTES && buffer.toString('utf8').includes(OWN_PLAYER_MARKER);
}

function libraryVersion() {
  return xlsx().version;
}

module.exports = {
  STANDALONE_DIR, PLAYER_FILE_NAME, BUILTIN_FILES, quizToWorkbookBuffer, readWorkbookRows, exportStandalone, sanitizeFileName, libraryVersion,
};
