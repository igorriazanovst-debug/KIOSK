// packages/player/src/periodictable/colorPalette.ts
// Единственный источник цветов классификации (FR-006) — TableScreen.tsx
// (фон ячейки) и LegendTab.tsx (образцы легенды) ссылаются СЮДА, а не
// заводят параллельные копии одних и тех же hex-значений. Типы ключей —
// union-типы из схемы (`ElementClass`/`ElectronType`/`OxideCharacter`), не
// голый `Record<string, string>`: это даёт проверку полноты на этапе
// компиляции — добавление нового значения в схему без соответствующего
// цвета не пройдёт tsc, а не тихо отрисуется белым.

import type { ElementClass, ElectronType, OxideCharacter } from './model/schema.ts';

// Насыщенная мультицветная гамма (выбрана пользователем при доработке
// дизайна 2026-09-11 — максимальный контраст между категориями, вместо
// прежних едва различимых бледно-пастельных тонов уровня Material 50).
// Уровень Material 300: достаточно ярко, чтобы категории читались с
// одного взгляда на сенсорном киоске, и достаточно светло, чтобы тёмный
// текст плиток (см. TableScreen.tsx) оставался контрастным без отдельной
// карты цветов текста на каждую категорию.
export const CLASS_COLOR: Record<ElementClass, string> = {
  metal: '#64b5f6',
  metalloid: '#ffb74d',
  nonmetal: '#81c784',
};

export const ELECTRON_TYPE_COLOR: Record<ElectronType, string> = {
  s: '#e57373',
  p: '#81c784',
  d: '#64b5f6',
  f: '#ba68c8',
};

export const OXIDE_COLOR: Record<OxideCharacter, string> = {
  acidic: '#e57373',
  basic: '#64b5f6',
  amphoteric: '#ffb74d',
  none: '#e0e0e0',
};
