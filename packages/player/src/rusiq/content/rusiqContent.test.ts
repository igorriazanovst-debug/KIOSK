// packages/player/src/rusiq/content/rusiqContent.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RusiqQuizSchema } from '../model/schema.ts';
import rusiqContentJson from './rusiqContent.json' with { type: 'json' };

const quiz = RusiqQuizSchema.parse(rusiqContentJson);

test('rusiqContent.json parses against RusiqQuizSchema without errors', () => {
  assert.equal(RusiqQuizSchema.safeParse(rusiqContentJson).success, true);
});

test('content has at least 600 questions (project target, above FR-021 minimum of 450)', () => {
  assert.ok(quiz.questions.length >= 600, `expected >=600, got ${quiz.questions.length}`);
});

test('content has at least 15 unique themes (project target, above FR-022 minimum of 12)', () => {
  const themes = new Set(quiz.questions.map((q) => q.theme));
  assert.ok(themes.size >= 15, `expected >=15, got ${themes.size}`);
});

test('no single theme accounts for more than 40% of all questions (balance check)', () => {
  const counts = new Map<string, number>();
  for (const q of quiz.questions) counts.set(q.theme, (counts.get(q.theme) ?? 0) + 1);
  const max = Math.max(...counts.values());
  assert.ok(max / quiz.questions.length <= 0.4, `largest theme is ${((max / quiz.questions.length) * 100).toFixed(1)}% of all questions`);
});

test('every question belongs to a valid level with a non-empty pool', () => {
  const byLevel = new Map<number, number>();
  for (const q of quiz.questions) byLevel.set(q.level, (byLevel.get(q.level) ?? 0) + 1);
  for (const level of [1, 2, 3]) {
    assert.ok((byLevel.get(level) ?? 0) > 0, `level ${level} has no questions`);
  }
});

test('no question text is empty and every question has a non-empty answer', () => {
  for (const q of quiz.questions) {
    assert.ok(q.text.trim().length > 0, `question ${q.id} has empty text`);
    assert.ok(q.answer.trim().length > 0, `question ${q.id} has empty answer`);
  }
});

// FR-005: помимо начисления баллов, ТЗ требует возможность добавить к
// вопросу подсказку — до этого теста helpText был пустой строкой у ВСЕХ
// 608 вопросов (найдено приёмочной сверкой), см. Тип7_трассировочная_матрица.md.
test('every question has a non-empty hint (helpText) that does not spell out a multi-letter answer verbatim', () => {
  for (const q of quiz.questions) {
    assert.ok(q.helpText.trim().length > 0, `question ${q.id} has empty helpText`);
    if (q.answer.trim().length > 1) {
      const hintWords = q.helpText
        .toLowerCase()
        .replace(/[«».,:;!?]/g, '')
        .split(/\s+/);
      assert.ok(
        !hintWords.includes(q.answer.trim().toLowerCase()),
        `question ${q.id} hint leaks the full answer word "${q.answer}"`,
      );
    }
  }
});

// Геометрический тест-инвариант (спека, разд. 5): правильная точка не должна
// систематически лежать дальше от центра изображения, чем ложные точки того
// же вопроса — иначе "выбери точку ближе к центру" была бы работающей
// эвристикой без чтения вопроса.
test('the correct point is not systematically closer to the image center than its own decoy points', () => {
  const cx = quiz.image.width / 2;
  const cy = quiz.image.height / 2;
  let correctCloserCount = 0;
  let comparableCount = 0;
  for (const q of quiz.questions) {
    if (q.decoyPoints.length === 0) continue;
    comparableCount++;
    const distCorrect = Math.hypot(q.x - cx, q.y - cy);
    const avgDistDecoy = q.decoyPoints.reduce((sum, p) => sum + Math.hypot(p.x - cx, p.y - cy), 0) / q.decoyPoints.length;
    if (distCorrect < avgDistDecoy) correctCloserCount++;
  }
  const fraction = correctCloserCount / comparableCount;
  // Порог 0.65 (не 0.5) — допускает некоторый естественный перекос, но
  // ловит грубую систематическую эвристику "ответ всегда ближе к центру".
  assert.ok(fraction < 0.65, `correct point is closer to center than decoys in ${(fraction * 100).toFixed(1)}% of questions — exploitable heuristic`);
});
