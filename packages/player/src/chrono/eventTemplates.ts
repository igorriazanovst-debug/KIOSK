// packages/player/src/chrono/eventTemplates.ts
// Галерея шаблонов СОБЫТИЙ для быстрого добавления (FR-025 ТЗ) - НЕ то же
// самое, что галерея шаблонов ПРОЕКТОВ из Фазы 7 (packages/chrono-templates/,
// editor-web): та даёт готовый ПРОЕКТ целиком для просмотра до установки,
// эта - готовый СТИЛЬ (вид карточки + цвет) для одного события, на устройстве,
// в момент добавления, чтобы не настраивать оформление каждый раз заново.
//
// Только СТРУКТУРНЫЕ пресеты (вид/цвет), НЕ готовый исторический контент -
// куратура реального содержания (какие события, какие темы) осознанно вне
// рамок этого прохода (план, «Что явно НЕ входит в MVP»: «Наполнение
// галереи контентом — нетехническая задача»), тот же принцип, что и у
// демо-шаблона проекта в Фазе 7. Название/дата события всё равно вводит
// педагог - шаблон лишь избавляет от повторного выбора вида/цвета.

import type { EventView } from '@kiosk/shared';

export interface EventTemplate {
  id: string;
  label: string;
  view: EventView;
  color?: string;
  fontColor?: string;
}

export const EVENT_TEMPLATES: EventTemplate[] = [
  { id: 'default', label: 'Обычное', view: 'compact' },
  { id: 'highlight', label: 'Важное', view: 'flag', color: '#e2a64a', fontColor: '#1a1a1a' },
  { id: 'illustrated', label: 'С картинкой', view: 'image' },
  { id: 'detailed', label: 'Подробная карточка', view: 'card' },
];
