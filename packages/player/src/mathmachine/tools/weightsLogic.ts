// Чистая математика инструмента-лаборатории «Весы» (ТЗ FR-024), без DOM —
// покрывается тестами напрямую, рендер (WeightsTool.tsx) — живой проверкой.
//
// Найдено вживую: раньше каждое значение 1-9 было ОДНИМ общим объектом
// с полем pan: 'left' | 'right' | null — одна и та же гиря физически не
// могла лежать на обеих чашах одновременно, хотя кнопки "Слева"/"Справа"
// визуально выглядят как два независимых набора. Теперь обе стороны —
// независимые списки активных значений; одно и то же число можно
// одновременно включить и слева, и справа.

export interface BalanceResult {
  leftMass: number;
  rightMass: number;
  tiltDegrees: number;
}

const MAX_TILT_DEGREES = 20;
const DEGREES_PER_UNIT_DIFFERENCE = 3;

export function computeBalance(leftValues: readonly number[], rightValues: readonly number[]): BalanceResult {
  const leftMass = leftValues.reduce((s, v) => s + v, 0);
  const rightMass = rightValues.reduce((s, v) => s + v, 0);
  const raw = (rightMass - leftMass) * DEGREES_PER_UNIT_DIFFERENCE;
  const tiltDegrees = Math.max(-MAX_TILT_DEGREES, Math.min(MAX_TILT_DEGREES, raw));
  return { leftMass, rightMass, tiltDegrees };
}
