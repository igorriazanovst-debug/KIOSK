import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateSessionsByDay, todayDateKey } from './dailyStats.ts';
import type { BioiqSession } from './model/schema.ts';

function session(id: string, playedAtIso: string, players: BioiqSession['players']): BioiqSession {
  return { id, quizId: 'quiz-1', playedAtIso, players };
}

test('aggregateSessionsByDay groups sessions of the same local day together', () => {
  const sessions = [
    session('s1', '2026-09-15T08:00:00.000Z', [{ name: 'Аня', score: 100, correctCount: 2, totalCount: 3 }]),
    session('s2', '2026-09-15T10:00:00.000Z', [{ name: 'Аня', score: 50, correctCount: 1, totalCount: 3 }]),
  ];
  const result = aggregateSessionsByDay(sessions);
  assert.equal(result.length, 1);
  assert.equal(result[0].players.length, 1);
  assert.deepEqual(result[0].players[0], {
    name: 'Аня',
    gamesPlayed: 2,
    totalScore: 150,
    totalCorrect: 3,
    totalQuestions: 6,
  });
});

test('aggregateSessionsByDay keeps different days separate', () => {
  const sessions = [
    session('s1', '2026-09-14T08:00:00.000Z', [{ name: 'Аня', score: 100, correctCount: 2, totalCount: 3 }]),
    session('s2', '2026-09-15T08:00:00.000Z', [{ name: 'Аня', score: 50, correctCount: 1, totalCount: 3 }]),
  ];
  const result = aggregateSessionsByDay(sessions);
  assert.equal(result.length, 2);
});

test('aggregateSessionsByDay sorts days newest first', () => {
  const sessions = [
    session('s1', '2026-09-10T08:00:00.000Z', []),
    session('s2', '2026-09-15T08:00:00.000Z', []),
    session('s3', '2026-09-12T08:00:00.000Z', []),
  ];
  const result = aggregateSessionsByDay(sessions);
  assert.deepEqual(
    result.map((r) => r.dateKey),
    ['2026-09-15', '2026-09-12', '2026-09-10'],
  );
});

test('aggregateSessionsByDay sorts players within a day by total score descending', () => {
  const sessions = [
    session('s1', '2026-09-15T08:00:00.000Z', [
      { name: 'Игрок А', score: 30, correctCount: 1, totalCount: 2 },
      { name: 'Игрок Б', score: 90, correctCount: 2, totalCount: 2 },
    ]),
  ];
  const result = aggregateSessionsByDay(sessions);
  assert.deepEqual(
    result[0].players.map((p) => p.name),
    ['Игрок Б', 'Игрок А'],
  );
});

test('aggregateSessionsByDay tracks separate players independently across multiple games', () => {
  const sessions = [
    session('s1', '2026-09-15T08:00:00.000Z', [
      { name: 'Аня', score: 100, correctCount: 2, totalCount: 3 },
      { name: 'Боря', score: 40, correctCount: 1, totalCount: 3 },
    ]),
    session('s2', '2026-09-15T09:00:00.000Z', [{ name: 'Боря', score: 60, correctCount: 2, totalCount: 3 }]),
  ];
  const result = aggregateSessionsByDay(sessions);
  const borya = result[0].players.find((p) => p.name === 'Боря');
  assert.deepEqual(borya, { name: 'Боря', gamesPlayed: 2, totalScore: 100, totalCorrect: 3, totalQuestions: 6 });
  const anya = result[0].players.find((p) => p.name === 'Аня');
  assert.equal(anya?.gamesPlayed, 1);
});

test('aggregateSessionsByDay returns empty array for no sessions', () => {
  assert.deepEqual(aggregateSessionsByDay([]), []);
});

test('aggregateSessionsByDay handles a session with no players gracefully', () => {
  const result = aggregateSessionsByDay([session('s1', '2026-09-15T08:00:00.000Z', [])]);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0].players, []);
});

test('todayDateKey returns a YYYY-MM-DD string', () => {
  assert.match(todayDateKey(), /^\d{4}-\d{2}-\d{2}$/);
});
