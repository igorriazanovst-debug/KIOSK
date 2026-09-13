// packages/shared/src/alphabet/index.ts
// Точка сборки домена «АзбукоСлов» (Тип 3).
//
// НАРУЖУ ЭТОТ МОДУЛЬ ВЫХОДИТ ПРОСТРАНСТВОМ ИМЁН, а не плоским реэкспортом,
// как остальные виджеты: `export * as alphabet from './alphabet'` в src/index.ts.
//
// Причина не в стиле. У виджетов «АзбукоСлов» и «Я знаю много слов» родственные
// задачи и, как следствие, четырнадцать одинаковых имён: wordImagePath,
// checkLibraryCompleteness, expectedLibraryFiles, estimateContentSize, answer,
// currentPlayerId, Rng, PlayerTally, FileNameSchema и другие. При `export *`
// столкнувшиеся имена в ES-модулях НЕ вызывают ошибку — они молча исчезают из
// пакета, и обнаружится это уже у вызывающего кода как «нет такого экспорта».
// Пространство имён снимает вопрос целиком и заодно читается: видно, из
// какого виджета функция.

export * from './model/schema';
export * from './model/graph';
export * from './model/resources';
export * from './game/random';
export * from './game/letterShow';
export * from './game/wordCompleting';
export * from './game/wordMake';
export * from './game/session';
export * from './game/statistics';
