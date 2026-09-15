// packages/player/src/chimiq/screens/GameBoardScreen.tsx
import React, { useEffect, useRef, useState } from 'react';
import type { ChimiqPoint, ChimiqQuestion } from '../model/schema.ts';
import { scoreForAnswer, nextTurn, buildBoardTiles, type ChimiqAnswerEvent, type ChimiqBoardTile } from '../gameLogic.ts';
import { chimiqItemImageUrl } from '../chimiqMediaUrl.ts';
import { playCorrectTone, playWrongTone } from '../sound.ts';
import '../chimiqTheme.css';

interface Props {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  playerNames: string[];
  questionsByPlayer: ChimiqQuestion[][];
  levelQuestions: ChimiqQuestion[];
  genericDecoyPoints: ChimiqPoint[];
  onFinished: (answers: ChimiqAnswerEvent[]) => void;
  soundOn: boolean;
  onSoundToggle: () => void;
  // Настройка «Крупнее» хранится в userData (ChimiqRuntime) и переживает
  // новую партию - без этого пропа она сбрасывалась бы при каждом заходе
  // на игровое поле (находка/предложение пользователя 2026-09-15).
  initialZoomed: boolean;
  onZoomedChange: (zoomed: boolean) => void;
}

// Прямая адаптация rusiq/screens/GameBoardScreen.tsx (Тип 7) — те же
// решения по тем же причинам (см. комментарии там подробно):
// - точки рендерятся в % от натурального размера изображения, не в px;
// - единый стиль для ВСЕХ точек в состоянии "не нажато" (иначе цвет точки
//   сам по себе подсказывает правильный ответ);
// - дедупликация плиток по координатам (иначе плитка правильного ответа
//   получает двойной слой подсветки и выделяется темнее прочих);
// - явная обработка истечения таймера отдельным эффектом (без неё вопрос
//   можно держать открытым бесконечно — реальный баг, найденный на РусIQ).
const DISPLAY_MAX_WIDTH_CSS = 'min(1200px, 92vw)';
const ZOOM_SCALE = 1.6;

const POINT_COLOR = 'rgba(90, 90, 90, 0.28)';
const POINT_RING = '2px solid rgba(255, 255, 255, 0.5)';
const FEEDBACK_CORRECT_COLOR = 'rgba(62, 207, 126, 0.85)';
const FEEDBACK_WRONG_COLOR = 'rgba(255, 107, 107, 0.85)';
const FEEDBACK_DURATION_MS = 900;

