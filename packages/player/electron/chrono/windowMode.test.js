import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBrowserWindowOptions, hasChronolineWidget, BASE_WINDOW_OPTIONS } from './windowMode.js';

// ─── The regression-safety guarantee ────────────────────────────────────────
// Every one of these MUST deep-equal BASE_WINDOW_OPTIONS exactly - this is
// the literal, automated proof that a build without the chronoline widget
// (every existing client today: museums, navigation, everything) gets
// byte-for-byte the same window it gets today.

test('no projectData at all -> exact baseline', () => {
  assert.deepEqual(buildBrowserWindowOptions(undefined), BASE_WINDOW_OPTIONS);
  assert.deepEqual(buildBrowserWindowOptions(null), BASE_WINDOW_OPTIONS);
});

test('projectData with no widgets field -> exact baseline', () => {
  assert.deepEqual(buildBrowserWindowOptions({}), BASE_WINDOW_OPTIONS);
  assert.deepEqual(buildBrowserWindowOptions({ name: 'Музей СВО' }), BASE_WINDOW_OPTIONS);
});

test('projectData with an empty widgets array -> exact baseline', () => {
  assert.deepEqual(buildBrowserWindowOptions({ widgets: [] }), BASE_WINDOW_OPTIONS);
});

test('projectData with only non-chronoline widgets (a real museum-style project) -> exact baseline', () => {
  const project = {
    name: 'Музей СВО',
    widgets: [
      { id: '1', type: 'image', properties: {} },
      { id: '2', type: 'video', properties: {} },
      { id: '3', type: 'navigation', properties: {} },
      { id: '4', type: 'text', properties: {} },
    ],
  };
  assert.deepEqual(buildBrowserWindowOptions(project), BASE_WINDOW_OPTIONS);
});

test('malformed widgets entries do not accidentally trigger window mode', () => {
  assert.deepEqual(
    buildBrowserWindowOptions({ widgets: [null, undefined, 'not-an-object', 42, { no_type: true }] }),
    BASE_WINDOW_OPTIONS
  );
});

// ─── Window mode actually activating ────────────────────────────────────────

test('a chronoline widget switches on window chrome', () => {
  const result = buildBrowserWindowOptions({ widgets: [{ id: '1', type: 'chronoline', properties: {} }] });

  assert.equal(result.fullscreen, false);
  assert.equal(result.kiosk, false);
  assert.equal(result.frame, true);
  assert.equal(result.autoHideMenuBar, false);
  assert.equal(result.alwaysOnTop, false);
  assert.equal(result.resizable, true);
  assert.equal(result.minimizable, true);
  assert.equal(result.maximizable, true);
});

test('window mode is triggered regardless of where in the widget list chronoline sits, and coexists with other widgets', () => {
  const project = {
    widgets: [
      { id: '1', type: 'image', properties: {} },
      { id: '2', type: 'chronoline', properties: {} },
      { id: '3', type: 'text', properties: {} },
    ],
  };
  assert.equal(hasChronolineWidget(project), true);
});

test('window mode preserves the base size/background even while switching chrome', () => {
  const result = buildBrowserWindowOptions({ widgets: [{ type: 'chronoline' }] });
  assert.equal(result.width, BASE_WINDOW_OPTIONS.width);
  assert.equal(result.height, BASE_WINDOW_OPTIONS.height);
  assert.equal(result.backgroundColor, BASE_WINDOW_OPTIONS.backgroundColor);
});

test('BASE_WINDOW_OPTIONS is frozen and cannot be mutated by callers', () => {
  assert.throws(() => {
    // @ts-expect-error - intentional attempt to mutate a frozen object
    BASE_WINDOW_OPTIONS.kiosk = false;
  }, TypeError);
});

test('buildBrowserWindowOptions never returns the frozen singleton itself (callers may spread more keys onto it)', () => {
  const result = buildBrowserWindowOptions({});
  assert.notEqual(result, BASE_WINDOW_OPTIONS);
  assert.doesNotThrow(() => {
    result.webPreferences = {};
  });
});
