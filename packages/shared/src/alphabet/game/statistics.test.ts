import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearUserStatistics,
  letterChartRows,
  mergeSessionStatistics,
  tallyAnswers,
} from './statistics';
import { parseStatistics } from '../model/schema';
import type { Statistics } from '../model/schema';
import type { LetterAnswer } from './session';

const answers: LetterAnswer[] = [
  { letterNumber: 1, correct: true },
  { letterNumber: 1, correct: false },
  { letterNumber: 2, correct: true },
];

test('ответы сводятся в пары «верно / всего»', () => {
  assert.deepEqual(tallyAnswers(answers), { '1': [1, 2], '2': [1, 1] });
  assert.deepEqual(tallyAnswers([]), {});
});

test('первая партия заводит обе пары показателей', () => {
  const statistics = mergeSessionStatistics({}, 'u1', answers);
  assert.deepEqual(statistics.u1['1'], { lastSession: [1, 2], total: [1, 2] });
  assert.deepEqual(statistics.u1['2'], { lastSession: [1, 1], total: [1, 1] });
});

test('последняя сессия ЗАМЕЩАЕТСЯ, итог НАКАПЛИВАЕТСЯ', () => {
  // Перепутать легко, а последствия неприятны в обе стороны: накапливаемая
  // «сессия» перестаёт отвечать на вопрос «как прошло занятие», замещаемый
  // итог теряет историю безвозвратно
  const first = mergeSessionStatistics({}, 'u1', answers);
  const second = mergeSessionStatistics(first, 'u1', [{ letterNumber: 1, correct: true }]);
  assert.deepEqual(second.u1['1'], { lastSession: [1, 1], total: [2, 3] });
});

test('буква, которой не было в партии, обнуляет сессию и сохраняет итог', () => {
  // Иначе на графике сегодняшнего занятия висят вчерашние столбики
  const first = mergeSessionStatistics({}, 'u1', answers);
  const second = mergeSessionStatistics(first, 'u1', [{ letterNumber: 1, correct: true }]);
  assert.deepEqual(second.u1['2'], { lastSession: [0, 0], total: [1, 1] });
});

test('партия одного игрока не трогает статистику другого', () => {
  const first = mergeSessionStatistics({}, 'u1', answers);
  const second = mergeSessionStatistics(first, 'u2', [{ letterNumber: 3, correct: false }]);
  assert.deepEqual(second.u1, first.u1);
  assert.deepEqual(second.u2['3'], { lastSession: [0, 1], total: [0, 1] });
});

test('слияние не правит переданный объект', () => {
  const before: Statistics = {};
  mergeSessionStatistics(before, 'u1', answers);
  assert.deepEqual(before, {});
});

test('результат слияния проходит собственный разбор', () => {
  // Иначе на диск лёг бы объект, который при следующем запуске отбросится
  const statistics = mergeSessionStatistics({}, 'u1', answers);
  assert.deepEqual(parseStatistics(statistics), statistics);
});

test('очистка убирает одного пользователя и не задевает остальных', () => {
  let statistics = mergeSessionStatistics({}, 'u1', answers);
  statistics = mergeSessionStatistics(statistics, 'u2', answers);
  const cleared = clearUserStatistics(statistics, 'u1');
  assert.equal(cleared.u1, undefined);
  assert.ok(cleared.u2);
  assert.ok(statistics.u1, 'исходный объект не тронут');
});

test('график показывает все запрошенные буквы, а не только отвеченные', () => {
  const statistics = mergeSessionStatistics({}, 'u1', answers);
  const rows = letterChartRows(statistics, 'u1', [1, 2, 3]);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].lastSession, 0.5);
  assert.equal(rows[1].total, 1);
});

test('буква без ответов даёт null, а не ноль', () => {
  // Ноль на графике читается как «отвечал и всё неверно» — ровно
  // противоположно правде «ещё не отвечал»
  const rows = letterChartRows({}, 'u1', [7]);
  assert.deepEqual(rows[0], {
    letterNumber: 7,
    lastSession: null,
    total: null,
    lastSessionAnswers: 0,
    totalAnswers: 0,
  });
});

test('буква, которой не было в последней сессии, отличима от буквы без ответов', () => {
  const first = mergeSessionStatistics({}, 'u1', answers);
  const second = mergeSessionStatistics(first, 'u1', [{ letterNumber: 1, correct: true }]);
  const rows = letterChartRows(second, 'u1', [2, 7]);
  assert.equal(rows[0].lastSession, null);
  assert.equal(rows[0].total, 1, 'итог по букве 2 сохранился');
  assert.equal(rows[1].total, null, 'буквы 7 не было никогда');
});
