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
import { SEAT_ROTATIONS, seatsFor } from '@kiosk/shared';
import { palette } from '../ui';

// Углы и правило рассадки — ОБЩИЕ с Типами 2 и 4 (@kiosk/shared, utils/seats).
// Здесь была своя копия, и она разошлась с копией Типа 2: при двоих игроках
// занимались места «снизу» и «слева», то есть люди садились рядом и закрывали
// друг другу половину доски, тогда как правило эталона — НАПРОТИВ.
export { SEAT_ROTATIONS as SEAT_ANGLES } from '@kiosk/shared';

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

  // Номер игрока -> НОМЕР МЕСТА по общему правилу, а не «первый садится на
  // место 0, второй на место 1». При двоих это и есть разница между «напротив»
  // и «рядом»
  const order = seatsFor(seats.length);

  const place = (index: number): React.CSSProperties => {
    switch (order[index]) {
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
