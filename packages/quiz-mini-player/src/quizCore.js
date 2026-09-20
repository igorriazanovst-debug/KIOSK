// packages/quiz-mini-player/src/quizCore.js
//
// Вся логика мини-проигрывателя, у которой нет экрана: разбор таблицы,
// варианты ответа, партия. Файл один и без зависимостей намеренно — он
// вшивается в player.html как есть и тем же текстом проверяется в Node.
//
// ТАБЛИЦА ПРИХОДИТ ОТ ЧЕЛОВЕКА. Педагог правит её в Excel руками, поэтому
// разбор терпим к форме (регистр и порядок столбцов, пустые строки, числа
// вместо текста) и нетерпим к смыслу: строка без ответа — это ошибка с номером
// строки Excel, а не тихо пропущенный вопрос.
//
// Синтаксис без новшеств (нет ?., ??, приватных полей): файл должен открыться
// в браузере, который последним обновлялся на Windows 7.

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.QuizCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LIMITS = { maxQuestions: 2000, maxTextLength: 500, maxPlayers: 3 };
  var OPTIONS_PER_QUESTION = 4;
  var MIN_OPTIONS = 2;
  var QUESTION_COUNT_CHOICES = [5, 10, 15];
  // Те же вес и время по уровням, что у встроенных викторин «ФизАстроIQ»
  var LEVEL_DEFAULTS = { 1: { price: 100, timeSeconds: 35 }, 2: { price: 130, timeSeconds: 30 }, 3: { price: 170, timeSeconds: 25 } };
  var MAX_PRICE = 100000;
  var MAX_TIME_SECONDS = 3600;

  var COLUMN_ALIASES = {
    level: ['уровень', 'уровень (1-3)', 'уровень (1–3)', 'сложность'],
    theme: ['тема', 'раздел'],
    text: ['вопрос', 'текст вопроса'],
    answer: ['ответ', 'правильный ответ', 'верный ответ'],
    wrong1: ['неверный 1', 'неверный ответ 1', 'неверный1'],
    wrong2: ['неверный 2', 'неверный ответ 2', 'неверный2'],
    wrong3: ['неверный 3', 'неверный ответ 3', 'неверный3'],
    helpText: ['подсказка'],
    price: ['вес', 'баллы', 'очки', 'цена'],
    timeSeconds: ['время, с', 'время', 'время (с)', 'время, сек', 'секунд'],
  };

  // Словарь БЕЗ прототипа. Ключи приходят из ячеек файла; у обычного {} слова
  // «constructor» или «toString» уже «есть», и вопрос с таким текстом считался
  // бы повтором самого себя.
  function dict() { return Object.create(null); }

  function cellText(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/\s+/g, ' ').trim();
  }

  function normalizeKey(value) {
    return cellText(value).toLowerCase().replace(/ё/g, 'е');
  }

  function mapColumns(headerRow) {
    var columns = dict();
    for (var i = 0; i < headerRow.length; i += 1) {
      var title = cellText(headerRow[i]).toLowerCase();
      if (!title) continue;
      for (var field in COLUMN_ALIASES) {
        if (columns[field] === undefined && COLUMN_ALIASES[field].indexOf(title) !== -1) columns[field] = i;
      }
    }
    return columns;
  }

  function rowError(rowNumber, text) {
    return { rowNumber: rowNumber, message: 'Строка ' + rowNumber + ': ' + text };
  }

  function parsePositiveNumber(raw, max) {
    var number = Number(String(raw).replace(',', '.'));
    if (!isFinite(number) || number <= 0 || number > max) return null;
    return Math.round(number);
  }

  /** Одна строка листа → вопрос либо ошибка. rowNumber — номер строки в Excel. */
  function parseQuestionRow(row, columns, rowNumber) {
    var get = function (field) { return columns[field] === undefined ? '' : cellText(row[columns[field]]); };
    var text = get('text');
    var answer = get('answer');
    if (!text) return { error: rowError(rowNumber, 'нет текста вопроса.') };
    if (!answer) return { error: rowError(rowNumber, 'нет ответа.') };

    var fields = [text, answer, get('helpText'), get('theme'), get('wrong1'), get('wrong2'), get('wrong3')];
    for (var f = 0; f < fields.length; f += 1) {
      if (fields[f].length > LIMITS.maxTextLength) {
        return { error: rowError(rowNumber, 'текст длиннее ' + LIMITS.maxTextLength + ' знаков — сократите его.') };
      }
    }

    var levelRaw = get('level');
    var level = levelRaw === '' ? 1 : Number(levelRaw);
    if (level !== 1 && level !== 2 && level !== 3) {
      return { error: rowError(rowNumber, 'уровень должен быть 1, 2 или 3, а указано «' + levelRaw + '».') };
    }

    var wrong = [];
    var seen = dict();
    seen[normalizeKey(answer)] = true;
    var wrongFields = ['wrong1', 'wrong2', 'wrong3'];
    for (var w = 0; w < wrongFields.length; w += 1) {
      var option = get(wrongFields[w]);
      if (!option) continue;
      var key = normalizeKey(option);
      if (key === normalizeKey(answer)) {
        return { error: rowError(rowNumber, 'неверный вариант «' + option + '» совпадает с правильным ответом.') };
      }
      if (seen[key]) return { error: rowError(rowNumber, 'неверные варианты повторяются: «' + option + '».') };
      seen[key] = true;
      wrong.push(option);
    }

    var defaults = LEVEL_DEFAULTS[level];
    var priceRaw = get('price');
    var price = priceRaw === '' ? defaults.price : parsePositiveNumber(priceRaw, MAX_PRICE);
    if (price === null) return { error: rowError(rowNumber, 'вес должен быть положительным числом, а указано «' + priceRaw + '».') };
    var timeRaw = get('timeSeconds');
    var timeSeconds = timeRaw === '' ? defaults.timeSeconds : parsePositiveNumber(timeRaw, MAX_TIME_SECONDS);
    if (timeSeconds === null) return { error: rowError(rowNumber, 'время должно быть положительным числом секунд, а указано «' + timeRaw + '».') };

    return {
      question: {
        id: 'q' + rowNumber, rowNumber: rowNumber, level: level, theme: get('theme'), text: text, answer: answer,
        wrong: wrong, helpText: get('helpText'), price: price, timeSeconds: timeSeconds,
      },
    };
  }

  function isEmptyRow(row) {
    if (!row || typeof row.length !== 'number') return true;
    for (var i = 0; i < row.length; i += 1) if (cellText(row[i])) return false;
    return true;
  }

  function fileError(text) {
    return { quiz: null, errors: [{ rowNumber: 0, message: text }], warnings: [] };
  }

  /**
   * rows — лист целиком как массив массивов, первая строка — заголовки.
   * Возвращает викторину вместе со списком ошибок: вопросы с ошибками в неё не
   * попадают, решение «играть ли на остальных» принимает экран, а не разбор.
   */
  function parseQuizRows(rows, meta) {
    if (!rows || typeof rows !== 'object' || typeof rows.length !== 'number' || rows.length === 0 || isEmptyRow(rows[0])) {
      return fileError('На листе нет таблицы вопросов: первая строка должна содержать названия столбцов.');
    }
    var columns = mapColumns(rows[0]);
    if (columns.text === undefined || columns.answer === undefined) {
      return fileError('Не найдены обязательные столбцы «Вопрос» и «Ответ». Проверьте первую строку листа.');
    }
    var dataRows = 0;
    for (var c = 1; c < rows.length; c += 1) if (!isEmptyRow(rows[c])) dataRows += 1;
    if (dataRows > LIMITS.maxQuestions) {
      return fileError('В файле слишком много вопросов: ' + dataRows + ', а допустимо не больше ' + LIMITS.maxQuestions + '.');
    }

    var questions = [];
    var errors = [];
    var warnings = [];
    var firstRowByText = dict();
    for (var r = 1; r < rows.length; r += 1) {
      if (isEmptyRow(rows[r])) continue;
      var rowNumber = r + 1;
      var parsed = parseQuestionRow(rows[r], columns, rowNumber);
      if (parsed.error) { errors.push(parsed.error); continue; }
      var textKey = normalizeKey(parsed.question.text);
      if (firstRowByText[textKey]) {
        warnings.push(rowError(rowNumber, 'текст вопроса повторяет вопрос из строки ' + firstRowByText[textKey] + '.'));
      } else {
        firstRowByText[textKey] = rowNumber;
      }
      questions.push(parsed.question);
    }

    var playable = [];
    for (var q = 0; q < questions.length; q += 1) {
      if (collectOptions(questions[q], questions).length < MIN_OPTIONS) {
        errors.push(rowError(questions[q].rowNumber, 'не из чего составить варианты ответа: добавьте неверные варианты или другие вопросы.'));
      } else {
        playable.push(questions[q]);
      }
    }
    errors.sort(function (a, b) { return a.rowNumber - b.rowNumber; });

    var info = meta || {};
    return {
      quiz: { title: cellText(info.title) || 'Викторина', description: cellText(info.description), questions: playable },
      errors: errors,
      warnings: warnings,
    };
  }

  function shuffle(items, rng) {
    var result = items.slice();
    for (var i = result.length - 1; i > 0; i -= 1) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = result[i]; result[i] = result[j]; result[j] = tmp;
    }
    return result;
  }

  /**
   * Правильный ответ + неверные. Сначала неверные из таблицы; недостающие
   * добираются из ответов других вопросов: той же темы и уровня, затем того же
   * уровня, затем любых — чужой ответ из той же темы похож на правду сильнее
   * всего. Порядок детерминирован (без rng): перемешивает buildOptions.
   */
  function collectOptions(question, pool) {
    var options = [question.answer];
    var seen = dict();
    seen[normalizeKey(question.answer)] = true;
    var add = function (text) {
      var key = normalizeKey(text);
      if (options.length >= OPTIONS_PER_QUESTION || !key || seen[key]) return;
      seen[key] = true;
      options.push(text);
    };
    for (var w = 0; w < question.wrong.length; w += 1) add(question.wrong[w]);
    var tiers = [
      function (other) { return other.level === question.level && other.theme === question.theme; },
      function (other) { return other.level === question.level; },
      function () { return true; },
    ];
    for (var t = 0; t < tiers.length && options.length < OPTIONS_PER_QUESTION; t += 1) {
      for (var p = 0; p < pool.length && options.length < OPTIONS_PER_QUESTION; p += 1) {
        if (pool[p].id !== question.id && tiers[t](pool[p])) add(pool[p].answer);
      }
    }
    return options;
  }

  function buildOptions(question, pool, rng) {
    var random = rng || Math.random;
    // Пул перемешивается ДО добора: иначе чужие ответы брались бы всегда из
    // начала таблицы, и одни и те же неверные варианты примелькались бы.
    return shuffle(collectOptions(question, shuffle(pool, random)), random);
  }

  function scoreForAnswer(price, timeSeconds, elapsedSeconds, isCorrect) {
    if (!isCorrect) return 0;
    var remainingFraction = Math.max(0, (timeSeconds - elapsedSeconds) / timeSeconds);
    return Math.round(price * remainingFraction);
  }

  function assignQuestions(pool, playerCount, questionsPerPlayer, rng) {
    var shuffled = shuffle(pool, rng || Math.random);
    var sets = [];
    for (var p = 0; p < playerCount; p += 1) sets.push(shuffled.slice(p * questionsPerPlayer, (p + 1) * questionsPerPlayer));
    return sets;
  }

  /** Сколько вопросов на игрока можно предложить при таком размере уровня */
  function availableCounts(poolSize, playerCount) {
    var maxPerPlayer = Math.floor(poolSize / playerCount);
    if (maxPerPlayer <= 0) return [];
    var counts = QUESTION_COUNT_CHOICES.filter(function (count) { return count <= maxPerPlayer; });
    return counts.length > 0 ? counts : [maxPerPlayer];
  }

  function createGame(params) {
    var rng = params.rng || Math.random;
    var sets = assignQuestions(params.questions, params.playerNames.length, params.questionsPerPlayer, rng);
    var players = params.playerNames.map(function (name, index) {
      return {
        name: name,
        score: 0,
        answers: [],
        turns: sets[index].map(function (question) {
          return { question: question, options: buildOptions(question, params.allQuestions || params.questions, rng) };
        }),
      };
    });
    return { players: players, currentPlayer: 0 };
  }

  function isFinished(game) {
    return game.players.every(function (player) { return player.answers.length >= player.turns.length; });
  }

  function currentTurn(game) {
    if (isFinished(game)) return null;
    var player = game.players[game.currentPlayer];
    return player.turns[player.answers.length];
  }

  function nextPlayerIndex(players, from) {
    for (var step = 1; step <= players.length; step += 1) {
      var index = (from + step) % players.length;
      if (players[index].answers.length < players[index].turns.length) return index;
    }
    return from;
  }

  function recordOutcome(game, outcome, chosen, elapsedSeconds) {
    var turn = currentTurn(game);
    if (!turn) return game;
    var question = turn.question;
    var gained = scoreForAnswer(question.price, question.timeSeconds, elapsedSeconds, outcome === 'correct');
    var players = game.players.map(function (player, index) {
      if (index !== game.currentPlayer) return player;
      return {
        name: player.name,
        score: player.score + gained,
        turns: player.turns,
        answers: player.answers.concat([{
          questionText: question.text, correctAnswer: question.answer, chosen: chosen, outcome: outcome, gained: gained,
        }]),
      };
    });
    return { players: players, currentPlayer: nextPlayerIndex(players, game.currentPlayer) };
  }

  function answer(game, optionText, elapsedSeconds) {
    var turn = currentTurn(game);
    if (!turn) return game;
    var isCorrect = normalizeKey(optionText) === normalizeKey(turn.question.answer);
    return recordOutcome(game, isCorrect ? 'correct' : 'wrong', optionText, elapsedSeconds);
  }

  function giveUp(game) { return recordOutcome(game, 'skipped', null, 0); }
  function timeOut(game) { return recordOutcome(game, 'timeout', null, 0); }

  function results(game) {
    return game.players.map(function (player) {
      var better = game.players.filter(function (other) { return other.score > player.score; }).length;
      return {
        name: player.name,
        score: player.score,
        place: better + 1,
        correct: player.answers.filter(function (a) { return a.outcome === 'correct'; }).length,
        answers: player.answers,
      };
    });
  }

  return {
    LIMITS: LIMITS,
    LEVEL_DEFAULTS: LEVEL_DEFAULTS,
    parseQuizRows: parseQuizRows,
    buildOptions: buildOptions,
    scoreForAnswer: scoreForAnswer,
    assignQuestions: assignQuestions,
    availableCounts: availableCounts,
    createGame: createGame,
    currentTurn: currentTurn,
    isFinished: isFinished,
    answer: answer,
    giveUp: giveUp,
    timeOut: timeOut,
    results: results,
  };
});
