// Чистая логика инструмента-лаборатории «Вращение» (Этап 4, Класс Б —
// вращение/полный оборот, ТЗ FR-022). По решению пользователя (2026-09-10)
// проверяется буквально ПОЛНЫЙ оборот (360°), не любой поворот — см.
// docs/superpowers/specs/2026-09-10-mathmachine-fr022-groups23-design.md,
// разд. 3.5.

/** Знаковая кратчайшая разница углов "от" → "до", диапазон (-180, 180]. */
export function angleDelta(fromDeg: number, toDeg: number): number {
  let d = (toDeg - fromDeg) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

/**
 * Накопленный ЗНАКОВЫЙ угол поворота — не сумма модулей покадровых
 * дельт. Если бы накопление шло по модулю, быстрое дрожание мышью туда-
 * обратно у стартового угла тоже набрало бы большую сумму, хотя фигура
 * фактически не провернулась ни на градус — знаковое накопление
 * защищает именно от этого (колебания туда-сюда взаимно гасят друг
 * друга, остаётся только ЧИСТЫЙ поворот в одну сторону).
 */
export function accumulateRotation(prevAccumulated: number, fromAngleDeg: number, toAngleDeg: number): number {
  return prevAccumulated + angleDelta(fromAngleDeg, toAngleDeg);
}

const FULL_TURN_THRESHOLD_DEG = 340;

/** Небольшой допуск ниже 360° — иначе неточность руки ребёнка (не робота)
 * никогда не даст пройти проверку. */
export function checkFullTurn(accumulatedDegrees: number): boolean {
  return Math.abs(accumulatedDegrees) >= FULL_TURN_THRESHOLD_DEG;
}

export const ROTATION_SHAPE_COUNT = 3;

export function generateRotationPuzzle(rng: () => number = Math.random): { shapeId: number } {
  return { shapeId: Math.floor(rng() * ROTATION_SHAPE_COUNT) };
}
