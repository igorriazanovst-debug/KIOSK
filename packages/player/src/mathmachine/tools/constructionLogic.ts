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

// Куски идут по кругу («вертушкой») вокруг центра квадрата — локальный
// контур каждого следующего куска (север→восток→юг→запад) есть локальный
// контур предыдущего, повёрнутый на +90° вокруг его же центроида (это
// свойство самой геометрии ABSOLUTE_TRIANGLES, проверено аналитически).
// Поэтому чтобы кусок №i, оказавшись в слоте №j, реально дорисовал контур
// без дырок и наложений, его локальный контур нужно довернуть ровно на
// (j - i) * 90° — а не на 0°, как если бы место можно было занять "как
// есть". targetRotation куска всегда 0 ровно потому, что 0 = "довернуть
// на (i - i) * 90 = 0" для его СОБСТВЕННОГО слота; при переносе в чужой
// слот это должно пересчитываться.
function requiredRotationDeg(pieceId: number, targetIndex: number, pieceCount: number): number {
  return (((targetIndex - pieceId) % pieceCount) + pieceCount) % pieceCount * (360 / pieceCount);
}

function fitsTarget(
  state: PieceState,
  piece: ConstructionPiece,
  target: { x: number; y: number },
  targetIndex: number,
  pieceCount: number,
): boolean {
  const dx = state.x - target.x;
  const dy = state.y - target.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const required = requiredRotationDeg(piece.id, targetIndex, pieceCount);
  const angleDiff = Math.min(
    Math.abs(normalizeAngle(state.rotationDeg) - required),
    360 - Math.abs(normalizeAngle(state.rotationDeg) - required),
  );
  return distance <= POSITION_TOLERANCE && angleDiff <= ROTATION_TOLERANCE;
}

/**
 * Все 4 куска — конгруэнтные треугольники (один и тот же силуэт,
 * повёрнутый на 0/90/180/270° вокруг центра квадрата) — у ребёнка нет
 * визуальной подсказки, какой конкретно кусок должен попасть в какой
 * слот (силуэт — просто пунктирный квадрат без цветовой разметки по
 * четвертям). Поэтому проверка НЕ привязывает кусок №i к слоту №i по
 * индексу (это и было исходным багом — верно собранный квадрат с
 * переставленными кусками отклонялся) — вместо этого для КАЖДОГО из 4
 * целевых слотов ищется ещё не использованный кусок, который в него
 * подходит С УЧЁТОМ довёрнутого на нужный угол контура (см.
 * requiredRotationDeg выше) — иначе кусок, просто перенесённый в чужой
 * слот без довёрнутого угла, засчитывался бы как влезший, хотя реально
 * оставлял бы дыру и наложение на силуэте.
 */
export function checkConstructionAnswer(puzzle: ConstructionPuzzle, states: PieceState[]): boolean {
  if (states.length !== puzzle.pieces.length) return false;
  const pieceCount = puzzle.pieces.length;
  const targets = puzzle.pieces.map((p) => ({ x: p.targetX, y: p.targetY }));
  const usedStateIndices = new Set<number>();
  return targets.every((target, targetIndex) => {
    const matchIndex = states.findIndex((state, i) => {
      if (usedStateIndices.has(i)) return false;
      return fitsTarget(state, puzzle.pieces[i], target, targetIndex, pieceCount);
    });
    if (matchIndex === -1) return false;
    usedStateIndices.add(matchIndex);
    return true;
  });
}
