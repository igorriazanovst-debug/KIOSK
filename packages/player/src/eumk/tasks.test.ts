import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkTask, normalizeAnswerText } from './tasks.ts';
import { TaskSchema, type EumkTask } from './model/schema.ts';

function task(raw: unknown): EumkTask {
  return TaskSchema.parse(raw);
}
const base = { id: 't1', title: 'T' };

test('normalizeAnswerText trims, lowercases and folds yo', () => {
  assert.equal(normalizeAnswerText('  ЁЖ   Колючий ', false), 'еж колючий');
});

test('normalizeAnswerText keeps case when caseSensitive', () => {
  assert.equal(normalizeAnswerText(' Ab ', true), 'Ab');
});

test('choice: correct only when the single right option is chosen', () => {
  const t = task({ ...base, type: 'choice', data: { options: ['a', 'b', 'c'], correct: [1] } });
  assert.equal(checkTask(t, [1]).isCorrect, true);
  assert.equal(checkTask(t, [0]).isCorrect, false);
  assert.equal(checkTask(t, []).isCorrect, false);
});

test('multi: requires exactly the right set, in any order', () => {
  const t = task({ ...base, type: 'multi', data: { options: ['a', 'b', 'c', 'd'], correct: [0, 2] } });
  assert.equal(checkTask(t, [2, 0]).isCorrect, true);
  assert.equal(checkTask(t, [0]).isCorrect, false);
  assert.equal(checkTask(t, [0, 2, 3]).isCorrect, false);
});

test('multi: partial credit is the share of right picks minus wrong picks, not below zero', () => {
  const t = task({ ...base, type: 'multi', data: { options: ['a', 'b', 'c', 'd'], correct: [0, 2] } });
  assert.equal(checkTask(t, [0]).share, 0.5);
  assert.equal(checkTask(t, [0, 3]).share, 0);
  assert.equal(checkTask(t, [1, 3]).share, 0);
});

test('order: correct only for the exact sequence', () => {
  const t = task({ ...base, type: 'order', data: { items: ['one', 'two', 'three'] } });
  assert.equal(checkTask(t, ['one', 'two', 'three']).isCorrect, true);
  assert.equal(checkTask(t, ['two', 'one', 'three']).isCorrect, false);
});

test('order: share counts items standing on their right place', () => {
  const t = task({ ...base, type: 'order', data: { items: ['one', 'two', 'three', 'four'] } });
  assert.equal(checkTask(t, ['two', 'one', 'three', 'four']).share, 0.5);
});

test('sort: share is the fraction of items put into the right category', () => {
  const t = task({ ...base, type: 'sort', data: {
    categories: ['X', 'Y'],
    items: [{ text: 'a', category: 'X' }, { text: 'b', category: 'Y' }, { text: 'c', category: 'X' }, { text: 'd', category: 'Y' }],
  } });
  const all = checkTask(t, { a: 'X', b: 'Y', c: 'X', d: 'Y' });
  assert.equal(all.isCorrect, true);
  const half = checkTask(t, { a: 'X', b: 'X', c: 'X', d: 'X' });
  assert.equal(half.share, 0.5);
  assert.equal(half.isCorrect, false);
});

test('sort: an unplaced item counts as wrong', () => {
  const t = task({ ...base, type: 'sort', data: { categories: ['X', 'Y'], items: [{ text: 'a', category: 'X' }, { text: 'b', category: 'Y' }] } });
  assert.equal(checkTask(t, { a: 'X' }).share, 0.5);
});

test('match: share is the fraction of left items paired correctly', () => {
  const t = task({ ...base, type: 'match', data: { pairs: [['l1', 'r1'], ['l2', 'r2'], ['l3', 'r3']] } });
  assert.equal(checkTask(t, { l1: 'r1', l2: 'r2', l3: 'r3' }).isCorrect, true);
  const wrong = checkTask(t, { l1: 'r2', l2: 'r1', l3: 'r3' });
  assert.equal(wrong.isCorrect, false);
  assert.ok(Math.abs(wrong.share - 1 / 3) < 1e-9);
});

test('gaps: every gap must hold the right word', () => {
  const t = task({ ...base, type: 'gaps', data: { text: 'A ___ B ___ C', options: ['x', 'y', 'z'], answers: ['x', 'y'] } });
  assert.equal(checkTask(t, ['x', 'y']).isCorrect, true);
  assert.equal(checkTask(t, ['x', 'z']).share, 0.5);
  assert.equal(checkTask(t, ['y', 'x']).isCorrect, false);
});

test('input: accepts any listed form after normalisation', () => {
  const t = task({ ...base, type: 'input', data: { accepted: ['4', 'четыре'], caseSensitive: false } });
  assert.equal(checkTask(t, ' Четыре ').isCorrect, true);
  assert.equal(checkTask(t, '4').isCorrect, true);
  assert.equal(checkTask(t, '5').isCorrect, false);
  assert.equal(checkTask(t, '').isCorrect, false);
});

test('input: caseSensitive keeps capitalisation significant', () => {
  const t = task({ ...base, type: 'input', data: { accepted: ['Москва'], caseSensitive: true } });
  assert.equal(checkTask(t, 'Москва').isCorrect, true);
  assert.equal(checkTask(t, 'москва').isCorrect, false);
});

test('an answer of the wrong shape never throws and is wrong', () => {
  const t = task({ ...base, type: 'order', data: { items: ['a', 'b'] } });
  assert.equal(checkTask(t, 'garbage').isCorrect, false);
  assert.equal(checkTask(t, null).share, 0);
});
