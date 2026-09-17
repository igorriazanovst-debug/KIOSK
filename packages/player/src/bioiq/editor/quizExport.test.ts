// packages/player/src/bioiq/editor/quizExport.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BIOIQ_EXPORT_FORMAT,
  buildExportPayload,
  serializeExportPayload,
  suggestExportFileName,
  parseAndPersistImportedQuiz,
  type BioiqExportedImage,
  type FetchAsBase64,
  type PersistLevelImage,
  type PersistItemImage,
} from './quizExport.ts';
import { BIOIQ_QUIZ_SCHEMA_VERSION, type BioiqQuestion, type BioiqQuiz } from '../model/schema.ts';

function validQuestion(overrides: Partial<BioiqQuestion> = {}): BioiqQuestion {
  return {
    id: 'q1',
    text: 'Вопрос',
    answer: 'Ответ',
    helpText: '',
    x: 10,
    y: 10,
    width: 100,
    height: 100,
    decoyPoints: [],
    alsoCorrectPoints: [],
    price: 100,
    timeSeconds: 30,
    level: 1,
    theme: 'Тема',
    questionImage: null,
    answerImage: null,
    hintImage: null,
    ...overrides,
  };
}

function validQuiz(overrides: Partial<BioiqQuiz> = {}): BioiqQuiz {
  return {
    schemaVersion: BIOIQ_QUIZ_SCHEMA_VERSION,
    id: 'quiz-1',
    title: 'Моя викторина',
    intro: '',
    themes: ['Тема'],
    passwordHash: null,
    images: {
      '1': { fileName: 'quiz-1-level1.png', width: 1000, height: 800 },
      '2': { fileName: 'quiz-1-level2.png', width: 1000, height: 800 },
      '3': { fileName: 'quiz-1-level3.png', width: 1000, height: 800 },
    },
    levels: [{ id: 1, label: 'Начинающий' }, { id: 2, label: 'Опытный' }, { id: 3, label: 'Профессионал' }],
    questions: [validQuestion()],
    genericDecoyPoints: [],
    ...overrides,
  };
}

const FAKE_IMAGE: BioiqExportedImage = { base64: 'AAAA', mimeType: 'image/png' };

test('buildExportPayload collects all three level images keyed by their fileName', async () => {
  const quiz = validQuiz();
  const fetchAsBase64: FetchAsBase64 = async () => FAKE_IMAGE;
  const payload = await buildExportPayload(quiz, fetchAsBase64);
  assert.equal(payload.format, BIOIQ_EXPORT_FORMAT);
  assert.deepEqual(payload.images['quiz-1-level1.png'], FAKE_IMAGE);
  assert.deepEqual(payload.images['quiz-1-level2.png'], FAKE_IMAGE);
  assert.deepEqual(payload.images['quiz-1-level3.png'], FAKE_IMAGE);
});

test('buildExportPayload collects question/answer/hint images of every question', async () => {
  const quiz = validQuiz({
    questions: [validQuestion({ questionImage: 'q-img.png', answerImage: 'a-img.png', hintImage: 'h-img.png' })],
  });
  const seenUrls: string[] = [];
  const fetchAsBase64: FetchAsBase64 = async (url) => {
    seenUrls.push(url);
    return FAKE_IMAGE;
  };
  const payload = await buildExportPayload(quiz, fetchAsBase64);
  assert.equal(Object.keys(payload.images).length, 6); // 3 level images + 3 item images
  assert.ok(payload.images['q-img.png']);
  assert.ok(payload.images['a-img.png']);
  assert.ok(payload.images['h-img.png']);
  assert.ok(seenUrls.some((u) => u.includes('q-img.png')));
});

test('buildExportPayload collects only the 3 level images when a question has no attached item images', async () => {
  const quiz = validQuiz();
  const fetchAsBase64: FetchAsBase64 = async () => FAKE_IMAGE;
  const payload = await buildExportPayload(quiz, fetchAsBase64);
  assert.equal(Object.keys(payload.images).length, 3);
});

test('buildExportPayload gracefully omits images the fetcher could not read (missing on disk)', async () => {
  const quiz = validQuiz();
  const fetchAsBase64: FetchAsBase64 = async () => null;
  const payload = await buildExportPayload(quiz, fetchAsBase64);
  assert.deepEqual(payload.images, {});
});

test('serializeExportPayload then JSON.parse round-trips the same structure', async () => {
  const quiz = validQuiz();
  const payload = await buildExportPayload(quiz, async () => FAKE_IMAGE);
  const json = serializeExportPayload(payload);
  const parsed = JSON.parse(json);
  assert.equal(parsed.format, BIOIQ_EXPORT_FORMAT);
  assert.equal(parsed.quiz.id, 'quiz-1');
});

test('suggestExportFileName sanitizes filesystem-unsafe characters and keeps Cyrillic', () => {
  const quiz = validQuiz({ title: 'Тест: "кавычки" / слэш?' });
  assert.equal(suggestExportFileName(quiz), 'Тест_ _кавычки_ _ слэш_.bioiq.json');
});

test('suggestExportFileName falls back to a default name for a blank title', () => {
  const quiz = validQuiz({ title: '   ' });
  assert.equal(suggestExportFileName(quiz), 'Викторина.bioiq.json');
});

