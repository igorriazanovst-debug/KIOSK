// packages/player/src/rusiq/content/rusiqContent.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RusiqQuizSchema } from '../model/schema.ts';
import rusiqContentJson from './rusiqContent.json' with { type: 'json' };

const quiz = RusiqQuizSchema.parse(rusiqContentJson);

test('rusiqContent.json parses against RusiqQuizSchema without errors', () => {
  assert.equal(RusiqQuizSchema.safeParse(rusiqContentJson).success, true);
});

test('base content has at least 450 questions (FR-021)', () => {
  assert.ok(quiz.questions.length >= 450, `expected >=450, got ${quiz.questions.length}`);
});

test('base content has at least 12 unique themes (FR-022)', () => {
  const themes = new Set(quiz.questions.map((q) => q.theme));
  assert.ok(themes.size >= 12, `expected >=12, got ${themes.size}`);
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
