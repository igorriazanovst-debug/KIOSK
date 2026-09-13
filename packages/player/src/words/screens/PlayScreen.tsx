// packages/player/src/words/screens/PlayScreen.tsx
// Игровое поле — ядро продукта (ТЗ строки 41 и 53).
//
// Цикл шага: показывается силуэт предмета и ВОПРОС ТЕКСТОМ («Найди: стол»),
// ребёнок выбирает нужную карточку. При верном ответе силуэт «проявляется» в
// цвете, шаг отмечается звездой на полосе прогресса. Партия — 20 шагов на
// игрока.
//
// Озвучка сама не включается: слово звучит только по кнопке «Озвучка вопроса»
// (решение пользователя от 13.09.2026).
//
// Три уровня различаются не «сложностью вопросов вообще», а механикой:
//   Ⅰ — силуэт показан: сопоставление по форме, самый простой вход;
//   Ⅱ — силуэта нет, опираться можно только на сам вопрос;
//   Ⅲ — перетаскивание УБРАНО по решению пользователя от 13.09.2026; сейчас
//       уровень отвечается нажатием, как и Ⅱ, и отличается от него только
//       сценарием озвучки. Это делает уровни Ⅱ и Ⅲ практически одинаковыми
//       для ребёнка — см. заметку в плане реализации.
//
// Поле квадратное и разворачивается целиком под текущего игрока: за столом
// он сидит со своей стороны, и интерфейс должен читаться с неё. Квадрат — не
// прихоть: прямоугольник при повороте на 90° вылезает за пределы сцены.

import React, { useRef } from 'react';
import { palette, BigButton, Stars } from '../ui';
import OwlHelper from '../components/OwlHelper';
import { SEAT_ROTATIONS, seatsFor } from '../types';
import type { Profile } from '../types';
import type { GameSession } from '@kiosk/shared';
import { currentStep, currentPlayerId, visibleOptions } from '@kiosk/shared';

/** Логический размер поля. Всё внутри свёрстано под него */
const BOARD_PX = 700;
/** Насколько поле разрешено увеличить на вытянутом окне */
const BOARD_MAX_ZOOM = 1.35;

