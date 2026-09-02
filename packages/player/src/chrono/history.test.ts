import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initHistory, pushHistory, undo, redo, canUndo, canRedo, MAX_HISTORY_SIZE } from './history.ts';

test('initHistory starts with empty past/future and cannot undo/redo', () => {
  const h = initHistory('a');
  assert.equal(h.present, 'a');
  assert.deepEqual(h.past, []);
  assert.deepEqual(h.future, []);
  assert.equal(canUndo(h), false);
  assert.equal(canRedo(h), false);
});

test('pushHistory moves the old present into past and clears future', () => {
  let h = initHistory('a');
  h = pushHistory(h, 'b');

  assert.equal(h.present, 'b');
  assert.deepEqual(h.past, ['a']);
  assert.equal(canUndo(h), true);
});

test('pushHistory after an undo discards the redo branch (standard undo/redo semantics)', () => {
  let h = initHistory('a');
  h = pushHistory(h, 'b');
  h = pushHistory(h, 'c');
  h = undo(h); // present: b, future: [c]
  h = pushHistory(h, 'd'); // new branch from b

  assert.equal(h.present, 'd');
  assert.deepEqual(h.past, ['a', 'b']);
  assert.deepEqual(h.future, [], 'the old c branch must be gone once a new edit was made');
});

test('undo/redo round-trip returns to the exact same state', () => {
  let h = initHistory('a');
  h = pushHistory(h, 'b');
  h = pushHistory(h, 'c');

  h = undo(h);
  assert.equal(h.present, 'b');
  h = undo(h);
  assert.equal(h.present, 'a');

  h = redo(h);
  assert.equal(h.present, 'b');
  h = redo(h);
  assert.equal(h.present, 'c');
});

test('undo at the start of history is a no-op', () => {
  const h = initHistory('a');
  assert.deepEqual(undo(h), h);
});

test('redo with an empty future is a no-op', () => {
  let h = initHistory('a');
  h = pushHistory(h, 'b');
  assert.deepEqual(redo(h), h);
});

test('history depth is capped at MAX_HISTORY_SIZE, oldest entries drop first', () => {
  let h = initHistory(0);
  for (let i = 1; i <= MAX_HISTORY_SIZE + 10; i++) {
    h = pushHistory(h, i);
  }

  assert.equal(h.past.length, MAX_HISTORY_SIZE);
  assert.equal(h.present, MAX_HISTORY_SIZE + 10);
  // 60 pushes append old-present values 0..59; keeping the last 50 of those means 0..9 got dropped
  assert.equal(h.past[0], 10);
});
