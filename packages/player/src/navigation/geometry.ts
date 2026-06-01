// packages/editor-web/src/utils/navigation/geometry.ts
// Геометрические утилиты — чистые функции, без зависимостей

import type { Point } from './types';

/** Евклидово расстояние между двумя точками */
export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Результат проекции точки на отрезок */
export interface ProjectionResult {
  x: number;
  y: number;
  /** Параметр t ∈ [0, 1] — положение проекции на отрезке (0 = a, 1 = b) */
  t: number;
}

/**
 * Привязка точки p к ближайшей точке на отрезке ab.
 * Возвращает координаты проекции и параметр t (зажат в [0,1]).
 */
export function projectOnSegment(p: Point, a: Point, b: Point): ProjectionResult {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return { x: a.x, y: a.y, t: 0 };
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + t * dx, y: a.y + t * dy, t };
}

/**
 * Точка p внутри полигона (алгоритм ray casting).
 * Полигон задаётся массивом вершин в порядке обхода.
 */
export function pointInPolygon(p: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      yi > p.y !== yj > p.y &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
