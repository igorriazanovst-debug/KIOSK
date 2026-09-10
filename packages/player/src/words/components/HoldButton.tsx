// packages/player/src/words/components/HoldButton.tsx
// Кнопка, которая срабатывает не от касания, а от УДЕРЖАНИЯ.
//
// Зачем. ТЗ раздел 3: «функции создания/редактирования контента и
// административные операции не должны СЛУЧАЙНО изменяться пользователем,
// работающим только в режиме обучения/просмотра». У профилей детей паролей
// нет и не планируется (Яслов_план_реализации.md, «Что явно НЕ входит в
// MVP»), а стол стоит в группе, и по нему бьют ладонями. Значит защита
// нужна не от злоумышленника, а именно от случайного попадания — и удержание
// закрывает ровно это: ткнуть пальцем мимо можно, продержать две секунды
// мимо — нет.
//
// Почему pointer-события, а не onClick/onTouchStart: сенсорная панель, мышь
// и стилус приходят одним типом событий, отдельной ветки под каждый ввод не
// нужно. Ровно так же устроено перетаскивание на уровне III.
//
// Почему таймер, а не CSS-анимация как источник истины: анимация может не
// стартовать (prefers-reduced-motion, фоновая вкладка), и тогда кнопка
// молча перестанет срабатывать. Прогресс на экране — производная от
// таймера, а не наоборот.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { palette, TOUCH_TARGET_PX } from '../ui';

/** Сколько держать. Две секунды: заметно дольше случайного касания, но не раздражает педагога */
export const HOLD_DURATION_MS = 2000;
/** Как часто перерисовывать полосу прогресса */
const TICK_MS = 50;

interface Props {
  onHoldComplete: () => void;
  children: React.ReactNode;
  /** Подпись под кнопкой: чем закончится удержание */
  hint?: string;
  disabled?: boolean;
  wide?: boolean;
  tone?: 'secondary' | 'danger';
  testId?: string;
}

const HoldButton: React.FC<Props> = ({
  onHoldComplete,
  children,
  hint,
  disabled,
  wide,
  tone = 'secondary',
  testId,
}) => {
  const [progress, setProgress] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);

  const stop = useCallback(() => {
    if (timer.current !== null) {
      clearInterval(timer.current);
      timer.current = null;
    }
    setProgress(0);
  }, []);

  // Незавершённое удержание не должно пережить размонтирование экрана
  useEffect(() => stop, [stop]);

  const start = useCallback(() => {
    if (disabled || timer.current !== null) return;
    startedAt.current = Date.now();
    timer.current = setInterval(() => {
      const done = Math.min(1, (Date.now() - startedAt.current) / HOLD_DURATION_MS);
      setProgress(done);
      if (done >= 1) {
        stop();
        onHoldComplete();
      }
    }, TICK_MS);
  }, [disabled, onHoldComplete, stop]);

  const border = tone === 'danger' ? `2px solid ${palette.danger}` : 'none';
  const color = tone === 'danger' ? palette.dangerText : palette.accentText;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
      <button
        data-testid={testId}
        data-hold-progress={progress.toFixed(2)}
        disabled={disabled}
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        style={{
          position: 'relative',
          overflow: 'hidden',
          minHeight: TOUCH_TARGET_PX,
          minWidth: wide ? 360 : TOUCH_TARGET_PX * 2,
          padding: '14px 28px',
          fontSize: 26,
          borderRadius: 12,
          border,
          background: tone === 'danger' ? 'transparent' : palette.panelLight,
          color,
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.45 : 1,
          fontFamily: 'inherit',
          // Иначе долгое нажатие на сенсорном экране откроет системное меню
          // выделения/копирования и удержание прервётся на середине
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        {/* Полоса заполнения — под подписью, поэтому текст остаётся читаемым */}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${progress * 100}%`,
            background: palette.accent,
            opacity: 0.35,
            pointerEvents: 'none',
          }}
        />
        <span style={{ position: 'relative' }}>{children}</span>
      </button>
      {hint && (
        <span style={{ fontSize: 16, color: palette.textMuted, textAlign: 'center' }}>{hint}</span>
      )}
    </div>
  );
};

export default HoldButton;
