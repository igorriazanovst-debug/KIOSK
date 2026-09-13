// packages/player/src/alphabet/ui.tsx
// Общие элементы интерфейса виджета «АзбукоСлов».
//
// Палитра взята со снимков эталона: голубое небо, тёмно-коричневая панель
// снизу, оранжевые буквы на белых кругах. Это не подражание ради подражания —
// цвета там выбраны под ребёнка-дошкольника у доски: крупные контрастные
// пятна, ничего мелкого и бледного.
//
// Размеры в ЛОГИЧЕСКИХ пикселях сцены: сцена целиком масштабируется
// трансформом в AlphabetRuntime, и подгонять шрифты под размер окна не нужно.

import React from 'react';

export const palette = {
  sky: '#63b8e8',
  skyDeep: '#3f93c7',
  ground: '#7cc15c',
  panel: '#4a2f23',
  panelEdge: '#6b4633',
  card: '#ffffff',
  letter: '#e8731e',
  letterCool: '#2f7fc4',
  text: '#ffffff',
  textDim: '#d9e7f0',
  textDark: '#2a2118',
  accent: '#f0a830',
  danger: '#c0442e',
};

/** Темы экрана: педагог меняет фон под освещение класса (перенесено из Тип 2) */
export const SCREEN_THEME_COLORS: Record<string, string> = {
  sky: palette.sky,
  forest: '#2f6b4a',
  night: '#1d2433',
  sand: '#c8a870',
  plum: '#4a2f52',
  graphite: '#3a3f45',
};

interface BigButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  tone?: 'primary' | 'secondary' | 'danger';
  wide?: boolean;
  disabled?: boolean;
  testId?: string;
}

export const BigButton: React.FC<BigButtonProps> = ({
  onClick,
  children,
  tone = 'primary',
  wide,
  disabled,
  testId,
}) => {
  const background =
    tone === 'primary' ? palette.accent : tone === 'danger' ? palette.danger : palette.panelEdge;
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      style={{
        background,
        color: tone === 'primary' ? palette.textDark : palette.text,
        border: 'none',
        borderRadius: 16,
        // Не меньше 56 логических пикселей по высоте: палец дошкольника у
        // доски промахивается по кнопкам меньшего размера
        minHeight: 56,
        padding: wide ? '16px 48px' : '16px 28px',
        fontSize: 22,
        fontWeight: 700,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        // Панель — flex-колонка, и без этого кнопка растягивается на всю её
        // ширину: «← К игрокам» превращалась в коричневую полосу через экран
        alignSelf: 'flex-start',
      }}
    >
      {children}
    </button>
  );
};

/**
 * Прокручиваемая область. `minHeight: 0` обязателен: без него flex-потомок
 * не ужимается ниже своего содержимого, и список уезжает за край сцены
 * вместо того, чтобы прокручиваться. В Тип 2 ровно это обрезало списки на
 * двух экранах, и заметили не сразу — списки там короткие.
 */
export const ScrollArea: React.FC<{ children: React.ReactNode; testId?: string }> = ({
  children,
  testId,
}) => (
  <div
    data-testid={testId}
    style={{ flex: 1, minHeight: 0, overflowY: 'auto', width: '100%' }}
  >
    {children}
  </div>
);

export const Panel: React.FC<{ children: React.ReactNode; testId?: string }> = ({
  children,
  testId,
}) => (
  <div
    data-testid={testId}
    style={{
      background: 'rgba(0, 0, 0, 0.28)',
      borderRadius: 20,
      padding: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      minHeight: 0,
    }}
  >
    {children}
  </div>
);
