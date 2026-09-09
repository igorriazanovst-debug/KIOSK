// Чистая математика инструмента-лаборатории «Весы» (ТЗ FR-024), без DOM —
// покрывается тестами напрямую, рендер (WeightsTool.tsx) — живой проверкой.

export interface WeightPlacement {
  value: number;
  pan: 'left' | 'right' | null;
}

export interface BalanceResult {
  leftMass: number;
  rightMass: number;
  tiltDegrees: number;
}

const MAX_TILT_DEGREES = 20;
const DEGREES_PER_UNIT_DIFFERENCE = 3;

export function computeBalance(weights: WeightPlacement[]): BalanceResult {
  const leftMass = weights.filter((w) => w.pan === 'left').reduce((s, w) => s + w.value, 0);
  const rightMass = weights.filter((w) => w.pan === 'right').reduce((s, w) => s + w.value, 0);
  const raw = (rightMass - leftMass) * DEGREES_PER_UNIT_DIFFERENCE;
  const tiltDegrees = Math.max(-MAX_TILT_DEGREES, Math.min(MAX_TILT_DEGREES, raw));
  return { leftMass, rightMass, tiltDegrees };
}
