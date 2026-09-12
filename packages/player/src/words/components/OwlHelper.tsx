// packages/player/src/words/components/OwlHelper.tsx
// Сова — внутренний анимированный персонаж-помощник (ТЗ строка 61, FR-022).
//
// Заменяет двух декоративных персонажей, которые стояли на экранах раньше.
// ТЗ требует ОДНОГО помощника, и один персонаж, который действительно
// подсказывает, полезнее двух, которые просто стоят.
//
// ЧТО ЗДЕСЬ АНИМАЦИЯ. Пять нарисованных кадров (покой, моргание, речь,
// указание, радость) в public/words-owl/. Какой кадр показать — считает
// чистая функция owlFrame() по прошедшему времени; она покрыта тестами.
// Здесь остаётся только цикл requestAnimationFrame и отрисовка.
//
// Цикл запускается ТОЛЬКО для подвижных настроений (см. isAnimated): держать
// rAF ради статичного жеста на слабом железе киоска незачем. Лёгкое
// покачивание корпуса сделано CSS-анимацией — она идёт на композиторе и не
// будит React.
//
// ПОЧЕМУ КАРТИНКИ, А НЕ SVG. Эталон ОС3 рисовал персонажей покадрово, и разбор
// оценил это как единственную позицию «высокой сложности». Кадры получены
// генерацией (см. docs/words-owl-asset-pipeline.md) и весят 48 КБ на все пять
// в WebP — дешевле, чем рисовать их в коде, и выглядит как детская книжка.
//
// ПОЧЕМУ ФАЙЛЫ В public/, А НЕ В ПАКЕТЕ КОНТЕНТА. Помощник — часть интерфейса,
// а не учебного контента: он обязан работать даже когда пакет слов не
// подключён (в этом состоянии приложение показывает пустую карту тем, и
// именно тогда подсказка нужнее всего). public/ попадает в сборку рендерера
// целиком, зависимости от extraResources нет.

import React, { useEffect, useRef, useState } from 'react';
import { palette, TOUCH_TARGET_PX } from '../ui';
import { owlFrame, isAnimated, type OwlMood } from './owlFrames.ts';

interface Props {
  /** Настроение задаёт экран по ходу игры */
  mood: OwlMood;
  size?: number;
  /**
   * Текст подсказки. Показывается в облачке рядом с совой; если не задан,
   * сова просто присутствует и реагирует на игру.
   */
  hint?: string | null;
  /**
   * Подсказка спрятана, пока по сове не нажмут. Для игрового поля так и
   * нужно: облако не должно закрывать карточки, пока ребёнок сам не спросит.
   */
  hintOnDemand?: boolean;
  /** С какой стороны от совы облачко: по умолчанию справа */
  bubbleSide?: 'left' | 'right';
  /** Отзеркалить сову — чтобы указывала в нужную сторону */
  flip?: boolean;
  testId?: string;
}

const FRAME_SRC: Record<string, string> = {
  idle: './words-owl/owl-idle.webp',
  blink: './words-owl/owl-blink.webp',
  speaking: './words-owl/owl-speaking.webp',
  pointing: './words-owl/owl-pointing.webp',
  happy: './words-owl/owl-happy.webp',
};

const OwlHelper: React.FC<Props> = ({
  mood,
  size = 150,
  hint = null,
  hintOnDemand = false,
  bubbleSide = 'right',
  flip = false,
  testId = 'owl',
}) => {
  const [frame, setFrame] = useState(() => owlFrame(mood, 0));
  const [open, setOpen] = useState(!hintOnDemand);

  // Настроение сменилось — время анимации начинается заново, иначе речь
  // могла бы начаться с закрытого клюва, а моргание — сразу с закрытых глаз
  const startedAt = useRef(0);

  useEffect(() => {
    startedAt.current = Date.now();
    setFrame(owlFrame(mood, 0));

    if (!isAnimated(mood)) return;

    let raf = 0;
    const tick = () => {
      setFrame(owlFrame(mood, Date.now() - startedAt.current));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mood]);

  // Новая подсказка на экране, где она по запросу, снова прячется
  useEffect(() => {
    setOpen(!hintOnDemand);
  }, [hint, hintOnDemand]);

  const bubble = hint && open && (
    <div
      data-testid={`${testId}-hint`}
      style={{
        maxWidth: 320,
        background: palette.panelLight,
        color: palette.text,
        borderRadius: 16,
        padding: '14px 18px',
        fontSize: 22,
        lineHeight: 1.3,
        // Облачко не должно перехватывать касания по карточкам под ним
        pointerEvents: 'none',
      }}
    >
      {hint}
    </div>
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexDirection: bubbleSide === 'left' ? 'row-reverse' : 'row',
      }}
    >
      <button
        type="button"
        data-testid={testId}
        data-owl-frame={frame}
        data-owl-mood={mood}
        aria-label={hint ? 'Подсказка совы' : 'Сова-помощник'}
        onClick={() => hint && setOpen((v) => !v)}
        style={{
          border: 'none',
          background: 'transparent',
          padding: 0,
          cursor: hint ? 'pointer' : 'default',
          minWidth: hint ? TOUCH_TARGET_PX : undefined,
          minHeight: hint ? TOUCH_TARGET_PX : undefined,
          lineHeight: 0,
        }}
      >
        <img
          src={FRAME_SRC[frame]}
          alt=""
          width={size}
          draggable={false}
          style={{
            width: size,
            height: 'auto',
            transform: flip ? 'scaleX(-1)' : undefined,
            // Покачивание — на композиторе, React о нём не знает
            animation: mood === 'happy' ? 'owl-hop 700ms ease-in-out infinite' : 'owl-bob 3s ease-in-out infinite',
            userSelect: 'none',
          }}
        />
      </button>
      {bubble}
      <style>{`
        @keyframes owl-bob { 0%,100% { translate: 0 0 } 50% { translate: 0 -4px } }
        @keyframes owl-hop { 0%,100% { translate: 0 0 } 40% { translate: 0 -12px } }
        @media (prefers-reduced-motion: reduce) {
          [data-testid="${testId}"] img { animation: none !important }
        }
      `}</style>
    </div>
  );
};

export default OwlHelper;
