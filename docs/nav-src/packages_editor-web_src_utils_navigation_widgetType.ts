// packages/editor-web/src/utils/navigation/widgetType.ts
// Описание типа виджета "navigation" — формат поля widget.properties

import type { NavigationData } from './types';

/** Идентификатор типа виджета */
export const NAVIGATION_WIDGET_TYPE = 'navigation' as const;

/**
 * Что лежит в widget.properties у виджета навигации.
 * Сами floors/transitions хранятся в navData, файлы SVG — через svgFileId внутри floor.
 */
export interface NavigationWidgetProperties {
  /** Данные навигации (этажи, помещения, переходы) */
  navData: NavigationData;
  /** ID активного этажа (для UI и для определения «Вы здесь») */
  activeFloorId: string | null;
  /** ID терминала «Вы здесь» — стартовый узел для маршрутов */
  currentTerminalId: string | null;
  /** Радиус слияния узлов графа (snap). Параметр редактора. */
  graphSnap: number;
  /** Цвет линии маршрута */
  routeColor: string;
  /** Толщина линии маршрута */
  routeWidth: number;
  /** Цвет пометки «Вы здесь» */
  youAreHereColor: string;
  /** Показывать список помещений в рантайме */
  showRoomList: boolean;
  /** Показывать строку поиска в рантайме */
  showSearch: boolean;
  /** Заголовок виджета (опционально) */
  title?: string;
}

/** Версия формата данных навигации */
export const NAV_DATA_VERSION = '1.0';

/** Дефолтные свойства нового виджета навигации */
export const NAVIGATION_DEFAULT_PROPS: NavigationWidgetProperties = {
  navData: {
    version: NAV_DATA_VERSION,
    floors: [],
    transitions: [],
    edgeCosts: { stairsPenalty: 50, elevatorPenalty: 100 },
  },
  activeFloorId: null,
  currentTerminalId: null,
  graphSnap: 300,
  routeColor: '#e74c3c',
  routeWidth: 6,
  youAreHereColor: '#2ecc71',
  showRoomList: true,
  showSearch: true,
  title: '',
};

/** Дефолтные размеры на канвасе при добавлении виджета */
export const NAVIGATION_DEFAULT_SIZE = {
  width: 1200,
  height: 800,
};
