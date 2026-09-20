// packages/quiz-mini-player/test/quizCore.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('../src/quizCore.js');

const HEADER = ['№', 'Уровень', 'Тема', 'Вопрос', 'Ответ', 'Неверный 1', 'Неверный 2', 'Неверный 3', 'Подсказка', 'Вес', 'Время, с'];
const row = (n, level, theme, text, answer, wrong = [], hint = '', price = '', time = '') =>
  [n, level, theme, text, answer, wrong[0] || '', wrong[1] || '', wrong[2] || '', hint, price, time];

/** Детерминированный генератор: тесты не должны зависеть от Math.random */
function seededRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function sampleRows(count = 12) {
  const rows = [HEADER];
  for (let i = 1; i <= count; i += 1) {
    rows.push(row(i, ((i - 1) % 3) + 1, i % 2 ? 'Планеты' : 'Звёзды', `Вопрос ${i}?`, `Ответ ${i}`, [`Неверно ${i}а`, `Неверно ${i}б`, `Неверно ${i}в`], `Подсказка ${i}`, 100, 30));
  }
  return rows;
}

// ─── Разбор таблицы ────────────────────────────────────────────────────────

test('разбирает строки листа в вопросы', () => {
  const { quiz, errors } = core.parseQuizRows(sampleRows(3), { title: 'Астрономия' });
  assert.deepEqual(errors, []);
  assert.equal(quiz.title, 'Астрономия');
  assert.equal(quiz.questions.length, 3);
  assert.deepEqual(quiz.questions[0], {
    id: 'q2', rowNumber: 2, level: 1, theme: 'Планеты', text: 'Вопрос 1?', answer: 'Ответ 1',
    wrong: ['Неверно 1а', 'Неверно 1б', 'Неверно 1в'], helpText: 'Подсказка 1', price: 100, timeSeconds: 30,
  });
});

test('заголовки узнаются без учёта регистра, пробелов и порядка столбцов', () => {
  const rows = [['ответ', ' ВОПРОС ', 'уровень', 'НЕВЕРНЫЙ 1'], ['Марс', 'Красная планета?', 2, 'Венера']];
  const { quiz, errors } = core.parseQuizRows(rows, {});
  assert.deepEqual(errors, []);
  assert.equal(quiz.questions[0].answer, 'Марс');
  assert.equal(quiz.questions[0].level, 2);
});

test('вес и время по умолчанию зависят от уровня, как в основной игре', () => {
  const rows = [['Вопрос', 'Ответ', 'Уровень'], ['А?', 'а', 1], ['Б?', 'б', 3]];
  const { quiz } = core.parseQuizRows(rows, {});
  assert.deepEqual([quiz.questions[0].price, quiz.questions[0].timeSeconds], [100, 35]);
  assert.deepEqual([quiz.questions[1].price, quiz.questions[1].timeSeconds], [170, 25]);
});

test('пустые строки пропускаются, а не становятся ошибками', () => {
  const rows = [HEADER, row(1, 1, 'Т', 'В?', 'О'), ['', '', '', '', ''], [], row(2, 1, 'Т', 'В2?', 'О2')];
  const { quiz, errors } = core.parseQuizRows(rows, {});
  assert.deepEqual(errors, []);
  assert.equal(quiz.questions.length, 2);
});

test('ошибки называют строку Excel и причину по-человечески', () => {
  const rows = [HEADER,
    row(1, 1, 'Т', 'Есть вопрос?', ''),
    row(2, 7, 'Т', 'Уровень семь?', 'да'),
    row(3, 1, 'Т', '', 'ответ без вопроса'),
    row(4, 1, 'Т', 'Вариант совпал?', 'Марс', ['Венера', 'марс ']),
    row(5, 1, 'Т', 'Дубли вариантов?', 'Марс', ['Венера', 'Венера']),
    row(6, 1, 'Т', 'Вес?', 'да', [], '', 'много'),
  ];
  const { errors } = core.parseQuizRows(rows, {});
  assert.deepEqual(errors.map((e) => e.rowNumber), [2, 3, 4, 5, 6, 7]);
  assert.match(errors[0].message, /строка 2.*нет ответа/i);
  assert.match(errors[1].message, /строка 3.*уровень.*1, 2 или 3/i);
  assert.match(errors[2].message, /строка 4.*нет текста вопроса/i);
  assert.match(errors[3].message, /строка 5.*совпадает с правильным/i);
  assert.match(errors[4].message, /строка 6.*повторя/i);
  assert.match(errors[5].message, /строка 7.*вес/i);
});

test('нет обязательных столбцов — одна понятная ошибка, а не сотня построчных', () => {
  const { quiz, errors } = core.parseQuizRows([['Тема', 'Подсказка'], ['Т', 'П']], {});
  assert.equal(quiz, null);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /столбц.*«Вопрос».*«Ответ»/);
});

test('пустой лист и не-таблица не роняют разбор', () => {
  for (const rows of [[], null, undefined, [[]], 'строка']) {
    const { quiz, errors } = core.parseQuizRows(rows, {});
    assert.equal(quiz, null);
    assert.equal(errors.length, 1);
  }
});

