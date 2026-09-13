import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSession,
  answer,
  currentPlayerId,
  currentStep,
  visibleOptions,
  interrupt,
  effectiveLevel,
  GameSetupError,
} from './session';
import type { GameSession, Rng, StepLevel } from './session';

/** Детерминированный ГПСЧ (mulberry32) — партии в тестах должны быть воспроизводимы */
function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const THEME_WORDS = ['0000', '0001', '0002', '0003', '0004', '0005'];

function session(overrides: Partial<Parameters<typeof buildSession>[0]> = {}): GameSession {
  return buildSession({
    roundId: 'r1',
    themeId: 'digits',
    playerIds: ['p1'],
    themeWordIds: THEME_WORDS,
    stepsPerPlayer: 3,
    optionsPerStep: 4,
    levelOf: () => 0 as StepLevel,
    rng: seededRng(42),
    ...overrides,
  });
}

/** Ответить верно на текущий шаг */
function answerCorrectly(s: GameSession): GameSession {
  const step = currentStep(s);
  assert.ok(step, 'ожидался незакрытый шаг');
  return answer(s, step.targetWordId).session;
}

/** Первый неверный вариант текущего шага */
function wrongOption(s: GameSession): string {
  const step = currentStep(s)!;
  const wrong = step.optionWordIds.find((id) => id !== step.targetWordId);
  assert.ok(wrong, 'на шаге должен быть хотя бы один неверный вариант');
  return wrong;
}

test('партия строит заданное число шагов на каждого игрока', () => {
  const s = session({ playerIds: ['p1', 'p2'], stepsPerPlayer: 20 });
  assert.equal(s.steps.p1.length, 20);
  assert.equal(s.steps.p2.length, 20);
});

test('шаг содержит загаданное слово среди вариантов', () => {
  const s = session();
  for (const step of s.steps.p1) {
    assert.ok(step.optionWordIds.includes(step.targetWordId));
    assert.equal(step.optionWordIds.length, 4);
    assert.equal(new Set(step.optionWordIds).size, 4, 'варианты не должны повторяться');
  }
});

test('когда слов в теме меньше, чем вариантов, добираются из запаса', () => {
  const s = session({
    themeWordIds: ['0000', '0001'],
    fallbackWordIds: ['0900', '0901', '0902'],
    optionsPerStep: 4,
  });
  for (const step of s.steps.p1) {
    assert.equal(step.optionWordIds.length, 4);
  }
});

test('слов не хватает даже с запасом — вариантов просто меньше, партия строится', () => {
  const s = session({ themeWordIds: ['0000', '0001'], optionsPerStep: 4 });
  assert.equal(s.steps.p1[0].optionWordIds.length, 2);
});

test('слов в теме меньше, чем шагов — загаданные повторяются, но никогда не подряд', () => {
  // Слов 2, шагов 6 — три прохода подряд, стыки проходов проверяются тоже:
  // одно и то же слово два шага подряд ребёнку показывать нельзя.
  for (let seed = 1; seed <= 50; seed++) {
    const s = session({ themeWordIds: ['0000', '0001'], stepsPerPlayer: 6, rng: seededRng(seed) });
    const targets = s.steps.p1.map((step) => step.targetWordId);
    assert.equal(targets.length, 6);
    for (let i = 1; i < targets.length; i++) {
      assert.notEqual(targets[i], targets[i - 1], `seed ${seed}, шаг ${i}`);
    }
  }
});

test('тема из одного слова: повтор подряд неизбежен и не роняет построение партии', () => {
  const s = session({ themeWordIds: ['0000'], stepsPerPlayer: 3 });
  assert.deepEqual(
    s.steps.p1.map((step) => step.targetWordId),
    ['0000', '0000', '0000'],
  );
});

test('партия без игроков или без слов не строится', () => {
  assert.throws(() => session({ playerIds: [] }), GameSetupError);
  assert.throws(() => session({ themeWordIds: [] }), GameSetupError);
  assert.throws(() => session({ playerIds: ['p1', 'p1'] }), GameSetupError);
});

test('верный ответ закрывает шаг и передаёт ход следующему игроку', () => {
  let s = session({ playerIds: ['p1', 'p2', 'p3'], stepsPerPlayer: 2 });
  assert.equal(currentPlayerId(s), 'p1');
  assert.equal(s.stepIndex, 0);

  s = answerCorrectly(s);
  assert.equal(currentPlayerId(s), 'p2');
  assert.equal(s.stepIndex, 0, 'шаг тот же, ходит следующий игрок');

  s = answerCorrectly(s);
  assert.equal(currentPlayerId(s), 'p3');

  s = answerCorrectly(s);
  assert.equal(currentPlayerId(s), 'p1');
  assert.equal(s.stepIndex, 1, 'круг замкнулся — переходим к следующему шагу');
});

