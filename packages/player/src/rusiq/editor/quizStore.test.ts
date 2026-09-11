import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listQuizzes, loadQuiz, saveQuiz, deleteQuiz, saveQuizBackground } from './quizStore.ts';
import { RUSIQ_QUIZ_SCHEMA_VERSION, type RusiqQuiz } from '../model/schema.ts';

function validQuiz(overrides: Partial<RusiqQuiz> = {}): RusiqQuiz {
  return {
    schemaVersion: RUSIQ_QUIZ_SCHEMA_VERSION,
    id: 'quiz-1',
    title: 'Тест',
    intro: '',
    themes: [],
    passwordHash: null,
    image: { fileName: 'bg.png', width: 100, height: 100 },
    levels: [{ id: 1, label: 'Начинающий' }, { id: 2, label: 'Опытный' }, { id: 3, label: 'Профессионал' }],
    questions: [{ id: 'q1', text: 'Вопрос?', answer: 'а', helpText: '', x: 10, y: 10, decoyPoints: [], price: 100, timeSeconds: 20, level: 1, theme: 'Тема' }],
    genericDecoyPoints: [],
    ...overrides,
  };
}

test('listQuizzes returns [] when window.rusiqAPI is absent', async () => {
  assert.deepEqual(await listQuizzes(), []);
});

test('loadQuiz returns null when window.rusiqAPI is absent', async () => {
  assert.equal(await loadQuiz('any'), null);
});

test('saveQuiz returns false when window.rusiqAPI is absent', async () => {
  assert.equal(await saveQuiz(validQuiz()), false);
});

test('listQuizzes returns the raw list from the API without schema validation (metadata only)', async () => {
  (globalThis as any).window = {
    rusiqAPI: {
      listQuizzes: async () => [{ id: 'a', title: 'A', hasPassword: false, updatedAt: '2026-01-01T00:00:00.000Z' }],
    },
  };
  const result = await listQuizzes();
  assert.deepEqual(result, [{ id: 'a', title: 'A', hasPassword: false, updatedAt: '2026-01-01T00:00:00.000Z' }]);
  delete (globalThis as any).window;
});

test('loadQuiz validates the loaded object against RusiqQuizSchema and returns null on failure', async () => {
  (globalThis as any).window = {
    rusiqAPI: { loadQuiz: async () => ({ id: 'broken' }) },
  };
  assert.equal(await loadQuiz('broken'), null);
  delete (globalThis as any).window;
});

test('loadQuiz returns the parsed quiz on success', async () => {
  const quiz = validQuiz();
  (globalThis as any).window = {
    rusiqAPI: { loadQuiz: async () => quiz },
  };
  const result = await loadQuiz('quiz-1');
  assert.deepEqual(result, quiz);
  delete (globalThis as any).window;
});

test('saveQuiz calls the API and returns true on {ok: true}', async () => {
  let received: unknown = null;
  (globalThis as any).window = {
    rusiqAPI: {
      saveQuiz: async (quiz: unknown) => {
        received = quiz;
        return { ok: true };
      },
    },
  };
  const quiz = validQuiz();
  assert.equal(await saveQuiz(quiz), true);
  assert.deepEqual(received, quiz);
  delete (globalThis as any).window;
});

test('deleteQuiz returns the ok flag from the API', async () => {
  (globalThis as any).window = {
    rusiqAPI: { deleteQuiz: async () => ({ ok: true }) },
  };
  assert.equal(await deleteQuiz('quiz-1'), true);
  delete (globalThis as any).window;
});

test('saveQuizBackground returns {ok: false} when window.rusiqAPI is absent', async () => {
  const result = await saveQuizBackground('quiz-1', new ArrayBuffer(0), 'image/png');
  assert.deepEqual(result, { ok: false });
});

test('saveQuizBackground forwards to the API and returns its result', async () => {
  (globalThis as any).window = {
    rusiqAPI: {
      saveQuizBackground: async () => ({ ok: true, fileName: 'quiz-1-background.png' }),
    },
  };
  const result = await saveQuizBackground('quiz-1', new ArrayBuffer(0), 'image/png');
  assert.deepEqual(result, { ok: true, fileName: 'quiz-1-background.png' });
  delete (globalThis as any).window;
});
