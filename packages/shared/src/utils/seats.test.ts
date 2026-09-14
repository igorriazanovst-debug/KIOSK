// packages/shared/src/utils/seats.test.ts
//
// Проверяется правило, а не арифметика: двое садятся НАПРОТИВ друг друга, и
// это заметно только по разнице углов в 180°. Перенесено из player/src/words
// вместе с самим правилом — теперь оно одно на три виджета.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { seatsFor, seatRotationFor, SEAT_ROTATIONS, SEAT_LABELS } from './seats';

test('повороты мест соответствуют снятым с эталона', () => {
  assert.deepEqual([...SEAT_ROTATIONS], [0, 90, 180, -90]);
  assert.deepEqual([...SEAT_LABELS], ['снизу', 'слева', 'сверху', 'справа']);
});

test('двое садятся друг напротив друга, а не рядом', () => {
  const seats = seatsFor(2);
  assert.deepEqual(seats, [0, 2]);
  assert.deepEqual(seats.map((s) => SEAT_ROTATIONS[s]), [0, 180], 'разница 180° — это и есть «напротив»');
});

test('трое: третий садится сверху', () => {
  assert.deepEqual(seatsFor(3), [0, 1, 2]);
});

test('четверо занимают все стороны', () => {
  assert.deepEqual(seatsFor(4), [0, 1, 2, 3]);
  assert.equal(new Set(seatsFor(4)).size, 4, 'два игрока не садятся на одно место');
});

test('одиночная игра — одно место снизу, без поворота', () => {
  assert.deepEqual(seatsFor(1), [0]);
  assert.equal(seatRotationFor(0, 1), 0);
});

test('угол поворота берётся по месту игрока, а не по его номеру', () => {
  // При двоих второй игрок сидит на месте 2 (сверху, 180°), а не на месте 1
  assert.equal(seatRotationFor(1, 2), 180);
  assert.equal(seatRotationFor(1, 4), 90);
});

test('число больше четырёх не ломает рассадку — берутся все четыре места', () => {
  assert.deepEqual(seatsFor(7), [0, 1, 2, 3]);
});
