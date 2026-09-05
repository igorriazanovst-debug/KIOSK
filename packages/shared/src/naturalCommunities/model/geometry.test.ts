import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toPixelRect, toFractionalRect } from './geometry';

test('toPixelRect scales fractional coordinates to a given board size', () => {
  const pixel = toPixelRect({ xFraction: 0.25, yFraction: 0.5, widthFraction: 0.5, heightFraction: 0.25 }, 1000, 800);
  assert.deepEqual(pixel, { x: 250, y: 400, width: 500, height: 200 });
});

test('toFractionalRect is the exact inverse of toPixelRect for the same board size', () => {
  const fractional = { xFraction: 0.3, yFraction: 0.4, widthFraction: 0.2, heightFraction: 0.15 };
  const pixel = toPixelRect(fractional, 1280, 720);
  const roundTripped = toFractionalRect(pixel, 1280, 720);
  assert.deepEqual(roundTripped, fractional);
});

test('the same fractional object lays out identically across different board sizes, relative to that board', () => {
  // Это и есть требование ТЗ (раздел 6): "плакат одинаково раскладывается при
  // разных масштабах области" - проверяем ЧЕРЕЗ инвариант, не через
  // конкретные пиксели: доля площади объекта относительно доски неизменна.
  const fractional = { xFraction: 0.1, yFraction: 0.1, widthFraction: 0.3, heightFraction: 0.2 };
  const small = toPixelRect(fractional, 640, 480);
  const large = toPixelRect(fractional, 1920, 1440);
  assert.equal(small.x / 640, large.x / 1920);
  assert.equal(small.width / 640, large.width / 1920);
});

test('toFractionalRect throws for non-positive board dimensions instead of returning Infinity/NaN silently', () => {
  const rect = { x: 10, y: 10, width: 10, height: 10 };
  assert.throws(() => toFractionalRect(rect, 0, 100), RangeError);
  assert.throws(() => toFractionalRect(rect, 100, -1), RangeError);
});
