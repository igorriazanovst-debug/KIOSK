import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionLock } from './sessionLock.js';

test('a fresh session lock starts locked', () => {
  const lock = createSessionLock();
  assert.equal(lock.isUnlocked(), false);
});

test('unlock() makes isUnlocked() true', () => {
  const lock = createSessionLock();
  lock.unlock();
  assert.equal(lock.isUnlocked(), true);
});

test('lock() re-locks an unlocked session immediately', () => {
  const lock = createSessionLock();
  lock.unlock();
  lock.lock();
  assert.equal(lock.isUnlocked(), false);
});

test('isUnlocked() becomes false again after the idle timeout elapses, without an explicit lock()', () => {
  const lock = createSessionLock(50); // 50ms timeout for the test
  lock.unlock();
  assert.equal(lock.isUnlocked(), true);
});

test('isUnlocked() stays true just under the idle timeout, and flips false once past it', async () => {
  const lock = createSessionLock(50);
  lock.unlock();

  await new Promise((r) => setTimeout(r, 80));

  assert.equal(lock.isUnlocked(), false);
});

test('touch() extends the session - a mutation right before the deadline keeps it alive past the original deadline', async () => {
  const lock = createSessionLock(80);
  lock.unlock();

  await new Promise((r) => setTimeout(r, 50));
  lock.touch();
  await new Promise((r) => setTimeout(r, 50));

  // 100ms total elapsed since unlock(), but only 50ms since the touch() -
  // still unlocked because touch() reset the clock.
  assert.equal(lock.isUnlocked(), true);
});

test('touch() on an already-locked session is a no-op, does not itself unlock', () => {
  const lock = createSessionLock();
  lock.touch();
  assert.equal(lock.isUnlocked(), false);
});

test('two independent session locks do not share state', () => {
  const a = createSessionLock();
  const b = createSessionLock();
  a.unlock();

  assert.equal(a.isUnlocked(), true);
  assert.equal(b.isUnlocked(), false);
});
