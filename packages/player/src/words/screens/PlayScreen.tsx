// packages/player/src/words/screens/PlayScreen.tsx
// Игровое поле — ядро продукта (ТЗ строки 41 и 53).
//
// Цикл шага: показывается силуэт предмета, звучит слово, ребёнок выбирает
// нужную карточку. При верном ответе силуэт «проявляется» в цвете, шаг
// отмечается звездой на полосе прогресса. Партия — 20 шагов на игрока.
//
// Три уровня различаются не «сложностью вопросов вообще», а механикой:
//   Ⅰ — силуэт показан: сопоставление по форме, самый простой вход;
//   Ⅱ — силуэта нет, опираться можно только на прозвучавшее слово;
//   Ⅲ — карточку надо ПЕРЕТАЩИТЬ в рамку, а не нажать (у эталона так же —
//       это отдельная механика, а не настройка).
//
// Поле квадратное и разворачивается целиком под текущего игрока: за столом
// он сидит со своей стороны, и интерфейс должен читаться с неё. Квадрат — не
// прихоть: прямоугольник при повороте на 90° вылезает за пределы сцены.

import React, { useRef, useState } from 'react';
import { palette, BigButton, Stars } from '../ui';
import Character from '../components/Character';
import { SEAT_ROTATIONS, seatsFor } from '../types';
import type { Profile } from '../types';
import type { GameSession } from '@kiosk/shared';
import { currentStep, currentPlayerId, visibleOptions } from '@kiosk/shared';

const BOARD_PX = 700;

interface Props {
  session: GameSession;
  /** Название слова — поставочного или своего */
  wordName: (wordId: string) => string;
  /** Картинка слова; null — у своего слова её может не быть */
  imageUrlFor: (wordId: string) => string | null;
  players: Profile[];
  /** Есть ли в пакете озвучка; если нет — слово показывается текстом */
  hasAudio: boolean;
  lastOutcome: 'correct' | 'wrong' | null;
  onAnswer: (wordId: string) => void;
  onRepeat: () => void;
  onExit: () => void;
}

const PlayScreen: React.FC<Props> = ({
  session,
  wordName,
  imageUrlFor,
  players,
  hasAudio,
  lastOutcome,
  onAnswer,
  onRepeat,
  onExit,
}) => {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState<{ wordId: string; x: number; y: number } | null>(null);

  const step = currentStep(session);
  const playerId = currentPlayerId(session);
  const player = players.find((p) => p.id === playerId);
  const options = visibleOptions(session);

  const seats = seatsFor(session.playerIds.length);
  const rotation = SEAT_ROTATIONS[seats[session.playerIndex] ?? 0];


  if (!step) return null;

  const solved = lastOutcome === 'correct';
  const needsDrag = step.level === 2;

  const finishDrag = (clientX: number, clientY: number, wordId: string) => {
    setDragging(null);
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;
    const inside =
      clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    if (inside) onAnswer(wordId);
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        color: palette.text,
      }}
      onPointerMove={(e) =>
        dragging && setDragging({ ...dragging, x: e.clientX, y: e.clientY })
      }
      onPointerUp={(e) => dragging && finishDrag(e.clientX, e.clientY, dragging.wordId)}
    >
      {/* Табло и выход вне поворачиваемого поля: они для педагога, а не для
          ребёнка, и вертеться вместе с полем им незачем */}
      <div style={{ position: 'absolute', top: 16, left: 24, right: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div data-testid="scoreboard" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 30 }}>
            Ходит: <b data-testid="current-player">{player?.name ?? 'Гость'}</b>
          </span>
          <Stars
            filled={session.tally[playerId]?.completed ?? 0}
            total={session.stepsPerPlayer}
          />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <BigButton onClick={onRepeat} tone="secondary" testId="repeat">
            ↻ Повторить
          </BigButton>
          <BigButton onClick={onExit} tone="danger" testId="exit-game">
            Выйти
          </BigButton>
        </div>
      </div>

      <div
        data-testid="board"
        data-rotation={rotation}
        style={{
          width: BOARD_PX,
          height: BOARD_PX,
          transform: `rotate(${rotation}deg)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
        }}
      >
        {/* Рамка с загаданным предметом */}
        <div
          ref={frameRef}
          data-testid="target-frame"
          data-solved={solved ? 'true' : 'false'}
          style={{
            width: 260,
            height: 260,
            borderRadius: 20,
            border: `4px dashed ${needsDrag ? palette.accent : palette.panelLight}`,
            background: palette.panel,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {(step.level === 0 || solved) && imageUrlFor(step.targetWordId) ? (
            <img
              src={imageUrlFor(step.targetWordId) ?? ''}
              alt=""
              data-testid="target-image"
              style={{
                width: 220,
                height: 220,
                // Силуэт: пока не отгадано — чёрная тень, после верного
                // ответа предмет «проявляется» в цвете
                filter: solved ? 'none' : 'brightness(0) opacity(0.75)',
                transition: 'filter 320ms ease',
              }}
            />
          ) : (
            <span style={{ fontSize: 80, opacity: 0.35 }}>?</span>
          )}
        </div>

        {/* Без озвучки слово нужно как-то предъявить — показываем текстом.
            Это признак незаконченного пакета контента, а не режим продукта. */}
        {!hasAudio && (
          <div data-testid="spoken-word" style={{ fontSize: 40 }}>
            {wordName(step.targetWordId)}
            <span style={{ fontSize: 18, color: palette.textMuted }}> · озвучка не записана</span>
          </div>
        )}

        <div style={{ fontSize: 22, color: palette.textMuted }}>
          {needsDrag ? 'Перетащите нужную карточку в рамку' : 'Выберите нужную карточку'}
        </div>

        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
          {options.map((wordId) => (
            <button
              key={wordId}
              data-testid={`option-${wordId}`}
              data-word={wordName(wordId)}
              onPointerDown={(e) => {
                if (!needsDrag) return;
                e.preventDefault();
                setDragging({ wordId, x: e.clientX, y: e.clientY });
              }}
              onClick={() => {
                if (needsDrag) return; // на третьем уровне нажатие не считается ответом
                onAnswer(wordId);
              }}
              style={{
                width: 150,
                height: 150,
                borderRadius: 16,
                border: 'none',
                background: palette.panel,
                cursor: 'pointer',
                padding: 8,
                opacity: dragging?.wordId === wordId ? 0.35 : 1,
                touchAction: 'none',
              }}
            >
              {imageUrlFor(wordId) ? (
                <img src={imageUrlFor(wordId)!} alt="" style={{ width: '100%', height: '100%' }} />
              ) : (
                <span style={{ fontSize: 22, color: palette.text }}>{wordName(wordId)}</span>
              )}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 40, alignItems: 'flex-end' }}>
          <Character
            kind="girl"
            mood={lastOutcome === 'wrong' ? 'pointing' : solved ? 'speaking' : 'idle'}
            handDirection="right"
            size={110}
          />
          <Character kind="boy" mood={solved ? 'speaking' : 'idle'} size={110} />
        </div>
      </div>

      {/* Карточка «в руке» при перетаскивании — вне поворота, чтобы
          следовать точно за пальцем, а не за повёрнутой системой координат */}
      {dragging && (
        <img
          src={imageUrlFor(dragging.wordId) ?? ''}
          alt=""
          data-testid="drag-ghost"
          style={{
            position: 'fixed',
            left: dragging.x - 60,
            top: dragging.y - 60,
            width: 120,
            height: 120,
            pointerEvents: 'none',
            opacity: 0.9,
          }}
        />
      )}
    </div>
  );
};

export default PlayScreen;
