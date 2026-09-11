// Описание типа виджета "rusiq" — формат поля widget.properties. Единственный
// источник (editor-web И player подключают отсюда), тот же принцип, что у
// chrono/naturalCommunities/mathmachine/widgetProperties.ts. Как и
// mathmachine, у этого виджета НЕТ встроенного сервера — только локальное
// хранение (спека, разд. 2/7 docs/superpowers/specs/2026-09-10-rusiq-widget-design.md).

export const RUSIQ_WIDGET_TYPE = 'rusiq' as const;

export interface RusiqWidgetProperties {
  /** Заголовок виджета (опционально) */
  title?: string;
}

export const RUSIQ_PROPS_VERSION = '1.0';

export const RUSIQ_DEFAULT_PROPS: RusiqWidgetProperties = {
  title: 'РусIQ',
};

export const RUSIQ_DEFAULT_SIZE = {
  width: 1024,
  height: 768,
};
