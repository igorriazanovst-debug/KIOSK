// packages/shared/src/index.ts

// Types
export * from './types';

// Constants
export * from './constants/plans';
export * from './constants/features';

// Utils
export * from './utils/validation';

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
