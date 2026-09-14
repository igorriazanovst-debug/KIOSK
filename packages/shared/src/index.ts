// packages/shared/src/index.ts

// Types
export * from './types';

// Constants
export * from './constants/plans';
export * from './constants/features';

// Utils
export * from './utils/validation';
// Рассадка вокруг интерактивного стола — общая на Типы 2, 3 и 4
export * from './utils/seats';

// Chrono («Хронолиния»)
export * from './chrono/precision';
export * from './chrono/chronoMoment';
export * from './chrono/axis';
export * from './chrono/chronoInterval';
export * from './chrono/chronoDuration';
export * from './chrono/shiftMoment';
export * from './chrono/calendar/jdn';
export * from './chrono/calendar/civilDay';
export * from './chrono/format/formatRu';
export * from './chrono/parse';
export * from './chrono/model/schema';
export * from './chrono/model/project';
export * from './chrono/model/mutations';
export * from './chrono/scale/ticks';
export * from './chrono/scale/projection';
export * from './chrono/widgetProperties';
export * from './chrono/media';

// Natural Communities («Конструктор природных сообществ»)
export * from './naturalCommunities/widgetProperties';
export * from './naturalCommunities/model/schema';
export * from './naturalCommunities/model/project';
export * from './naturalCommunities/model/geometry';
export * from './naturalCommunities/roles';

// Матемашка (Тип 6)
export * from './mathmachine/model/schema';
export * from './mathmachine/widgetProperties';
export * from './mathmachine/taskEngine';
export * from './mathmachine/catalog';

// Таблица Менделеева (Тип 8)
export * from './periodictable/widgetProperties';

// РусIQ (Тип 7)
export * from './rusiq/widgetProperties';

// ХимIQ (Тип 9)
export * from './chimiq/widgetProperties';

// Words («Я знаю много слов», Тип 2)
export * from './words/widgetProperties';
export * from './words/model/schema';
export * from './words/model/resources';
export * from './words/game/session';
export * from './words/game/achievements';
export * from './words/game/stats';
export * from './words/store/rules';
export * from './words/store/contentRules';
export * from './words/store/teacherGate';

// АзбукоСлов (Тип 3)
// widgetProperties — плоско: девять точек регистрации виджета в редакторе и
// плеере импортируют из '@kiosk/shared' напрямую, и делать одну из них
// непохожей на остальные незачем; имена там уникальны по пакету
export * from './alphabet/widgetProperties';
// Домен — пространством имён, см. src/alphabet/index.ts:
// у него четырнадцать имён, общих с виджетом «слов», и плоский реэкспорт
// молча выбросил бы столкнувшиеся
export * as alphabet from './alphabet';

// Инофон (Тип 4)
// widgetProperties — плоско, как у остальных виджетов: девять точек
// регистрации импортируют из '@kiosk/shared' напрямую
export * from './inophone/widgetProperties';
// Домен — пространством имён, см. src/inophone/index.ts: имена Scene, Theme,
// Translation, answer, MAX_PLAYERS совпадают с чужими, и плоский реэкспорт
// молча выбросил бы столкнувшиеся
export * as inophone from './inophone';
