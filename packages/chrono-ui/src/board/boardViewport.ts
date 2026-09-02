// packages/player/src/chrono/board/boardViewport.ts
// Чистая логика панорамирования/зума видимого диапазона доски — независимая
// от того, ЧТО именно вызывает пан/зум (жест пальцем, колесо мыши,
// перетаскивание обзорной шкалы). Взаимодействие (@use-gesture/react,
// решение спайка 0.4) — только источник дельт в пикселях, вся математика
// перевода в годы уже готова в @kiosk/shared (axisYearsToPx/pxToAxisYears).

import { pxToAxisYears, type Viewport } from '@kiosk/shared';

/** Минимальный видимый диапазон — не даём зумиться до бесконечно малого шага */
export const MIN_SPAN_YEARS = 1e-6; // ~30 миллисекунд
/** Максимальный видимый диапазон — весь заявленный охват "до миллиардов лет" с запасом */
export const MAX_SPAN_YEARS = 2e10;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Плотность пикселей ЛЮБОГО viewport (сам основной viewport доски, окно
 * обзорной шкалы поверх собственного крупномасштабного viewport и т.д.) —
 * общая конверсия дельты жеста в годы оси, переиспользуется panViewport,
 * eventDrag.ts (перетаскивание/растягивание событий) и OverviewScale.tsx.
 */
export function pxDeltaToAxisYearsDelta(deltaPx: number, viewport: Viewport): number {
  return (deltaPx / viewport.widthPx) * viewport.spanAxisYears;
}

/**
 * Панорамирование на deltaPx пикселей (положительное — палец/курсор тянет
 * контент вправо, то есть видимое окно смещается в прошлое).
 */
export function panViewport(viewport: Viewport, deltaPx: number): Viewport {
  return { ...viewport, centerAxisYears: viewport.centerAxisYears - pxDeltaToAxisYearsDelta(deltaPx, viewport) };
}

/**
 * Зум с фиксацией точки под курсором/пальцем: год, оказавшийся на пикселе
 * pxAnchor ДО зума, остаётся на том же пикселе ПОСЛЕ — без этого зум
 * "убегает" из-под пальца при масштабировании не по центру экрана.
 *
 * Вывод формулы: пусть f = (pxAnchor - width/2)/width (доля смещения от
 * центра, не меняется при зуме, т.к. pxAnchor фиксирован). Тогда
 * anchorAxisYears = oldCenter + f·oldSpan = newCenter + f·newSpan, откуда
 * newCenter = oldCenter + f·(oldSpan - newSpan). Точная формула, не
 * итеративное приближение.
 */
export function zoomViewportAtPoint(
  viewport: Viewport,
  pxAnchor: number,
  scaleFactor: number,
  minSpanYears = MIN_SPAN_YEARS,
  maxSpanYears = MAX_SPAN_YEARS
): Viewport {
  if (!(scaleFactor > 0) || !Number.isFinite(scaleFactor)) {
    throw new RangeError(`zoomViewportAtPoint: scaleFactor must be a positive finite number, got ${scaleFactor}`);
  }

  const newSpan = clamp(viewport.spanAxisYears / scaleFactor, minSpanYears, maxSpanYears);
  const fractionFromCenter = (pxAnchor - viewport.widthPx / 2) / viewport.widthPx;
  const newCenter = viewport.centerAxisYears + fractionFromCenter * (viewport.spanAxisYears - newSpan);

  return { ...viewport, centerAxisYears: newCenter, spanAxisYears: newSpan };
}

/** Видимый диапазон в приблизительных годах: [start, end] */
export function visibleAxisRange(viewport: Viewport): { start: number; end: number } {
  return {
    start: pxToAxisYears(0, viewport),
    end: pxToAxisYears(viewport.widthPx, viewport),
  };
}

/**
 * Растягивание окна текущего видимого диапазона за один край (ручка на
 * обзорной шкале, OverviewScale.tsx) - другой край должен остаться РОВНО
 * на месте, каким бы ни был исход клампинга. Поэтому клампится не итоговый
 * центр/спан напрямую (как в zoomViewportAtPoint, где фиксирован пиксель,
 * а не граница), а именно тянущийся край относительно неподвижного:
 * итоговое положение неподвижного края всегда пересчитывается из него
 * самого + уже зажатого спана, а не из сырых start/end.
 */
export function resizeViewportWindow(
  viewport: Viewport,
  edge: 'start' | 'end',
  deltaAxisYears: number,
  minSpanYears = MIN_SPAN_YEARS,
  maxSpanYears = MAX_SPAN_YEARS
): Viewport {
  const half = viewport.spanAxisYears / 2;
  const fixedStart = viewport.centerAxisYears - half;
  const fixedEnd = viewport.centerAxisYears + half;

  if (edge === 'start') {
    const draggedStart = fixedStart + deltaAxisYears;
    const spanAxisYears = clamp(fixedEnd - draggedStart, minSpanYears, maxSpanYears);
    const start = fixedEnd - spanAxisYears;
    return { ...viewport, centerAxisYears: (start + fixedEnd) / 2, spanAxisYears };
  }

  const draggedEnd = fixedEnd + deltaAxisYears;
  const spanAxisYears = clamp(draggedEnd - fixedStart, minSpanYears, maxSpanYears);
  const end = fixedStart + spanAxisYears;
  return { ...viewport, centerAxisYears: (fixedStart + end) / 2, spanAxisYears };
}
