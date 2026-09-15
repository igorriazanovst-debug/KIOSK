// Описание типа виджета "bioiq" (Тип 10, «БиоIQ») — формат поля
// widget.properties. Единственный источник (editor-web И player подключают
// отсюда), тот же принцип, что у rusiq/widgetProperties.ts (Тип 7) — тот же
// класс виджета (квиз по координатам точек на изображении), см. план
// реализации `Тип10_БиоIQ/Био_план_реализации.md`. Как и rusiq, у этого
// виджета НЕТ встроенного сервера — только локальное хранение.

export const BIOIQ_WIDGET_TYPE = 'bioiq' as const;

export interface BioiqWidgetProperties {
  /** Заголовок виджета (опционально) */
  title?: string;
}

export const BIOIQ_PROPS_VERSION = '1.0';

export const BIOIQ_DEFAULT_PROPS: BioiqWidgetProperties = {
  title: 'БиоIQ',
};

export const BIOIQ_DEFAULT_SIZE = {
  width: 1024,
  height: 768,
};
