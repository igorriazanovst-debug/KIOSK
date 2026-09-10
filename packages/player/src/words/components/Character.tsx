// packages/player/src/words/components/Character.tsx
// Анимированный персонаж-помощник (ТЗ строка 61).
//
// ЗАГЛУШКА ПО СЛОЖНОСТИ, а не по наличию. У эталона персонажи нарисованы
// как SVG-компоненты с покадровой анимацией на собственном цикле
// requestAnimationFrame — это единственная позиция, оценённая разбором как
// «высокая сложность». В MVP реализованы три состояния (молчит / говорит /
// показывает жест) на CSS-переходах; полная покадровая анимация вынесена за
// границу MVP осознанно (см. Яслов_план_реализации.md, раздел 0.6).
//
// Персонажей два, как у эталона: они говорят по очереди, чтобы реплики не
// звучали от одного и того же лица всю партию.

import React from 'react';

export type CharacterMood = 'idle' | 'speaking' | 'pointing';
export type CharacterKind = 'girl' | 'boy';

interface Props {
  kind: CharacterKind;
  mood: CharacterMood;
  /** Куда показывает рука: пригодится подсказке на игровом поле */
  handDirection?: 'left' | 'right';
  size?: number;
  onClick?: () => void;
}

const SKIN = '#f2cfae';
const HAIR: Record<CharacterKind, string> = { girl: '#8a4b2a', boy: '#3f3a36' };
const SHIRT: Record<CharacterKind, string> = { girl: '#c85a8a', boy: '#3f6fb5' };

const Character: React.FC<Props> = ({ kind, mood, handDirection = 'right', size = 190, onClick }) => {
  const mouthHeight = mood === 'speaking' ? 16 : 5;
  const armAngle = mood === 'pointing' ? (handDirection === 'right' ? -35 : 35) : 0;

  return (
    <svg
      data-testid={`character-${kind}`}
      data-mood={mood}
      width={size}
      height={size * 1.25}
      viewBox="0 0 160 200"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default', userSelect: 'none' }}
    >
      {/* туловище */}
      <rect x="48" y="104" width="64" height="76" rx="18" fill={SHIRT[kind]} />
      {/* рука, которая показывает на карточку */}
      <g
        transform={`rotate(${armAngle} ${handDirection === 'right' ? 112 : 48} 120)`}
        style={{ transition: 'transform 220ms ease' }}
      >
        <rect
          x={handDirection === 'right' ? 108 : 40}
          y="116"
          width="14"
          height="52"
          rx="7"
          fill={SKIN}
        />
      </g>
      {/* голова */}
      <circle cx="80" cy="66" r="40" fill={SKIN} />
      <path
        d={kind === 'girl' ? 'M40 62a40 40 0 0 1 80 0v-6a40 40 0 0 0-80 0z' : 'M42 56a38 38 0 0 1 76 0z'}
        fill={HAIR[kind]}
      />
      {kind === 'girl' && <circle cx="124" cy="72" r="12" fill={HAIR[kind]} />}
      {kind === 'girl' && <circle cx="36" cy="72" r="12" fill={HAIR[kind]} />}
      {/* глаза */}
      <circle cx="66" cy="62" r="5" fill="#2a2a2a" />
      <circle cx="94" cy="62" r="5" fill="#2a2a2a" />
      {/* рот: раскрывается, когда персонаж говорит */}
      <rect
        x="70"
        y="82"
        width="20"
        height={mouthHeight}
        rx={mouthHeight / 2}
        fill="#8a3b3b"
        style={{ transition: 'height 160ms ease' }}
      />
    </svg>
  );
};

export default Character;
