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
// "chronoline"/"naturalcommunities" результат должен быть побайтово равен
// BASE_WINDOW_OPTIONS - тому, что все существующие клиенты (музеи,
// навигация) получают сегодня.
//
// "naturalcommunities" (Тип 5, Тип5_план_реализации.md) - второй widget-тип
// того же "standalone-приложение, не встроенный в канвас widget" рода, что
// и "chronoline" (см. этот же файл, история решений Хронолинии): своя
// оконная рамка, свой тулбар, не kiosk fullscreen. Оконный режим обобщён на
// оба типа единым списком STANDALONE_APP_WIDGET_TYPES, а не дублированием
// всей функции buildBrowserWindowOptions под второй тип.

const CHRONOLINE_WIDGET_TYPE = 'chronoline';
const NATCOM_WIDGET_TYPE = 'naturalcommunities';
const STANDALONE_APP_WIDGET_TYPES = [CHRONOLINE_WIDGET_TYPE, NATCOM_WIDGET_TYPE];

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
 * @param {string} widgetType
 * @returns {boolean}
 */
function hasWidgetOfType(projectData, widgetType) {
  return (
    !!projectData &&
    typeof projectData === 'object' &&
    Array.isArray(projectData.widgets) &&
    projectData.widgets.some(
      (widget) => widget && typeof widget === 'object' && widget.type === widgetType
    )
  );
}

/**
 * @param {unknown} projectData
 * @returns {boolean}
 */
function hasChronolineWidget(projectData) {
  return hasWidgetOfType(projectData, CHRONOLINE_WIDGET_TYPE);
}

/**
 * @param {unknown} projectData
 * @returns {boolean}
 */
function hasNaturalCommunitiesWidget(projectData) {
  return hasWidgetOfType(projectData, NATCOM_WIDGET_TYPE);
}

/**
 * Любой widget-тип "отдельного standalone-приложения" (не позиционируемый
 * widget на канвасе) - на сегодня chronoline и naturalcommunities.
 * @param {unknown} projectData
 * @returns {boolean}
 */
function hasStandaloneAppWidget(projectData) {
  return STANDALONE_APP_WIDGET_TYPES.some((type) => hasWidgetOfType(projectData, type));
}

/**
 * @param {unknown} projectData - распарсенный project.json (или null/undefined,
 *   если файл не найден/битый — на этот момент того же самого случая, который
 *   loadEmbeddedProject() уже обрабатывает отдельно)
 * @returns {Record<string, unknown>} опции для `new BrowserWindow(...)`,
 *   без webPreferences (собирается отдельно в main.js — там нужен __dirname)
 */
function buildBrowserWindowOptions(projectData) {
  if (!hasStandaloneAppWidget(projectData)) {
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
    // Найдено вживую при реальном запуске в Electron (Хронолиния): без этого
    // флага width/height (BASE_WINDOW_OPTIONS) задают размер ОКНА С РАМКОЙ, а
    // не содержимого - на Windows resizable-рамка съедает несколько px с
    // каждой стороны. useContentSize делает width/height размером ИМЕННО
    // содержимого - тот же принцип нужен и для naturalcommunities.
    useContentSize: true,
  };
}

module.exports = {
  buildBrowserWindowOptions,
  hasChronolineWidget,
  hasNaturalCommunitiesWidget,
  hasStandaloneAppWidget,
  BASE_WINDOW_OPTIONS,
  CHRONOLINE_WIDGET_TYPE,
  NATCOM_WIDGET_TYPE,
};
