// packages/player/src/words/ui.tsx
// Общие элементы интерфейса виджета «Я знаю много слов».
//
// Размеры кнопок и отступов заданы крупными не «для красоты»: продукт живёт
// на интерактивной доске и столе, где нажимают пальцем, а пользователь —
// ребёнок дошкольного возраста. Мелкие цели промахиваются.

import React from 'react';

/** Минимальная сторона нажимаемого элемента. Меньше — палец промахивается */
export const TOUCH_TARGET_PX = 72;

/**
 * Цвета экрана на выбор педагога (ТЗ раздел 6 — настройка визуальными
 * средствами). Каждый оттенок тёмный: текст и карточки в приложении светлые,
 * и на светлом фоне они перестали бы читаться. Поэтому выбор из набора, а не
 * произвольный цвет — см. ScreenThemeSchema в @kiosk/shared.
 */
export const SCREEN_THEME_COLORS: Record<string, { bg: string; label: string }> = {
  forest: { bg: '#16302a', label: 'Лес' },
  night: { bg: '#151a2e', label: 'Ночь' },
  sand: { bg: '#2e2a1c', label: 'Песок' },
  sky: { bg: '#152a33', label: 'Небо' },
  plum: { bg: '#2a1a2e', label: 'Слива' },
  graphite: { bg: '#1e1f22', label: 'Графит' },
};

export const palette = {
  bg: '#16302a',
  panel: '#1d3d35',
  panelLight: '#255045',
  accent: '#2a7255',
  accentText: '#ffffff',
  text: '#e8f5ef',
  textMuted: '#9ab5a8',
  danger: '#a04040',
  dangerText: '#e8a0a0',
  gold: '#e0b33a',
  silver: '#c8ccd0',
  wooden: '#a9764a',
};

export const BigButton: React.FC<{
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  tone?: 'primary' | 'secondary' | 'danger';
  wide?: boolean;
  testId?: string;
}> = ({ onClick, children, disabled, tone = 'primary', wide, testId }) => {
  const background =
    tone === 'primary' ? palette.accent : tone === 'danger' ? 'transparent' : palette.panelLight;
  const border = tone === 'danger' ? `2px solid ${palette.danger}` : 'none';
  const color = tone === 'danger' ? palette.dangerText : palette.accentText;

  return (
    <button
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      style={{
        minHeight: TOUCH_TARGET_PX,
        minWidth: wide ? 360 : TOUCH_TARGET_PX * 2,
        padding: '14px 28px',
        fontSize: 26,
        borderRadius: 12,
        border,
        background,
        color,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
};

export const ScreenFrame: React.FC<{
  title: string;
  onBack?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ title, onBack, children, footer }) => (
  <div
    style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: 36,
      boxSizing: 'border-box',
      gap: 20,
      color: palette.text,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      {onBack && (
        <BigButton onClick={onBack} tone="secondary" testId="back">
          ← Назад
        </BigButton>
      )}
      <h1 style={{ margin: 0, fontSize: 40 }}>{title}</h1>
    </div>
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {children}
    </div>
    {footer && <div style={{ display: 'flex', gap: 16 }}>{footer}</div>}
  </div>
);

export const ErrorBanner: React.FC<{ text: string | null }> = ({ text }) =>
  text ? (
    <div
      data-testid="error"
      style={{
        background: '#4a1f1f',
        border: `2px solid ${palette.danger}`,
        borderRadius: 10,
        padding: 16,
        fontSize: 22,
      }}
    >
      {text}
    </div>
  ) : null;

/**
 * Прокручиваемая область под палец: инерционная прокрутка касанием плюс
 * широкая полоса, за которую реально попасть. Штатный тонкий скроллбар на
 * сенсорной панели непригоден — у эталона по этой же причине своя прокрутка.
 */
export const ScrollArea: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({
  children,
  style,
}) => (
  <div
    style={{
      overflowY: 'auto',
      overflowX: 'hidden',
      WebkitOverflowScrolling: 'touch',
      scrollbarWidth: 'auto',
      scrollbarColor: `${palette.accent} ${palette.panel}`,
      paddingRight: 8,
      // minHeight: 0 ОБЯЗАТЕЛЕН. У флекс-элемента min-height по умолчанию
      // auto, то есть он не сжимается меньше своего содержимого: вместо
      // прокрутки область просто распирала родителя, и нижние строки списка
      // уходили за край сцены — прокрутки при этом не появлялось, потому что
      // переполнялся не этот блок, а тот, что снаружи. Так молча срезались
      // уровни последней темы в настройках и последние карточки на экране
      // картинок слов.
      minHeight: 0,
      ...style,
    }}
  >
    {children}
  </div>
);

/** Звёзды на табло — они же отметки пройденных шагов */
export const Stars: React.FC<{ filled: number; total: number }> = ({ filled, total }) => (
  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
    {Array.from({ length: total }, (_, i) => (
      <span key={i} style={{ fontSize: 22, opacity: i < filled ? 1 : 0.25 }}>
        ★
      </span>
    ))}
  </div>
);

export const TIER_LABEL: Record<string, { text: string; color: string }> = {
  gold: { text: 'Золото', color: palette.gold },
  silver: { text: 'Серебро', color: palette.silver },
  wooden: { text: 'Дерево', color: palette.wooden },
};
