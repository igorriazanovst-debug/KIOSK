// packages/player/src/chrono/board/initialViewport.ts
// Стартовый viewport при открытии проекта: подгоняет видимый диапазон под
// фактические события (с отступом), а не открывает доску в случайном
// масштабе. Пустой проект (ещё нет ни одного события) — разумный дефолт
// вокруг текущего календарного года, не нулевой/бесконечный диапазон.

import { toRange, type ChronoProject, type Viewport } from '@kiosk/shared';

const DEFAULT_SPAN_YEARS = 100;
const PADDING_FRACTION = 0.1;
const MIN_SPAN_YEARS = 10;

/**
 * @param project Загруженный проект (может быть пустым — свежесозданный)
 * @param widthPx Ширина области отрисовки в пикселях
 * @param now Точка отсчёта для пустого проекта — параметризована для тестируемости
 */
export function computeInitialViewport(project: ChronoProject, widthPx: number, now: Date = new Date()): Viewport {
  const bounds: number[] = [];

  for (const timeline of project.timelines) {
    for (const event of timeline.events) {
      const startRange = toRange(event.interval.start);
      bounds.push(startRange.start, startRange.end);
      if (event.interval.end !== null) {
        const endRange = toRange(event.interval.end);
        bounds.push(endRange.start, endRange.end);
      }
    }
  }

  if (bounds.length === 0) {
    return { centerAxisYears: now.getUTCFullYear(), spanAxisYears: DEFAULT_SPAN_YEARS, widthPx };
  }

  const min = Math.min(...bounds);
  const max = Math.max(...bounds);
  const rawSpan = max - min;
  const padding = Math.max(rawSpan * PADDING_FRACTION, MIN_SPAN_YEARS / 2);
  const spanAxisYears = Math.max(rawSpan + padding * 2, MIN_SPAN_YEARS);

  return { centerAxisYears: (min + max) / 2, spanAxisYears, widthPx };
}
