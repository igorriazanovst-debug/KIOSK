// Чистая логика инструмента-лаборатории «Движение» (Этап 4, Класс Б —
// пространственные представления/движение, ТЗ FR-022; вместе с
// «Деформацией» реализует ОДНУ категорию ТЗ «движение и деформация» как
// два отдельных инструмента — решение пользователя, см.
// docs/superpowers/specs/2026-09-10-mathmachine-fr022-groups23-design.md,
// разд. 3.2).

export interface GridPos {
  row: number;
  col: number;
}

export interface MovementPuzzle {
  size: number;
  start: GridPos;
  target: GridPos;
  obstacle: GridPos | null;
}

export type MoveDirection = 'up' | 'down' | 'left' | 'right';

const GRID_SIZE = 5;

function pickInt(rng: () => number, min: number, maxInclusive: number): number {
  return min + Math.floor(rng() * (maxInclusive - min + 1));
}

function samePos(a: GridPos, b: GridPos): boolean {
  return a.row === b.row && a.col === b.col;
}

export function generateMovementPuzzle(rng: () => number = Math.random): MovementPuzzle {
  const size = GRID_SIZE;
  const start: GridPos = { row: pickInt(rng, 0, size - 1), col: pickInt(rng, 0, size - 1) };
  let target: GridPos;
  do {
    target = { row: pickInt(rng, 0, size - 1), col: pickInt(rng, 0, size - 1) };
  } while (samePos(target, start));

  // Препятствие — клетка, не совпадающая ни со стартом, ни с целью, и не
  // блокирующая единственный путь (на сетке 5×5 движение вверх/вниз/влево/
  // вправо всегда имеет обходной путь вокруг одной препятствующей клетки,
  // поэтому достаточно исключить только совпадение со стартом/целью).
  let obstacle: GridPos | null = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate: GridPos = { row: pickInt(rng, 0, size - 1), col: pickInt(rng, 0, size - 1) };
    if (!samePos(candidate, start) && !samePos(candidate, target)) {
      obstacle = candidate;
      break;
    }
  }

  return { size, start, target, obstacle };
}

export function applyMove(puzzle: MovementPuzzle, pos: GridPos, direction: MoveDirection): GridPos {
  const delta: Record<MoveDirection, GridPos> = {
    up: { row: -1, col: 0 },
    down: { row: 1, col: 0 },
    left: { row: 0, col: -1 },
    right: { row: 0, col: 1 },
  };
  const next: GridPos = { row: pos.row + delta[direction].row, col: pos.col + delta[direction].col };
  if (next.row < 0 || next.row >= puzzle.size || next.col < 0 || next.col >= puzzle.size) return pos;
  if (puzzle.obstacle && samePos(next, puzzle.obstacle)) return pos;
  return next;
}

export function checkMovementAnswer(puzzle: MovementPuzzle, currentPos: GridPos): boolean {
  return samePos(currentPos, puzzle.target);
}