const GameBoardScreen: React.FC<Props> = ({
  imageUrl,
  imageWidth,
  imageHeight,
  playerNames,
  questionsByPlayer,
  levelQuestions,
  genericDecoyPoints,
  onFinished,
  soundOn,
  onSoundToggle,
  initialZoomed,
  onZoomedChange,
}) => {
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [questionIndexByPlayer, setQuestionIndexByPlayer] = useState<number[]>(() => playerNames.map(() => 0));
  const [elapsed, setElapsed] = useState(0);
  const [answers, setAnswers] = useState<ChimiqAnswerEvent[]>([]);
  const [hintShown, setHintShown] = useState(false);
  const [feedback, setFeedback] = useState<{ key: string; correct: boolean } | null>(null);
  // Найдено по жалобе пользователя (2026-09-15): текст ответа нарисован
  // ПИКСЕЛЯМИ на статичной картинке уровня (не HTML-текст), поэтому
  // системный "увеличить страницу" браузера тут не помогает так, как
  // помог бы для обычного текста — при плотной сетке ~50-70 плиток на
  // уровень мелкий текст на некоторых плитках плохо читается с
  // расстояния экрана киоска. Кнопка «Крупнее» отображает картинку и
  // точки в её натуральном (или крупнее) пиксельном размере вместо
  // подогнанного под окно — поле становится прокручиваемым.
  const [zoomed, setZoomed] = useState(initialZoomed);

  function toggleZoomed() {
    setZoomed((z) => {
      const next = !z;
      onZoomedChange(next);
      return next;
    });
  }

  const hasAnsweredRef = useRef(false);
  const feedbackTimeoutRef = useRef<number | null>(null);

  const currentQuestion = questionsByPlayer[currentPlayer][questionIndexByPlayer[currentPlayer]];
  const tiles = buildBoardTiles(currentQuestion, levelQuestions, genericDecoyPoints);

  useEffect(() => {
    setElapsed(0);
    setHintShown(false);
    setFeedback(null);
    hasAnsweredRef.current = false;
    const interval = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [currentPlayer, questionIndexByPlayer[currentPlayer]]);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current !== null) window.clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (elapsed >= currentQuestion.timeSeconds && !hasAnsweredRef.current) {
      hasAnsweredRef.current = true;
      commitAdvance({ playerIndex: currentPlayer, score: 0, correct: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed]);

  function commitAdvance(event: ChimiqAnswerEvent) {
    const updatedAnswers = [...answers, event];
    setAnswers(updatedAnswers);

    const nextIndexForCurrent = questionIndexByPlayer[currentPlayer] + 1;
    const allDone = playerNames.every((_, p) => (p === currentPlayer ? nextIndexForCurrent : questionIndexByPlayer[p]) >= questionsByPlayer[p].length);

    if (allDone) {
      onFinished(updatedAnswers);
      return;
    }

    setQuestionIndexByPlayer((prev) => prev.map((idx, p) => (p === currentPlayer ? nextIndexForCurrent : idx)));
    setCurrentPlayer((prev) => nextTurn(prev, playerNames.length));
  }

  function handleTileClick(tile: ChimiqBoardTile) {
    if (hasAnsweredRef.current) return;
    hasAnsweredRef.current = true;
    const correct = tile.isCorrect;
    const score = correct ? scoreForAnswer(currentQuestion.price, currentQuestion.timeSeconds, elapsed, true) : 0;
    if (soundOn) (correct ? playCorrectTone : playWrongTone)();
    setFeedback({ key: tile.key, correct });
    feedbackTimeoutRef.current = window.setTimeout(() => {
      setFeedback(null);
      commitAdvance({ playerIndex: currentPlayer, score, correct });
    }, FEEDBACK_DURATION_MS);
  }

  function handleGiveUp() {
    if (hasAnsweredRef.current) return;
    hasAnsweredRef.current = true;
    commitAdvance({ playerIndex: currentPlayer, score: 0, correct: false });
  }

  function handleShowHint() {
    setHintShown(true);
  }

  const remainingSeconds = Math.max(0, currentQuestion.timeSeconds - elapsed);
  const liveScore = scoreForAnswer(currentQuestion.price, currentQuestion.timeSeconds, elapsed, true);

  function pointStyle(point: { width: number; height: number }, activeFeedback: { correct: boolean } | null): React.CSSProperties {
    const background = activeFeedback ? (activeFeedback.correct ? FEEDBACK_CORRECT_COLOR : FEEDBACK_WRONG_COLOR) : POINT_COLOR;
    const border = activeFeedback ? `2px solid ${activeFeedback.correct ? '#3ecf7e' : '#ff6b6b'}` : POINT_RING;
    return {
      position: 'absolute',
      width: `${(point.width / imageWidth) * 100}%`,
      height: `${(point.height / imageHeight) * 100}%`,
      transform: 'translate(-50%, -50%)',
      borderRadius: 6,
      background,
      border,
      boxShadow: '0 0 6px rgba(0, 0, 0, 0.4)',
      padding: 0,
      cursor: hasAnsweredRef.current ? 'default' : 'pointer',
      transition: 'background 120ms ease, border-color 120ms ease',
      // Обратная связь по клику не должна различаться ТОЛЬКО цветом (см.
      // тот же урок, уже применённый в «АзбукоСлов»: «верный и неверный
      // различаются не только цветом, но и значком — среди детей нарушение
      // цветовосприятия обычное дело», актуально и для взрослых
      // дальтоников-посетителей киоска). Глиф ✓/✗ ниже дублирует цвет.
      display: activeFeedback ? 'flex' : undefined,
      alignItems: activeFeedback ? 'center' : undefined,
      justifyContent: activeFeedback ? 'center' : undefined,
    };
  }

  function feedbackGlyph(activeFeedback: { correct: boolean } | null): React.ReactNode {
    if (!activeFeedback) return null;
    return (
      <span
        aria-hidden="true"
        style={{
          color: '#ffffff',
          fontSize: '1.4em',
          fontWeight: 700,
          textShadow: '0 1px 3px rgba(0, 0, 0, 0.6)',
          lineHeight: 1,
        }}
      >
        {activeFeedback.correct ? '✓' : '✗'}
      </span>
    );
  }

  function pointPosition(point: ChimiqPoint): React.CSSProperties {
    return {
      left: `${(point.x / imageWidth) * 100}%`,
      top: `${(point.y / imageHeight) * 100}%`,
    };
  }

  // Найденный баг (2026-09-15, по жалобе «не все ответы видны»): контейнер
  // картинки раньше подгонялся ТОЛЬКО под ширину (width: DISPLAY_MAX_WIDTH_CSS
  // + aspectRatio), без учёта доступной высоты окна. Для высоких изображений
  // (уровень 2/3, 1710×1440/1280) это давало высоту ~1000-1140px против
  // фиксированных 800px окна плеера — нижняя часть поля с частью кликабельных
  // точек (иногда включая саму верную) физически обрезалась окном, скролла
  // не было. Живой CDP-замер подтвердил: 8 из 16 точек, включая
  // correct-point, оказывались ниже window.innerHeight.
  //
  // Исправление — flex-раскладка на всю высоту окна: «шапка» (счёт+вопрос+
  // подсказка, высота которой меняется от вопроса к вопросу) не сжимается,
  // а картинка получает оставшееся пространство (flex: 1) и масштабируется
  // ОДНОВРЕМЕННО по ширине И высоте (width/height: auto + max-width/
  // max-height + aspectRatio — Chromium корректно решает такую систему
  // ограничений, сохраняя пропорции). Никаких зашитых в px оценок высоты
  // шапки — тот же класс хрупкого предположения уже один раз стоил бага.
  return (
    <div className="ciq-page" style={{ padding: 0, height: '100vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
      <div style={{ flex: '0 0 auto' }}>
        <div className="ciq-scoreboard">
          <span className="ciq-scoreboard-item">
            Вопрос <strong>{questionIndexByPlayer[currentPlayer] + 1}</strong>/{questionsByPlayer[currentPlayer].length}
          </span>
          <span className="ciq-scoreboard-item">
            Ходит: <strong>{playerNames[currentPlayer]}</strong>
          </span>
          <span className={`ciq-scoreboard-item ${remainingSeconds <= 5 ? 'ciq-scoreboard-timer-urgent' : 'ciq-scoreboard-timer'}`}>
            Таймер: <strong>{remainingSeconds}с</strong>
          </span>
          <span className="ciq-scoreboard-item">
            Очки сейчас: <strong>{liveScore}</strong>
          </span>
          <button onClick={toggleZoomed} className="ciq-btn ciq-btn-ghost ciq-btn-small" aria-pressed={zoomed}>
            {zoomed ? 'Обычный размер' : '🔍 Крупнее'}
          </button>
          <button onClick={onSoundToggle} className="ciq-btn ciq-btn-ghost ciq-btn-small" aria-pressed={soundOn}>
            {soundOn ? '🔊 Звук' : '🔇 Звук выкл.'}
          </button>
          <button onClick={handleGiveUp} className="ciq-btn ciq-btn-danger ciq-btn-small">
            Сдаюсь
          </button>
        </div>
        <p className="ciq-question-text">{currentQuestion.text}</p>
        {currentQuestion.questionImage && (
          <img
            src={chimiqItemImageUrl(currentQuestion.questionImage)}
            alt=""
            style={{ display: 'block', maxWidth: 220, maxHeight: 160, margin: '10px auto 0', borderRadius: 8 }}
          />
        )}
        {currentQuestion.helpText.length > 0 && (
          <div className="ciq-hint">
            {hintShown ? (
              <>
                <p className="ciq-hint-text">Подсказка: {currentQuestion.helpText}</p>
                {currentQuestion.hintImage && (
                  <img
                    src={chimiqItemImageUrl(currentQuestion.hintImage)}
                    alt=""
                    style={{ display: 'block', maxWidth: 220, maxHeight: 160, margin: '6px auto 0', borderRadius: 8 }}
                  />
                )}
              </>
            ) : (
              <button onClick={handleShowHint} className="ciq-btn ciq-btn-ghost ciq-btn-small">
                Показать подсказку
              </button>
            )}
          </div>
        )}
      </div>
      <div
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          display: 'flex',
          justifyContent: zoomed ? 'flex-start' : 'center',
          alignItems: 'flex-start',
          // «Крупнее» намеренно переключает overflow на auto: увеличенное
          // (scale) поле больше своего исходного места в раскладке, и без
          // прокрутки часть плиток снова стала бы физически недостижимой —
          // тот же класс проблемы, что уже был исправлен для обычного
          // размера (см. комментарий ниже), только по своей причине.
          overflow: zoomed ? 'auto' : 'hidden',
          paddingTop: 20,
          boxSizing: 'border-box',
        }}
      >
        {/* margin-top на этом блоке (вместо paddingTop на родителе) складывался
            ПОВЕРХ maxHeight: '100%' — родитель отводил 100% под сам блок, а
            margin ещё на 20px толкал его ниже, из-за чего последняя строка
            сетки на уровне 3 (самое частое соотношение сторон) на 14px
            вылезала за window.innerHeight вместе с иногда попадавшим туда
            correct-point. Найдено живым CDP-замером geometry после первой
            версии фикса — той же дисциплиной, что и сам баг. */}
        <div
          style={{
            position: 'relative',
            width: 'auto',
            height: 'auto',
            // «Крупнее» задаёт maxWidth В ПИКСЕЛЯХ картинки (не CSS
            // transform: scale) намеренно: transform не меняет размер,
            // который занимает элемент в потоке разметки, поэтому
            // прокручиваемый родитель не узнал бы о новом, большем размере
            // содержимого без хрупких margin-заглушек на глаз. Явный
            // pixel-width, наоборот, растит сам блок по обычной раскладке —
            // overflow:auto родителя получает корректные границы прокрутки
            // бесплатно.
            maxWidth: zoomed ? `${Math.round(imageWidth * ZOOM_SCALE)}px` : DISPLAY_MAX_WIDTH_CSS,
            maxHeight: zoomed ? 'none' : '100%',
            aspectRatio: `${imageWidth} / ${imageHeight}`,
            borderRadius: 10,
            overflow: 'hidden',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
            border: '2px solid var(--ciq-border)',
            transition: 'max-width 150ms ease',
          }}
        >
          <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', display: 'block' }} />
          {tiles.map((tile) => {
            const activeFeedback = feedback && feedback.key === tile.key ? feedback : null;
            return (
              <button
                key={tile.key}
                onClick={() => handleTileClick(tile)}
                style={{ ...pointStyle(tile, activeFeedback), ...pointPosition(tile) }}
                aria-label={tile.isCorrect ? 'correct-point' : `decoy-${tile.key}`}
              >
                {feedbackGlyph(activeFeedback)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default GameBoardScreen;
