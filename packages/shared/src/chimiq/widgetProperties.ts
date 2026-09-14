// Описание типа виджета "chimiq" (Тип 9, «ХимIQ») — формат поля
// widget.properties. Единственный источник (editor-web И player подключают
// отсюда), тот же принцип, что у rusiq/widgetProperties.ts (Тип 7) — тот же
// класс виджета (квиз по координатам точек на изображении), см. план
// реализации `Тип9_ХимIQ/Тип9_план_реализации.md`. Как и rusiq, у этого
// виджета НЕТ встроенного сервера — только локальное хранение.

export const CHIMIQ_WIDGET_TYPE = 'chimiq' as const;

export interface ChimiqWidgetProperties {
  /** Заголовок виджета (опционально) */
  title?: string;
}

export const CHIMIQ_PROPS_VERSION = '1.0';

export const CHIMIQ_DEFAULT_PROPS: ChimiqWidgetProperties = {
  title: 'ХимIQ',
};

export const CHIMIQ_DEFAULT_SIZE = {
  width: 1024,
  height: 768,
};
