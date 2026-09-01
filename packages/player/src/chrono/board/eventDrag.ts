// packages/player/src/chrono/board/eventDrag.ts
// Чистая математика перетаскивания события: пиксельная дельта жеста →
// дельта в годах оси → сдвинутый интервал (через уже готовый и
// протестированный shiftInterval, Фаза 3). Сама привязка к жесту
// (@use-gesture) — в EventNode.tsx, не здесь; это разделение специально
// оставляет пиксель-математику юнит-тестируемой без браузера.
//
// Знак дельты: перетаскивание ВПРАВО (положительная deltaPx) двигает
// событие ВПЕРЁД по времени — та же ось, что и у остального рендера
// (axisYearsToPx растёт слева направо). Обратный знак у panViewport
// (см. boardViewport.ts) корректен для другого действия — там двигают
// не событие, а точку зрения, поэтому дельты противоположны по смыслу,
// не должны быть одной функцией.

import { shiftInterval, type ChronoInterval, type Viewport } from '@kiosk/shared';

export function pxDeltaToAxisYearsDelta(deltaPx: number, viewport: Viewport): number {
  return (deltaPx / viewport.widthPx) * viewport.spanAxisYears;
}

/** Интервал, каким он станет, если отпустить драг прямо сейчас (используется и для live-превью, и для коммита) */
export function previewDraggedInterval(original: ChronoInterval, deltaPx: number, viewport: Viewport): ChronoInterval {
  return shiftInterval(original, pxDeltaToAxisYearsDelta(deltaPx, viewport));
}
