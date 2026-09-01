// packages/player/src/chrono/history.ts
// Обычный генерик-стек undo/redo (past/present/future), не привязан к
// ChronoProject нарочно - локальное редактирование деструктивно (удалить
// линию, случайно перетащить событие), а отдельного диалога "точно?" нет
// почти нигде, кроме удаления. Ограничение глубины истории - чтобы сессия
// редактирования в течение дня не копила неограниченно снимки всего
// проекта в памяти.

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

export const MAX_HISTORY_SIZE = 50;

export function initHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

/** Новое состояние применено пользователем - future обнуляется (стандартная семантика undo/redo) */
export function pushHistory<T>(history: History<T>, next: T): History<T> {
  const past = [...history.past, history.present];
  return {
    past: past.length > MAX_HISTORY_SIZE ? past.slice(past.length - MAX_HISTORY_SIZE) : past,
    present: next,
    future: [],
  };
}

export function undo<T>(history: History<T>): History<T> {
  if (history.past.length === 0) return history;
  const previous = history.past[history.past.length - 1];
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redo<T>(history: History<T>): History<T> {
  if (history.future.length === 0) return history;
  const [next, ...rest] = history.future;
  return {
    past: [...history.past, history.present],
    present: next,
    future: rest,
  };
}

export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0;
}

export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0;
}
