import React from 'react';
import { COLOR } from './theme';

// Маскот «Матвей» — временная векторная отрисовка (см.
// Тип6_визуальная_идентичность.md для полного описания образа: мальчик
// 7-8 лет, круглые очки в толстой оправе, рюкзак с шестерёнками,
// механический карандаш в руке, плоский вектор/«стикер»-стиль).
//
// Это НЕ финальный арт — финальные иллюстрации генерируются пользователем
// вручную через веб-версию syntx.ai (см. mascotPrompts.ts) и кладутся в
// public/mascot/*.png. Как только файл для конкретной позы появляется на
// диске, эта отрисовка заменяется на <img>, использующий его — см. TODO
// в каждой функции ниже. До тех пор SVG-заглушка держит визуальную
// идентичность видимой на экране без внешней зависимости.

export type MascotPose = 'greeting' | 'thinking' | 'celebrating';

interface Props {
  pose: MascotPose;
  size?: number;
}

const Mascot: React.FC<Props> = ({ pose, size = 120 }) => {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="Матвей">
      {/* Рюкзак с шестерёнкой — за спиной, виден сбоку */}
      <rect x="10" y="55" width="22" height="34" rx="8" fill={COLOR.indigo} />
      <circle cx="21" cy="66" r="6" fill={COLOR.amberLight} stroke={COLOR.amber} strokeWidth="2" />
      <circle cx="21" cy="66" r="2" fill={COLOR.indigo} />

      {/* Тело — свитер */}
      <path d="M35 118 L35 90 Q35 72 60 72 Q85 72 85 90 L85 118 Z" fill={COLOR.mint} />

      {/* Голова — крупная, упрощённые пропорции */}
      <circle cx="60" cy="46" r="30" fill="#F6D9B8" />

      {/* Причёска */}
      <path d="M30 40 Q30 14 60 14 Q90 14 90 40 Q90 30 74 27 Q60 24 46 27 Q30 30 30 40 Z" fill={COLOR.text} />

      {/* Очки — круглые, толстая оправа */}
      <circle cx="46" cy="48" r="11" fill="#FFFFFF" stroke={COLOR.text} strokeWidth="4" />
      <circle cx="74" cy="48" r="11" fill="#FFFFFF" stroke={COLOR.text} strokeWidth="4" />
      <line x1="57" y1="47" x2="63" y2="47" stroke={COLOR.text} strokeWidth="4" />
      <circle cx="46" cy="48" r="4" fill={COLOR.indigo} />
      <circle cx="74" cy="48" r="4" fill={COLOR.indigo} />

      {/* Рот — меняется по позе */}
      {pose === 'thinking' ? (
        <path d="M52 64 Q60 62 68 64" stroke={COLOR.text} strokeWidth="3" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M50 62 Q60 72 70 62" stroke={COLOR.text} strokeWidth="3" fill="none" strokeLinecap="round" />
      )}

      {/* Рука с механическим карандашом или поднятая (празднует) */}
      {pose === 'celebrating' ? (
        <>
          <path d="M85 92 L102 70" stroke="#F6D9B8" strokeWidth="12" strokeLinecap="round" />
          <path d="M35 92 L18 70" stroke="#F6D9B8" strokeWidth="12" strokeLinecap="round" />
          <circle cx="20" cy="30" r="3" fill={COLOR.amber} />
          <circle cx="100" cy="30" r="3" fill={COLOR.mint} />
          <circle cx="60" cy="8" r="3" fill={COLOR.indigo} />
        </>
      ) : pose === 'thinking' ? (
        <path d="M75 92 Q95 85 92 60" stroke="#F6D9B8" strokeWidth="12" strokeLinecap="round" fill="none" />
      ) : (
        <>
          <path d="M85 95 L100 100" stroke="#F6D9B8" strokeWidth="12" strokeLinecap="round" />
          <rect x="98" y="94" width="18" height="5" rx="2.5" fill={COLOR.amber} transform="rotate(20 98 94)" />
        </>
      )}
    </svg>
  );
};

export default Mascot;
