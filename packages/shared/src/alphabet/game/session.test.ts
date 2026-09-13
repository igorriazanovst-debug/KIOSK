import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  answer,
  buildAlphabetSession,
  cellCount,
  currentPlayerId,
  currentQuestion,
  eligibleWords,
  expectedKey,
  scoredLetter,
  MAX_PLAYERS,
  SessionSetupError,
} from './session';
import type { AlphabetSession, AlphabetStage } from './session';
import { seededRng } from './random';
import { testLibrary } from '../model/testLibrary';
import type { AlphabetLibrary } from '../model/schema';

function session(stage: AlphabetStage, questionsPerPlayer = 2, playerIds = ['p1']) {
  return buildAlphabetSession(testLibrary(), {
    roundId: 'r1',
    stage,
    playerIds,
    questionsPerPlayer,
    rng: seededRng(2026),
  });
}

/** Пройти текущую ячейку верно */
function answerCorrectly(library: AlphabetLibrary, state: AlphabetSession) {
  const question = currentQuestion(state);
  assert.ok(question);
  return answer(library, state, expectedKey(question, state.cellIndex));
}

test('отбор слов под этап учитывает длину слова', () => {
  const library = testLibrary();
  assert.deepEqual(eligibleWords(library, 'letterShow'), ['avtobus', 'arbuz', 'banan', 'bant']);
  assert.deepEqual(eligibleWords(library, 'wordCompleting'), ['avtobus', 'arbuz', 'banan']);
  assert.deepEqual(eligibleWords(library, 'wordMake'), ['avtobus', 'arbuz', 'banan']);
});

test('партия собирается на каждый этап', () => {
  for (const stage of ['letterShow', 'wordCompleting', 'wordMake'] as const) {
    const state = session(stage, 3);
    assert.equal(state.questions.p1.length, 3);
    assert.equal(state.questions.p1[0].stage, stage);
  }
});

test('вопросов больше, чем слов — слово повторяется, но не двумя подряд', () => {
  const state = session('wordMake', 12);
  const ids = state.questions.p1.map((q) => q.wordId);
  assert.equal(ids.length, 12);
  for (let i = 1; i < ids.length; i++) {
    assert.notEqual(ids[i], ids[i - 1], `слово ${ids[i]} повторилось подряд на шаге ${i}`);
  }
});

test('несобираемая партия называет этап, а не «не повезло»', () => {
  const library = testLibrary();
  library.words = library.words.filter((w) => w.id === 'bant');
  assert.throws(
    () =>
      buildAlphabetSession(library, {
        roundId: 'r1',
        stage: 'wordCompleting',
        playerIds: ['p1'],
        questionsPerPlayer: 1,
        rng: seededRng(1),
      }),
    /wordCompleting/
  );
});

test('состав игроков проверяется на входе', () => {
  assert.throws(() => session('letterShow', 1, []), SessionSetupError);
  assert.throws(() => session('letterShow', 1, ['p1', 'p1']), /повторяются/);
  assert.throws(
    () => session('letterShow', 1, ['p1', 'p2', 'p3', 'p4', 'p5']),
    new RegExp(String(MAX_PLAYERS))
  );
});

test('верный ответ закрывает вопрос этапа 1 и двигает партию', () => {
  const library = testLibrary();
  let state = session('letterShow', 2);
  const outcome = answerCorrectly(library, state);
  assert.equal(outcome.correct, true);
  assert.equal(outcome.questionFinished, true);
  assert.equal(outcome.sessionFinished, false);
  assert.equal(outcome.session.questionIndex, 1);
  assert.deepEqual(outcome.session.tally.p1, { completed: 1, flawless: 1, errors: 0 });
});

test('ошибка не закрывает вопрос, а убирает вариант с панели', () => {
  const library = testLibrary();
  const state = session('letterShow', 1);
  const question = currentQuestion(state);
  assert.ok(question && question.stage === 'letterShow');
  const wrong = question.optionLetterNumbers.find((n) => n !== question.answerLetterNumber);
  const outcome = answer(library, state, wrong as number);
  assert.equal(outcome.correct, false);
  assert.equal(outcome.questionFinished, false);
  assert.deepEqual(outcome.session.rejected, [String(wrong)]);
  assert.equal(outcome.session.errorsInQuestion, 1);
  assert.equal(outcome.session.tally.p1.errors, 1);
  // вопрос всё ещё тот же
  assert.equal(outcome.session.questionIndex, 0);
});

test('повторная ошибка одним и тем же вариантом не дублирует его в отказах', () => {
  const library = testLibrary();
  const state = session('letterShow', 1);
  const question = currentQuestion(state);
  assert.ok(question && question.stage === 'letterShow');
  const wrong = question.optionLetterNumbers.find((n) => n !== question.answerLetterNumber);
  const once = answer(library, state, wrong as number).session;
  const twice = answer(library, once, wrong as number).session;
  assert.deepEqual(twice.rejected, [String(wrong)]);
  assert.equal(twice.errorsInQuestion, 2);
});

