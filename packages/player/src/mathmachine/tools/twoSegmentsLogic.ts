// Чистая математика/логика инструмента-лаборатории «Два отрезка» (ТЗ
// FR-024, Этап 2a). Механика близка к оригиналу (спека разд. 1/5): один
// отрезок фиксированной длины, второй ребёнок подгоняет под текстовое
// условие сравнения.

export type SegmentDirection = 'longer' | 'shorter';

export interface TwoSegmentsPuzzle {
  referenceLength: number;
  delta: number;
  direction: SegmentDirection;
}

export const RULER_MIN_CM = 0;
export const RULER_MAX_CM = 30;

const REFERENCE_MIN_CM = 4;
const REFERENCE_MAX_CM = 20;
const DELTA_MIN_CM = 1;
const DELTA_MAX_CM = 10;

function pickInt(rng: () => number, min: number, maxInclusive: number): number {
  return min + Math.floor(rng() * (maxInclusive - min + 1));
}

export function generateTwoSegmentsPuzzle(rng: () => number = Math.random): TwoSegmentsPuzzle {
  const referenceLength = pickInt(rng, REFERENCE_MIN_CM, REFERENCE_MAX_CM);
  const direction: SegmentDirection = rng() < 0.5 ? 'longer' : 'shorter';
  const maxDelta = direction === 'longer' ? RULER_MAX_CM - referenceLength : referenceLength - RULER_MIN_CM;
  const delta = pickInt(rng, DELTA_MIN_CM, Math.min(DELTA_MAX_CM, maxDelta));
  return { referenceLength, delta, direction };
}

export function targetLength(puzzle: TwoSegmentsPuzzle): number {
  return puzzle.direction === 'longer' ? puzzle.referenceLength + puzzle.delta : puzzle.referenceLength - puzzle.delta;
}

export function checkSegmentAnswer(puzzle: TwoSegmentsPuzzle, draggedLength: number): boolean {
  return draggedLength === targetLength(puzzle);
}
