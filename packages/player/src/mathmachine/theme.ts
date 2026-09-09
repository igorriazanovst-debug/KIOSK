// Визуальная идентичность «Матемашки» — согласована 2026-09-08, см.
// Тип6_визуальная_идентичность.md (вне git). Токены цвета/шрифта/радиуса,
// общие для всех экранов виджета (CatalogScreen/TaskRunner/AnswerInput/
// TaskVisual/LabScreen/MathMachineRuntime), чтобы палитра не разъезжалась
// между файлами.
//
// Шрифты 'Nunito' и 'Pacifico' уже подключены глобально через fonts.css
// (используются палитрой шаблонов Хронолайнера/браузер-меню) — новых
// зависимостей не требуется.

import type React from 'react';

export const COLOR = {
  amber: '#F2A93B',
  amberDark: '#D9931F',
  amberLight: '#FCEBD1',
  indigo: '#3B5BDB',
  indigoDark: '#2A46B0',
  indigoLight: '#E4E9FB',
  mint: '#5BC9A6',
  mintDark: '#3FA486',
  mintLight: '#E3F7F0',
  cream: '#FAF3E6',
  surface: '#FFFEFB',
  text: '#3A332B',
  textMuted: '#8A7F6E',
  border: '#E4D9C5',
} as const;

export const FONT = {
  ui: "'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  display: "'Pacifico', cursive",
} as const;

export const RADIUS = { sm: 8, md: 14, lg: 22 } as const;

export const SHADOW = {
  soft: '0 2px 8px rgba(58, 51, 43, 0.10)',
  card: '0 4px 14px rgba(58, 51, 43, 0.12)',
} as const;

// Фон «в клетку» — тёплая тетрадная нейтральность (см. документ
// визидентичности, «фон — клетчатая тетрадь», без копирования конкретного
// оттенка оригинала). Тонкая сетка индиго поверх кремового фона.
export const NOTEBOOK_GRID_BACKGROUND: React.CSSProperties = {
  backgroundColor: COLOR.cream,
  backgroundImage:
    `linear-gradient(${COLOR.border} 1px, transparent 1px), linear-gradient(90deg, ${COLOR.border} 1px, transparent 1px)`,
  backgroundSize: '28px 28px',
};
