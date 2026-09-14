// packages/player/src/inophone/ui.tsx
// Общие элементы интерфейса виджета «Инофон».
//
// Палитра СВОЯ, а не заимствованная у Типа 3, и разница тут не декоративная.
// «АзбукоСлов» рассчитан на дошкольника: крупные контрастные пятна, детская
// голубизна. «Инофон» по ТЗ — пособие для инофона любого возраста, включая
// взрослого, и мультяшная палитра здесь читалась бы как «программа для
// малышей». Отсюда спокойный тёмно-синий с тёплым акцентом.
//
// Размеры в ЛОГИЧЕСКИХ пикселях сцены: сцена целиком масштабируется
// трансформом в InophoneRuntime, и подгонять шрифты под размер окна не нужно.

import React from 'react';

export const palette = {
  bg: '#1d2b3a',
  bgDeep: '#152230',
  panel: '#25384b',
  panelEdge: '#33506b',
  card: '#ffffff',
  text: '#f2f6fa',
  textDim: '#a9bece',
  textDark: '#17222e',
  accent: '#f0a830',
  accentCool: '#4fa8d8',
  good: '#4a9d5f',
  danger: '#c0442e',
};

/** Темы экрана: педагог меняет фон под освещение класса (перенесено из Типов 2 и 3) */
export const SCREEN_THEME_COLORS: Record<string, string> = {
  night: palette.bg,
  sky: '#2b5f85',
  forest: '#2f6b4a',
  sand: '#6d5a3c',
  plum: '#42304f',
  graphite: '#33383d',
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
        borderRadius: 14,
        // Не меньше 56 логических пикселей по высоте: у доски попадают пальцем,
        // а не курсором, и мелкая кнопка означает промах на занятии
        minHeight: 56,
        padding: '14px 28px',
        width: wide ? '100%' : undefined,
        fontSize: 22,
        fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {children}
    </button>
  );
};

/** Заголовок экрана с кнопкой возврата — одинаков на всех экранах виджета */
export const ScreenHeader: React.FC<{
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}> = ({ title, onBack, right }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
    {onBack && (
      <BigButton onClick={onBack} tone="secondary" testId="inophone-back">
        ← Назад
      </BigButton>
    )}
    <div style={{ fontSize: 34, fontWeight: 700, color: palette.text, flex: 1 }}>{title}</div>
    {right}
  </div>
);

/**
 * Полоса сообщения. Ошибка и удачное действие показываются ОДНИМ элементом
 * в разных тонах: два разных места на экране педагог читает как два разных
 * события, хотя относятся они к одному только что сделанному действию.
 */
export const Banner: React.FC<{ text: string; tone: 'error' | 'notice' }> = ({ text, tone }) => (
  <div
    data-testid={tone === 'error' ? 'inophone-error' : 'inophone-notice'}
    style={{
      background: tone === 'error' ? palette.danger : palette.good,
      color: palette.text,
      borderRadius: 12,
      padding: '12px 18px',
      fontSize: 18,
      marginBottom: 16,
    }}
  >
    {text}
  </div>
);

export const Panel: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({
  children,
  style,
}) => (
  <div
    style={{
      background: palette.panel,
      border: `2px solid ${palette.panelEdge}`,
      borderRadius: 18,
      padding: 20,
      ...style,
    }}
  >
    {children}
  </div>
);
