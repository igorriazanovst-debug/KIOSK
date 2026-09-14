// packages/shared/src/inophone/model/geometry.test.ts
//
// Главное, что здесь проверяется, — ОТСУТСТВИЕ ЛОЖНЫХ СРАБАТЫВАНИЙ. Проверка,
// ругающаяся на правильную разметку, перестаёт читаться уже к третьему случаю,
// и тогда она хуже, чем её отсутствие: она создаёт видимость контроля.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parsePoints,
  pointInPolygon,
  polygonsOverlap,
  checkSceneGeometry,
} from './geometry';
import type { Scene } from './schema';

const rect = (x: number, y: number, w: number, h: number) =>
  `${x},${y} ${x + w},${y} ${x + w},${y + h} ${x},${y + h}`;

const scene = (hotspots: { conceptId: string; points: string }[]): Scene => ({
  id: 's',
  titles: { ru: 'Сцена' },
  viewBox: { width: 1000, height: 1000 },
  hotspots,
});

test('контур разбирается в точки', () => {
  assert.deepEqual(parsePoints('0,0 10,0 10,10'), [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
  ]);
});

test('точка внутри и снаружи многоугольника', () => {
  const poly = parsePoints(rect(0, 0, 10, 10));
  assert.ok(pointInPolygon({ x: 5, y: 5 }, poly));
  assert.ok(!pointInPolygon({ x: 15, y: 5 }, poly));
});

test('раздельные контуры НЕ считаются наложением', () => {
  assert.ok(!polygonsOverlap(parsePoints(rect(0, 0, 10, 10)), parsePoints(rect(20, 20, 10, 10))));
});

test('пересекающиеся контуры считаются наложением', () => {
  assert.ok(polygonsOverlap(parsePoints(rect(0, 0, 10, 10)), parsePoints(rect(5, 5, 10, 10))));
});

test('вложенный контур — тоже наложение', () => {
  // Подушка внутри кровати: щелчок принадлежит обоим, и программа молча
  // засчитает тот, что нарисован позже
  assert.ok(polygonsOverlap(parsePoints(rect(0, 0, 100, 100)), parsePoints(rect(10, 10, 20, 20))));
});

test('Г-образные предметы углами друг к другу — НЕ наложение', () => {
  // По охватывающим прямоугольникам это выглядело бы как пересечение, и
  // проверка ругалась бы на правильную разметку
  const l1 = parsePoints('0,0 40,0 40,10 10,10 10,40 0,40');
  const l2 = parsePoints('50,50 90,50 90,90 80,90 80,60 50,60');
  assert.ok(!polygonsOverlap(l1, l2));
});

test('сцена без наложений проходит', () => {
  const r = checkSceneGeometry(
    scene([
      { conceptId: 'a', points: rect(0, 0, 100, 100) },
      { conceptId: 'b', points: rect(200, 200, 100, 100) },
    ])
  );
  assert.ok(r.ok);
  assert.deepEqual(r.ambiguous, []);
});

test('наложение называется ПАРОЙ, а не просто «сцена плохая»', () => {
  // «Разметка неверна» бесполезно тому, кто размечает тридцать одну сцену
  const r = checkSceneGeometry(
    scene([
      { conceptId: 'bed', points: rect(0, 0, 100, 100) },
      { conceptId: 'pillow', points: rect(10, 10, 20, 20) },
    ])
  );
  assert.equal(r.ok, false);
  assert.deepEqual(r.ambiguous, [{ sceneId: 's', a: 'bed', b: 'pillow' }]);
});

test('контур за краем подложки — отдельная беда', () => {
  // Объект есть в словаре, а ткнуть в него нельзя
  const r = checkSceneGeometry(scene([{ conceptId: 'x', points: rect(950, 950, 200, 200) }]));
  assert.deepEqual(r.outOfBounds, [{ sceneId: 's', conceptId: 'x' }]);
  assert.equal(r.ok, false);
});

test('контур ровно по краю подложки — это не выход за край', () => {
  const r = checkSceneGeometry(scene([{ conceptId: 'x', points: rect(0, 0, 1000, 1000) }]));
  assert.deepEqual(r.outOfBounds, []);
});
