// packages/shared/src/naturalCommunities/roles.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasAtLeastRole } from './roles';

test('a role always satisfies its own minimum', () => {
  assert.equal(hasAtLeastRole('student', 'student'), true);
  assert.equal(hasAtLeastRole('teacher', 'teacher'), true);
  assert.equal(hasAtLeastRole('admin', 'admin'), true);
});

test('higher roles satisfy lower minimums', () => {
  assert.equal(hasAtLeastRole('teacher', 'student'), true);
  assert.equal(hasAtLeastRole('admin', 'student'), true);
  assert.equal(hasAtLeastRole('admin', 'teacher'), true);
});

test('lower roles do not satisfy higher minimums', () => {
  assert.equal(hasAtLeastRole('student', 'teacher'), false);
  assert.equal(hasAtLeastRole('student', 'admin'), false);
  assert.equal(hasAtLeastRole('teacher', 'admin'), false);
});
