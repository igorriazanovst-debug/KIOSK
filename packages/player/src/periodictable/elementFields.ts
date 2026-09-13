// packages/player/src/periodictable/elementFields.ts
// Единый список всех 18 характеристик FR-005 — раньше жил только внутри
// ElementDetailCard.tsx; вынесен сюда, потому что "Сравнение элементов"
// показывает те же 18 полей для нескольких элементов сразу и не должен
// заводить вторую копию того же списка меток/форматирования (ELECTRON_
// TYPE_RU/OXIDE_CHARACTER_RU уже разошлись бы при правке одного места без
// другого — тот же принцип, что уже применён к colorPalette.ts/viewTypes.ts).

import type { PeriodicElement, OxideCharacter, ElectronType } from './model/schema.ts';

export const OXIDE_CHARACTER_RU: Record<OxideCharacter, string> = {
  acidic: 'кислотный',
  basic: 'основной',
  amphoteric: 'амфотерный',
  none: 'не выражен',
};

// Буква остаётся частью текста (стандартная химическая нотация), но со
// словом «элемент», а не в одиночку — легенда и настройки вида везде
// говорят «s-элементы», не голую букву.
export const ELECTRON_TYPE_RU: Record<ElectronType, string> = {
  s: 's-элемент',
  p: 'p-элемент',
  d: 'd-элемент',
  f: 'f-элемент',
};

export interface ElementField {
  key: string;
  label: string;
  getValue: (el: PeriodicElement) => string | number | null;
  wide?: boolean;
}

export const ELEMENT_FIELDS: ElementField[] = [
  { key: 'symbol', label: 'Символ элемента', getValue: (el) => el.symbol },
  { key: 'atomicNumber', label: 'Номер элемента', getValue: (el) => el.atomicNumber },
  { key: 'atomicMass', label: 'Относительная атомная масса', getValue: (el) => el.atomicMass },
  { key: 'nameRu', label: 'Название элемента на русском языке', getValue: (el) => el.nameRu },
  { key: 'nameLatin', label: 'Название элемента на латыни', getValue: (el) => el.nameLatin },
  { key: 'electronType', label: 'Электронный тип', getValue: (el) => ELECTRON_TYPE_RU[el.electronType] },
  { key: 'naturalOccurrence', label: 'Нахождение в природе', getValue: (el) => el.naturalOccurrence, wide: true },
  { key: 'physicalStateNormal', label: 'Агрегатное состояние при нормальных условиях', getValue: (el) => el.physicalStateNormal },
  { key: 'crystalLattice', label: 'Тип кристаллической решётки простого вещества', getValue: (el) => el.crystalLattice },
  { key: 'allotropes', label: 'Аллотропные модификации', getValue: (el) => el.allotropes },
  { key: 'stableIsotopes', label: 'Стабильные изотопы', getValue: (el) => el.stableIsotopes },
  {
    key: 'electrochemicalSeriesPosition',
    label: 'Положение в ряду электрохимического напряжения относительно водорода (для металлов)',
    getValue: (el) => el.electrochemicalSeriesPosition,
    wide: true,
  },
  { key: 'oxideCharacter', label: 'Характер свойств оксидов и гидроксидов', getValue: (el) => OXIDE_CHARACTER_RU[el.oxideCharacter] },
  { key: 'density', label: 'Плотность (г/см³)', getValue: (el) => el.density },
  { key: 'meltingPointK', label: 'Температура плавления (К)', getValue: (el) => el.meltingPointK },
  { key: 'boilingPointK', label: 'Температура кипения (К)', getValue: (el) => el.boilingPointK },
  {
    key: 'oxidationStates',
    label: 'Характерные степени окисления в неорганических соединениях',
    getValue: (el) => el.oxidationStates,
    wide: true,
  },
  { key: 'electronegativityPauling', label: 'Электроотрицательность по шкале Полинга', getValue: (el) => el.electronegativityPauling },
];

// Единая обработка «пусто»: и null/undefined (поле структурно необязательно
// — например electrochemicalSeriesPosition у неметаллов), и пустая строка
// (аллотропные модификации/стабильные изотопы у части элементов по факту
// химии, не по недосмотру) отображаются одним и тем же прочерком.
export function displayFieldValue(value: string | number | null): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}
