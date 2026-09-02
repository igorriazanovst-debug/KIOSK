// packages/player/src/chrono/eventTemplates.ts
// Галерея шаблонов СОБЫТИЙ для быстрого добавления (FR-025 ТЗ) - НЕ то же
// самое, что галерея шаблонов ПРОЕКТОВ из Фазы 7 (packages/chrono-templates/,
// editor-web): та даёт готовый ПРОЕКТ целиком для просмотра до установки,
// эта - готовый СТИЛЬ (вид карточки + цвет + необязательная подсказка в поле
// названия) для одного события, на устройстве, в момент добавления.
//
// Куратура 2026-09-02: набор расширен и переосмыслен по темам, характерным
// для исторической хронолинии (битва/договор/открытие и т.д.), вместо
// нейтральных механических подписей вида «Обычное»/«Важное». Это ПО-ПРЕЖНЕМУ
// только структурный пресет (вид/цвет/подсказка-плейсхолдер), НЕ готовое
// событие: `namePlaceholder` - это только `placeholder` инпута названия
// (как и у поля даты, см. AddEventForm.tsx), ничего не подставляет и не
// сохраняется, пока педагог сам не введёт название. Название/дата события
// всё равно вводит педагог - шаблон лишь избавляет от повторного выбора
// оформления и подсказывает, для какого рода события пресет предназначен.

import type { EventView } from '@kiosk/shared';

export interface EventTemplate {
  id: string;
  label: string;
  view: EventView;
  color?: string;
  fontColor?: string;
  namePlaceholder?: string;
}

export const EVENT_TEMPLATES: EventTemplate[] = [
  { id: 'default', label: 'Обычное', view: 'compact' },
  {
    id: 'founding',
    label: 'Основание / начало',
    view: 'flag',
    color: '#4caf7d',
    fontColor: '#0d2818',
    namePlaceholder: 'например: Основание города',
  },
  {
    id: 'battle',
    label: 'Битва / сражение',
    view: 'flag',
    color: '#b23a3a',
    fontColor: '#fff0f0',
    namePlaceholder: 'например: Битва при …',
  },
  {
    id: 'treaty',
    label: 'Договор / соглашение',
    view: 'card',
    color: '#3a6bb2',
    fontColor: '#eaf2ff',
    namePlaceholder: 'например: Подписание договора о …',
  },
  {
    id: 'biography',
    label: 'Рождение / утрата',
    view: 'compact',
    color: '#8a5fc2',
    fontColor: '#f5eeff',
    namePlaceholder: 'например: Рождение / смерть …',
  },
  {
    id: 'discovery',
    label: 'Открытие / изобретение',
    view: 'image',
    color: '#d9a441',
    fontColor: '#241a02',
    namePlaceholder: 'например: Изобретение …',
  },
  {
    id: 'holiday',
    label: 'Праздник / годовщина',
    view: 'flag',
    color: '#e08a3c',
    fontColor: '#241a02',
    namePlaceholder: 'например: День …',
  },
  {
    id: 'disaster',
    label: 'Катастрофа / трагедия',
    view: 'card',
    color: '#4a4a4a',
    fontColor: '#f2f2f2',
    namePlaceholder: 'например: Авария на …',
  },
  { id: 'illustrated', label: 'С картинкой', view: 'image' },
  { id: 'detailed', label: 'Подробная карточка', view: 'card' },
];
