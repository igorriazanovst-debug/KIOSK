// Группировка игр по блокам теории для экрана «Игры» (Д-1, K5-контент
// план §1.5). Логика - как у заданий в TasksScreen: блоки теории в учебном
// порядке, пустые пропускаются; игры без привязки к блоку («», либо id,
// которого нет в теории - схема контента такое отклоняет, здесь защита от
// потери) собираются в последнюю группу «Другое».
//
// Вынесено из компонента в чистый модуль: .tsx не импортируется тестами
// (strip-types не трансформирует JSX), а группировка - это логика.

export const OTHER_GAMES_TITLE = 'Другое';
const OTHER_GAMES_KEY = 'other';

export interface BlockRef {
  id: string;
  title: string;
}

export interface BlockAttributed {
  block: string;
}

export interface GameGroup<T> {
  key: string;
  title: string;
  games: T[];
}

export function groupGamesByBlock<T extends BlockAttributed>(blocks: readonly BlockRef[], games: readonly T[]): GameGroup<T>[] {
  const groups = blocks
    .map((b) => ({ key: b.id, title: b.title, games: games.filter((g) => g.block === b.id) }))
    .filter((g) => g.games.length > 0);
  const loose = games.filter((g) => !blocks.some((b) => b.id === g.block));
  return loose.length > 0 ? [...groups, { key: OTHER_GAMES_KEY, title: OTHER_GAMES_TITLE, games: loose }] : groups;
}
