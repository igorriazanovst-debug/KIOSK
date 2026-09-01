// packages/player/src/chrono/board/timelineBounds.ts
// Сбор границ (в годах оси) всех событий проекта - общая часть для
// initialViewport.ts (стартовый масштаб) и overviewScale.ts (обзорная
// шкала снизу), вынесена, чтобы не дублировать один и тот же цикл по
// toRange() в двух местах.

import { toRange, type ChronoTimeline } from '@kiosk/shared';

export function collectAxisYearBounds(timelines: ChronoTimeline[]): number[] {
  const bounds: number[] = [];

  for (const timeline of timelines) {
    for (const event of timeline.events) {
      const startRange = toRange(event.interval.start);
      bounds.push(startRange.start, startRange.end);
      if (event.interval.end !== null) {
        const endRange = toRange(event.interval.end);
        bounds.push(endRange.start, endRange.end);
      }
    }
  }

  return bounds;
}
