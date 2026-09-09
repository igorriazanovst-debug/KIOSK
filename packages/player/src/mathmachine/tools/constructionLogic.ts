// Чистая логика инструмента-лаборатории «Конструирование» (Этап 4, Класс
// Б — плоские фигуры/конструирование, ТЗ FR-022). Танграм-стиль: собрать
// силуэт квадрата из 4 треугольников-«вертушки» — см.
// docs/superpowers/specs/2026-09-10-mathmachine-fr022-groups23-design.md,
// разд. 3.1. Целевые позиции получены КОНСТРУКТИВНО (обратным способом) —
// сначала строится верно собранный квадрат из 4 абсолютных треугольников,
// затем для каждого куска вычисляется его собственный локальный контур
// (координаты минус центроид) — так центр вращения куска гарантированно
// совпадает с его геометрическим центром, а не подобран на глаз.

export interface ConstructionPiece {
  id: number;
  /** Контур куска в ЛОКАЛЬНЫХ координатах (центроид куска — точка (0,0)). */
  localPoints: number[];
  targetX: number;
  targetY: number;
  /** Целевой угол всегда 0 — локальные координаты уже соответствуют финальной ориентации. */
  targetRotation: 0;
  colorId: number;
}

export interface PieceState {
  x: number;
  y: number;
  rotationDeg: number;
}

export interface ConstructionPuzzle {
  pieces: ConstructionPiece[];
  /** Стартовые позиция/угол каждого куска (случайно разбросаны, не на месте). */
  initialStates: PieceState[];
  /** Половина стороны собранного квадрата — нужна вызывающей стороне для отрисовки контура-силуэта. */
  halfSide: number;
}

const HALF_SIDE = 70;
const POSITION_TOLERANCE = 22;
const ROTATION_TOLERANCE = 1; // после привязки к шагу 90° сравнение точное, допуск — на плавающую точку

function centroid(points: number[]): { x: number; y: number } {
  let sx = 0;
  let sy = 0;
  const n = points.length / 2;
  for (let i = 0; i < points.length; i += 2) {
    sx += points[i];
    sy += points[i + 1];
  }
  return { x: sx / n, y: sy / n };
}

function toLocal(points: number[], c: { x: number; y: number }): number[] {
  const out: number[] = [];
  for (let i = 0; i < points.length; i += 2) {
    out.push(points[i] - c.x, points[i + 1] - c.y);
  }
  return out;
}

// 4 треугольника «вертушки» от центра квадрата к каждой паре соседних
// углов — абсолютные координаты в системе, где центр квадрата — (0,0).
const ABSOLUTE_TRIANGLES: number[][] = [
  [0, 0, -HALF_SIDE, -HALF_SIDE, HALF_SIDE, -HALF_SIDE], // север
  [0, 0, HALF_SIDE, -HALF_SIDE, HALF_SIDE, HALF_SIDE], // восток
  [0, 0, HALF_SIDE, HALF_SIDE, -HALF_SIDE, HALF_SIDE], // юг
  [0, 0, -HALF_SIDE, HALF_SIDE, -HALF_SIDE, -HALF_SIDE], // запад
];

function pickInt(rng: () => number, min: number, maxInclusive: number): number {
  return min + Math.floor(rng() * (maxInclusive - min + 1));
}

export function generateConstructionPuzzle(rng: () => number = Math.random): ConstructionPuzzle {
  const pieces: ConstructionPiece[] = ABSOLUTE_TRIANGLES.map((absPoints, id) => {
    const c = centroid(absPoints);
    return {
      id,
      localPoints: toLocal(absPoints, c),
      targetX: c.x,
      targetY: c.y,
      targetRotation: 0,
      colorId: id,
    };
  });

  // Разброс стартовых положений — по кругу ниже силуэта, случайный угол из
  // {90,180,270} (никогда 0 — иначе кусок стартовал бы уже верно
  // повёрнутым, и вращение не требовалось бы).
  const initialStates: PieceState[] = pieces.map((_, i) => ({
    x: (i - (pieces.length - 1) / 2) * (HALF_SIDE * 1.6),
    y: HALF_SIDE * 3,
    rotationDeg: [90, 180, 270][pickInt(rng, 0, 2)],
  }));

  return { pieces, initialStates, halfSide: HALF_SIDE };
}

function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function checkConstructionAnswer(puzzle: ConstructionPuzzle, states: PieceState[]): boolean {
  if (states.length !== puzzle.pieces.length) return false;
  return puzzle.pieces.every((piece, i) => {
    const state = states[i];
    const dx = state.x - piece.targetX;
    const dy = state.y - piece.targetY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angleDiff = Math.min(
      Math.abs(normalizeAngle(state.rotationDeg) - piece.targetRotation),
      360 - Math.abs(normalizeAngle(state.rotationDeg) - piece.targetRotation),
    );
    return distance <= POSITION_TOLERANCE && angleDiff <= ROTATION_TOLERANCE;
  });
}