test('числа и даты из Excel приводятся к тексту, а не ломают вопрос', () => {
  const rows = [['Вопрос', 'Ответ', 'Уровень', 'Неверный 1'], ['Сколько планет?', 8, '2', 9]];
  const { quiz, errors } = core.parseQuizRows(rows, {});
  assert.deepEqual(errors, []);
  assert.equal(quiz.questions[0].answer, '8');
  assert.deepEqual(quiz.questions[0].wrong, ['9']);
});

test('слишком длинный текст и слишком большой файл отклоняются', () => {
  const long = 'я'.repeat(core.LIMITS.maxTextLength + 1);
  const { errors } = core.parseQuizRows([HEADER, row(1, 1, 'Т', long, 'о')], {});
  assert.match(errors[0].message, /длиннее/);
  const huge = [HEADER];
  for (let i = 0; i < core.LIMITS.maxQuestions + 1; i += 1) huge.push(row(i, 1, 'Т', `В${i}?`, `О${i}`));
  const result = core.parseQuizRows(huge, {});
  assert.equal(result.quiz, null);
  assert.match(result.errors[0].message, /слишком много/i);
});

test('повтор текста вопроса — предупреждение, викторина остаётся рабочей', () => {
  const rows = [HEADER, row(1, 1, 'Т', 'Один и тот же?', 'а'), row(2, 1, 'Т', 'один и тот же?', 'б')];
  const { quiz, errors, warnings } = core.parseQuizRows(rows, {});
  assert.deepEqual(errors, []);
  assert.equal(quiz.questions.length, 2);
  assert.match(warnings[0].message, /строка 3.*повторяет.*строк[аи] 2/i);
});

// ─── Варианты ответа ───────────────────────────────────────────────────────

test('варианты: правильный ответ и три неверных из таблицы, порядок перемешан', () => {
  const { quiz } = core.parseQuizRows(sampleRows(12), {});
  const q = quiz.questions[0];
  const options = core.buildOptions(q, quiz.questions, seededRng(1));
  assert.equal(options.length, 4);
  assert.deepEqual([...options].sort(), [q.answer, ...q.wrong].sort());
});

test('правильный ответ не стоит всегда на одном месте', () => {
  const { quiz } = core.parseQuizRows(sampleRows(12), {});
  const q = quiz.questions[0];
  const positions = new Set();
  for (let seed = 1; seed <= 40; seed += 1) positions.add(core.buildOptions(q, quiz.questions, seededRng(seed)).indexOf(q.answer));
  assert.equal(positions.size, 4);
});

test('недостающие неверные варианты добираются из ответов той же темы и уровня, затем уровня, затем любых', () => {
  const rows = [['Вопрос', 'Ответ', 'Уровень', 'Тема'],
    ['Красная планета?', 'Марс', 1, 'Планеты'],
    ['Самая большая планета?', 'Юпитер', 1, 'Планеты'],
    ['Ближайшая к Солнцу?', 'Меркурий', 1, 'Планеты'],
    ['С кольцами?', 'Сатурн', 1, 'Планеты'],
    ['Ярчайшая звезда ночи?', 'Сириус', 1, 'Звёзды'],
    ['Наша галактика?', 'Млечный Путь', 3, 'Галактики'],
  ];
  const { quiz } = core.parseQuizRows(rows, {});
  const options = core.buildOptions(quiz.questions[0], quiz.questions, seededRng(3));
  assert.deepEqual([...options].sort(), ['Марс', 'Меркурий', 'Сатурн', 'Юпитер']);
});

test('автоподбор не даёт дублей и не подставляет правильный ответ дважды', () => {
  const rows = [['Вопрос', 'Ответ', 'Уровень'], ['А?', 'Марс', 1], ['Б?', 'марс', 1], ['В?', 'Венера', 1], ['Г?', ' Венера ', 1], ['Д?', 'Земля', 1]];
  const { quiz } = core.parseQuizRows(rows, {});
  const options = core.buildOptions(quiz.questions[0], quiz.questions, seededRng(5));
  assert.deepEqual([...options].map((o) => o.trim().toLowerCase()).sort(), ['венера', 'земля', 'марс']);
});

test('вопрос, у которого не набирается хотя бы два варианта, помечается при разборе', () => {
  const rows = [['Вопрос', 'Ответ', 'Уровень'], ['Один вопрос?', 'Один ответ', 1]];
  const { errors } = core.parseQuizRows(rows, {});
  assert.match(errors[0].message, /не из чего составить варианты/i);
});

// ─── Партия ────────────────────────────────────────────────────────────────

test('очки убывают со временем и не начисляются за неверный ответ — как в основной игре', () => {
  assert.equal(core.scoreForAnswer(100, 30, 0, true), 100);
  assert.equal(core.scoreForAnswer(100, 30, 15, true), 50);
  assert.equal(core.scoreForAnswer(100, 30, 45, true), 0);
  assert.equal(core.scoreForAnswer(100, 30, 1, false), 0);
});