interface Props {
  session: GameSession;
  /** Название слова — поставочного или своего */
  wordName: (wordId: string) => string;
  /** Картинка слова; null — у своего слова её может не быть */
  imageUrlFor: (wordId: string) => string | null;
  players: Profile[];
  /**
   * Есть ли в пакете озвучка. Вопрос показывается текстом в любом случае;
   * от этого флага зависит только пометка «озвучка не записана» и то, будет
   * ли кнопке «Озвучка вопроса» что проигрывать.
   */
  hasAudio: boolean;
  lastOutcome: 'correct' | 'wrong' | null;
  /** Логический размер сцены — от него считается сторона поля */
  sceneWidth: number;
  sceneHeight: number;
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
  sceneWidth,
  sceneHeight,
  onAnswer,
  onRepeat,
  onExit,
}) => {
  const frameRef = useRef<HTMLDivElement | null>(null);

  const step = currentStep(session);
  const playerId = currentPlayerId(session);
  const player = players.find((p) => p.id === playerId);
  const options = visibleOptions(session);

  // Поле не РАСТЯГИВАЕТСЯ, а УВЕЛИЧИВАЕТСЯ целиком. Увеличивать сам блок
  // бесполезно: рамка, карточки и подписи свёрстаны фиксированными, и
  // растянутое поле просто получило бы пустые поля внутри. Масштаб же
  // увеличивает вместе с полем всё его содержимое.
  //
  // Считается по МЕНЬШЕЙ стороне сцены: поле квадратное, и по большей оно
  // вылезло бы за экран. На привычном 4:3 множитель равен единице, то есть
  // поле остаётся ровно таким, каким было; запас появляется только на
  // вытянутом окне — вертикальном планшете или сверхшироком мониторе.
  const boardZoom = Math.min(
    BOARD_MAX_ZOOM,
    Math.max(1, Math.min(sceneWidth, sceneHeight) / (BOARD_PX + 68))
  );

  const seats = seatsFor(session.playerIds.length);
  const rotation = SEAT_ROTATIONS[seats[session.playerIndex] ?? 0];


  if (!step) return null;

  const solved = lastOutcome === 'correct';

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
    >
      {/* Табло и выход вне поворачиваемого поля: они для педагога, а не для
          ребёнка, и вертеться вместе с полем им незачем.

          zIndex ОБЯЗАТЕЛЕН. Поле идёт ниже по разметке и имеет transform, из-за
          чего создаёт свой контекст наложения и рисуется ПОВЕРХ этой шапки.
          Без явного zIndex кнопка «Озвучить слово» и табло видны, но нажать их
          нельзя — касание перехватывает поле. В окне 1280×800 кнопка была
          закрыта целиком, в 1920 — наполовину, поэтому дефект легко принять за
          случайное «не сработало». Найдено сквозным прогоном 13.09.2026. */}
      <div style={{ position: 'absolute', top: 16, left: 24, right: 24, zIndex: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
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
            🔊 Озвучка вопроса
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
          transform: `rotate(${rotation}deg) scale(${boardZoom})`,
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
            border: `4px dashed ${palette.panelLight}`,
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

        {/* Вопрос написан ТЕКСТОМ ВСЕГДА, а не только когда нет озвучки
            (решение пользователя от 13.09.2026). Раньше слово показывалось
            текстом лишь как признак незаконченного пакета контента, а звучало
            само. Теперь наоборот: текст — основной способ задать вопрос, а
            звук доступен по кнопке «Озвучка вопроса» и сам не включается. */}
        <div data-testid="spoken-word" style={{ fontSize: 40, textAlign: 'center' }}>
          {'Найди: '}
          <b>{wordName(step.targetWordId)}</b>
          {!hasAudio && (
            <span style={{ fontSize: 18, color: palette.textMuted }}> · озвучка не записана</span>
          )}
        </div>

        <div style={{ fontSize: 22, color: palette.textMuted }}>
          Выберите нужную карточку
        </div>

        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
          {options.map((wordId) => (
            <button
              key={wordId}
              data-testid={`option-${wordId}`}
              data-word={wordName(wordId)}
              onClick={() => onAnswer(wordId)}
              style={{
                width: 150,
                height: 150,
                borderRadius: 16,
                border: 'none',
                background: palette.panel,
                cursor: 'pointer',
                padding: 8,
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

      </div>

      {/* Сова-помощник — В УГЛУ ЭКРАНА, ВНЕ ПОЛЯ.
          Сначала она стояла в углу самого поля, но ряд карточек занимает почти
          всю его ширину, и нижний угол оказался занят: сова закрывала часть
          первой карточки. Свободного угла внутри поля просто нет.
          Поворот под текущего игрока при этом сохранён — помощник должен
          смотреть на того, чей ход, как и повёрнутое поле. */}
      <div
        data-testid="owl-corner"
        style={{
          position: 'absolute',
          left: 24,
          bottom: 12,
          zIndex: 4,
          transform: `rotate(${rotation}deg)`,
          display: 'flex',
          alignItems: 'flex-end',
        }}
      >
        <OwlHelper
          mood={lastOutcome === 'wrong' ? 'pointing' : solved ? 'happy' : 'idle'}
          size={110}
          hintOnDemand
          hint={
            solved
              ? 'Верно! Смотри, какое слово дальше.'
              : lastOutcome === 'wrong'
                ? 'Не угадал — ничего страшного. Прочитай слово ещё раз или нажми «Озвучка вопроса» и попробуй другую картинку.'
                : 'Прочитай слово наверху и нажми картинку, которая ему подходит. Не получается прочитать — нажми «Озвучка вопроса».'
          }
          testId="owl-play"
        />
      </div>

    </div>
  );
};

export default PlayScreen;
