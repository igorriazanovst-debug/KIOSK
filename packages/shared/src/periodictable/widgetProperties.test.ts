import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PERIODICTABLE_WIDGET_TYPE,
  PERIODICTABLE_DEFAULT_PROPS,
  PERIODICTABLE_DEFAULT_SIZE,
  PERIODICTABLE_PROPS_VERSION,
} from './widgetProperties';

test('widget type constant is the expected string', () => {
  assert.equal(PERIODICTABLE_WIDGET_TYPE, 'periodictable');
});

test('props version is a non-empty string', () => {
  assert.equal(typeof PERIODICTABLE_PROPS_VERSION, 'string');
  assert.ok(PERIODICTABLE_PROPS_VERSION.length > 0);
});

test('default props include a non-empty title and a 4-digit teacherPin', () => {
  assert.ok(PERIODICTABLE_DEFAULT_PROPS.title && PERIODICTABLE_DEFAULT_PROPS.title.length > 0);
  assert.match(PERIODICTABLE_DEFAULT_PROPS.teacherPin ?? '', /^\d{4}$/);
});

test('default size is positive in both dimensions', () => {
  assert.ok(PERIODICTABLE_DEFAULT_SIZE.width > 0);
  assert.ok(PERIODICTABLE_DEFAULT_SIZE.height > 0);
});
