import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPickedMediaPaths } from './pickedMediaPaths.js';

test('consume returns false for a path that was never remembered (the HIGH-finding scenario: an arbitrary renderer-supplied path)', () => {
  const tracker = createPickedMediaPaths();
  assert.equal(tracker.consume('C:\\Users\\someone\\private-photo.jpg'), false);
});

test('consume returns true for a path that was remembered, and false on a second attempt (single-use)', () => {
  const tracker = createPickedMediaPaths();
  tracker.remember('C:\\picked\\photo.jpg');

  assert.equal(tracker.consume('C:\\picked\\photo.jpg'), true);
  assert.equal(tracker.consume('C:\\picked\\photo.jpg'), false, 'a consumed path must not be usable a second time');
});

test('remembering the same path twice still only allows one consume (Set semantics, not a counter)', () => {
  const tracker = createPickedMediaPaths();
  tracker.remember('C:\\picked\\photo.jpg');
  tracker.remember('C:\\picked\\photo.jpg');

  assert.equal(tracker.consume('C:\\picked\\photo.jpg'), true);
  assert.equal(tracker.consume('C:\\picked\\photo.jpg'), false);
});

test('tracked paths are capped - remembering past the cap evicts the oldest, unconsumed entry', () => {
  const tracker = createPickedMediaPaths(2);
  tracker.remember('a');
  tracker.remember('b');
  tracker.remember('c'); // should evict 'a'

  assert.equal(tracker.consume('a'), false, 'oldest entry must have been evicted');
  assert.equal(tracker.consume('b'), true);
  assert.equal(tracker.consume('c'), true);
});

test('two independent trackers do not share state', () => {
  const a = createPickedMediaPaths();
  const b = createPickedMediaPaths();
  a.remember('x');

  assert.equal(a.consume('x'), true);
  assert.equal(b.consume('x'), false);
});