test('неверный ответ: счётчик ошибок растёт, ход остаётся, карточка уходит с экрана', () => {
  const s0 = session();
  const wrong = wrongOption(s0);

  const { session: s1, outcome } = answer(s0, wrong);
  assert.equal(outcome, 'wrong');
  assert.equal(s1.errorsInStep, 1);
  assert.equal(s1.attempt, 1);
  assert.equal(currentPlayerId(s1), 'p1', 'ход не передаётся');
  assert.ok(s1.rejectedWordIds.includes(wrong));
  assert.ok(!visibleOptions(s1).includes(wrong), 'отвергнутый вариант убран с экрана');
});

test('верный ответ обнуляет счётчик ошибок шага', () => {
  let s = session();
  s = answer(s, wrongOption(s)).session;
  assert.equal(s.errorsInStep, 1);
  s = answerCorrectly(s);
  assert.equal(s.errorsInStep, 0);
  assert.deepEqual(s.rejectedWordIds, []);
});

test('повторное касание уже отвергнутой карточки игнорируется, а не штрафуется', () => {
  // На сенсорной панели двойное касание — норма, второй ошибкой это быть не должно
  let s = session();
  const wrong = wrongOption(s);
  s = answer(s, wrong).session;

  const repeat = answer(s, wrong);
  assert.equal(repeat.outcome, 'ignored');
  assert.equal(repeat.session.errorsInStep, 1);
  assert.equal(repeat.session, s, 'состояние не меняется вовсе');
});

test('ответ карточкой не из этого шага игнорируется', () => {
  const s = session();
  const outside = answer(s, '9999');
  assert.equal(outside.outcome, 'ignored');
});

test('партия заканчивается после последнего шага последнего игрока', () => {
  let s = session({ playerIds: ['p1', 'p2'], stepsPerPlayer: 2 });
  for (let i = 0; i < 4; i++) {
    assert.equal(s.finished, false);
    s = answerCorrectly(s);
  }
  assert.equal(s.finished, true);
  assert.equal(currentStep(s), null);
  assert.deepEqual(visibleOptions(s), []);
});

test('ответ после конца партии игнорируется', () => {
  let s = session({ stepsPerPlayer: 1 });
  s = answerCorrectly(s);
  assert.equal(s.finished, true);
  assert.equal(answer(s, '0000').outcome, 'ignored');
});

test('счёт игрока: закрытые шаги, безошибочные шаги и всего ошибок', () => {
  let s = session({ stepsPerPlayer: 2 });
  s = answerCorrectly(s); // первый шаг с первой попытки
  s = answer(s, wrongOption(s)).session; // ошибка на втором
  s = answerCorrectly(s);

  assert.deepEqual(s.tally.p1, { completed: 2, flawless: 1, errors: 1 });
});

test('счёт ведётся по каждому игроку отдельно (ТЗ строка 52)', () => {
  let s = session({ playerIds: ['p1', 'p2'], stepsPerPlayer: 1 });
  s = answer(s, wrongOption(s)).session; // ошибается p1
  s = answerCorrectly(s);
  s = answerCorrectly(s); // p2 без ошибок

  assert.deepEqual(s.tally.p1, { completed: 1, flawless: 0, errors: 1 });
  assert.deepEqual(s.tally.p2, { completed: 1, flawless: 1, errors: 0 });
});

test('результат по слову: решено и сколько было ошибок', () => {
  let s = session({ stepsPerPlayer: 1 });
  const target = currentStep(s)!.targetWordId;
  s = answer(s, wrongOption(s)).session;
  assert.equal(s.results.p1[target].solved, false);
  s = answerCorrectly(s);
  assert.equal(s.results.p1[target].solved, true);
  assert.equal(s.results.p1[target].errors, 1, 'ошибка прошлой попытки не теряется');
});

test('состояние партии не мутируется на месте', () => {
  const s0 = session();
  const snapshot = JSON.stringify(s0);
  answer(s0, wrongOption(s0));
  answer(s0, currentStep(s0)!.targetWordId);
  assert.equal(JSON.stringify(s0), snapshot);
});

test('досрочный выход завершает партию, не трогая накопленный счёт', () => {
  let s = session({ stepsPerPlayer: 3 });
  s = answerCorrectly(s);
  const stopped = interrupt(s);
  assert.equal(stopped.finished, true);
  assert.deepEqual(stopped.tally.p1, { completed: 1, flawless: 1, errors: 0 });
});

