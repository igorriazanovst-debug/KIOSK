// packages/shared/src/chrono/widgetProperties.ts
// Описание типа виджета "chronoline" — формат поля widget.properties.
// Единственный источник (editor-web И player подключают отсюда) — то самое
// правило ревью Фазы 2 «нет copy-paste между пакетами», введённое именно
// чтобы не повторить прецедент NavigationWidgetProperties (дублировался
// между editor-web и player по отдельности).
//
// В отличие от остальных виджетов, у "chronoline" реальный авторский контент
// (хронолинии, события, медиа) живёт ЛОКАЛЬНО на устройстве после установки —
// не в этом проекте на сервере (см. Хронолайнер_vs_KIOSK_анализ.md, раздел 8).
// В editor-web настраивается только внешний вид/поведение виджета.

/** Идентификатор типа виджета */
export const CHRONOLINE_WIDGET_TYPE = 'chronoline' as const;

/** Что лежит в widget.properties у виджета «Хронолиния» */
export interface ChronolineWidgetProperties {
  /** Заголовок виджета (опционально, показывается в заглушке и на устройстве) */
  title?: string;
  /** Разрешено ли локальное редактирование на устройстве (иначе — только просмотр seed-контента) */
  localEditingEnabled: boolean;
  /** Тема оформления доски */
  theme: 'light' | 'dark';
}

/** Версия формата свойств виджета (для будущих миграций) */
export const CHRONOLINE_PROPS_VERSION = '1.0';

/** Дефолтные свойства нового виджета «Хронолиния» */
export const CHRONOLINE_DEFAULT_PROPS: ChronolineWidgetProperties = {
  title: '',
  localEditingEnabled: true,
  theme: 'light',
};

/** Дефолтные размеры на канвасе при добавлении виджета */
export const CHRONOLINE_DEFAULT_SIZE = {
  width: 1200,
  height: 700,
};
