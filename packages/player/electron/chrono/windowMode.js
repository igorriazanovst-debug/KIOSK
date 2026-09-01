// packages/player/electron/chrono/windowMode.js
// Решает опции BrowserWindow ДО его создания, на основе того же
// project.json, который плеер и так читает при старте (loadEmbeddedProject
// в main.js). Никаких изменений в builds.js не требуется - в отличие от
// изначального варианта плана (флаг из отдельного build-config файла), это
// не трогает пайплайн сборки вообще и не создаёт новую поверхность для
// гонки параллельных сборок (STATUS.md, известный баг №1).
//
// buildBrowserWindowOptions - чистая функция с одним критичным свойством,
// проверенным тестами буквально: для любого проекта БЕЗ виджета
// "chronoline" результат должен быть побайтово равен BASE_WINDOW_OPTIONS —
// тому, что все существующие клиенты (музеи, навигация) получают сегодня.

const CHRONOLINE_WIDGET_TYPE = 'chronoline';

const BASE_WINDOW_OPTIONS = Object.freeze({
  width: 1280,
  height: 800,
  fullscreen: true,
  kiosk: true,
  frame: false,
  autoHideMenuBar: true,
  alwaysOnTop: true,
  backgroundColor: '#000000',
});

/**
 * @param {unknown} projectData
 * @returns {boolean}
 */
function hasChronolineWidget(projectData) {
  return (
    !!projectData &&
    typeof projectData === 'object' &&
    Array.isArray(projectData.widgets) &&
    projectData.widgets.some(
      (widget) => widget && typeof widget === 'object' && widget.type === CHRONOLINE_WIDGET_TYPE
    )
  );
}

/**
 * @param {unknown} projectData - распарсенный project.json (или null/undefined,
 *   если файл не найден/битый — на этот момент того же самого случая, который
 *   loadEmbeddedProject() уже обрабатывает отдельно)
 * @returns {Record<string, unknown>} опции для `new BrowserWindow(...)`,
 *   без webPreferences (собирается отдельно в main.js — там нужен __dirname)
 */
function buildBrowserWindowOptions(projectData) {
  if (!hasChronolineWidget(projectData)) {
    return { ...BASE_WINDOW_OPTIONS };
  }

  return {
    ...BASE_WINDOW_OPTIONS,
    fullscreen: false,
    kiosk: false,
    frame: true,
    autoHideMenuBar: false,
    alwaysOnTop: false,
    resizable: true,
    minimizable: true,
    maximizable: true,
  };
}

module.exports = { buildBrowserWindowOptions, hasChronolineWidget, BASE_WINDOW_OPTIONS, CHRONOLINE_WIDGET_TYPE };
