// Описание типа виджета "mathmachine" — формат поля widget.properties.
// Единственный источник (editor-web И player подключают отсюда), тот же
// принцип, что у chrono/naturalCommunities/widgetProperties.ts. В отличие от
// naturalcommunities, у этого виджета НЕТ встроенного сервера — только
// локальное хранение (спека, разд. 2).

export const MATHMACHINE_WIDGET_TYPE = 'mathmachine' as const;

export interface MathMachineWidgetProperties {
  /** Заголовок виджета (опционально) */
  title?: string;
}

export const MATHMACHINE_PROPS_VERSION = '1.0';

export const MATHMACHINE_DEFAULT_PROPS: MathMachineWidgetProperties = {
  title: 'Матемашка',
};

export const MATHMACHINE_DEFAULT_SIZE = {
  width: 1024,
  height: 768,
};
