// packages/player/src/periodictable/trendColor.ts
// Числовой градиент для режима "Тренды" — красит плитку по значению
// свойства (плотность/масса/температуры/электроотрицательность), а не по
// дискретной категории. Единственное место, где считается диапазон
// [min,max] по реальным данным и интерполируется цвет — TableScreen.tsx и
// LegendTab.tsx ссылаются сюда, не заводят параллельную копию.

import type { PeriodicElement } from './model/schema.ts';
import type { TrendProperty } from './viewTypes.ts';

export const TREND_PROPERTY_LABEL_RU: Record<TrendProperty, string> = {
  atomicMass: 'Атомная масса',
  density: 'Плотность (г/см³)',
  meltingPointK: 'Температура плавления (К)',
  boilingPointK: 'Температура кипения (К)',
  electronegativityPauling: 'Электроотрицательность по Полингу',
};

// Цвет для отсутствующих данных (часть элементов не имеет измеренной
// плотности/электроотрицательности и т.п. — см. schema.ts, поля
// nullable) — нейтральный серый, не подставляется в диапазон и не
// красится частью градиента, чтобы не намекать на несуществующее значение.
export const TREND_MISSING_COLOR = '#cfd8dc';

// Три опорные точки градиента (низкое → среднее → высокое значение) —
// стандартная "тепловая" последовательность синий-жёлтый-красный, легко
// читается на сенсорном экране, не привязана к цветам категорий из
// colorPalette.ts (тренды — другое измерение, не должны визуально путаться
// с классами/электронным типом/характером оксидов).
const LOW_COLOR: [number, number, number] = [0x42, 0xa5, 0xf5]; // #42a5f5
const MID_COLOR: [number, number, number] = [0xff, 0xee, 0x58]; // #ffee58
const HIGH_COLOR: [number, number, number] = [0xef, 0x53, 0x50]; // #ef5350

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function toHex(rgb: [number, number, number]): string {
  return '#' + rgb.map((c) => c.toString(16).padStart(2, '0')).join('');
}

export interface TrendRange {
  min: number;
  max: number;
}

/** Диапазон значений по реальным данным (без null/undefined) — если ни
 *  одного значения нет (не встречается в реальных данных, но не должно
 *  падать), возвращает {min:0,max:0}, что делает trendColorFor нейтральным
 *  для всех значений. */
export function computeTrendRange(elements: PeriodicElement[], property: TrendProperty): TrendRange {
  const values = elements.map((el) => el[property]).filter((v): v is number => typeof v === 'number');
  if (values.length === 0) return { min: 0, max: 0 };
  return { min: Math.min(...values), max: Math.max(...values) };
}

/** value=null (нет данных у элемента) → нейтральный серый.
 *  min===max (все значения одинаковы или диапазон вырожден) → средняя
 *  точка градиента для всех — не делить на ноль. */
export function trendColorFor(value: number | null, range: TrendRange): string {
  if (value === null) return TREND_MISSING_COLOR;
  const t = range.max === range.min ? 0.5 : (value - range.min) / (range.max - range.min);
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped <= 0.5) {
    const localT = clamped / 0.5;
    return toHex([
      lerpChannel(LOW_COLOR[0], MID_COLOR[0], localT),
      lerpChannel(LOW_COLOR[1], MID_COLOR[1], localT),
      lerpChannel(LOW_COLOR[2], MID_COLOR[2], localT),
    ]);
  }
  const localT = (clamped - 0.5) / 0.5;
  return toHex([
    lerpChannel(MID_COLOR[0], HIGH_COLOR[0], localT),
    lerpChannel(MID_COLOR[1], HIGH_COLOR[1], localT),
    lerpChannel(MID_COLOR[2], HIGH_COLOR[2], localT),
  ]);
}
