// packages/player/src/chrono/board/eventFilter.ts
// Поиск/фильтр по тексту/дате/атрибутам (Фаза 6, последний пункт плана).
// Чистые функции - фильтр применяется в BoardView поверх уже готового
// isEventVisible (видимость по viewport), это отдельное, независимое
// условие: событие может быть видно в текущем масштабе, но не проходить
// фильтр, и наоборот - за пределами видимого диапазона, но формально
// подошедшее бы под фильтр (такие события просто не отрисовываются вообще,
// подсчёт "сколько скрыто фильтром" не включает их).

import { intervalRange, toAxisYears, type ChronoMoment, type TimelineEvent } from '@kiosk/shared';

export interface EventFilter {
  text: string;
  dateFrom: ChronoMoment | null;
  dateTo: ChronoMoment | null;
  attributeId: string | null;
  attributeValueText: string;
}

export const EMPTY_EVENT_FILTER: EventFilter = {
  text: '',
  dateFrom: null,
  dateTo: null,
  attributeId: null,
  attributeValueText: '',
};

/** Показывать ли постоянный индикатор "применены фильтры" - независимо от того, открыта ли сама панель фильтра */
export function isFilterActive(filter: EventFilter): boolean {
  return (
    filter.text.trim().length > 0 ||
    filter.dateFrom !== null ||
    filter.dateTo !== null ||
    (filter.attributeId !== null && filter.attributeValueText.trim().length > 0)
  );
}

function attributeValueToText(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.join(' ');
  return String(value);
}

export function matchesEventFilter(event: TimelineEvent, filter: EventFilter): boolean {
  if (filter.text.trim()) {
    const needle = filter.text.trim().toLowerCase();
    const haystack = [event.name, event.place ?? '', event.descriptionHtml ?? ''].join(' ').toLowerCase();
    if (!haystack.includes(needle)) return false;
  }

  if (filter.dateFrom !== null || filter.dateTo !== null) {
    const range = intervalRange(event.interval);
    const from = filter.dateFrom !== null ? toAxisYears(filter.dateFrom) : -Infinity;
    const to = filter.dateTo !== null ? toAxisYears(filter.dateTo) : Infinity;
    // Пересечение диапазонов, не "начало события внутри from..to" -
    // событие, длящееся ЧЕРЕЗ границу фильтра, обязано пройти фильтр.
    if (range.end < from || range.start > to) return false;
  }

  if (filter.attributeId !== null && filter.attributeValueText.trim()) {
    const needle = filter.attributeValueText.trim().toLowerCase();
    const valueText = attributeValueToText(event.attributeValues[filter.attributeId]).toLowerCase();
    if (!valueText.includes(needle)) return false;
  }

  return true;
}