test('сценарий озвучки выбирается по уровню шага', () => {
  const byLevel = (level: StepLevel) => {
    const s = session({ levelOf: () => level, stepsPerPlayer: 1 });
    return answer(s, currentStep(s)!.targetWordId).scenario;
  };
  assert.equal(byLevel(0), 'level0');
  assert.equal(byLevel(1), 'level1');
  assert.equal(byLevel(2), 'level2');
});

test('пользовательское слово всегда идёт по своему сценарию озвучки', () => {
  // У слова педагога нет фразовых вариантов — только его собственная запись
  assert.equal(effectiveLevel('u1234abcd', 0), 9);
  assert.equal(effectiveLevel('u1234abcd', 2, { u1234abcd: 1 }), 9);
});

test('переопределение уровня педагогом применяется к поставочному слову', () => {
  assert.equal(effectiveLevel('0000', 0, { '0000': 2 }), 2);
  assert.equal(effectiveLevel('0000', 1, {}), 1);
  assert.equal(effectiveLevel('0000', 1, { '0000': 7 as never }), 1, 'мусорное значение игнорируется');
});

test('одна и та же партия с одним зерном ГПСЧ воспроизводится побайтово', () => {
  const a = session({ rng: seededRng(7) });
  const b = session({ rng: seededRng(7) });
  assert.deepEqual(a.steps, b.steps);
});

// ─── Совместная игра: задания игроков не повторяются ───────────────────────
//
// Проверяем через buildSession, а не через саму раздачу: верный алгоритм
// можно подключить неверно — например, разложить шаги по игрокам не в том
// порядке, в каком они ходят, и свойство раздачи до стола не дойдёт.
//
// Прогоняем на многих зёрнах. Прежняя раздача, где каждому игроку доставался
// свой независимый список, на отдельных зёрнах тоже давала чистый круг, и
// одно зерно ничего не доказывает. Здесь это особенно важно: слов в теме мало
// (у эталона 10–21 при 20 шагах), поэтому совпадения были не редкостью, а
// нормой.

/** Слова партии в ПОРЯДКЕ ХОДА, как их видят дети за столом */
function targetsInTurnOrder(state: GameSession): string[] {
  const order: string[] = [];
  for (let step = 0; step < state.stepsPerPlayer; step++) {
    for (const playerId of state.playerIds) {
      order.push(state.steps[playerId][step].targetWordId);
    }
  }
  return order;
}

test('в совместной игре слова игроков не повторяются в одном круге', () => {
  const players = ['p1', 'p2', 'p3', 'p4'];
  for (let seed = 1; seed <= 100; seed++) {
    const state = session({ playerIds: players, stepsPerPlayer: 5, rng: seededRng(seed) });
    const order = targetsInTurnOrder(state);
    for (let step = 0; step < 5; step++) {
      const round = order.slice(step * players.length, (step + 1) * players.length);
      assert.equal(
        new Set(round).size,
        players.length,
        `зерно ${seed}, круг ${step}: повтор в круге — ${round.join(', ')}`
      );
    }
  }
});

test('в совместной игре одно слово не выпадает игроку двумя его шагами подряд', () => {
  const players = ['p1', 'p2', 'p3', 'p4'];
  for (let seed = 1; seed <= 100; seed++) {
    const state = session({ playerIds: players, stepsPerPlayer: 5, rng: seededRng(seed) });
    for (const playerId of players) {
      const mine = state.steps[playerId].map((s) => s.targetWordId);
      for (let i = 1; i < mine.length; i++) {
        assert.notEqual(mine[i], mine[i - 1], `зерно ${seed}, ${playerId}: своё слово подряд`);
      }
    }
  }
});

test('в одиночной игре слово по-прежнему не встаёт двумя шагами подряд', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const state = session({ stepsPerPlayer: 20, rng: seededRng(seed) });
    const mine = state.steps.p1.map((s) => s.targetWordId);
    for (let i = 1; i < mine.length; i++) {
      assert.notEqual(mine[i], mine[i - 1], `зерно ${seed}: повтор подряд`);
    }
  }
});

test('шагов у каждого игрока ровно столько, сколько заказано', () => {
  const players = ['p1', 'p2', 'p3'];
  const state = session({ playerIds: players, stepsPerPlayer: 7 });
  for (const playerId of players) {
    assert.equal(state.steps[playerId].length, 7);
  }
});

test('тема расходуется равномерно — нет слова, которое выпадает вдвое чаще', () => {
  const players = ['p1', 'p2'];
  const state = session({ playerIds: players, stepsPerPlayer: 9, rng: seededRng(5) });
  const counts = new Map<string, number>();
  for (const word of targetsInTurnOrder(state)) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  const used = [...counts.values()];
  assert.ok(Math.max(...used) - Math.min(...used) <= 1, `разброс ${used.join(', ')}`);
  assert.equal(counts.size, THEME_WORDS.length, 'задействована не вся тема');
});
