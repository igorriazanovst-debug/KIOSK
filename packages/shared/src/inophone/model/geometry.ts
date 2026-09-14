// packages/shared/src/inophone/model/geometry.ts
// Проверка разметки сцены на неоднозначность.
//
// ЗАЧЕМ ЭТО ВООБЩЕ. Два накладывающихся контура означают точку, в которой
// щелчок принадлежит сразу двум объектам. Программа при этом не падает и
// ничего не сообщает: она просто засчитывает тот, что нарисован позже. Ученик
// тычет в подушку, а ответ идёт за кровать — и понять, почему «неверно», он не
// может. Найдено глазом на первом же снимке затравочной сцены, где подушка
// оказалась внутри кровати.
//
// ПРОВЕРКА ЧЕСТНАЯ, А НЕ ПО ОХВАТЫВАЮЩИМ ПРЯМОУГОЛЬНИКАМ. У прямоугольников
// ложные срабатывания неизбежны: два Г-образных предмета, стоящих углами друг
// к другу, охватываются пересекающимися прямоугольниками, не соприкасаясь.
// Проверка, которая ругается на правильную разметку, перестаёт читаться уже к
// третьему ложному случаю.

import type { InophoneLibrary, Scene } from './schema';

export interface Point {
  x: number;
  y: number;
}

/** Разбор контура из атрибута SVG polygon: «x1,y1 x2,y2 …» */
export function parsePoints(points: string): Point[] {
  return points
    .split(/\s+/)
    .filter(Boolean)
    .map((pair) => {
      const [x, y] = pair.split(',').map(Number);
      return { x, y };
    });
}

/** Лежит ли точка внутри многоугольника — луч вправо, чётность пересечений */
export function pointInPolygon(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    const straddles = a.y > p.y !== b.y > p.y;
    if (!straddles) continue;
    const xAt = ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (p.x < xAt) inside = !inside;
  }
  return inside;
}

function orientation(a: Point, b: Point, c: Point): number {
  const v = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  return v === 0 ? 0 : v > 0 ? 1 : 2;
}

function onSegment(a: Point, b: Point, c: Point): boolean {
  return (
    b.x <= Math.max(a.x, c.x) &&
    b.x >= Math.min(a.x, c.x) &&
    b.y <= Math.max(a.y, c.y) &&
    b.y >= Math.min(a.y, c.y)
  );
}

/** Пересекаются ли отрезки, включая касание концом */
export function segmentsIntersect(p1: Point, q1: Point, p2: Point, q2: Point): boolean {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;
  return false;
}

/**
 * Есть ли у двух многоугольников общая площадь.
 *
 * Общей считается и вложенность: контур, целиком лежащий внутри другого, даёт
 * ту же беду — щелчок принадлежит обоим.
 */
export function polygonsOverlap(a: Point[], b: Point[]): boolean {
  for (let i = 0; i < a.length; i++) {
    const a1 = a[i];
    const a2 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      const b1 = b[j];
      const b2 = b[(j + 1) % b.length];
      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  // Рёбра не пересеклись — остаётся вложенность
  return pointInPolygon(a[0], b) || pointInPolygon(b[0], a);
}

export interface AmbiguousPair {
  sceneId: string;
  a: string;
  b: string;
}

export interface SceneGeometryReport {
  /** Пары объектов, у которых есть общая площадь */
  ambiguous: AmbiguousPair[];
  /** Контуры, вышедшие за границы viewBox сцены */
  outOfBounds: { sceneId: string; conceptId: string }[];
  ok: boolean;
}

/** Проверка одной сцены — вынесена, чтобы её можно было звать из сборщика */
export function checkSceneGeometry(scene: Scene): SceneGeometryReport {
  const ambiguous: AmbiguousPair[] = [];
  const outOfBounds: { sceneId: string; conceptId: string }[] = [];
  const polys = scene.hotspots.map((h) => ({ id: h.conceptId, pts: parsePoints(h.points) }));

  for (const p of polys) {
    const out = p.pts.some(
      (pt) => pt.x < 0 || pt.y < 0 || pt.x > scene.viewBox.width || pt.y > scene.viewBox.height
    );
    // Контур за краем подложки недостижим целиком или частично: объект есть в
    // словаре, а ткнуть в него нельзя
    if (out) outOfBounds.push({ sceneId: scene.id, conceptId: p.id });
  }

  for (let i = 0; i < polys.length; i++) {
    for (let j = i + 1; j < polys.length; j++) {
      if (polygonsOverlap(polys[i].pts, polys[j].pts)) {
        ambiguous.push({ sceneId: scene.id, a: polys[i].id, b: polys[j].id });
      }
    }
  }

  return { ambiguous, outOfBounds, ok: ambiguous.length === 0 && outOfBounds.length === 0 };
}

export function checkGeometry(lib: InophoneLibrary): SceneGeometryReport {
  const ambiguous: AmbiguousPair[] = [];
  const outOfBounds: { sceneId: string; conceptId: string }[] = [];
  for (const scene of lib.scenes) {
    const r = checkSceneGeometry(scene);
    ambiguous.push(...r.ambiguous);
    outOfBounds.push(...r.outOfBounds);
  }
  return { ambiguous, outOfBounds, ok: ambiguous.length === 0 && outOfBounds.length === 0 };
}