function fakePersistLevelImage(prefix = 'new-level'): PersistLevelImage {
  return async (_quizId, level) => ({ ok: true, fileName: `${prefix}${level}.png` });
}

function fakePersistItemImage(prefix = 'new-item'): PersistItemImage {
  let counter = 0;
  return async (_quizId, _questionId, kind) => {
    counter += 1;
    return { ok: true, fileName: `${prefix}-${kind}-${counter}.png` };
  };
}

test('parseAndPersistImportedQuiz rejects invalid JSON', async () => {
  const result = await parseAndPersistImportedQuiz('{not valid json', fakePersistLevelImage(), fakePersistItemImage());
  assert.equal(result.ok, false);
});

test('parseAndPersistImportedQuiz rejects a JSON file without the expected format marker', async () => {
  const result = await parseAndPersistImportedQuiz(JSON.stringify({ quiz: validQuiz() }), fakePersistLevelImage(), fakePersistItemImage());
  assert.equal(result.ok, false);
});

test('parseAndPersistImportedQuiz rejects a quiz payload that fails schema validation', async () => {
  const raw = JSON.stringify({ format: BIOIQ_EXPORT_FORMAT, quiz: { title: 'incomplete' }, images: {} });
  const result = await parseAndPersistImportedQuiz(raw, fakePersistLevelImage(), fakePersistItemImage());
  assert.equal(result.ok, false);
});

test('parseAndPersistImportedQuiz assigns a fresh quiz id different from the file', async () => {
  const quiz = validQuiz();
  const payload = await buildExportPayload(quiz, async () => FAKE_IMAGE);
  const result = await parseAndPersistImportedQuiz(serializeExportPayload(payload), fakePersistLevelImage(), fakePersistItemImage());
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.notEqual(result.quiz.id, 'quiz-1');
    assert.equal(typeof result.quiz.id, 'string');
    assert.ok(result.quiz.id.length > 0);
  }
});

test('parseAndPersistImportedQuiz re-persists all three level images under freshly returned fileNames', async () => {
  const quiz = validQuiz();
  const payload = await buildExportPayload(quiz, async () => FAKE_IMAGE);
  const result = await parseAndPersistImportedQuiz(serializeExportPayload(payload), fakePersistLevelImage('recreated-level'), fakePersistItemImage());
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.quiz.images['1'].fileName, 'recreated-level1.png');
    assert.equal(result.quiz.images['2'].fileName, 'recreated-level2.png');
    assert.equal(result.quiz.images['3'].fileName, 'recreated-level3.png');
  }
});

test('parseAndPersistImportedQuiz re-persists question/answer/hint images and remaps their fileNames', async () => {
  const quiz = validQuiz({
    questions: [validQuestion({ questionImage: 'q-img.png', answerImage: 'a-img.png', hintImage: null })],
  });
  const payload = await buildExportPayload(quiz, async () => FAKE_IMAGE);
  const result = await parseAndPersistImportedQuiz(serializeExportPayload(payload), fakePersistLevelImage(), fakePersistItemImage('restored'));
  assert.equal(result.ok, true);
  if (result.ok) {
    const q = result.quiz.questions[0];
    assert.match(q.questionImage ?? '', /^restored-question-\d+\.png$/);
    assert.match(q.answerImage ?? '', /^restored-answer-\d+\.png$/);
    assert.equal(q.hintImage, null);
  }
});

test('parseAndPersistImportedQuiz fails cleanly when a level image is missing from the file', async () => {
  const raw = JSON.stringify({ format: BIOIQ_EXPORT_FORMAT, quiz: validQuiz(), images: {} });
  const result = await parseAndPersistImportedQuiz(raw, fakePersistLevelImage(), fakePersistItemImage());
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /уровня/);
});

test('parseAndPersistImportedQuiz fails cleanly when only some level images are missing', async () => {
  const quiz = validQuiz();
  const payload = await buildExportPayload(quiz, async () => FAKE_IMAGE);
  delete payload.images['quiz-1-level2.png'];
  const result = await parseAndPersistImportedQuiz(serializeExportPayload(payload), fakePersistLevelImage(), fakePersistItemImage());
  assert.equal(result.ok, false);
});

test('parseAndPersistImportedQuiz degrades a missing item-image entry to null instead of failing the whole import', async () => {
  const quiz = validQuiz({ questions: [validQuestion({ questionImage: 'q-img.png' })] });
  const payload = await buildExportPayload(quiz, async (url) => (url.includes('q-img.png') ? null : FAKE_IMAGE));
  const result = await parseAndPersistImportedQuiz(serializeExportPayload(payload), fakePersistLevelImage(), fakePersistItemImage());
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.quiz.questions[0].questionImage, null);
});

test('parseAndPersistImportedQuiz preserves passwordHash from the imported file', async () => {
  const quiz = validQuiz({ passwordHash: 'abc123hash' });
  const payload = await buildExportPayload(quiz, async () => FAKE_IMAGE);
  const result = await parseAndPersistImportedQuiz(serializeExportPayload(payload), fakePersistLevelImage(), fakePersistItemImage());
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.quiz.passwordHash, 'abc123hash');
});
