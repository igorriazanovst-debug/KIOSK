import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreForAnswer, assignQuestions, nextTurn, summarizeResults, buildBoardTiles, neutralTileLabels } from './gameLogic.ts';
import { BIOIQ_DEFAULT_POINT_SIZE, type BioiqQuestion, type BioiqPoint } from './model/schema.ts';

function q(overrides: Partial<BioiqQuestion> = {}): BioiqQuestion {
  return {
    id: 'q1', text: 't', answer: 'a', helpText: '', x: 0, y: 0, width: BIOIQ_DEFAULT_POINT_SIZE, height: BIOIQ_DEFAULT_POINT_SIZE, decoyPoints: [], alsoCorrectPoints: [],
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

// buildBoardTiles - найденный баг (2026-09-15, жалоба пользователя «только
// некоторые иконки можно было прям нажать, хотя их в разы больше»): каждый
// вопрос уровня рисуется СВОЕЙ отдельной плиткой на общей картинке уровня
// (Фаза 7, ~53-61 плитка/уровень), но кликабельными раньше были только
// плитка ТЕКУЩЕГО вопроса + 15 статичных generic-decoy - остальные
// нарисованные плитки (другие вопросы того же уровня) были мёртвой зоной:
// выглядят как варианты ответа, но клик по ним ничего не делает. Заодно
// это была причина жалобы «пул ответов никак не меняется» - тот же
// статичный набор из 15 decoy был единственным, что реагировало на клик,
// при любом вопросе. Исправление: тайл КАЖДОГО вопроса уровня становится
// кликабельным decoy-кандидатом для любого ДРУГОГО вопроса того же уровня.

function point(overrides: Partial<BioiqPoint> = {}): BioiqPoint {
  return { x: 0, y: 0, width: BIOIQ_DEFAULT_POINT_SIZE, height: BIOIQ_DEFAULT_POINT_SIZE, ...overrides };
}

test('buildBoardTiles includes a tile for every OTHER question in the level as a clickable decoy', () => {
  const current = q({ id: 'q1', x: 10, y: 10 });
  const other1 = q({ id: 'q2', x: 200, y: 10 });
  const other2 = q({ id: 'q3', x: 400, y: 10 });
  const tiles = buildBoardTiles(current, [current, other1, other2], []);
  assert.equal(tiles.length, 3);
  const byKey = new Map(tiles.map((t) => [t.key, t]));
  assert.equal(byKey.get('10_10')?.isCorrect, true);
  assert.equal(byKey.get('200_10')?.isCorrect, false);
  assert.equal(byKey.get('400_10')?.isCorrect, false);
});

test('buildBoardTiles marks exactly one tile as correct, matching the current question coordinates', () => {
  const current = q({ id: 'q1', x: 10, y: 10 });
  const levelQuestions = [current, q({ id: 'q2', x: 200, y: 10 }), q({ id: 'q3', x: 400, y: 10 })];
  const tiles = buildBoardTiles(current, levelQuestions, []);
  const correctTiles = tiles.filter((t) => t.isCorrect);
  assert.equal(correctTiles.length, 1);
  assert.equal(correctTiles[0].x, 10);
  assert.equal(correctTiles[0].y, 10);
});

test('buildBoardTiles includes generic decoy points alongside level questions', () => {
  const current = q({ id: 'q1', x: 10, y: 10 });
  const other = q({ id: 'q2', x: 200, y: 10 });
  const decoys = [point({ x: 500, y: 10 }), point({ x: 700, y: 10 })];
  const tiles = buildBoardTiles(current, [current, other], decoys);
  assert.equal(tiles.length, 4);
  assert.equal(tiles.every((t) => !t.isCorrect || (t.x === 10 && t.y === 10)), true);
});

test('buildBoardTiles includes per-question decoyPoints, still supported for custom quizzes', () => {
  const current = q({ id: 'q1', x: 10, y: 10, decoyPoints: [point({ x: 900, y: 10 })] });
  const tiles = buildBoardTiles(current, [current], []);
  assert.equal(tiles.length, 2);
});

test('buildBoardTiles deduplicates tiles that share the same rounded coordinates, correct tile always wins', () => {
  const current = q({ id: 'q1', x: 10, y: 10 });
  const collidingOther = q({ id: 'q2', x: 10.2, y: 9.8 }); // rounds to the same key as current
  const tiles = buildBoardTiles(current, [current, collidingOther], []);
  assert.equal(tiles.length, 1);
  assert.equal(tiles[0].isCorrect, true);
});

test('buildBoardTiles excludes questions from OTHER levels even if passed in by mistake', () => {
  const current = q({ id: 'q1', x: 10, y: 10, level: 1 });
  const otherLevel = q({ id: 'q2', x: 200, y: 10, level: 2 });
  const tiles = buildBoardTiles(current, [current, otherLevel], []);
  assert.equal(tiles.length, 1);
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

test('buildBoardTiles: двойник структуры верен для своего вопроса и обманка для чужого', () => {
  const base = { helpText: '', decoyPoints: [], price: 100, timeSeconds: 30, level: 1 as const, theme: 't', questionImage: null, answerImage: null, hintImage: null, width: 50, height: 50 };
  const lung = { ...base, id: 'lung', text: 'q', answer: 'Лёгкое', x: 100, y: 100, alsoCorrectPoints: [{ x: 300, y: 100, width: 50, height: 50 }] };
  const heart = { ...base, id: 'heart', text: 'q', answer: 'Сердце', x: 200, y: 100, alsoCorrectPoints: [] };
  const generic = [{ x: 300, y: 100, width: 50, height: 50 }];

  const forLung = buildBoardTiles(lung, [lung, heart], generic);
  assert.deepEqual(forLung.filter((t) => t.isCorrect).map((t) => t.key).sort(), ['100_100', '300_100']);
  assert.equal(forLung.length, 3);

  const forHeart = buildBoardTiles(heart, [lung, heart], generic);
  assert.deepEqual(forHeart.filter((t) => t.isCorrect).map((t) => t.key), ['200_100']);
  assert.equal(forHeart.find((t) => t.key === '300_100')?.isCorrect, false);
});
