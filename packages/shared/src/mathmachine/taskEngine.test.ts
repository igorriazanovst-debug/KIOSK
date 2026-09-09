import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkTaskAnswer, getAnswerMode } from './taskEngine';
import type { Task } from './model/schema';

const sumTask: Task = { id: 't1', typeId: 'number_sum_two', text: '2+3', params: { a: 2, b: 3 }, correctAnswer: 5 };
const compareTask: Task = {
  id: 't2', typeId: 'compare_length', text: 'Какой длиннее?', params: { leftLength: 3, rightLength: 7 },
  correctAnswer: 'right', choices: ['left', 'right'],
};

test('checkTaskAnswer accepts a correct numeric answer given as a number', () => {
  assert.equal(checkTaskAnswer(sumTask, 5), true);
});

test('checkTaskAnswer accepts a correct numeric answer given as a numeric string (keyboard entry)', () => {
  assert.equal(checkTaskAnswer(sumTask, '5'), true);
});

test('checkTaskAnswer rejects a wrong numeric answer', () => {
  assert.equal(checkTaskAnswer(sumTask, 4), false);
});

test('checkTaskAnswer rejects a non-numeric string for a numeric task', () => {
  assert.equal(checkTaskAnswer(sumTask, 'five'), false);
});

test('checkTaskAnswer accepts the correct choice for a choice-mode task', () => {
  assert.equal(checkTaskAnswer(compareTask, 'right'), true);
  assert.equal(checkTaskAnswer(compareTask, 'left'), false);
});

test('getAnswerMode returns numeric for number_sum_two and choice for compare_length', () => {
  assert.equal(getAnswerMode('number_sum_two'), 'numeric');
  assert.equal(getAnswerMode('compare_length'), 'choice');
});

test('checkTaskAnswer throws on an unregistered task type', () => {
  const bogus = { ...sumTask, typeId: 'not_real' as any };
  assert.throws(() => checkTaskAnswer(bogus, 5));
});
