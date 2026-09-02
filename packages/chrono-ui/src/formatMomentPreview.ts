// packages/player/src/chrono/formatMomentPreview.ts
// Превью результата parseChronoInput для формы добавления события —
// показывает пользователю, как именно был понят введённый текст, ДО
// сохранения (честный отказ, если правило не подошло, не тихая догадка).

import { formatMoment, formatInterval, type ParseResult } from '@kiosk/shared';

export function formatMomentPreview(parsed: ParseResult): string {
  switch (parsed.type) {
    case 'moment':
      return `Распознано: ${formatMoment(parsed.moment)}`;
    case 'range':
      return `Распознано: ${formatInterval({ start: parsed.start, end: parsed.end })}`;
    case 'none':
      return 'Не распознано — попробуйте другую формулировку';
  }
}
