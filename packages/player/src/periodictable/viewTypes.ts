// packages/player/src/periodictable/viewTypes.ts
// Единственный источник типов режима отображения (цветовая индикация/
// подсветка) — TableScreen.tsx (рендер), ViewSettingsTab.tsx (выбор),
// LegendTab.tsx (расшифровка, Задача 10) и viewSettingsStorage.ts
// (валидация при хранении, Задача 9) ссылаются СЮДА, а не заводят
// параллельные копии одного и того же набора строковых литералов.

import { z } from 'zod';

export const ColorIndicationSchema = z.enum(['none', 'class', 'electronType', 'oxideCharacter']);
export type ColorIndicationMode = z.infer<typeof ColorIndicationSchema>;

export const HighlightModeSchema = z.enum(['none', 'metal', 'nonmetal', 'metalloid', 's', 'p', 'd', 'f', 'acidic', 'basic', 'amphoteric']);
export type HighlightMode = z.infer<typeof HighlightModeSchema>;
