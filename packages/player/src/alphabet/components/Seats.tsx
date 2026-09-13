// packages/player/src/alphabet/components/Seats.tsx
// Рассадка игроков вокруг интерактивного стола — ТЗ строка 75
// («для каждой стороны интерактивного стола для 2, 3 и 4 игроков»).
//
// ЧЕТЫРЕ МЕСТА ПО ПЕРИМЕТРУ, как у эталона: снизу 0°, слева 90°, сверху 180°,
// справа −90°. Подпись каждого повёрнута к своему игроку — сидящий слева
// читает своё имя, не наклоняя голову.
//
// КАК ИМЕННО ЭТО РАБОТАЕТ У НАС — И ЧЕМ ОТЛИЧАЕТСЯ ОТ ЭТАЛОНА.
//
// У эталона каждая сторона получает СЛОТ С ПОЛНЫМ игровым интерфейсом,
// повёрнутым к своему игроку: своя панель слогов, свои ячейки. У нас игрок
// один за раз (очерёдность), и к нему поворачивается ВСЯ сцена.
//
// Это осознанное решение, а не упрощение по недосмотру. Четыре копии поля,
// из которых три бездействуют, ничего не дают, пока нет одновременного
// мультитача, — а он прямо вынесен планом за пределы MVP. Требование «для
// каждой стороны» при этом выполняется в том смысле, который и имеет
// значение: каждый играет лицом к себе, а не вверх ногами.
//
// Решение зафиксировано как расхождение с эталоном и вынесено на приёмку.

import React from 'react';
import { palette } from '../ui';

/** Углы мест: снизу, слева, сверху, справа */
export const SEAT_ANGLES = [0, 90, 180, -90] as const;

interface Seat {
  playerId: string;
  name: string;
}

interface Props {
  seats: Seat[];
  /** Чей сейчас ход */
  activeIndex: number;
}

/**
 * Подписи мест по периметру. Рисуются поверх сцены и НЕ участвуют в её
 * повороте: имена должны стоять там, где сидят люди, а не ехать вместе с
 * полем.
 */
const Seats: React.FC<Props> = ({ seats, activeIndex }) => {
  if (seats.length < 2) return null;

  const place = (index: number): React.CSSProperties => {
    switch (index) {
      case 0:
        return { bottom: 6, left: '50%', transform: 'translateX(-50%)' };
      case 1:
        return { left: 6, top: '50%', transform: 'translateY(-50%) rotate(90deg)' };
      case 2:
        return { top: 6, left: '50%', transform: 'translateX(-50%) rotate(180deg)' };
      default:
        return { right: 6, top: '50%', transform: 'translateY(-50%) rotate(-90deg)' };
    }
  };

  return (
    <div data-testid="seats" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 6 }}>
      {seats.map((seat, index) => {
        const active = index === activeIndex;
        return (
          <div
            key={seat.playerId}
            data-testid={`seat-${index}`}
            data-active={active ? 'yes' : 'no'}
            style={{
              position: 'absolute',
              ...place(index),
              background: active ? palette.accent : 'rgba(0,0,0,0.35)',
              color: active ? palette.textDark : palette.textDim,
              borderRadius: 10,
              padding: '6px 14px',
              fontSize: 20,
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            {seat.name}
          </div>
        );
      })}
    </div>
  );
};

export default Seats;