test('вопрос, закрытый с ошибкой, не считается безупречным', () => {
  const library = testLibrary();
  let state = session('letterShow', 1);
  const question = currentQuestion(state);
  assert.ok(question && question.stage === 'letterShow');
  const wrong = question.optionLetterNumbers.find((n) => n !== question.answerLetterNumber);
  state = answer(library, state, wrong as number).session;
  const outcome = answerCorrectly(library, state);
  assert.deepEqual(outcome.session.tally.p1, { completed: 1, flawless: 0, errors: 1 });
  assert.deepEqual(outcome.session.results.p1, [
    { wordId: question.wordId, solved: true, errors: 1 },
  ]);
});

test('этап 3 закрывается по ячейке, а не целиком', () => {
  const library = testLibrary();
  let state = session('wordMake', 1);
  const question = currentQuestion(state);
  assert.ok(question && question.stage === 'wordMake');
  const cells = cellCount(question);
  assert.ok(cells >= 2);

  for (let i = 0; i < cells - 1; i++) {
    const outcome = answerCorrectly(library, state);
    assert.equal(outcome.correct, true);
    assert.equal(outcome.questionFinished, false, `ячейка ${i} не должна закрывать вопрос`);
    assert.equal(outcome.session.cellIndex, i + 1);
    state = outcome.session;
  }
  const last = answerCorrectly(library, state);
  assert.equal(last.questionFinished, true);
  assert.equal(last.sessionFinished, true);
});

test('отказы предыдущей ячейки не переносятся на следующую', () => {
  const library = testLibrary();
  let state = session('wordMake', 1);
  const question = currentQuestion(state);
  assert.ok(question && question.stage === 'wordMake');
  const wrong = question.optionSyllableIds.find(
    (id) => !question.answerSyllableIds.includes(id)
  );
  state = answer(library, state, wrong as string).session;
  assert.deepEqual(state.rejected, [wrong]);
  state = answerCorrectly(library, state).session;
  assert.deepEqual(state.rejected, [], 'на новой ячейке панель полная');
});

test('ход переходит по кругу, номер вопроса растёт только на замыкании круга', () => {
  const library = testLibrary();
  let state = session('letterShow', 2, ['p1', 'p2']);
  assert.equal(currentPlayerId(state), 'p1');

  state = answerCorrectly(library, state).session;
  assert.equal(currentPlayerId(state), 'p2');
  assert.equal(state.questionIndex, 0, 'второй игрок отвечает на свой первый вопрос');

  state = answerCorrectly(library, state).session;
  assert.equal(currentPlayerId(state), 'p1');
  assert.equal(state.questionIndex, 1);
});

test('партия завершается после последнего вопроса последнего игрока', () => {
  const library = testLibrary();
  let state = session('letterShow', 1, ['p1', 'p2']);
  state = answerCorrectly(library, state).session;
  const last = answerCorrectly(library, state);
  assert.equal(last.sessionFinished, true);
  assert.equal(last.session.finished, true);
  assert.equal(currentQuestion(last.session), null);
});

test('ответ в завершённой партии ничего не меняет', () => {
  const library = testLibrary();
  let state = session('letterShow', 1);
  state = answerCorrectly(library, state).session;
  const after = answer(library, state, 1);
  assert.equal(after.session, state, 'состояние должно вернуться тем же объектом');
  assert.equal(after.sessionFinished, true);
});

test('исходное состояние не правится на месте', () => {
  const library = testLibrary();
  const state = session('letterShow', 2);
  const before = JSON.stringify(state);
  answerCorrectly(library, state);
  assert.equal(JSON.stringify(state), before);
});

test('на этапе 1 ответ засчитывается первой букве слова', () => {
  const library = testLibrary();
  const state = session('letterShow', 1);
  const question = currentQuestion(state);
  assert.ok(question && question.stage === 'letterShow');
  assert.equal(scoredLetter(library, question, 0), question.answerLetterNumber);
});

test('на этапах 2 и 3 ответ засчитывается первой букве подбираемого слога', () => {
  const library = testLibrary();
  const state = session('wordMake', 1);
  const question = currentQuestion(state);
  assert.ok(question && question.stage === 'wordMake');
  const syllableId = question.answerSyllableIds[1];
  const syllable = library.syllables.find((s) => s.id === syllableId);
  assert.equal(scoredLetter(library, question, 1), syllable?.letterNumbers[0]);
});

test('слог без букв не роняет партию — ответ просто не попадает в статистику', () => {
  const library = testLibrary();
  const broken = library.syllables.find((s) => s.id === 'bus');
  assert.ok(broken);
  broken.letterNumbers = [];
  const state = buildAlphabetSession(library, {
    roundId: 'r1',
    stage: 'wordCompleting',
    playerIds: ['p1'],
    questionsPerPlayer: 4,
    rng: seededRng(2026),
  });
  // На любом вопросе движок обязан выдать какую-то букву или null,
  // но не бросить исключение
  for (const question of state.questions.p1) {
    assert.doesNotThrow(() => scoredLetter(library, question, 0));
  }
});

