// Чистая логика инструмента-лаборатории «Симметрия» (Этап 4, Класс Б —
// симметрия/отражение, ТЗ FR-022). По решению пользователя действие
// руками — «дорисовать вторую половину», см.
// docs/superpowers/specs/2026-09-10-mathmachine-fr022-groups23-design.md,
// разд. 3.6.

export interface SymmetryFeature {
  /** Относительная вертикальная позиция (0..1), одинакова у левой половины и её верного зеркального фрагмента справа. */
  y: number;
  radius: number;
  colorId: number;
}

export interface TrayItem extends SymmetryFeature {
  isDecoy: boolean;
}

export interface SymmetryPuzzle {
  /** Ровно 3 черты — определяют и левую (готовую) половину, и то, что должно оказаться в каждом из 3 слотов справа. */
  features: SymmetryFeature[];
  /** Перемешанный лоток: 3 верных фрагмента (по одному на черту) + 2 дистрактора. */
  trayItems: TrayItem[];
}

const FEATURE_YS = [0.25, 0.5, 0.75];
const RADII = [10, 16, 22, 28];
const COLOR_COUNT = 4;

function pickInt(rng: () => number, min: number, maxInclusive: number): number {
  return min + Math.floor(rng() * (maxInclusive - min + 1));
}

function shuffle<T>(rng: () => number, arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function generateSymmetryPuzzle(rng: () => number = Math.random): SymmetryPuzzle {
  const features: SymmetryFeature[] = FEATURE_YS.map((y) => ({
    y,
    radius: RADII[pickInt(rng, 0, RADII.length - 1)],
    colorId: pickInt(rng, 0, COLOR_COUNT - 1),
  }));

  const correctTrayItems: TrayItem[] = features.map((f) => ({ ...f, isDecoy: false }));

  // Дистракторы: радиус/цвет, гарантированно НЕ совпадающий целиком ни с
  // одной чертой (иначе дистрактор случайно оказался бы неотличим от
  // верного фрагмента и подходил бы в чужой слот).
  const decoys: TrayItem[] = [];
  while (decoys.length < 2) {
    const candidate = { y: 0, radius: RADII[pickInt(rng, 0, RADII.length - 1)], colorId: pickInt(rng, 0, COLOR_COUNT - 1) };
    const matchesAnyFeature = features.some((f) => f.radius === candidate.radius && f.colorId === candidate.colorId);
    if (!matchesAnyFeature) decoys.push({ ...candidate, isDecoy: true });
  }

  const trayItems = shuffle(rng, [...correctTrayItems, ...decoys]);
  return { features, trayItems };
}

/** slotAssignment[i] — индекс элемента trayItems, помещённого в i-й слот (соответствует features[i]); null — пусто. */
export function checkSymmetryAnswer(puzzle: SymmetryPuzzle, slotAssignment: (number | null)[]): boolean {
  if (slotAssignment.length !== puzzle.features.length) return false;
  if (slotAssignment.some((v) => v === null)) return false;
  const indices = slotAssignment as number[];
  if (new Set(indices).size !== indices.length) return false;
  return puzzle.features.every((feature, i) => {
    const item = puzzle.trayItems[indices[i]];
    return item && !item.isDecoy && item.radius === feature.radius && item.colorId === feature.colorId;
  });
}
