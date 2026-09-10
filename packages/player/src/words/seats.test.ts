import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seatsFor, SEAT_ROTATIONS, SEAT_LABELS } from './types.ts';

// ТЗ строка 54: «работа с 4 сторон интерактивного стола для 2, 3 и 4 игроков».
// Повороты сняты с эталона живым прогоном: снизу 0°, слева 90°, сверху 180°,
// справа −90°.

test('повороты мест соответствуют снятым с эталона', () => {
  assert.deepEqual([...SEAT_ROTATIONS], [0, 90, 180, -90]);
  assert.deepEqual([...SEAT_LABELS], ['снизу', 'слева', 'сверху', 'справа']);
});

test('двое садятся друг напротив друга, а не рядом', () => {
  const seats = seatsFor(2);
  assert.deepEqual(seats, [0, 2]);
  const angles = seats.map((s) => SEAT_ROTATIONS[s]);
  assert.deepEqual(angles, [0, 180], 'разница 180° — это и есть «напротив»');
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
  assert.equal(SEAT_ROTATIONS[seatsFor(1)[0]], 0);
});

test('при любом числе игроков места не повторяются и существуют', () => {
  for (let count = 1; count <= 4; count++) {
    const seats = seatsFor(count);
    assert.equal(seats.length, count, `игроков ${count}`);
    assert.equal(new Set(seats).size, count, `места уникальны при ${count}`);
    for (const seat of seats) {
      assert.ok(seat >= 0 && seat < SEAT_ROTATIONS.length, `место ${seat} существует`);
    }
  }
});

test('число больше четырёх не ломает рассадку — берутся все четыре места', () => {
  assert.deepEqual(seatsFor(7), [0, 1, 2, 3]);
});
