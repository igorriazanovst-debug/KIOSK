import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BioiqQuizSchema, BioiqUserDataSchema, BIOIQ_QUIZ_SCHEMA_VERSION, BIOIQ_USERDATA_SCHEMA_VERSION, BIOIQ_DEFAULT_POINT_SIZE } from './schema.ts';

function validQuestion(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'q1',
    text: 'Самый сильный окислитель.',
    answer: 'Фтор',
    helpText: '',
    x: 728,
    y: 123,
    decoyPoints: [{ x: 458, y: 526 }],
    price: 100,
    timeSeconds: 30,
    level: 1,
    theme: 'Химические соединения',
    ...overrides,
  };
}

function validQuiz(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    schemaVersion: BIOIQ_QUIZ_SCHEMA_VERSION,
    id: 'quiz1',
    title: 'Химия',
    intro: 'Викторина по химии.',
    themes: ['Химические соединения'],
    passwordHash: null,
    images: {
      '1': { fileName: 'level1.png', width: 1200, height: 798 },
      '2': { fileName: 'level2.png', width: 1200, height: 798 },
      '3': { fileName: 'level3.png', width: 1200, height: 798 },
    },
    levels: [{ id: 1, label: 'Начинающий' }, { id: 2, label: 'Опытный' }, { id: 3, label: 'Профессионал' }],
    questions: [validQuestion()],
    genericDecoyPoints: [{ x: 10, y: 20, level: 1 }],
    ...overrides,
  };
}

test('BioiqQuizSchema accepts a minimal valid quiz', () => {
  const result = BioiqQuizSchema.safeParse(validQuiz());
  assert.equal(result.success, true);
});

test('BioiqQuizSchema rejects a wrong schemaVersion', () => {
  const result = BioiqQuizSchema.safeParse(validQuiz({ schemaVersion: 2 }));
  assert.equal(result.success, false);
});

test('BioiqQuizSchema rejects a question with an out-of-range level', () => {
  const result = BioiqQuizSchema.safeParse(validQuiz({ questions: [validQuestion({ level: 4 })] }));
  assert.equal(result.success, false);
});

test('BioiqQuizSchema rejects a question with empty text', () => {
  const result = BioiqQuizSchema.safeParse(validQuiz({ questions: [validQuestion({ text: '' })] }));
  assert.equal(result.success, false);
});

test('BioiqQuizSchema defaults genericDecoyPoints to an empty array when absent', () => {
  const quiz = validQuiz();
  delete (quiz as Record<string, unknown>).genericDecoyPoints;
  const result = BioiqQuizSchema.safeParse(quiz);
  assert.equal(result.success, true);
  if (result.success) assert.deepEqual(result.data.genericDecoyPoints, []);
});

test('BioiqQuizSchema defaults width/height to BIOIQ_DEFAULT_POINT_SIZE on a question point without them', () => {
  const question = validQuestion();
  delete (question as Record<string, unknown>).width;
  delete (question as Record<string, unknown>).height;
  const result = BioiqQuizSchema.safeParse(validQuiz({ questions: [question] }));
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.questions[0].width, BIOIQ_DEFAULT_POINT_SIZE);
    assert.equal(result.data.questions[0].height, BIOIQ_DEFAULT_POINT_SIZE);
  }
});

test('BioiqQuizSchema defaults width/height on a decoyPoints entry without them', () => {
  const question = validQuestion({ decoyPoints: [{ x: 458, y: 526 }] });
  const result = BioiqQuizSchema.safeParse(validQuiz({ questions: [question] }));
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.questions[0].decoyPoints[0].width, BIOIQ_DEFAULT_POINT_SIZE);
    assert.equal(result.data.questions[0].decoyPoints[0].height, BIOIQ_DEFAULT_POINT_SIZE);
  }
});

test('BioiqQuizSchema defaults width/height on a genericDecoyPoints entry without them', () => {
  const result = BioiqQuizSchema.safeParse(validQuiz({ genericDecoyPoints: [{ x: 10, y: 20, level: 1 }] }));
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.genericDecoyPoints[0].width, BIOIQ_DEFAULT_POINT_SIZE);
    assert.equal(result.data.genericDecoyPoints[0].height, BIOIQ_DEFAULT_POINT_SIZE);
  }
});

test('BioiqQuizSchema rejects a non-positive width or height', () => {
  const question = validQuestion({ width: 0 });
  const result = BioiqQuizSchema.safeParse(validQuiz({ questions: [question] }));
  assert.equal(result.success, false);
});

// Ключевое доменное отличие от rusiq: своё изображение на каждый уровень.
test('BioiqQuizSchema rejects a quiz missing the image for a declared level', () => {
  const quiz = validQuiz();
  delete (quiz.images as Record<string, unknown>)['2'];
  const result = BioiqQuizSchema.safeParse(quiz);
  assert.equal(result.success, false);
});

