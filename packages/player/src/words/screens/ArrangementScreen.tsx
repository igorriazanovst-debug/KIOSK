// packages/player/src/words/screens/ArrangementScreen.tsx
// Рассадка игроков вокруг интерактивного стола — ТЗ строка 54.
//
// Показывается только при числе игроков больше одного, как у эталона.
// Подписи разворачиваются под каждую сторону: снизу 0°, слева 90°, сверху
// 180°, справа −90°. Эти значения не выдуманы — они сняты с работающего
// эталона вычисленными стилями при разборе.
//
// ВАЖНО ДЛЯ ПРИЁМКИ: это рассадка с очерёдностью хода, а не одновременная
// игра четверых. Формулировку ТЗ («возможность работы с 4 сторон») это
// закрывает, и принятый заказчиком эталон устроен так же. Если имелся в виду
// одновременный ввод — это другой объём работ, см. открытые вопросы плана.

import React from 'react';
import { BigButton, palette } from '../ui';
import { SEAT_ROTATIONS, SEAT_LABELS, seatsFor } from '../types';
import type { Profile } from '../types';

interface Props {
  players: Profile[];
  onBack: () => void;
  onStart: () => void;
}

/** Куда поставить подпись места на схеме стола */
const SEAT_POSITION: Array<React.CSSProperties> = [
  { left: '50%', bottom: 24, transform: 'translateX(-50%)' },
  { left: 24, top: '50%', transform: 'translateY(-50%)' },
  { left: '50%', top: 24, transform: 'translateX(-50%)' },
  { right: 24, top: '50%', transform: 'translateY(-50%)' },
];

const ArrangementScreen: React.FC<Props> = ({ players, onBack, onStart }) => {
  const seats = seatsFor(players.length);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        padding: 28,
        boxSizing: 'border-box',
        color: palette.text,
      }}
    >
      <h1 style={{ margin: 0, fontSize: 38 }}>Займите места вокруг стола</h1>

      <div
        data-testid="table"
        style={{
          position: 'relative',
          width: 620,
          height: 460,
          borderRadius: 28,
          background: palette.panel,
          border: `4px solid ${palette.panelLight}`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            color: palette.textMuted,
          }}
        >
          Ход переходит по кругу
        </div>

        {players.map((player, index) => {
          const seat = seats[index];
          const rotation = SEAT_ROTATIONS[seat];
          const position = SEAT_POSITION[seat];
          return (
            <div
              key={player.id}
              data-testid={`seat-${player.name}`}
              data-seat={seat}
              data-rotation={rotation}
              style={{
                position: 'absolute',
                ...position,
                fontSize: 30,
                background: palette.accent,
                borderRadius: 12,
                padding: '10px 22px',
                whiteSpace: 'nowrap',
                // Поворот дописывается к позиционирующему transform, иначе
                // он его затрёт и подпись уедет с края стола
                transform: `${position.transform ?? ''} rotate(${rotation}deg)`.trim(),
              }}
            >
              {player.name}
              <span style={{ fontSize: 18, opacity: 0.75 }}> · {SEAT_LABELS[seat]}</span>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 16 }}>
        <BigButton onClick={onBack} tone="secondary" testId="arrangement-back">
          ← Назад
        </BigButton>
        <BigButton onClick={onStart} wide testId="arrangement-start">
          Все сели, начать
        </BigButton>
      </div>
    </div>
  );
};

export default ArrangementScreen;
