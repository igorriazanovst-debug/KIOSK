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
