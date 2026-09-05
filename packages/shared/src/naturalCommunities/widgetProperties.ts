// packages/shared/src/naturalCommunities/widgetProperties.ts
// Описание типа виджета "naturalcommunities" — формат поля widget.properties.
// Единственный источник (editor-web И player подключают отсюда), тот же принцип, что
// у chrono/widgetProperties.ts.
//
// Как и у "chronoline", реальный контент (библиотека объектов, презентации) НЕ хранится
// в этом проекте на сервере — здесь только внешний вид/поведение виджета. В отличие от
// chronoline, у этого виджета есть собственный встроенный сервер (Express + socket.io),
// который педагогический ПК поднимает локально, чтобы браузеры других устройств школьной
// сети могли подключиться — см. Тип5_план_реализации.md, раздел 1.

/** Идентификатор типа виджета */
export const NATCOM_WIDGET_TYPE = 'naturalcommunities' as const;

/** Что лежит в widget.properties у виджета «Конструктор природных сообществ» */
export interface NatComWidgetProperties {
  /** Заголовок виджета (опционально, показывается в заглушке и на устройстве) */
  title?: string;
  /** Порт встроенного локального сервера (Express + socket.io), слушающего на 0.0.0.0 */
  serverPort: number;
  /** Максимум одновременных подключённых клиентов (ТЗ FR-011, строка 110 оригинала) */
  maxClients: number;
}

/** Версия формата свойств виджета (для будущих миграций) */
export const NATCOM_PROPS_VERSION = '1.0';

/** Дефолтные свойства нового виджета «Конструктор природных сообществ» */
export const NATCOM_DEFAULT_PROPS: NatComWidgetProperties = {
  title: '',
  serverPort: 33000,
  maxClients: 31,
};

/** Дефолтные размеры на канвасе при добавлении виджета */
export const NATCOM_DEFAULT_SIZE = {
  width: 1280,
  height: 800,
};
