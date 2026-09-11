// packages/player/src/periodictable/colorPalette.ts
// Единственный источник цветов классификации (FR-006) — TableScreen.tsx
// (фон ячейки) и LegendTab.tsx (образцы легенды) ссылаются СЮДА, а не
// заводят параллельные копии одних и тех же hex-значений. Типы ключей —
// union-типы из схемы (`ElementClass`/`ElectronType`/`OxideCharacter`), не
// голый `Record<string, string>`: это даёт проверку полноты на этапе
// компиляции — добавление нового значения в схему без соответствующего
// цвета не пройдёт tsc, а не тихо отрисуется белым.

import type { ElementClass, ElectronType, OxideCharacter } from './model/schema.ts';

export const CLASS_COLOR: Record<ElementClass, string> = {
  metal: '#e3f2fd',
  metalloid: '#fff3e0',
  nonmetal: '#e8f5e9',
};

export const ELECTRON_TYPE_COLOR: Record<ElectronType, string> = {
  s: '#ffebee',
  p: '#e8f5e9',
  d: '#e3f2fd',
  f: '#f3e5f5',
};

export const OXIDE_COLOR: Record<OxideCharacter, string> = {
  acidic: '#ffebee',
  basic: '#e3f2fd',
  amphoteric: '#fff3e0',
  none: '#f5f5f5',
};