test('вопросы раздаются игрокам без повторов', () => {
  const { quiz } = core.parseQuizRows(sampleRows(12), {});
  const sets = core.assignQuestions(quiz.questions, 3, 4, seededRng(7));
  const ids = sets.flat().map((q) => q.id);
  assert.equal(ids.length, 12);
  assert.equal(new Set(ids).size, 12);
});

test('доступное число вопросов на игрока ограничено размером уровня', () => {
  assert.deepEqual(core.availableCounts(30, 3), [5, 10]);
  assert.deepEqual(core.availableCounts(12, 1), [5, 10]);
  assert.deepEqual(core.availableCounts(4, 1), [4]);
  assert.deepEqual(core.availableCounts(0, 1), []);
});

test('партия: ходы по кругу, верный и неверный ответ, «Сдаюсь», итоги и детализация', () => {
  const { quiz } = core.parseQuizRows(sampleRows(12), {});
  const level1 = quiz.questions.filter((q) => q.level === 1);
  let game = core.createGame({ questions: level1, allQuestions: quiz.questions, playerNames: ['Аня', 'Миша'], questionsPerPlayer: 2, rng: seededRng(11) });
  assert.equal(game.currentPlayer, 0);
  assert.equal(core.currentTurn(game).options.length, 4);

  const first = core.currentTurn(game).question;
  game = core.answer(game, first.answer, 0);
  assert.equal(game.currentPlayer, 1);
  assert.equal(game.players[0].score, first.price);

  const second = core.currentTurn(game).question;
  game = core.answer(game, second.wrong[0], 3);
  assert.equal(game.players[1].score, 0);
  assert.equal(game.currentPlayer, 0);

  game = core.giveUp(game);
  assert.equal(game.currentPlayer, 1);
  assert.equal(core.isFinished(game), false);
  game = core.timeOut(game);
  assert.equal(core.isFinished(game), true);
  assert.equal(core.currentTurn(game), null);

  const results = core.results(game);
  assert.deepEqual(results.map((r) => r.name), ['Аня', 'Миша']);
  assert.equal(results[0].place, 1);
  assert.deepEqual(results[0].answers.map((a) => a.outcome), ['correct', 'skipped']);
  assert.deepEqual(results[1].answers.map((a) => a.outcome), ['wrong', 'timeout']);
  assert.equal(results[1].answers[0].chosen, second.wrong[0]);
  assert.equal(results[1].answers[0].correctAnswer, second.answer);
});

test('ход не меняет прежнее состояние партии', () => {
  const { quiz } = core.parseQuizRows(sampleRows(12), {});
  const game = core.createGame({ questions: quiz.questions, allQuestions: quiz.questions, playerNames: ['Аня'], questionsPerPlayer: 2, rng: seededRng(2) });
  const snapshot = JSON.stringify(game);
  core.answer(game, core.currentTurn(game).question.answer, 1);
  assert.equal(JSON.stringify(game), snapshot);
});

test('равные очки делят место', () => {
  const { quiz } = core.parseQuizRows(sampleRows(12), {});
  let game = core.createGame({ questions: quiz.questions, allQuestions: quiz.questions, playerNames: ['А', 'Б'], questionsPerPlayer: 1, rng: seededRng(4) });
  game = core.giveUp(core.giveUp(game));
  assert.deepEqual(core.results(game).map((r) => r.place), [1, 1]);
});

// ─── Слова из файла не должны задевать Object.prototype ───────────────────

test('ячейки с именами встроенных свойств объекта разбираются как обычный текст', () => {
  const rows = [['Вопрос', 'Ответ', 'Уровень', 'Неверный 1', 'Неверный 2'],
    ['constructor', 'hasOwnProperty', 1, '__proto__', 'toString'],
    ['valueOf', 'constructor', 1, 'isPrototypeOf', '']];
  const { quiz, errors, warnings } = core.parseQuizRows(rows, {});
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  assert.equal(quiz.questions.length, 2);
  assert.deepEqual(quiz.questions[0].wrong, ['__proto__', 'toString']);
  const options = core.buildOptions(quiz.questions[1], quiz.questions, seededRng(9));
  assert.deepEqual([...options].sort(), ['constructor', 'hasOwnProperty', 'isPrototypeOf'].sort());
  assert.equal(Object.prototype.polluted, undefined);
});

test('если вопросов меньше, чем просят на игрока, партия идёт на тех, что есть, и завершается', () => {
  const { quiz } = core.parseQuizRows(sampleRows(3), {});
  let game = core.createGame({ questions: quiz.questions, allQuestions: quiz.questions, playerNames: ['А', 'Б'], questionsPerPlayer: 5, rng: seededRng(6) });
  assert.deepEqual(game.players.map((p) => p.turns.length), [3, 0]);
  for (let i = 0; i < 3; i += 1) game = core.giveUp(game);
  assert.equal(core.isFinished(game), true);
});
