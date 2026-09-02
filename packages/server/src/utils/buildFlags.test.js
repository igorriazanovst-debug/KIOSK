import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectWindowMode } from './buildFlags.js';

test('detectWindowMode is false for a project with no widgets', () => {
  assert.equal(detectWindowMode({ widgets: [] }), false);
});

test('detectWindowMode is false for a project with only other widget types', () => {
  assert.equal(
    detectWindowMode({
      widgets: [
        { id: '1', type: 'image', properties: {} },
        { id: '2', type: 'navigation', properties: {} },
      ],
    }),
    false
  );
});

test('detectWindowMode is true when a chronoline widget is present', () => {
  assert.equal(
    detectWindowMode({
      widgets: [
        { id: '1', type: 'text', properties: {} },
        { id: '2', type: 'chronoline', properties: {} },
      ],
    }),
    true
  );
});

test('detectWindowMode is true regardless of chronoline widget position in the list', () => {
  assert.equal(
    detectWindowMode({
      widgets: [{ id: '1', type: 'chronoline', properties: {} }],
    }),
    true
  );
});

test('detectWindowMode handles missing/malformed projectData without throwing', () => {
  assert.equal(detectWindowMode(null), false);
  assert.equal(detectWindowMode(undefined), false);
  assert.equal(detectWindowMode({}), false);
  assert.equal(detectWindowMode({ widgets: null }), false);
  assert.equal(detectWindowMode({ widgets: 'not-an-array' }), false);
});

test('detectWindowMode ignores malformed entries inside widgets array', () => {
  assert.equal(
    detectWindowMode({
      widgets: [null, undefined, 'not-an-object', 42, { type: 'chronoline' }],
    }),
    true
  );
  assert.equal(
    detectWindowMode({
      widgets: [null, undefined, 'not-an-object', 42],
    }),
    false
  );
});
