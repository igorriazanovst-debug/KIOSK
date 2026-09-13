// packages/player/src/rusiq/editor/quizExport.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RUSIQ_EXPORT_FORMAT,
  buildExportPayload,
  serializeExportPayload,
  suggestExportFileName,
  parseAndPersistImportedQuiz,
  type RusiqExportedImage,
  type FetchAsBase64,
  type PersistBackground,
  type PersistItemImage,
} from './quizExport.ts';
import { RUSIQ_QUIZ_SCHEMA_VERSION, type RusiqQuestion, type RusiqQuiz } from '../model/schema.ts';

function validQuestion(overrides: Partial<RusiqQuestion> = {}): RusiqQuestion {
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

function validQuiz(overrides: Partial<RusiqQuiz> = {}): RusiqQuiz {
  return {
    schemaVersion: RUSIQ_QUIZ_SCHEMA_VERSION,
    id: 'quiz-1',
    title: 'Моя викторина',
    intro: '',
    themes: ['Тема'],
    passwordHash: null,
    image: { fileName: 'quiz-1-background.png', width: 1000, height: 800 },
    levels: [{ id: 1, label: 'Начинающий' }],
    questions: [validQuestion()],
    genericDecoyPoints: [],
    ...overrides,
  };
}

const FAKE_IMAGE: RusiqExportedImage = { base64: 'AAAA', mimeType: 'image/png' };

test('buildExportPayload collects the background image keyed by its fileName', async () => {
  const quiz = validQuiz();
  const fetchAsBase64: FetchAsBase64 = async () => FAKE_IMAGE;
  const payload = await buildExportPayload(quiz, fetchAsBase64);
  assert.equal(payload.format, RUSIQ_EXPORT_FORMAT);
  assert.deepEqual(payload.images['quiz-1-background.png'], FAKE_IMAGE);
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
  assert.equal(Object.keys(payload.images).length, 4); // background + 3
  assert.ok(payload.images['q-img.png']);
  assert.ok(payload.images['a-img.png']);
  assert.ok(payload.images['h-img.png']);
  assert.ok(seenUrls.some((u) => u.includes('q-img.png')));
});

test('buildExportPayload skips a question with no attached item images without error', async () => {
  const quiz = validQuiz();
  const fetchAsBase64: FetchAsBase64 = async () => FAKE_IMAGE;
  const payload = await buildExportPayload(quiz, fetchAsBase64);
  assert.equal(Object.keys(payload.images).length, 1); // background only
});

test('buildExportPayload gracefully omits an image the fetcher could not read (missing on disk)', async () => {
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
  assert.equal(parsed.format, RUSIQ_EXPORT_FORMAT);
  assert.equal(parsed.quiz.id, 'quiz-1');
});

test('suggestExportFileName sanitizes filesystem-unsafe characters and keeps Cyrillic', () => {
  const quiz = validQuiz({ title: 'Тест: "кавычки" / слэш?' });
  assert.equal(suggestExportFileName(quiz), 'Тест_ _кавычки_ _ слэш_.rusiq.json');
});

test('suggestExportFileName falls back to a default name for a blank title', () => {
  const quiz = validQuiz({ title: '   ' });
  assert.equal(suggestExportFileName(quiz), 'Викторина.rusiq.json');
});

function fakePersistBackground(fileName = 'new-bg.png'): PersistBackground {
  return async () => ({ ok: true, fileName });
}

function fakePersistItemImage(prefix = 'new-item'): PersistItemImage {
  let counter = 0;
  return async (_quizId, _questionId, kind) => {
    counter += 1;
    return { ok: true, fileName: `${prefix}-${kind}-${counter}.png` };
  };
}

test('parseAndPersistImportedQuiz rejects invalid JSON', async () => {
  const result = await parseAndPersistImportedQuiz('{not valid json', fakePersistBackground(), fakePersistItemImage());
  assert.equal(result.ok, false);
});

test('parseAndPersistImportedQuiz rejects a JSON file without the expected format marker', async () => {
  const result = await parseAndPersistImportedQuiz(JSON.stringify({ quiz: validQuiz() }), fakePersistBackground(), fakePersistItemImage());
  assert.equal(result.ok, false);
});

test('parseAndPersistImportedQuiz rejects a quiz payload that fails schema validation', async () => {
  const raw = JSON.stringify({ format: RUSIQ_EXPORT_FORMAT, quiz: { title: 'incomplete' }, images: {} });
  const result = await parseAndPersistImportedQuiz(raw, fakePersistBackground(), fakePersistItemImage());
  assert.equal(result.ok, false);
});

test('parseAndPersistImportedQuiz assigns a fresh quiz id different from the file', async () => {
  const quiz = validQuiz();
  const payload = await buildExportPayload(quiz, async () => FAKE_IMAGE);
  const result = await parseAndPersistImportedQuiz(serializeExportPayload(payload), fakePersistBackground(), fakePersistItemImage());
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.notEqual(result.quiz.id, 'quiz-1');
    assert.equal(typeof result.quiz.id, 'string');
    assert.ok(result.quiz.id.length > 0);
  }
});

