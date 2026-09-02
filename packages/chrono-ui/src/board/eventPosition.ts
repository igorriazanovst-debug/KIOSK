// packages/player/src/chrono/board/eventPosition.ts
// Пиксельные границы события на доске при текущем viewport. Всегда через
// toRange() (Фаза 2, правка Б5) — момент с грубой precision занимает
// ширину своего "кванта" времени (год = весь год), не схлопывается в
// точку. Для одиночного (не "по настоящее время") события без отдельного
// конца ожидается end === start в самой модели, не null — null зарезервирован
// под символьный открытый конец (см. chronoInterval.ts); тогда левая
// граница берётся из toRange(start).start, а правая из toRange(end).end,
// что для end===start корректно даёт ширину в один "квант" точности
// момента, а не нулевую ширину.

import { toRange, axisYearsToPx, type ChronoInterval, type Viewport } from '@kiosk/shared';

export interface EventPixelBounds {
  left: number;
  width: number;
}

/**
 * @param interval Интервал события
 * @param viewport Текущий видимый диапазон
 */
export function eventPixelBounds(interval: ChronoInterval, viewport: Viewport): EventPixelBounds {
  const startRange = toRange(interval.start);
  const startPx = axisYearsToPx(startRange.start, viewport);

  let endPx: number;
  if (interval.end === null) {
    // Символьный открытый конец ("по настоящее время") — визуально тянется
    // до правого края видимой области, не материализуется конкретной
    // датой (Фаза 2, chronoInterval.ts).
    endPx = viewport.widthPx;
  } else {
    const endRange = toRange(interval.end);
    endPx = axisYearsToPx(endRange.end, viewport);
  }

  const left = Math.min(startPx, endPx);
  const width = Math.max(0, Math.abs(endPx - startPx));

  return { left, width };
}

/** true, если событие хотя бы частично попадает в видимую область — для виртуализации при большом числе событий */
export function isEventVisible(interval: ChronoInterval, viewport: Viewport): boolean {
  const bounds = eventPixelBounds(interval, viewport);
  return bounds.left + bounds.width >= 0 && bounds.left <= viewport.widthPx;
}
