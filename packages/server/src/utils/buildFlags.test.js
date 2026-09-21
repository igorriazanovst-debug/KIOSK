import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectWindowMode, isPerAppDeviceIdRequested, applyPerAppDeviceId } from './buildFlags.js';

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

test('isPerAppDeviceIdRequested is false when the flag is absent', () => {
  assert.equal(isPerAppDeviceIdRequested(undefined), false);
  assert.equal(isPerAppDeviceIdRequested(null), false);
  assert.equal(isPerAppDeviceIdRequested(''), false);
});

test('isPerAppDeviceIdRequested accepts boolean true and the string "true" (multipart/JSON bodies)', () => {
  assert.equal(isPerAppDeviceIdRequested(true), true);
  assert.equal(isPerAppDeviceIdRequested('true'), true);
});

test('isPerAppDeviceIdRequested rejects everything else, including "false", "1" and objects', () => {
  for (const v of [false, 'false', '1', 1, 'yes', {}, []]) {
    assert.equal(isPerAppDeviceIdRequested(v), false, String(v));
  }
});

test('applyPerAppDeviceId sets the flag only when requested', () => {
  assert.equal(applyPerAppDeviceId({ id: 'p', widgets: [] }, true).perAppDeviceId, true);
  assert.equal('perAppDeviceId' in applyPerAppDeviceId({ id: 'p' }, false), false);
});

test('applyPerAppDeviceId strips a flag smuggled in via the stored project data', () => {
  const stored = { id: 'p', perAppDeviceId: true, widgets: [] };
  assert.equal('perAppDeviceId' in applyPerAppDeviceId(stored, false), false);
  assert.equal(applyPerAppDeviceId(stored, true).perAppDeviceId, true);
});

test('applyPerAppDeviceId does not mutate its input and keeps other fields', () => {
  const stored = { id: 'p', name: 'X', perAppDeviceId: true };
  const out = applyPerAppDeviceId(stored, false);
  assert.equal(stored.perAppDeviceId, true);
  assert.deepEqual(out, { id: 'p', name: 'X' });
});

test('applyPerAppDeviceId passes non-objects through untouched', () => {
  assert.equal(applyPerAppDeviceId(null, true), null);
  assert.equal(applyPerAppDeviceId('str', true), 'str');
});
