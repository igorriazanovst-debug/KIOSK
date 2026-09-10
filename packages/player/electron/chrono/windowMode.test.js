import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBrowserWindowOptions, hasChronolineWidget, hasNaturalCommunitiesWidget, hasMathMachineWidget, hasPeriodicTableWidget, hasRusiqWidget, hasStandaloneAppWidget, BASE_WINDOW_OPTIONS, hasWordsWidget } from './windowMode.js';

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
  // useContentSize - без него width/height считают рамку окна как часть
  // содержимого, и доска Хронолинии (доверяет заявленной ширине виджета)
  // рендерится на несколько px шире реально видимой области - найдено
  // вживую при первом реальном запуске в Electron.
  assert.equal(result.useContentSize, true);
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

// ─── naturalcommunities - second standalone-app widget type ────────────────

test('a naturalcommunities widget switches on window chrome, same as chronoline', () => {
  const result = buildBrowserWindowOptions({ widgets: [{ id: '1', type: 'naturalcommunities', properties: {} }] });

  assert.equal(result.fullscreen, false);
  assert.equal(result.kiosk, false);
  assert.equal(result.frame, true);
  assert.equal(result.autoHideMenuBar, false);
  assert.equal(result.useContentSize, true);
});

test('hasNaturalCommunitiesWidget does not fire for chronoline and vice versa', () => {
  assert.equal(hasNaturalCommunitiesWidget({ widgets: [{ type: 'chronoline' }] }), false);
  assert.equal(hasChronolineWidget({ widgets: [{ type: 'naturalcommunities' }] }), false);
});

// ─── mathmachine - third standalone-app widget type ────────────────────────

test('a mathmachine widget switches on window chrome, same as chronoline/naturalcommunities', () => {
  const result = buildBrowserWindowOptions({ widgets: [{ id: '1', type: 'mathmachine', properties: {} }] });

  assert.equal(result.fullscreen, false);
  assert.equal(result.kiosk, false);
  assert.equal(result.frame, true);
  assert.equal(result.autoHideMenuBar, false);
  assert.equal(result.useContentSize, true);
});

test('hasMathMachineWidget does not fire for the other standalone-app types and vice versa', () => {
  assert.equal(hasMathMachineWidget({ widgets: [{ type: 'chronoline' }] }), false);
  assert.equal(hasMathMachineWidget({ widgets: [{ type: 'naturalcommunities' }] }), false);
  assert.equal(hasNaturalCommunitiesWidget({ widgets: [{ type: 'mathmachine' }] }), false);
});

// ─── periodictable - fourth standalone-app widget type ─────────────────────

test('a periodictable widget switches on window chrome, same as chronoline/naturalcommunities/mathmachine', () => {
  const result = buildBrowserWindowOptions({ widgets: [{ id: '1', type: 'periodictable', properties: {} }] });

  assert.equal(result.fullscreen, false);
  assert.equal(result.kiosk, false);
  assert.equal(result.frame, true);
  assert.equal(result.autoHideMenuBar, false);
  assert.equal(result.useContentSize, true);
});

test('hasPeriodicTableWidget does not fire for the other standalone-app types and vice versa', () => {
  assert.equal(hasPeriodicTableWidget({ widgets: [{ type: 'chronoline' }] }), false);
  assert.equal(hasPeriodicTableWidget({ widgets: [{ type: 'naturalcommunities' }] }), false);
  assert.equal(hasPeriodicTableWidget({ widgets: [{ type: 'mathmachine' }] }), false);
  assert.equal(hasMathMachineWidget({ widgets: [{ type: 'periodictable' }] }), false);
});

