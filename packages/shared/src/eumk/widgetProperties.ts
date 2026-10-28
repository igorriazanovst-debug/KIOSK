// Описание типа виджета "eumk" («Инфосреда: ЭУМК») - формат поля
// widget.properties. Один движок обслуживает оба электронных учебно-
// методических комплекса (начальные классы, дошкольное образование):
// различается только содержимое `content`. Формат содержимого проверяет
// zod-схема в packages/player/src/eumk/model/schema.ts, здесь оно
// типизировано свободно, потому что shared не зависит от плеера.

export const EUMK_WIDGET_TYPE = 'eumk' as const;

export interface EumkWidgetProperties {
  /** Заголовок виджета (опционально) */
  title?: string;
  /** Содержимое комплекса: теория, банк вопросов, задания, игры, кейсы, справочники */
  content?: unknown;
}

export const EUMK_PROPS_VERSION = '1.0';

export const EUMK_DEFAULT_PROPS: EumkWidgetProperties = {
  title: 'ЭУМК',
};

export const EUMK_DEFAULT_SIZE = {
  width: 1024,
  height: 768,
};
