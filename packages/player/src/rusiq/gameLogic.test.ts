import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreForAnswer, assignQuestions, nextTurn, summarizeResults, neutralTileLabels, orderTilesByPosition } from './gameLogic.ts';
import { RUSIQ_DEFAULT_POINT_SIZE, type RusiqQuestion } from './model/schema.ts';

function q(overrides: Partial<RusiqQuestion> = {}): RusiqQuestion {
  return {
    id: 'q1', text: 't', answer: 'a', helpText: '', x: 0, y: 0, width: RUSIQ_DEFAULT_POINT_SIZE, height: RUSIQ_DEFAULT_POINT_SIZE, decoyPoints: [],
    price: 100, timeSeconds: 30, level: 1, theme: 'A', questionImage: null, answerImage: null, hintImage: null,
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

test('neutralTileLabels: подпись не зависит от правильности и порядка рендера', () => {
  const tiles = [
    { key: 'c', x: 300, y: 100 },
    { key: 'a', x: 100, y: 100 },
    { key: 'correct', x: 50, y: 900 },
    { key: 'b', x: 200, y: 50 },
  ];
  const labels = neutralTileLabels(tiles);
  assert.equal(labels.get('b'), 'Область 1');
  assert.equal(labels.get('a'), 'Область 2');
  assert.equal(labels.get('c'), 'Область 3');
  assert.equal(labels.get('correct'), 'Область 4');
  const reversed = neutralTileLabels([...tiles].reverse());
  assert.deepEqual([...reversed.entries()].sort(), [...labels.entries()].sort());
  assert.equal(new Set(labels.values()).size, tiles.length);
});

test('orderTilesByPosition: верная область не оказывается последней только потому, что построена последней', () => {
  const tiles = [{ key: 'd1', x: 500, y: 500 }, { key: 'd2', x: 100, y: 900 }, { key: 'correct', x: 300, y: 100 }];
  assert.deepEqual(orderTilesByPosition(tiles).map((t) => t.key), ['correct', 'd1', 'd2']);
  assert.deepEqual(tiles.map((t) => t.key), ['d1', 'd2', 'correct']);
});
