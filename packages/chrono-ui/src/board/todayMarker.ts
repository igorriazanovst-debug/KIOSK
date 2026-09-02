// packages/chrono-ui/src/board/todayMarker.ts
// Маркер «сегодня» на шкале (FR-030 ТЗ, приёмочная матрица Фазы 8) —
// показывается на ScaleRuler, только если текущая дата попадает в видимый
// диапазон оси. Чистая функция, чтобы не тянуть Date.now() внутрь теста
// позиционирования — ScaleRuler передаёт `now` явно (по умолчанию new
// Date(), как и everywhere else в проекте, например initialViewport.ts).

import { axisYearsToPx, civilDayToAxisYears, calendarDateTimeToCivilDay, type Viewport } from '@kiosk/shared';
import { visibleAxisRange } from './boardViewport.js';

/**
 * @returns пиксельная позиция маркера, или null, если сегодняшняя дата вне видимого диапазона
 */
export function computeTodayMarkerPx(viewport: Viewport, now: Date): number | null {
  const civilDay = calendarDateTimeToCivilDay(
    { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() },
    'gregorian'
  );
  const todayAxisYears = civilDayToAxisYears(civilDay);

  const range = visibleAxisRange(viewport);
  if (todayAxisYears < range.start || todayAxisYears > range.end) return null;

  return axisYearsToPx(todayAxisYears, viewport);
}