test('BioiqQuizSchema validates question point bounds against ITS OWN level image, not a shared scene', () => {
  // уровень 1 -> images['1'] 1200x798; точка x=1500 за пределами уровня 1,
  // но была бы в пределах гипотетической "сцены 1280x1024" — именно тот
  // класс бага, который нашёл ~20% некликабельных вопросов у rusiq.
  const question = validQuestion({ level: 1, x: 1500, y: 500 });
  const result = BioiqQuizSchema.safeParse(validQuiz({ questions: [question] }));
  assert.equal(result.success, false);
});

test('BioiqQuizSchema validates genericDecoyPoints bounds against the image of their own level field', () => {
  const result = BioiqQuizSchema.safeParse(validQuiz({ genericDecoyPoints: [{ x: 5000, y: 20, level: 2 }] }));
  assert.equal(result.success, false);
});

test('BioiqQuizSchema accepts a point that is in-bounds for level 3 but would be out-of-bounds for a smaller level 1 image', () => {
  const quiz = validQuiz({
    images: {
      '1': { fileName: 'level1.png', width: 800, height: 600 },
      '2': { fileName: 'level2.png', width: 1000, height: 700 },
      '3': { fileName: 'level3.png', width: 1900, height: 1080 },
    },
    questions: [validQuestion({ level: 3, x: 1850, y: 1000 })],
  });
  const result = BioiqQuizSchema.safeParse(quiz);
  assert.equal(result.success, true);
});

// FR-015 (по образцу rusiq Фазы 2b): изображение к вопросу/ответу/подсказке,
// отдельное от изображения-карты уровня.
test('BioiqQuizSchema defaults question/answer/hint images to null when absent', () => {
  const result = BioiqQuizSchema.safeParse(validQuiz());
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.questions[0].questionImage, null);
    assert.equal(result.data.questions[0].answerImage, null);
    assert.equal(result.data.questions[0].hintImage, null);
  }
});

test('BioiqQuizSchema accepts explicit question/answer/hint image file names', () => {
  const question = validQuestion({
    questionImage: 'quiz1-q1-question.png',
    answerImage: 'quiz1-q1-answer.jpg',
    hintImage: 'quiz1-q1-hint.webp',
  });
  const result = BioiqQuizSchema.safeParse(validQuiz({ questions: [question] }));
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.questions[0].questionImage, 'quiz1-q1-question.png');
    assert.equal(result.data.questions[0].answerImage, 'quiz1-q1-answer.jpg');
    assert.equal(result.data.questions[0].hintImage, 'quiz1-q1-hint.webp');
  }
});

test('BioiqQuizSchema rejects an empty-string image file name (must be null, not empty)', () => {
  const question = validQuestion({ questionImage: '' });
  const result = BioiqQuizSchema.safeParse(validQuiz({ questions: [question] }));
  assert.equal(result.success, false);
});

test('BioiqUserDataSchema accepts empty history and defaults soundOn to true', () => {
  const result = BioiqUserDataSchema.safeParse({ schemaVersion: BIOIQ_USERDATA_SCHEMA_VERSION, sessions: [] });
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.soundOn, true);
});

test('BioiqUserDataSchema accepts a completed session record', () => {
  const result = BioiqUserDataSchema.safeParse({
    schemaVersion: BIOIQ_USERDATA_SCHEMA_VERSION,
    soundOn: true,
    sessions: [{
      id: 's1',
      quizId: 'quiz1',
      playedAtIso: '2026-09-14T12:00:00.000Z',
      players: [{ name: 'Аня', score: 333, correctCount: 13, totalCount: 13 }],
    }],
  });
  assert.equal(result.success, true);
});

test('BioiqUserDataSchema defaults activeQuizId and teacherPinHash to null', () => {
  const result = BioiqUserDataSchema.safeParse({ schemaVersion: BIOIQ_USERDATA_SCHEMA_VERSION, sessions: [] });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.activeQuizId, null);
    assert.equal(result.data.teacherPinHash, null);
  }
});

// boardZoomed - находка 2026-09-15 (предложение пользователя «сохранить выбор
// Крупнее между партиями»): без явного поля в userData кнопка «Крупнее»
// сбрасывалась при каждой новой игре.
test('BioiqUserDataSchema defaults boardZoomed to false', () => {
  const result = BioiqUserDataSchema.safeParse({ schemaVersion: BIOIQ_USERDATA_SCHEMA_VERSION, sessions: [] });
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.boardZoomed, false);
});

test('BioiqUserDataSchema accepts an explicit boardZoomed', () => {
  const result = BioiqUserDataSchema.safeParse({ schemaVersion: BIOIQ_USERDATA_SCHEMA_VERSION, sessions: [], boardZoomed: true });
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.boardZoomed, true);
});

test('BioiqUserDataSchema accepts an explicit activeQuizId and teacherPinHash', () => {
  const result = BioiqUserDataSchema.safeParse({
    schemaVersion: BIOIQ_USERDATA_SCHEMA_VERSION,
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
