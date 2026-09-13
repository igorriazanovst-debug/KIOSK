// packages/player/src/periodictable/viewTypes.ts
// Единственный источник типов режима отображения (цветовая индикация/
// подсветка) — TableScreen.tsx (рендер), ViewSettingsTab.tsx (выбор),
// LegendTab.tsx (расшифровка, Задача 10) и viewSettingsStorage.ts
// (валидация при хранении, Задача 9) ссылаются СЮДА, а не заводят
// параллельные копии одного и того же набора строковых литералов.

import { z } from 'zod';

export const ColorIndicationSchema = z.enum(['none', 'class', 'electronType', 'oxideCharacter', 'trend']);
export type ColorIndicationMode = z.infer<typeof ColorIndicationSchema>;

// Какое числовое свойство красит таблицу градиентом в режиме 'trend' —
// отдельное поле, а не 5 разных значений ColorIndicationSchema
// ('trendDensity', 'trendMass', ...), потому что все пять рендерятся
// ОДНИМ и тем же кодом (только диапазон и подпись разные) — 5 отдельных
// enum-значений размножили бы одинаковую логику на TableScreen/LegendTab
// без всякой пользы.
export const TrendPropertySchema = z.enum(['atomicMass', 'density', 'meltingPointK', 'boilingPointK', 'electronegativityPauling']);
export type TrendProperty = z.infer<typeof TrendPropertySchema>;

export const HighlightModeSchema = z.enum(['none', 'metal', 'nonmetal', 'metalloid', 's', 'p', 'd', 'f', 'acidic', 'basic', 'amphoteric']);
export type HighlightMode = z.infer<typeof HighlightModeSchema>;
