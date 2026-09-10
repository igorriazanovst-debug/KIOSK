// packages/shared/src/periodictable/widgetProperties.ts
// Описание типа виджета "periodictable" — формат поля widget.properties.
// Единственный источник (editor-web И player подключают отсюда), тот же
// принцип, что у mathmachine/rusiq/widgetProperties.ts. Как и mathmachine/
// rusiq, у этого виджета НЕТ встроенного сервера и НЕТ IPC-хранилища —
// единственное настраиваемое свойство (teacherPin) живёт в самом проекте,
// не на диске устройства (спека, разд. 5/9,
// docs/superpowers/specs/2026-09-10-periodictable-widget-design.md).

export const PERIODICTABLE_WIDGET_TYPE = 'periodictable' as const;

export interface PeriodicTableWidgetProperties {
  /** Заголовок виджета (опционально) */
  title?: string;
  /** 4-значный PIN для разблокировки вкладки «Настройки вида» учителем */
  teacherPin?: string;
}

export const PERIODICTABLE_PROPS_VERSION = '1.0';

export const PERIODICTABLE_DEFAULT_PROPS: PeriodicTableWidgetProperties = {
  title: 'Таблица Менделеева',
  teacherPin: '0000',
};

export const PERIODICTABLE_DEFAULT_SIZE = {
  width: 1024,
  height: 768,
};