test('hasStandaloneAppWidget fires for any of the four types, and for none when absent', () => {
  assert.equal(hasStandaloneAppWidget({ widgets: [{ type: 'chronoline' }] }), true);
  assert.equal(hasStandaloneAppWidget({ widgets: [{ type: 'naturalcommunities' }] }), true);
  assert.equal(hasStandaloneAppWidget({ widgets: [{ type: 'mathmachine' }] }), true);
  assert.equal(hasStandaloneAppWidget({ widgets: [{ type: 'periodictable' }] }), true);
  assert.equal(hasStandaloneAppWidget({ widgets: [{ type: 'image' }] }), false);
  assert.equal(hasStandaloneAppWidget({}), false);
});

// ─── rusiq - fourth standalone-app widget type ─────────────────────────────

test('a rusiq widget switches on window chrome, same as the other standalone-app types', () => {
  const result = buildBrowserWindowOptions({ widgets: [{ id: '1', type: 'rusiq', properties: {} }] });

  assert.equal(result.fullscreen, false);
  assert.equal(result.kiosk, false);
  assert.equal(result.frame, true);
  assert.equal(result.autoHideMenuBar, false);
  assert.equal(result.useContentSize, true);
});

test('hasRusiqWidget does not fire for the other standalone-app types and vice versa', () => {
  assert.equal(hasRusiqWidget({ widgets: [{ type: 'chronoline' }] }), false);
  assert.equal(hasRusiqWidget({ widgets: [{ type: 'naturalcommunities' }] }), false);
  assert.equal(hasRusiqWidget({ widgets: [{ type: 'mathmachine' }] }), false);
  assert.equal(hasMathMachineWidget({ widgets: [{ type: 'rusiq' }] }), false);
});

test('hasStandaloneAppWidget fires for rusiq too', () => {
  assert.equal(hasStandaloneAppWidget({ widgets: [{ type: 'rusiq' }] }), true);
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

// ─── Тип 2, «Я знаю много слов» ─────────────────────────────────────────────
// Третий standalone-тип. Регрессионная гарантия та же: проект без него не
// должен заметить его появления вообще.

test('words widget -> windowed mode, same shape as the other standalone types', () => {
  const withWords = buildBrowserWindowOptions({ widgets: [{ type: 'words' }] });
  assert.equal(withWords.kiosk, false);
  assert.equal(withWords.fullscreen, false);
  assert.equal(withWords.frame, true);
  assert.equal(withWords.resizable, true);
  assert.equal(withWords.useContentSize, true);
  assert.deepEqual(withWords, buildBrowserWindowOptions({ widgets: [{ type: 'chronoline' }] }));
});

test('hasWordsWidget does not confuse the type with the other two', () => {
  assert.equal(hasWordsWidget({ widgets: [{ type: 'words' }] }), true);
  assert.equal(hasWordsWidget({ widgets: [{ type: 'chronoline' }] }), false);
  assert.equal(hasWordsWidget({ widgets: [{ type: 'naturalcommunities' }] }), false);
  assert.equal(hasChronolineWidget({ widgets: [{ type: 'words' }] }), false);
  assert.equal(hasNaturalCommunitiesWidget({ widgets: [{ type: 'words' }] }), false);
});

test('hasStandaloneAppWidget now fires for words too', () => {
  assert.equal(hasStandaloneAppWidget({ widgets: [{ type: 'words' }] }), true);
});

test('a project mixing ordinary widgets with words still goes windowed', () => {
  const mixed = buildBrowserWindowOptions({
    widgets: [{ type: 'image' }, { type: 'navigation' }, { type: 'words' }],
  });
  assert.equal(mixed.kiosk, false);
});

test('adding the words type did not change anything for projects without it', () => {
  // Побайтовая гарантия для всех существующих клиентов - музеи, навигация
  assert.deepEqual(buildBrowserWindowOptions({ widgets: [{ type: 'image' }] }), BASE_WINDOW_OPTIONS);
  assert.deepEqual(buildBrowserWindowOptions({ widgets: [{ type: 'wordsy' }] }), BASE_WINDOW_OPTIONS);
  assert.deepEqual(buildBrowserWindowOptions({ widgets: [{ type: 'WORDS' }] }), BASE_WINDOW_OPTIONS);
});
