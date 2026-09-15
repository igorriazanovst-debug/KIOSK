// packages/player/src/chimiq/quizVariants.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUILTIN_QUIZ_VARIANTS, pickRandomVariant } from './quizVariants.ts';

// Находка по предложению пользователя (2026-09-16, продолжение списка
// доработок после фикса кликабельности): один и тот же статичный набор
// картинок-карт уровня показывался при КАЖДОЙ партии - у игрока со
// временем появляется "память места". Три альтернативные раскладки
// (та же геометрия сетки/тот же текст вопросов, но перемешанное
// распределение тайлов по клеткам) выбираются случайно один раз за
// запуск виджета - см. Тип9_ХимIQ/Тип9_план_реализации.md §15.

test('BUILTIN_QUIZ_VARIANTS has exactly 3 alternative layouts', () => {
  assert.equal(BUILTIN_QUIZ_VARIANTS.length, 3);
});

test('every variant carries the same 168 questions (same ids, text, answers) - only tile positions/images differ', () => {
  const [first, ...rest] = BUILTIN_QUIZ_VARIANTS;
  const firstFingerprint = first.questions
    .map((q) => `${q.id}|${q.text}|${q.answer}|${q.level}|${q.theme}`)
    .sort();
  for (const variant of rest) {
    const fingerprint = variant.questions.map((q) => `${q.id}|${q.text}|${q.answer}|${q.level}|${q.theme}`).sort();
    assert.deepEqual(fingerprint, firstFingerprint);
  }
});

test('every variant has distinct level-image file names from the others (different pictures)', () => {
  const fileNameSets = BUILTIN_QUIZ_VARIANTS.map((v) => Object.values(v.images).map((img) => img.fileName));
  const [first, second, third] = fileNameSets;
  assert.notDeepEqual(first, second);
  assert.notDeepEqual(first, third);
  assert.notDeepEqual(second, third);
});

test('pickRandomVariant returns an element from the array, deterministically given a fixed rng', () => {
  const variants = ['a', 'b', 'c'];
  assert.equal(pickRandomVariant(variants, () => 0), 'a');
  assert.equal(pickRandomVariant(variants, () => 0.34), 'b');
  assert.equal(pickRandomVariant(variants, () => 0.99), 'c');
});

test('pickRandomVariant never returns undefined even at the rng upper edge (rng() approaching 1)', () => {
  const variants = ['a', 'b', 'c'];
  const result = pickRandomVariant(variants, () => 0.9999999999);
  assert.ok(variants.includes(result));
});

test('pickRandomVariant throws on an empty array instead of returning undefined silently', () => {
  assert.throws(() => pickRandomVariant([]));
});
