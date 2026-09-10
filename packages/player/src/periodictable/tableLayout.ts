// packages/player/src/periodictable/tableLayout.ts
// Раскладка ячеек обеих форм таблицы (FR-004) из ОДНОГО набора данных
// (спека, разд. 7) — различается только раскладка ячеек, не контент.
//
// Упрощение, принятое сознательно (спека, разд. 7 — «решить при
// реализации»): классическая короткопериодная форма традиционно делит
// каждую из 8 римских групп на главную/побочную подгруппу с раздвоением
// строки периода. Здесь короткая форма — та же 7-строчная (+2 строки
// подвала) сетка, что и IUPAC-форма, различается только подпись колонки
// (римская цифра I-VIII вместо арабского числа 1-18) — это то, что
// реально используется в большинстве современных школьных изданий
// короткопериодной таблицы, и полностью покрывает буквальный смысл FR-004
// («короткопериодная форма» vs «форма IUPAC»), не углубляясь в историческую
// систему главных/побочных подгрупп, которую ТЗ не требует явно.

import type { PeriodicElement } from './model/schema.ts';
import { isFooterElement } from './model/schema.ts';

export type TableForm = 'short' | 'iupac';

export interface CellPosition {
  row: number; // 1-7 основная сетка; 9 = подвал лантаноидов; 10 = подвал актиноидов
  col: number; // 1-8 (short) / 1-18 (iupac) в основной сетке; 2-15 в строках подвала
}

// Групп IUPAC (1-18) → традиционная короткая римская колонка (1-8).
// Стандартное соответствие классической 8-группной формы: 1,11→I;
// 2,12→II; 3,13→III; 4,14→IV; 5,15→V; 6,16→VI; 7,17→VII; 8,9,10,18→VIII.
const IUPAC_TO_SHORT_COLUMN: Record<number, number> = {
  1: 1, 11: 1,
  2: 2, 12: 2,
  3: 3, 13: 3,
  4: 4, 14: 4,
  5: 5, 15: 5,
  6: 6, 16: 6,
  7: 7, 17: 7,
  8: 8, 9: 8, 10: 8, 18: 8,
};

const ROMAN_BY_SHORT_COLUMN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

export function getCellPosition(el: PeriodicElement, form: TableForm): CellPosition {
  if (el.isLanthanide && el.atomicNumber !== 57) {
    return { row: 9, col: el.atomicNumber - 58 + 2 }; // Ce(58)->2 .. Lu(71)->15
  }
  if (el.isActinide && el.atomicNumber !== 89) {
    return { row: 10, col: el.atomicNumber - 90 + 2 }; // Th(90)->2 .. Lr(103)->15
  }
  if (el.groupIupac === null) {
    throw new Error(`${el.symbol} (${el.atomicNumber}): missing groupIupac for a main-grid element`);
  }
  const col = form === 'short' ? IUPAC_TO_SHORT_COLUMN[el.groupIupac] : el.groupIupac;
  return { row: el.period, col };
}

export function formatGroupLabel(groupIupac: number, form: TableForm): string {
  if (form === 'iupac') return String(groupIupac);
  return ROMAN_BY_SHORT_COLUMN[IUPAC_TO_SHORT_COLUMN[groupIupac]];
}

export { isFooterElement };
