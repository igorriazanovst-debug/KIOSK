import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesEventFilter, isFilterActive, EMPTY_EVENT_FILTER, type EventFilter } from './eventFilter.js';
import { calendarDateTimeToCivilDay, type ChronoMoment, type TimelineEvent } from '@kiosk/shared';

function yearMoment(year: number): ChronoMoment {
  return {
    kind: 'calendar',
    civilDay: calendarDateTimeToCivilDay({ year, month: 1, day: 1 }, 'gregorian'),
    precision: 'year',
    calendar: 'gregorian',
    approximate: false,
  };
}

function sampleEvent(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
  const moment = yearMoment(1941);
  return {
    id: 'ev-1',
    interval: { start: moment, end: moment },
    name: 'Начало войны',
    place: 'Брест',
    descriptionHtml: 'Внезапное нападение',
    mediaIds: [],
    attributeValues: {},
    view: 'compact',
    verticalPriority: 1000,
    ...overrides,
  };
}

// ─── isFilterActive ────────────────────────────────────────────────────

test('isFilterActive is false for the empty filter', () => {
  assert.equal(isFilterActive(EMPTY_EVENT_FILTER), false);
});

test('isFilterActive is true when only the text field is set', () => {
  assert.equal(isFilterActive({ ...EMPTY_EVENT_FILTER, text: 'война' }), true);
});

test('isFilterActive is false for whitespace-only text (not a real filter)', () => {
  assert.equal(isFilterActive({ ...EMPTY_EVENT_FILTER, text: '   ' }), false);
});

test('isFilterActive is true when only a date bound is set', () => {
  assert.equal(isFilterActive({ ...EMPTY_EVENT_FILTER, dateFrom: yearMoment(1900) }), true);
});

test('isFilterActive requires BOTH an attribute id and a non-empty value text to count', () => {
  assert.equal(isFilterActive({ ...EMPTY_EVENT_FILTER, attributeId: 'attr-1' }), false);
  assert.equal(isFilterActive({ ...EMPTY_EVENT_FILTER, attributeId: 'attr-1', attributeValueText: 'x' }), true);
});

// ─── matchesEventFilter: text ──────────────────────────────────────────

test('matchesEventFilter with no filter set matches everything', () => {
  assert.equal(matchesEventFilter(sampleEvent(), EMPTY_EVENT_FILTER), true);
});

test('matchesEventFilter text matches name, place, or description, case-insensitively', () => {
  const event = sampleEvent();
  assert.equal(matchesEventFilter(event, { ...EMPTY_EVENT_FILTER, text: 'ВОЙНЫ' }), true);
  assert.equal(matchesEventFilter(event, { ...EMPTY_EVENT_FILTER, text: 'брест' }), true);
  assert.equal(matchesEventFilter(event, { ...EMPTY_EVENT_FILTER, text: 'внезапное' }), true);
  assert.equal(matchesEventFilter(event, { ...EMPTY_EVENT_FILTER, text: 'победа' }), false);
});

// ─── matchesEventFilter: date range ────────────────────────────────────

test('matchesEventFilter date range matches an event inside the range', () => {
  const event = sampleEvent({ interval: { start: yearMoment(1941), end: yearMoment(1941) } });
  const filter: EventFilter = { ...EMPTY_EVENT_FILTER, dateFrom: yearMoment(1939), dateTo: yearMoment(1945) };
  assert.equal(matchesEventFilter(event, filter), true);
});

test('matchesEventFilter date range excludes an event entirely outside the range', () => {
  const event = sampleEvent({ interval: { start: yearMoment(1812), end: yearMoment(1812) } });
  const filter: EventFilter = { ...EMPTY_EVENT_FILTER, dateFrom: yearMoment(1939), dateTo: yearMoment(1945) };
  assert.equal(matchesEventFilter(event, filter), false);
});

test('matchesEventFilter date range matches an event that only PARTIALLY overlaps the range (spans across a boundary)', () => {
  const event = sampleEvent({ interval: { start: yearMoment(1935), end: yearMoment(1942) } });
  const filter: EventFilter = { ...EMPTY_EVENT_FILTER, dateFrom: yearMoment(1939), dateTo: yearMoment(1945) };
  assert.equal(matchesEventFilter(event, filter), true, 'an event running through the filter window must pass, not just ones starting inside it');
});

test('matchesEventFilter with only dateFrom set (open-ended lower bound) matches anything after it', () => {
  const event = sampleEvent({ interval: { start: yearMoment(2020), end: yearMoment(2020) } });
  const filter: EventFilter = { ...EMPTY_EVENT_FILTER, dateFrom: yearMoment(1939) };
  assert.equal(matchesEventFilter(event, filter), true);
});

test('matchesEventFilter respects an open-ended event interval (end: null, "to the present")', () => {
  const event = sampleEvent({ interval: { start: yearMoment(1991), end: null } });
  const filter: EventFilter = { ...EMPTY_EVENT_FILTER, dateFrom: yearMoment(2020) };
  assert.equal(matchesEventFilter(event, filter), true, 'an ongoing event must match any lower bound, its range extends to +Infinity');
});

// ─── matchesEventFilter: attribute value ───────────────────────────────

test('matchesEventFilter attribute filter matches on a substring of the string value', () => {
  const event = sampleEvent({ attributeValues: { 'attr-1': 'Западный фронт' } });
  const filter: EventFilter = { ...EMPTY_EVENT_FILTER, attributeId: 'attr-1', attributeValueText: 'западный' };
  assert.equal(matchesEventFilter(event, filter), true);
});

test('matchesEventFilter attribute filter fails when the event has no value for that attribute', () => {
  const event = sampleEvent({ attributeValues: {} });
  const filter: EventFilter = { ...EMPTY_EVENT_FILTER, attributeId: 'attr-1', attributeValueText: 'x' };
  assert.equal(matchesEventFilter(event, filter), false);
});

test('matchesEventFilter attribute filter works on a "set" (string[]) value by joining it', () => {
  const event = sampleEvent({ attributeValues: { 'attr-1': ['пехота', 'артиллерия'] } });
  const filter: EventFilter = { ...EMPTY_EVENT_FILTER, attributeId: 'attr-1', attributeValueText: 'артилл' };
  assert.equal(matchesEventFilter(event, filter), true);
});

test('matchesEventFilter attribute filter works on a boolean/number value via string coercion', () => {
  const event = sampleEvent({ attributeValues: { 'attr-1': true } });
  const filter: EventFilter = { ...EMPTY_EVENT_FILTER, attributeId: 'attr-1', attributeValueText: 'true' };
  assert.equal(matchesEventFilter(event, filter), true);
});

// ─── matchesEventFilter: combined conditions (AND, not OR) ─────────────

test('matchesEventFilter requires ALL active conditions to pass, not just one', () => {
  const event = sampleEvent();
  const filter: EventFilter = { ...EMPTY_EVENT_FILTER, text: 'война', dateFrom: yearMoment(2000) };
  assert.equal(matchesEventFilter(event, filter), false, 'text matches but the date range does not - overall must fail');
});
