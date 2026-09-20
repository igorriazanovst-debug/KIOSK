// packages/quiz-mini-player/src/app.js
//
// Экраны мини-проигрывателя. Вся логика — в quizCore.js; здесь только показ.
//
// ТЕКСТ ИЗ ФАЙЛА НИКОГДА НЕ СТАНОВИТСЯ РАЗМЕТКОЙ. Таблицу приносит человек, и
// она может оказаться чьей угодно. Поэтому узлы строятся через
// createElement/textContent, innerHTML в файле нет вовсе, а страница закрыта
// политикой CSP с хэшами (см. build.mjs): чужой скрипт не выполнится, даже
// если бы разметка где-то просочилась.

(function () {
  'use strict';

  var core = window.QuizCore;
  // Текстовая база на 2000 вопросов весит около 300 КБ. Потолок низкий намеренно:
  // xlsx — это zip, и лимит на входе не ограничивает распакованный объём.
  var MAX_FILE_BYTES = 2 * 1024 * 1024;
  var FEEDBACK_MS = 1600;
  var TICK_MS = 200;
  var LEVEL_LABELS = { 1: 'Начинающий', 2: 'Опытный', 3: 'Профессионал' };
  var QUESTIONS_SHEET = 'вопросы';
  var ABOUT_SHEET = 'о викторине';
  var MAX_NAME_LENGTH = 20;
  var MAX_LISTED_PROBLEMS = 12;

  var root = document.getElementById('app');
  var state = { screen: 'load', quiz: null, problems: null, fileName: '', loadError: '' };
  var timerId = null;
  var keyHandler = null;

  // ─── Построение узлов ────────────────────────────────────────────────────

  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    var key;
    for (key in attrs || {}) {
      if (!Object.prototype.hasOwnProperty.call(attrs, key)) continue;
      var value = attrs[key];
      if (value === null || value === undefined || value === false) continue;
      if (key === 'class') el.className = value;
      else if (key === 'text') el.textContent = value;
      else if (key.indexOf('on') === 0) el.addEventListener(key.slice(2), value);
      else el.setAttribute(key, value === true ? '' : value);
    }
    (children || []).forEach(function (child) {
      if (child === null || child === undefined || child === false) return;
      el.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return el;
  }

  function button(label, onClick, variant, extra) {
    var attrs = { type: 'button', class: 'btn' + (variant ? ' btn-' + variant : ''), text: label, onclick: onClick };
    for (var key in extra || {}) attrs[key] = extra[key];
    return h('button', attrs);
  }

  function show(screenNode) {
    stopTimer();
    if (keyHandler) { document.removeEventListener('keydown', keyHandler); keyHandler = null; }
    while (root.firstChild) root.removeChild(root.firstChild);
    root.appendChild(screenNode);
    var focusTarget = root.querySelector('[data-autofocus]');
    if (focusTarget) focusTarget.focus();
  }

  function stopTimer() {
    if (timerId !== null) { clearInterval(timerId); timerId = null; }
  }

  // ─── Чтение файла ────────────────────────────────────────────────────────

  function findSheet(workbook, wantedName) {
    for (var i = 0; i < workbook.SheetNames.length; i += 1) {
      if (workbook.SheetNames[i].trim().toLowerCase() === wantedName) return workbook.Sheets[workbook.SheetNames[i]];
    }
    return null;
  }

  function readMeta(workbook) {
    var sheet = findSheet(workbook, ABOUT_SHEET);
    var meta = { title: '', description: '' };
    if (!sheet) return meta;
    var rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
    rows.forEach(function (row) {
      var key = String(row[0] === undefined ? '' : row[0]).trim().toLowerCase();
      if (key === 'название') meta.title = row[1];
      if (key === 'описание') meta.description = row[1];
    });
    return meta;
  }

  function loadFile(file) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) return showLoad('Файл больше 2 МБ. Текстовая викторина столько не весит — проверьте, тот ли это файл.');
    if (!/\.(xlsx|xlsm)$/i.test(file.name)) return showLoad('Нужен файл Excel (.xlsx). Выбран «' + file.name + '».');
    var reader = new FileReader();
    reader.onerror = function () { showLoad('Не удалось прочитать файл. Закройте его в Excel и попробуйте ещё раз.'); };
    reader.onload = function () {
      try {
        var workbook = window.XLSX.read(new Uint8Array(reader.result), { type: 'array' });
        var sheet = findSheet(workbook, QUESTIONS_SHEET) || workbook.Sheets[workbook.SheetNames[0]];
        // blankrows нужен, чтобы номер строки в сообщении совпадал с номером в Excel
        var rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true, blankrows: true });
        var meta = readMeta(workbook);
        if (!meta.title) meta.title = file.name.replace(/\.[^.]+$/, '');
        var parsed = core.parseQuizRows(rows, meta);
        state.fileName = file.name;
        state.problems = { errors: parsed.errors, warnings: parsed.warnings };
        if (!parsed.quiz || parsed.quiz.questions.length === 0) {
          state.quiz = null;
          return showLoad(parsed.errors.length ? '' : 'В файле не нашлось ни одного вопроса.');
        }
        state.quiz = parsed.quiz;
        showIntro();
      } catch (e) {
        showLoad('Файл не открывается как таблица Excel. Возможно, он повреждён или это не .xlsx.');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function problemList(title, items, variant) {
    if (!items || items.length === 0) return null;
    var listed = items.slice(0, MAX_LISTED_PROBLEMS).map(function (item) { return h('li', { text: item.message }); });
    if (items.length > MAX_LISTED_PROBLEMS) listed.push(h('li', { class: 'muted', text: '…и ещё ' + (items.length - MAX_LISTED_PROBLEMS) + '.' }));
    return h('section', { class: 'notice notice-' + variant, role: variant === 'error' ? 'alert' : 'status' }, [
      h('h2', { class: 'notice-title', text: title + ': ' + items.length }),
      h('ul', { class: 'notice-list' }, listed),
    ]);
  }

  // ─── Экран: выбор файла ──────────────────────────────────────────────────

  function showLoad(message) {
    state.screen = 'load';
    // Фокус с клавиатуры получает сам input (он скрыт только зрительно), а рамку
    // фокуса рисует соседняя зона — см. «.visually-hidden:focus + .dropzone».
    // Отдельный tabindex у зоны дал бы две остановки Tab на одно действие.
    var input = h('input', { type: 'file', accept: '.xlsx,.xlsm', class: 'visually-hidden', id: 'file-input', 'data-autofocus': true,
      onchange: function (event) { loadFile(event.target.files[0]); } });
    var drop = h('label', { class: 'dropzone', for: 'file-input',
      ondragover: function (event) { event.preventDefault(); drop.classList.add('dropzone-over'); },
      ondragleave: function () { drop.classList.remove('dropzone-over'); },
      ondrop: function (event) { event.preventDefault(); drop.classList.remove('dropzone-over'); loadFile(event.dataTransfer.files[0]); },
    }, [
      h('span', { class: 'dropzone-mark', 'aria-hidden': 'true', text: 'XLSX' }),
      h('span', { class: 'dropzone-title', text: 'Выберите файл викторины' }),
      h('span', { class: 'dropzone-hint', text: 'или перетащите его сюда. Файл никуда не отправляется — он читается прямо на этом компьютере.' }),
    ]);
    var problems = state.problems || {};
    show(h('main', { class: 'screen screen-load' }, [
      h('p', { class: 'eyebrow', text: 'Мини-проигрыватель викторин' }),
      h('h1', { class: 'display', text: 'Викторина из таблицы Excel' }),
      message ? h('p', { class: 'notice notice-error', role: 'alert', text: message }) : null,
      problemList('Ошибки в файле «' + state.fileName + '»', problems.errors, 'error'),
      input, drop,
      h('details', { class: 'format' }, [
        h('summary', { text: 'Как устроен файл' }),
        h('p', { text: 'Лист «Вопросы», первая строка — названия столбцов: Уровень (1–3), Тема, Вопрос, Ответ, Неверный 1, Неверный 2, Неверный 3, Подсказка, Вес, Время, с.' }),
        h('p', { text: 'Обязательны только «Вопрос» и «Ответ». Если неверные варианты не заполнены, проигрыватель подберёт их из ответов на другие вопросы той же темы.' }),
        h('p', { text: 'Необязательный лист «О викторине»: строки «Название» и «Описание».' }),
        h('p', { text: 'Варианты сравниваются без учёта регистра, а «ё» и «е» считаются одной буквой: «все» и «всё» в одном вопросе — это повтор.' }),
      ]),
    ]));
  }

  // ─── Экран: о викторине ──────────────────────────────────────────────────

  function questionsOfLevel(level) {
    return state.quiz.questions.filter(function (q) { return q.level === level; });
  }

  function showIntro() {
    state.screen = 'intro';
    var quiz = state.quiz;
    var themes = [];
    quiz.questions.forEach(function (q) { if (q.theme && themes.indexOf(q.theme) === -1) themes.push(q.theme); });
    var stats = [1, 2, 3].map(function (level) {
      return h('li', { class: 'stat' }, [
        h('span', { class: 'stat-number', text: String(questionsOfLevel(level).length) }),
        h('span', { class: 'stat-label', text: LEVEL_LABELS[level] }),
      ]);
    });
    show(h('main', { class: 'screen screen-intro' }, [
      h('p', { class: 'eyebrow', text: 'Викторина · ' + quiz.questions.length + ' вопросов' }),
      h('h1', { class: 'display', text: quiz.title }),
      quiz.description ? h('p', { class: 'lead', text: quiz.description }) : null,
      h('ul', { class: 'stats', 'aria-label': 'Вопросов по уровням' }, stats),
      themes.length ? h('p', { class: 'themes' }, [h('span', { class: 'muted', text: 'Темы: ' }), themes.join(' · ')]) : null,
      problemList('Пропущено строк с ошибками', state.problems.errors, 'error'),
      problemList('Замечания', state.problems.warnings, 'warn'),
      h('div', { class: 'actions' }, [
        button('Играть!', showSetup, 'primary', { 'data-autofocus': true }),
        button('Другой файл', function () { state.problems = null; showLoad(''); }, 'ghost'),
      ]),
    ]));
  }

  // ─── Экран: настройка партии ─────────────────────────────────────────────

  function showSetup() {
    state.screen = 'setup';
    var setup = { players: 1, names: ['', '', ''], level: null, count: null };
    var firstLevel = [1, 2, 3].filter(function (level) { return questionsOfLevel(level).length > 0; })[0];
    setup.level = firstLevel;

    function choice(label, selected, onPick, disabled) {
      return h('button', { type: 'button', class: 'chip' + (selected ? ' chip-on' : ''), 'aria-pressed': selected ? 'true' : 'false',
        disabled: disabled, text: label, onclick: onPick });
    }

    function render() {
      var counts = core.availableCounts(questionsOfLevel(setup.level).length, setup.players);
      if (counts.indexOf(setup.count) === -1) setup.count = counts.length ? counts[0] : null;
      var nameInputs = [];
      for (var i = 0; i < setup.players; i += 1) {
        (function (index) {
          nameInputs.push(h('label', { class: 'field' }, [
            h('span', { class: 'field-label', text: 'Игрок ' + (index + 1) }),
            h('input', { type: 'text', class: 'input', maxlength: String(MAX_NAME_LENGTH), value: setup.names[index], placeholder: 'Имя',
              oninput: function (event) { setup.names[index] = event.target.value; } }),
          ]));
        })(i);
      }
      show(h('main', { class: 'screen screen-setup' }, [
        h('h1', { class: 'title', text: 'Настройка партии' }),
        h('fieldset', { class: 'group' }, [
          h('legend', { text: 'Сколько игроков' }),
          h('div', { class: 'chips' }, [1, 2, 3].map(function (n) {
            return choice(String(n), setup.players === n, function () { setup.players = n; render(); });
          })),
        ]),
        h('div', { class: 'fields' }, nameInputs),
        h('fieldset', { class: 'group' }, [
          h('legend', { text: 'Уровень' }),
          h('div', { class: 'chips' }, [1, 2, 3].map(function (level) {
            var size = questionsOfLevel(level).length;
            return choice(LEVEL_LABELS[level] + ' · ' + size, setup.level === level, function () { setup.level = level; render(); }, size === 0);
          })),
        ]),
        h('fieldset', { class: 'group' }, [
          h('legend', { text: 'Вопросов каждому' }),
          counts.length
            ? h('div', { class: 'chips' }, counts.map(function (count) {
              return choice(String(count), setup.count === count, function () { setup.count = count; render(); });
            }))
            : h('p', { class: 'muted', text: 'На этом уровне не хватает вопросов на столько игроков.' }),
        ]),
        h('div', { class: 'actions' }, [
          button('Начать', function () { startGame(setup); }, 'primary', { disabled: setup.count === null, 'data-autofocus': true }),
          button('Назад', showIntro, 'ghost'),
        ]),
      ]));
    }
    render();
  }

  function startGame(setup) {
    var names = [];
    for (var i = 0; i < setup.players; i += 1) names.push((setup.names[i] || '').trim().slice(0, MAX_NAME_LENGTH) || 'Игрок ' + (i + 1));
    var game = core.createGame({
      questions: questionsOfLevel(setup.level), allQuestions: state.quiz.questions,
      playerNames: names, questionsPerPlayer: setup.count,
    });
    showBoard(game, setup);
  }

  // ─── Экран: игровое поле ─────────────────────────────────────────────────

  function showBoard(game, setup) {
    if (core.isFinished(game)) return showResults(game, setup);
    state.screen = 'board';
    var turn = core.currentTurn(game);
    var question = turn.question;
    var player = game.players[game.currentPlayer];
    var startedAt = Date.now();
    var locked = false;

    var timerValue = h('strong', { class: 'meter-value', text: question.timeSeconds + ' с' });
    var scoreValue = h('strong', { class: 'meter-value', text: String(question.price) });
    var timeBar = h('span', { class: 'timebar-fill' });
    var hintBox = h('div', { class: 'hint' });
    var verdict = h('p', { class: 'verdict', role: 'status', 'aria-live': 'polite' });

    function elapsedSeconds() { return (Date.now() - startedAt) / 1000; }

    function finish(nextGame, chosenButton, outcome) {
      if (locked) return;
      locked = true;
      stopTimer();
      giveUpButton.disabled = true;
      optionButtons.forEach(function (btn) {
        btn.disabled = true;
        if (btn.getAttribute('data-option') === question.answer) btn.classList.add('option-correct');
      });
      if (chosenButton && outcome === 'wrong') chosenButton.classList.add('option-wrong');
      var last = nextGame.players[game.currentPlayer].answers.slice(-1)[0];
      verdict.className = 'verdict verdict-' + outcome;
      verdict.textContent = outcome === 'correct' ? '✓ Верно! +' + last.gained
        : outcome === 'wrong' ? '✗ Неверно. Правильный ответ: ' + question.answer
        : outcome === 'timeout' ? '✗ Время вышло. Правильный ответ: ' + question.answer
        : 'Пропущено. Правильный ответ: ' + question.answer;
      setTimeout(function () { showBoard(nextGame, setup); }, FEEDBACK_MS);
    }

    var optionButtons = turn.options.map(function (optionText, index) {
      var btn = h('button', { type: 'button', class: 'option', 'data-option': optionText, 'data-testid': 'option-' + index }, [
        h('span', { class: 'option-key', 'aria-hidden': 'true', text: String(index + 1) }),
        h('span', { class: 'option-text', text: optionText }),
      ]);
      btn.addEventListener('click', function () {
        var next = core.answer(game, optionText, elapsedSeconds());
        var outcome = next.players[game.currentPlayer].answers.slice(-1)[0].outcome;
        finish(next, btn, outcome);
      });
      return btn;
    });

    if (question.helpText) {
      hintBox.appendChild(button('Показать подсказку', function () {
        while (hintBox.firstChild) hintBox.removeChild(hintBox.firstChild);
        hintBox.appendChild(h('p', { class: 'hint-text', text: 'Подсказка: ' + question.helpText }));
      }, 'ghost'));
    }

    var giveUpButton = button('Сдаюсь', function () { finish(core.giveUp(game), null, 'skipped'); }, 'danger');
    var answered = player.answers.length + 1;
    show(h('main', { class: 'screen screen-board' }, [
      h('header', { class: 'boardbar' }, [
        h('span', { class: 'meter' }, [h('span', { class: 'meter-label', text: 'Вопрос' }), h('strong', { class: 'meter-value', text: answered + '/' + player.turns.length })]),
        h('span', { class: 'meter' }, [h('span', { class: 'meter-label', text: 'Ходит' }), h('strong', { class: 'meter-value meter-name', text: player.name })]),
        h('span', { class: 'meter' }, [h('span', { class: 'meter-label', text: 'Таймер' }), timerValue]),
        h('span', { class: 'meter' }, [h('span', { class: 'meter-label', text: 'Очки сейчас' }), scoreValue]),
        giveUpButton,
      ]),
      h('div', { class: 'timebar', 'aria-hidden': 'true' }, [timeBar]),
      h('section', { class: 'question' }, [
        question.theme ? h('p', { class: 'eyebrow', text: question.theme }) : null,
        h('h1', { class: 'question-text', text: question.text }),
        hintBox,
      ]),
      h('div', { class: 'options', role: 'group', 'aria-label': 'Варианты ответа' }, optionButtons),
      h('p', { class: 'keys-hint muted', text: 'Ответить можно и с клавиатуры: клавиши 1–4.' }),
      verdict,
    ]));
    // Фокус на первый вариант НЕ ставится: рамка фокуса выглядела подсказкой.
    // Клавиши 1–4 слушает документ, поэтому работают и без фокуса на поле.
    keyHandler = function (event) {
      var index = ['1', '2', '3', '4'].indexOf(event.key);
      if (index !== -1 && optionButtons[index] && !locked) optionButtons[index].click();
    };
    document.addEventListener('keydown', keyHandler);

    timerId = setInterval(function () {
      var elapsed = elapsedSeconds();
      var left = Math.max(0, question.timeSeconds - elapsed);
      timerValue.textContent = Math.ceil(left) + ' с';
      scoreValue.textContent = String(core.scoreForAnswer(question.price, question.timeSeconds, elapsed, true));
      timeBar.style.transform = 'scaleX(' + (left / question.timeSeconds) + ')';
      if (left <= 0) finish(core.timeOut(game), null, 'timeout');
    }, TICK_MS);
  }

  // ─── Экран: итоги ────────────────────────────────────────────────────────

  var OUTCOME_LABELS = { correct: '✓ верно', wrong: '✗ неверно', skipped: '— пропущен', timeout: '✗ время вышло' };

  function showResults(game, setup) {
    state.screen = 'results';
    var results = core.results(game).slice().sort(function (a, b) { return a.place - b.place; });
    var rows = results.map(function (r) {
      return h('tr', { class: r.place === 1 ? 'row-winner' : '' }, [
        h('td', { class: 'cell-place', text: String(r.place) }),
        h('th', { scope: 'row', text: r.name }),
        h('td', { text: r.correct + ' из ' + r.answers.length }),
        h('td', { class: 'cell-score', text: String(r.score) }),
      ]);
    });
    var details = results.map(function (r) {
      return h('details', { class: 'detail' }, [
        h('summary', { text: 'Подробнее: ' + r.name }),
        h('ol', { class: 'detail-list' }, r.answers.map(function (a) {
          return h('li', { class: 'detail-item detail-' + a.outcome }, [
            h('p', { class: 'detail-question', text: a.questionText }),
            h('p', { class: 'detail-answer' }, [
              h('span', { class: 'detail-outcome', text: OUTCOME_LABELS[a.outcome] }),
              a.chosen && a.outcome === 'wrong' ? ' · ответ игрока: ' + a.chosen : '',
              ' · правильный ответ: ' + a.correctAnswer + ' · очков: ' + a.gained,
            ]),
          ]);
        })),
      ]);
    });
    show(h('main', { class: 'screen screen-results' }, [
      h('p', { class: 'eyebrow', text: state.quiz.title + ' · ' + LEVEL_LABELS[setup.level] }),
      h('h1', { class: 'display', text: 'Результат' }),
      h('table', { class: 'results' }, [
        h('thead', {}, [h('tr', {}, [h('th', { scope: 'col', text: 'Место' }), h('th', { scope: 'col', text: 'Игрок' }), h('th', { scope: 'col', text: 'Верно' }), h('th', { scope: 'col', text: 'Очки' })])]),
        h('tbody', {}, rows),
      ]),
      h('div', { class: 'details' }, details),
      h('div', { class: 'actions' }, [
        button('Новая игра', showSetup, 'primary', { 'data-autofocus': true }),
        button('К викторине', showIntro, 'ghost'),
      ]),
    ]));
  }

  // Файл, брошенный мимо зоны, иначе открылся бы вместо проигрывателя
  window.addEventListener('dragover', function (event) { event.preventDefault(); });
  window.addEventListener('drop', function (event) { event.preventDefault(); });

  showLoad('');
})();
