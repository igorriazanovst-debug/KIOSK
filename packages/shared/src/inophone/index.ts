// packages/shared/src/inophone/index.ts
// Точка сборки домена «Инофон» (Тип 4).
//
// НАРУЖУ ВЫХОДИТ ПРОСТРАНСТВОМ ИМЁН — `export * as inophone from './inophone'`,
// как у «АзбукоСлов», и по той же причине. Имена `Scene`, `Theme`,
// `Translation`, `answer`, `currentPlayerId`, `MAX_PLAYERS`, `PlayerTally`
// совпадают с именами других виджетов. При `export *` столкнувшиеся имена в
// ES-модулях НЕ дают ошибки — они молча исчезают из пакета, и обнаруживается
// это уже у вызывающего кода как «нет такого экспорта».

export * from './model/languages';
export * from './model/schema';
export * from './model/resources';
export * from './model/geometry';
export * from './model/statistics';
export * from './game/session';
export * from './game/presentation';