test('каждый ответ, верный и нет, попадает в список для статистики', () => {
  const library = testLibrary();
  let state = session('letterShow', 1);
  const question = currentQuestion(state);
  assert.ok(question && question.stage === 'letterShow');
  const wrong = question.optionLetterNumbers.find((n) => n !== question.answerLetterNumber);
  state = answer(library, state, wrong as number).session;
  state = answerCorrectly(library, state).session;
  assert.deepEqual(state.answers.p1, [
    { letterNumber: question.answerLetterNumber, correct: false },
    { letterNumber: question.answerLetterNumber, correct: true },
  ]);
});

// ─── Совместная игра: задания игроков не повторяются ───────────────────────
//
// Проверяем через buildAlphabetSession, а не через саму раздачу: верный
// алгоритм можно подключить неверно — например, разложить ходы по игрокам не
// в том порядке, в каком они ходят, и тогда свойство раздачи до стола не
// дойдёт.
//
// Прогоняем на многих зёрнах: прежняя раздача по игрокам на отдельных зёрнах
// тоже давала чистый круг, и одно зерно ничего не доказывает.

/** Слова партии в ПОРЯДКЕ ХОДА, как их видят дети за столом */
function wordsInTurnOrder(state: AlphabetSession): string[] {
  const order: string[] = [];
  for (let q = 0; q < state.questionsPerPlayer; q++) {
    for (const playerId of state.playerIds) {
      order.push(state.questions[playerId][q].wordId);
    }
  }
  return order;
}

test('в совместной игре слова игроков не повторяются в одном круге', () => {
  const players = ['p1', 'p2', 'p3', 'p4'];
  for (let seed = 1; seed <= 100; seed++) {
    const state = buildAlphabetSession(testLibrary(), {
      roundId: 'r1',
      stage: 'letterShow',
      playerIds: players,
      questionsPerPlayer: 3,
      rng: seededRng(seed),
    });
    const order = wordsInTurnOrder(state);
    for (let q = 0; q < 3; q++) {
      const round = order.slice(q * players.length, (q + 1) * players.length);
      assert.equal(
        new Set(round).size,
        players.length,
        `зерно ${seed}, круг ${q}: повтор в круге — ${round.join(', ')}`
      );
    }
  }
});

test('в совместной игре одно слово не выпадает игроку двумя его ходами подряд', () => {
  // Трое, а не четверо: в тестовом пакете ровно четыре слова, пригодных
  // этапу 1. При четверых запас РАВЕН числу игроков, и тогда это правило и
  // правило чистого круга вместе невыполнимы — см. границу в utils/turnDeal.
  // Отдельным тестом ниже зафиксировано, что в этом случае держится главное
  const players = ['p1', 'p2', 'p3'];
  for (let seed = 1; seed <= 100; seed++) {
    const state = buildAlphabetSession(testLibrary(), {
      roundId: 'r1',
      stage: 'letterShow',
      playerIds: players,
      questionsPerPlayer: 3,
      rng: seededRng(seed),
    });
    for (const playerId of players) {
      const mine = state.questions[playerId].map((q) => q.wordId);
      for (let i = 1; i < mine.length; i++) {
        assert.notEqual(mine[i], mine[i - 1], `зерно ${seed}, ${playerId}: своё слово подряд`);
      }
    }
  }
});

test('в одиночной игре слово по-прежнему не встаёт двумя вопросами подряд', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const state = buildAlphabetSession(testLibrary(), {
      roundId: 'r1',
      stage: 'letterShow',
      playerIds: ['p1'],
      questionsPerPlayer: 8,
      rng: seededRng(seed),
    });
    const mine = state.questions.p1.map((q) => q.wordId);
    for (let i = 1; i < mine.length; i++) {
      assert.notEqual(mine[i], mine[i - 1], `зерно ${seed}: повтор подряд`);
    }
  }
});

test('каждому игроку достаётся ровно столько вопросов, сколько заказано', () => {
  const players = ['p1', 'p2', 'p3'];
  const state = buildAlphabetSession(testLibrary(), {
    roundId: 'r1',
    stage: 'letterShow',
    playerIds: players,
    questionsPerPlayer: 4,
    rng: seededRng(11),
  });
  for (const playerId of players) {
    assert.equal(state.questions[playerId].length, 4);
  }
});

test('слов ровно столько же, сколько игроков: круг всё равно чист', () => {
  // Вырожденный случай: педагог собрал комплект ровно из четырёх слов на
  // четверых. Главное требование — не выдать двум детям одно задание
  // одновременно — держится и здесь; повтор у одного игрока между кругами
  // принимается осознанно, потому что развести оба правила сразу при таком
  // запасе эта раздача не может
  const players = ['p1', 'p2', 'p3', 'p4'];
  for (let seed = 1; seed <= 50; seed++) {
    const state = buildAlphabetSession(testLibrary(), {
      roundId: 'r1',
      stage: 'letterShow',
      playerIds: players,
      questionsPerPlayer: 3,
      rng: seededRng(seed),
    });
    const order = wordsInTurnOrder(state);
    for (let q = 0; q < 3; q++) {
      const round = order.slice(q * players.length, (q + 1) * players.length);
      assert.equal(new Set(round).size, players.length, `зерно ${seed}, круг ${q}`);
    }
  }
});
