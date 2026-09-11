import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RusiqQuizSchema, RusiqUserDataSchema, RUSIQ_QUIZ_SCHEMA_VERSION, RUSIQ_USERDATA_SCHEMA_VERSION } from './schema.ts';

function validQuestion(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'q1',
    text: 'Какая буква пропущена в слове: р…бота?',
    answer: 'а',
    helpText: '',
    x: 209,
    y: 86,
    decoyPoints: [{ x: 458, y: 526 }],
    price: 100,
    timeSeconds: 30,
    level: 1,
    theme: 'Непроверяемые безударные гласные в корне слов',
    ...overrides,
  };
}

function validQuiz(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    schemaVersion: RUSIQ_QUIZ_SCHEMA_VERSION,
    id: 'quiz1',
    title: 'Обучение грамоте',
    intro: 'Викторина по орфографии.',
    themes: ['Непроверяемые безударные гласные в корне слов'],
    passwordHash: null,
    image: { fileName: 'alphabet.png', width: 1280, height: 1024 },
    levels: [{ id: 1, label: 'Начинающий' }, { id: 2, label: 'Опытный' }, { id: 3, label: 'Профессионал' }],
    questions: [validQuestion()],
    genericDecoyPoints: [{ x: 10, y: 20 }],
    ...overrides,
  };
}

test('RusiqQuizSchema accepts a minimal valid quiz', () => {
  const result = RusiqQuizSchema.safeParse(validQuiz());
  assert.equal(result.success, true);
});

test('RusiqQuizSchema rejects a wrong schemaVersion', () => {
  const result = RusiqQuizSchema.safeParse(validQuiz({ schemaVersion: 2 }));
  assert.equal(result.success, false);
});

test('RusiqQuizSchema rejects a question with an out-of-range level', () => {
  const result = RusiqQuizSchema.safeParse(validQuiz({ questions: [validQuestion({ level: 4 })] }));
  assert.equal(result.success, false);
});

test('RusiqQuizSchema rejects a question with empty text', () => {
  const result = RusiqQuizSchema.safeParse(validQuiz({ questions: [validQuestion({ text: '' })] }));
  assert.equal(result.success, false);
});

test('RusiqQuizSchema defaults genericDecoyPoints to an empty array when absent', () => {
  const quiz = validQuiz();
  delete (quiz as Record<string, unknown>).genericDecoyPoints;
  const result = RusiqQuizSchema.safeParse(quiz);
  assert.equal(result.success, true);
  if (result.success) assert.deepEqual(result.data.genericDecoyPoints, []);
});

test('RusiqUserDataSchema accepts empty history and defaults soundOn to true', () => {
  const result = RusiqUserDataSchema.safeParse({ schemaVersion: RUSIQ_USERDATA_SCHEMA_VERSION, sessions: [] });
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.soundOn, true);
});

test('RusiqUserDataSchema accepts a completed session record', () => {
  const result = RusiqUserDataSchema.safeParse({
    schemaVersion: RUSIQ_USERDATA_SCHEMA_VERSION,
    soundOn: true,
    sessions: [{
      id: 's1',
      quizId: 'quiz1',
      playedAtIso: '2026-09-10T12:00:00.000Z',
      players: [{ name: 'Аня', score: 335, correctCount: 49, totalCount: 49 }],
    }],
  });
  assert.equal(result.success, true);
});

test('RusiqUserDataSchema defaults activeQuizId and teacherPinHash to null', () => {
  const result = RusiqUserDataSchema.safeParse({ schemaVersion: RUSIQ_USERDATA_SCHEMA_VERSION, sessions: [] });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.activeQuizId, null);
    assert.equal(result.data.teacherPinHash, null);
  }
});

test('RusiqUserDataSchema accepts an explicit activeQuizId and teacherPinHash', () => {
  const result = RusiqUserDataSchema.safeParse({
    schemaVersion: RUSIQ_USERDATA_SCHEMA_VERSION,
    sessions: [],
    activeQuizId: 'quiz-custom-1',
    teacherPinHash: 'abc123',
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.activeQuizId, 'quiz-custom-1');
    assert.equal(result.data.teacherPinHash, 'abc123');
  }
});
