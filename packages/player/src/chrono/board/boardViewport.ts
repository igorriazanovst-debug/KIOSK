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
 * Панорамирование на deltaPx пикселей (положительное — палец/курсор тянет
 * контент вправо, то есть видимое окно смещается в прошлое).
 */
export function panViewport(viewport: Viewport, deltaPx: number): Viewport {
  const deltaAxisYears = (deltaPx / viewport.widthPx) * viewport.spanAxisYears;
  return { ...viewport, centerAxisYears: viewport.centerAxisYears - deltaAxisYears };
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
