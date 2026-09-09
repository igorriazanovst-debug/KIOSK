// Чистая логика инструмента-лаборатории «Деформация» (Этап 4, Класс Б —
// пространственные представления/деформация, ТЗ FR-022; вместе с
// «Движением» реализует ОДНУ категорию ТЗ «движение и деформация» как два
// отдельных инструмента — решение пользователя, см.
// docs/superpowers/specs/2026-09-10-mathmachine-fr022-groups23-design.md,
// разд. 3.3).

export interface DeformationPuzzle {
  /** Целевое отношение ширины к высоте — фигура стартует квадратом/кругом (1:1). */
  targetRatio: number;
  /** Только влияет на визуал (круг→эллипс или квадрат→прямоугольник), не на проверку. */
  isEllipse: boolean;
}

export const BASE_SIZE = 100;
const MIN_RATIO = 0.4;
const MAX_RATIO = 2.5;
// Держим цель подальше от 1 — иначе "не трогать фигуру вообще" тоже
// проходило бы проверку, а задание должно требовать реальной деформации.
const MIN_DISTANCE_FROM_ONE = 0.3;
const TOLERANCE_RATIO = 0.15;

function pickRatio(rng: () => number): number {
  let ratio: number;
  do {
    ratio = MIN_RATIO + rng() * (MAX_RATIO - MIN_RATIO);
  } while (Math.abs(ratio - 1) < MIN_DISTANCE_FROM_ONE);
  return ratio;
}

export function generateDeformationPuzzle(rng: () => number = Math.random): DeformationPuzzle {
  return { targetRatio: pickRatio(rng), isEllipse: rng() < 0.5 };
}

export function checkDeformationAnswer(puzzle: DeformationPuzzle, currentWidth: number, currentHeight: number = BASE_SIZE): boolean {
  if (currentHeight <= 0) return false;
  const ratio = currentWidth / currentHeight;
  return Math.abs(ratio - puzzle.targetRatio) / puzzle.targetRatio <= TOLERANCE_RATIO;
}
