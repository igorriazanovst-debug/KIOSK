// packages/player/src/chrono/board/overviewScale.ts
// Чистая математика обзорной шкалы снизу (OverviewScale.tsx): диапазон
// показа шкалы и позиция окна "текущий видимый viewport" внутри неё.
// Сама шкала - это ЕЩЁ ОДИН Viewport (более крупного масштаба), поэтому
// переиспользует уже готовые axisYearsToPx/pxToAxisYears вместо отдельной
// системы координат.

import { axisYearsToPx, type ChronoTimeline, type Viewport } from '@kiosk/shared';
import { collectAxisYearBounds } from './timelineBounds.ts';

const PADDING_FRACTION = 0.1;
const MIN_SPAN_YEARS = 10;

/**
 * Диапазон, который показывает обзорная шкала: охватывает ВСЕ события
 * проекта И текущий видимый viewport (иначе окно "вы здесь" могло бы
 * оказаться за пределами шкалы при зуме/пане далеко за пределы событий).
 *
 * @param timelines Линии проекта
 * @param widthPx Ширина полосы обзорной шкалы в пикселях
 * @param viewport Текущий видимый viewport основной доски
 */
export function computeOverviewRange(timelines: ChronoTimeline[], widthPx: number, viewport: Viewport): Viewport {
  const bounds = collectAxisYearBounds(timelines);
  const half = viewport.spanAxisYears / 2;
  bounds.push(viewport.centerAxisYears - half, viewport.centerAxisYears + half);

  const min = Math.min(...bounds);
  const max = Math.max(...bounds);
  const rawSpan = max - min;
  const padding = Math.max(rawSpan * PADDING_FRACTION, MIN_SPAN_YEARS / 2);
  const spanAxisYears = Math.max(rawSpan + padding * 2, MIN_SPAN_YEARS);

  return { centerAxisYears: (min + max) / 2, spanAxisYears, widthPx };
}

/** Пиксельные границы окна "текущий видимый viewport" внутри полосы обзорной шкалы */
export function windowBoundsPx(viewport: Viewport, overview: Viewport): { left: number; width: number } {
  const half = viewport.spanAxisYears / 2;
  const left = axisYearsToPx(viewport.centerAxisYears - half, overview);
  const right = axisYearsToPx(viewport.centerAxisYears + half, overview);
  return { left, width: Math.max(right - left, 1) };
}
