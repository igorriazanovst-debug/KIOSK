// Описание типа виджета "physastroiq" (Тип 11, «ФизАстроIQ») — формат поля
// widget.properties. Единственный источник (editor-web И player подключают
// отсюда), тот же принцип, что у rusiq/widgetProperties.ts (Тип 7) — тот же
// класс виджета (квиз по координатам точек на изображении), см. план
// реализации `Тип11_ФизАстроIQ/ФизАстро_план_реализации.md`. Как и rusiq, у этого
// виджета НЕТ встроенного сервера — только локальное хранение.

export const PHYSASTROIQ_WIDGET_TYPE = 'physastroiq' as const;

export interface PhysastroiqWidgetProperties {
  /** Заголовок виджета (опционально) */
  title?: string;
}

export const PHYSASTROIQ_PROPS_VERSION = '1.0';

export const PHYSASTROIQ_DEFAULT_PROPS: PhysastroiqWidgetProperties = {
  title: 'ФизАстроIQ',
};

export const PHYSASTROIQ_DEFAULT_SIZE = {
  width: 1024,
  height: 768,
};
