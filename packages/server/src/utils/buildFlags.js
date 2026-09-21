// Определяет флаги сборки плеера по составу проекта.
//
// windowMode: true только когда проект содержит виджет типа "chronoline"
// (виджет "Хронолиния") — единственный случай, когда собранный плеер должен
// получить рамку окна (сворачивание/разворачивание/полноэкранный режим)
// вместо обычного закреплённого fullscreen kiosk-режима. Для всех остальных
// клиентов (музейные киоски, навигация и т.д.) флаг обязан оставаться false —
// это специфика только сборок с этим виджетом, см.
// Хронолайнер_план_реализации.md, раздел 8.
const CHRONOLINE_WIDGET_TYPE = 'chronoline';

/**
 * @param {{ widgets?: unknown }} projectData - JSON проекта (Project.projectData)
 * @returns {boolean}
 */
export function detectWindowMode(projectData) {
  if (!projectData || !Array.isArray(projectData.widgets)) {
    return false;
  }

  return projectData.widgets.some(
    (widget) => widget && typeof widget === 'object' && widget.type === CHRONOLINE_WIDGET_TYPE
  );
}

/**
 * perAppDeviceId: сборка получает собственный идентификатор устройства (а не
 * общий на компьютер) — нужно, когда у каждого приложения своя лицензия со
 * своим лимитом мест. Включается только явным запросом админа при сборке.
 * @param {unknown} value - значение поля из тела запроса (JSON или multipart)
 * @returns {boolean}
 */
export function isPerAppDeviceIdRequested(value) {
  return value === true || value === 'true';
}

/**
 * Единственное место, где флаг perAppDeviceId попадает в project.json сборки.
 * Значение определяется ТОЛЬКО запросом админа: то, что лежит в данных проекта
 * (их пишет клиент), отбрасывается — иначе клиент включил бы режим сам и занял
 * бы больше мест лицензии, чем ему выдано.
 * @param {unknown} projectData
 * @param {boolean} requested
 * @returns {unknown} копия проекта; входной объект не меняется
 */
export function applyPerAppDeviceId(projectData, requested) {
  if (!projectData || typeof projectData !== 'object') return projectData;
  const { perAppDeviceId: _stored, ...rest } = projectData;
  return requested === true ? { ...rest, perAppDeviceId: true } : rest;
}
