// packages/shared/src/chrono/index.ts
// Публичная точка входа домена «хронология» — до этого коммита ни один
// внешний пакет (editor-web, player) физически не мог импортировать
// ничего отсюда через @kiosk/shared: не было ни этого барреля, ни
// реэкспорта из корневого src/index.ts (см. тот файл).

export * from './precision';
export * from './chronoMoment';
export * from './axis';
export * from './chronoInterval';
export * from './chronoDuration';
export * from './calendar/jdn';
export * from './calendar/civilDay';
export * from './format/formatRu';
export * from './parse';
export * from './model/schema';
export * from './model/project';
export * from './scale/ticks';
export * from './scale/projection';
