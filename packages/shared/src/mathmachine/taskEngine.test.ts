import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkTaskAnswer, getAnswerMode } from './taskEngine';
import type { Task } from './model/schema';

const sumTask: Task = { id: 't1', typeId: 'number_sum_two', text: '2+3', params: { a: 2, b: 3 }, correctAnswer: 5 };
const compareTask: Task = {
  id: 't2', typeId: 'compare_length', text: 'Какой длиннее?', params: { leftLength: 3, rightLength: 7 },
  correctAnswer: 'right', choices: ['left', 'right'],
};
const subtractTask: Task = {
  id: 't3', typeId: 'number_subtract_two', text: 'Сколько будет 5 минус 2?', params: { a: 5, b: 2 },
  correctAnswer: 3,
};
const numberCompareTask: Task = {
  id: 't4', typeId: 'number_compare', text: 'Какое число больше: 3 или 7?', params: { a: 3, b: 7, direction: 0 },
  correctAnswer: 7, choices: [3, 7],
};
const digitTask: Task = {
  id: 't5', typeId: 'digit_recognition', text: 'Найди цифру 4', params: { target: 4 },
  correctAnswer: 4, choices: [4, 3, 5],
};
const compositionTask: Task = {
  id: 't6', typeId: 'number_composition', text: '5 = 2 + ?', params: { whole: 5, knownPart: 2 },
  correctAnswer: 3,
};
const orderingTask: Task = {
  id: 't7', typeId: 'number_ordering', text: 'Какое число самое маленькое?', params: { series: [4, 7, 2], direction: 1 },
  correctAnswer: 2, choices: [4, 7, 2],
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

test('getAnswerMode returns the right mode for each Этап 2b wave 1 type', () => {
  assert.equal(getAnswerMode('number_subtract_two'), 'numeric');
  assert.equal(getAnswerMode('number_compare'), 'choice');
  assert.equal(getAnswerMode('digit_recognition'), 'choice');
  assert.equal(getAnswerMode('number_composition'), 'numeric');
  assert.equal(getAnswerMode('number_ordering'), 'choice');
});

test('checkTaskAnswer validates each Этап 2b wave 1 type correctly', () => {
  assert.equal(checkTaskAnswer(subtractTask, 3), true);
  assert.equal(checkTaskAnswer(subtractTask, 4), false);
  assert.equal(checkTaskAnswer(numberCompareTask, 7), true);
  assert.equal(checkTaskAnswer(numberCompareTask, 3), false);
  assert.equal(checkTaskAnswer(digitTask, 4), true);
  assert.equal(checkTaskAnswer(digitTask, 3), false);
  assert.equal(checkTaskAnswer(compositionTask, 3), true);
  assert.equal(checkTaskAnswer(compositionTask, 2), false);
  assert.equal(checkTaskAnswer(orderingTask, 2), true);
  assert.equal(checkTaskAnswer(orderingTask, 7), false);
});
