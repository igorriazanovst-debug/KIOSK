// packages/player/src/periodictable/tableLayout.ts
// Раскладка ячеек обеих форм таблицы (FR-004) из ОДНОГО набора данных
// (спека, разд. 7) — различается только раскладка ячеек, не контент.
//
// Упрощение, принятое сознательно (спека, разд. 7 — «решить при
// реализации»), ИСПРАВЛЕНО по факту находки Задачи 5: первая версия этого
// файла пыталась схлопнуть главную и побочную подгруппу в один физический
// столбец сетки (напр. группа 1 и группа 11 — в один столбец). Это ломается
// структурно, а не из-за данных: период 4 одновременно содержит элемент
// главной подгруппы (K, группа 1) И элемент побочной подгруппы (Cu, группа
// 11) — они физически не могут занимать одну ячейку сетки. То же самое верно
// для КАЖДОЙ из 8 колонок, не только «VIII» (Fe/Co/Ni/Kr). Классическая
// бумажная короткая форма решает это раздвоением строки периода на два
// под-ряда — сознательно вне рамок (см. упрощение выше). Правильное
// решение, не ломающее позиционирование: короткая и IUPAC формы используют
// ОДНУ И ТУ ЖЕ 18-колоночную сетку (col = groupIupac напрямую, без
// схлопывания) — коллизии невозможны по построению, та же гарантия, что уже
// работает для формы IUPAC. Разница между формами — ТОЛЬКО в подписи
// колонки (`formatGroupLabel`): короткая форма показывает аутентичную
// римскую цифру по Менделееву (группы 1 и 11 обе подписаны «I», просто в
// двух соседних физических столбцах, а не в одном схлопнутом) — то есть
// визуально узнаваемый стиль сохраняется, просто не пытается физически
// объединить колонки.

import type { PeriodicElement } from './model/schema.ts';

// Единственный источник значений формы таблицы — viewSettingsStorage.ts
// строит свою zod-схему из этого же массива вместо параллельного
// `z.enum(['short', 'iupac'])`, чтобы два файла не могли разойтись, если
// когда-нибудь появится третья форма.
export const TABLE_FORM_VALUES = ['short', 'iupac'] as const;
export type TableForm = (typeof TABLE_FORM_VALUES)[number];

export interface CellPosition {
  row: number; // 1-7 основная сетка; 9 = подвал лантаноидов; 10 = подвал актиноидов
  col: number; // 1-18 в основной сетке (ОБЕ формы — см. комментарий выше); 2-15 в строках подвала
}

// Групп IUPAC (1-18) → традиционная короткая римская ПОДПИСЬ (не физическая
// колонка — только для formatGroupLabel). Стандартное соответствие
// классической 8-группной формы: 1,11→I; 2,12→II; 3,13→III; 4,14→IV;
// 5,15→V; 6,16→VI; 7,17→VII; 8,9,10,18→VIII.
const IUPAC_TO_SHORT_LABEL_INDEX: Record<number, number> = {
  1: 1, 11: 1,
  2: 2, 12: 2,
  3: 3, 13: 3,
  4: 4, 14: 4,
  5: 5, 15: 5,
  6: 6, 16: 6,
  7: 7, 17: 7,
  8: 8, 9: 8, 10: 8, 18: 8,
};

const ROMAN_BY_SHORT_LABEL_INDEX = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

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
  // ВАЖНО: col = groupIupac для ОБЕИХ форм — короткая форма НЕ схлопывает
  // колонки (см. комментарий в шапке файла). `form` здесь намеренно не
  // используется для позиционирования, только formatGroupLabel ниже
  // зависит от form.
  return { row: el.period, col: el.groupIupac };
}

export function formatGroupLabel(groupIupac: number, form: TableForm): string {
  if (form === 'iupac') return String(groupIupac);
  return ROMAN_BY_SHORT_LABEL_INDEX[IUPAC_TO_SHORT_LABEL_INDEX[groupIupac]];
}