test('parseAndPersistImportedQuiz re-persists the background under a freshly returned fileName', async () => {
  const quiz = validQuiz();
  const payload = await buildExportPayload(quiz, async () => FAKE_IMAGE);
  const result = await parseAndPersistImportedQuiz(serializeExportPayload(payload), fakePersistBackground('recreated-bg.jpg'), fakePersistItemImage());
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.quiz.image.fileName, 'recreated-bg.jpg');
});

test('parseAndPersistImportedQuiz re-persists question/answer/hint images and remaps their fileNames', async () => {
  const quiz = validQuiz({
    questions: [validQuestion({ questionImage: 'q-img.png', answerImage: 'a-img.png', hintImage: null })],
  });
  const payload = await buildExportPayload(quiz, async () => FAKE_IMAGE);
  const result = await parseAndPersistImportedQuiz(serializeExportPayload(payload), fakePersistBackground(), fakePersistItemImage('restored'));
  assert.equal(result.ok, true);
  if (result.ok) {
    const q = result.quiz.questions[0];
    assert.match(q.questionImage ?? '', /^restored-question-\d+\.png$/);
    assert.match(q.answerImage ?? '', /^restored-answer-\d+\.png$/);
    assert.equal(q.hintImage, null);
  }
});

test('parseAndPersistImportedQuiz fails cleanly when the background image bytes are missing from the file', async () => {
  const raw = JSON.stringify({ format: RUSIQ_EXPORT_FORMAT, quiz: validQuiz(), images: {} });
  const result = await parseAndPersistImportedQuiz(raw, fakePersistBackground(), fakePersistItemImage());
  assert.equal(result.ok, false);
});

test('parseAndPersistImportedQuiz degrades a missing item-image entry to null instead of failing the whole import', async () => {
  const quiz = validQuiz({ questions: [validQuestion({ questionImage: 'q-img.png' })] });
  const raw = JSON.stringify({
    format: RUSIQ_EXPORT_FORMAT,
    quiz,
    images: { 'quiz-1-background.png': FAKE_IMAGE }, // q-img.png intentionally absent
  });
  const result = await parseAndPersistImportedQuiz(raw, fakePersistBackground(), fakePersistItemImage());
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.quiz.questions[0].questionImage, null);
});

test('parseAndPersistImportedQuiz preserves passwordHash from the imported file', async () => {
  const quiz = validQuiz({ passwordHash: 'abc123hash' });
  const payload = await buildExportPayload(quiz, async () => FAKE_IMAGE);
  const result = await parseAndPersistImportedQuiz(serializeExportPayload(payload), fakePersistBackground(), fakePersistItemImage());
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.quiz.passwordHash, 'abc123hash');
});
