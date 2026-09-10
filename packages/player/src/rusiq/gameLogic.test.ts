import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreForAnswer, assignQuestions, nextTurn, summarizeResults } from './gameLogic.ts';
import type { RusiqQuestion } from './model/schema.ts';

function q(overrides: Partial<RusiqQuestion> = {}): RusiqQuestion {
  return {
    id: 'q1', text: 't', answer: 'a', helpText: '', x: 0, y: 0, decoyPoints: [],
    price: 100, timeSeconds: 30, level: 1, theme: 'A',
    ...overrides,
  };
}

test('scoreForAnswer gives full price for an instant correct answer', () => {
  assert.equal(scoreForAnswer(100, 30, 0, true), 100);
});

test('scoreForAnswer gives roughly half price for a correct answer at the halfway mark', () => {
  assert.equal(scoreForAnswer(100, 30, 15, true), 50);
});

test('scoreForAnswer gives 0 for a wrong answer regardless of speed', () => {
  assert.equal(scoreForAnswer(100, 30, 0, false), 0);
});

test('scoreForAnswer gives 0 when time is fully elapsed even if marked correct', () => {
  assert.equal(scoreForAnswer(100, 30, 30, true), 0);
});

test('scoreForAnswer never returns a negative score for elapsed > timeSeconds', () => {
  assert.equal(scoreForAnswer(100, 30, 45, true), 0);
});

test('nextTurn cycles through players in order and wraps around', () => {
  assert.equal(nextTurn(0, 3), 1);
  assert.equal(nextTurn(1, 3), 2);
  assert.equal(nextTurn(2, 3), 0);
});

test('nextTurn is a no-op cycle for a single player', () => {
  assert.equal(nextTurn(0, 1), 0);
});

test('assignQuestions gives each player a disjoint set of questions, no repeats across players', () => {
  const pool = Array.from({ length: 10 }, (_, i) => q({ id: `q${i}` }));
  const result = assignQuestions(pool, 2, 3);
  assert.equal(result.length, 2);
  assert.equal(result[0].length, 3);
  assert.equal(result[1].length, 3);
  const allIds = [...result[0], ...result[1]].map((x) => x.id);
  assert.equal(new Set(allIds).size, allIds.length);
});

test('assignQuestions throws when the pool is too small for the requested count', () => {
  const pool = [q({ id: 'q0' }), q({ id: 'q1' })];
  assert.throws(() => assignQuestions(pool, 2, 3));
});

test('assignQuestions is deterministic given a fixed rng', () => {
  const pool = Array.from({ length: 5 }, (_, i) => q({ id: `q${i}` }));
  const fixedRng = () => 0.5;
  const a = assignQuestions(pool, 1, 3, fixedRng);
  const b = assignQuestions(pool, 1, 3, fixedRng);
  assert.deepEqual(a, b);
});

test('summarizeResults aggregates score and correctness per player', () => {
  const result = summarizeResults(['Аня', 'Боря'], [
    { playerIndex: 0, score: 90, correct: true },
    { playerIndex: 1, score: 0, correct: false },
    { playerIndex: 0, score: 60, correct: true },
  ]);
  assert.deepEqual(result, [
    { name: 'Аня', score: 150, correctCount: 2, totalCount: 2 },
    { name: 'Боря', score: 0, correctCount: 0, totalCount: 1 },
  ]);
});
