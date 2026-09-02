// packages/player/src/chrono/board/eventDrag.ts
// Чистая математика перетаскивания события: пиксельная дельта жеста →
// дельта в годах оси (pxDeltaToAxisYearsDelta, boardViewport.ts) →
// сдвинутый интервал (через уже готовый и протестированный shiftInterval,
// Фаза 3). Сама привязка к жесту (@use-gesture) — в EventNode.tsx, не
// здесь; это разделение специально оставляет пиксель-математику
// юнит-тестируемой без браузера.
//
// Знак дельты: перетаскивание ВПРАВО (положительная deltaPx) двигает
// событие ВПЕРЁД по времени — та же ось, что и у остального рендера
// (axisYearsToPx растёт слева направо). Обратный знак у panViewport
// (см. boardViewport.ts) корректен для другого действия — там двигают
// не событие, а точку зрения, поэтому дельты противоположны по смыслу,
// не должны быть одной функцией, хотя обе используют одну и ту же
// плотность пикселей (pxDeltaToAxisYearsDelta).

import { shiftInterval, shiftMoment, toAxisYears, type ChronoInterval, type Viewport } from '@kiosk/shared';
import { pxDeltaToAxisYearsDelta } from './boardViewport.js';

export type ResizeEdge = 'start' | 'end';

export { pxDeltaToAxisYearsDelta };

/** Интервал, каким он станет, если отпустить драг прямо сейчас (используется и для live-превью, и для коммита) */
export function previewDraggedInterval(original: ChronoInterval, deltaPx: number, viewport: Viewport): ChronoInterval {
  return shiftInterval(original, pxDeltaToAxisYearsDelta(deltaPx, viewport));
}

/**
 * Растягивание ОДНОГО конца интервала (ручка на границе события), второй
 * конец не трогается. Открытый конец (end === null, "по настоящее время")
 * нельзя растянуть за конкретную дату здесь - это отдельное действие
 * ("закрыть" интервал), не жест на ручке.
 *
 * Если сдвиг переносит край ЗА другой конец (начало позже конца или
 * наоборот), край схлопывается ровно на другом конце - интервал остаётся
 * нулевой ширины, а не перевёрнутым (start > end).
 */
export function previewResizedInterval(
  original: ChronoInterval,
  edge: ResizeEdge,
  deltaPx: number,
  viewport: Viewport
): ChronoInterval {
  const deltaAxisYears = pxDeltaToAxisYearsDelta(deltaPx, viewport);

  if (edge === 'start') {
    const newStart = shiftMoment(original.start, deltaAxisYears);
    if (original.end !== null && toAxisYears(newStart) > toAxisYears(original.end)) {
      return { start: original.end, end: original.end };
    }
    return { start: newStart, end: original.end };
  }

  if (original.end === null) return original;

  const newEnd = shiftMoment(original.end, deltaAxisYears);
  if (toAxisYears(newEnd) < toAxisYears(original.start)) {
    return { start: original.start, end: original.start };
  }
  return { start: original.start, end: newEnd };
}
