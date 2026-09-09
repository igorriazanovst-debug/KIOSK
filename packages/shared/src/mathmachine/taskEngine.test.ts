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
const multiplyTask: Task = {
  id: 'w2t1', typeId: 'number_multiply_two', text: 'Сколько будет 3 умножить на 4?', params: { a: 3, b: 4 },
  correctAnswer: 12,
};
const divideTask: Task = {
  id: 'w2t2', typeId: 'number_divide_remainder', text: 'Сколько будет 7 разделить на 2?', params: { a: 7, b: 2 },
  correctAnswer: '3 ост. 1', choices: ['3 ост. 1', '3 ост. 2', '2 ост. 1'],
};
const multipleCheckTask: Task = {
  id: 'w2t3', typeId: 'number_multiple_check', text: 'Какое из чисел делится на 3 без остатка?', params: { n: 3, options: [9, 10, 8] },
  correctAnswer: 9, choices: [9, 10, 8],
};
const roundTask: Task = {
  id: 'w2t4', typeId: 'round_to_ten', text: 'Округли 47 до десятков', params: { n: 47 },
  correctAnswer: 50,
};
const ordinalTask: Task = {
  id: 'w2t5', typeId: 'ordinal_position', text: 'Какое число стоит на 3-м месте: 5, 8, 2, 9, 1?', params: { series: [5, 8, 2, 9, 1], position: 3 },
  correctAnswer: 2,
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

test('getAnswerMode returns the right mode for each Этап 2b wave 2 type', () => {
  assert.equal(getAnswerMode('number_multiply_two'), 'numeric');
  assert.equal(getAnswerMode('number_divide_remainder'), 'choice');
  assert.equal(getAnswerMode('number_multiple_check'), 'choice');
  assert.equal(getAnswerMode('round_to_ten'), 'numeric');
  assert.equal(getAnswerMode('ordinal_position'), 'numeric');
});

test('checkTaskAnswer validates each Этап 2b wave 2 type correctly', () => {
  assert.equal(checkTaskAnswer(multiplyTask, 12), true);
  assert.equal(checkTaskAnswer(multiplyTask, 11), false);
  assert.equal(checkTaskAnswer(divideTask, '3 ост. 1'), true);
  assert.equal(checkTaskAnswer(divideTask, '3 ост. 2'), false);
  assert.equal(checkTaskAnswer(multipleCheckTask, 9), true);
  assert.equal(checkTaskAnswer(multipleCheckTask, 10), false);
  assert.equal(checkTaskAnswer(roundTask, 50), true);
  assert.equal(checkTaskAnswer(roundTask, 40), false);
  assert.equal(checkTaskAnswer(ordinalTask, 2), true);
  assert.equal(checkTaskAnswer(ordinalTask, 8), false);
});

const shareTask: Task = {
  id: 'w3t1', typeId: 'share_of_whole',
  text: 'У Матвея 8 яблок. Он разделил их поровну на две части — сколько досталось на одну часть?',
  params: { total: 8, parts: 2 }, correctAnswer: 4,
};

test('getAnswerMode returns numeric for the Этап 2b wave 3 type (share_of_whole)', () => {
  assert.equal(getAnswerMode('share_of_whole'), 'numeric');
});

test('checkTaskAnswer validates share_of_whole correctly', () => {
  assert.equal(checkTaskAnswer(shareTask, 4), true);
  assert.equal(checkTaskAnswer(shareTask, 8), false);
  assert.equal(checkTaskAnswer(shareTask, '4'), true);
});

const countAddTask: Task = {
  id: 'e4t1', typeId: 'count_then_add',
  text: 'Посчитай кружки в первой группе, посчитай во второй, сложи вместе — сколько всего?',
  params: { groupA: 3, groupB: 4 }, correctAnswer: 7,
};
const clockTask: Task = {
  id: 'e4t2', typeId: 'clock_reading', text: 'Сколько времени показывают часы?',
  params: { hours: 3, minutes: 0 }, correctAnswer: '3:00', choices: ['3:00', '9:00', '6:00'],
};

test('getAnswerMode returns the right mode for each Этап 4 Class A type', () => {
  assert.equal(getAnswerMode('count_then_add'), 'numeric');
  assert.equal(getAnswerMode('count_then_subtract'), 'numeric');
  assert.equal(getAnswerMode('clock_reading'), 'choice');
  assert.equal(getAnswerMode('mass_measurement'), 'choice');
  assert.equal(getAnswerMode('right_angle_recognition'), 'choice');
  assert.equal(getAnswerMode('shape_naming'), 'choice');
  assert.equal(getAnswerMode('shape_properties'), 'choice');
  assert.equal(getAnswerMode('solid_naming'), 'choice');
  assert.equal(getAnswerMode('solid_properties'), 'choice');
  assert.equal(getAnswerMode('spatial_position'), 'choice');
  assert.equal(getAnswerMode('spatial_direction'), 'choice');
  assert.equal(getAnswerMode('spatial_ordering'), 'choice');
  assert.equal(getAnswerMode('grid_coordinates'), 'choice');
});

test('checkTaskAnswer validates Этап 4 Class A types correctly', () => {
  assert.equal(checkTaskAnswer(countAddTask, 7), true);
  assert.equal(checkTaskAnswer(countAddTask, 6), false);
  assert.equal(checkTaskAnswer(clockTask, '3:00'), true);
  assert.equal(checkTaskAnswer(clockTask, '9:00'), false);
});
