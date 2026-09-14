// packages/player/src/chimiq/screens/GameBoardScreen.tsx
import React, { useEffect, useRef, useState } from 'react';
import type { ChimiqPoint, ChimiqQuestion } from '../model/schema.ts';
import { scoreForAnswer, nextTurn, type ChimiqAnswerEvent } from '../gameLogic.ts';
import { chimiqItemImageUrl } from '../chimiqMediaUrl.ts';
import '../chimiqTheme.css';

interface Props {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  playerNames: string[];
  questionsByPlayer: ChimiqQuestion[][];
  genericDecoyPoints: ChimiqPoint[];
  onFinished: (answers: ChimiqAnswerEvent[]) => void;
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

const POINT_COLOR = 'rgba(90, 90, 90, 0.28)';
const POINT_RING = '2px solid rgba(255, 255, 255, 0.5)';
const FEEDBACK_CORRECT_COLOR = 'rgba(62, 207, 126, 0.85)';
const FEEDBACK_WRONG_COLOR = 'rgba(255, 107, 107, 0.85)';
const FEEDBACK_DURATION_MS = 900;

interface BoardTile {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isCorrect: boolean;
}

function tileKey(point: { x: number; y: number }): string {
  return `${Math.round(point.x)}_${Math.round(point.y)}`;
}

function buildTiles(question: ChimiqQuestion, genericDecoyPoints: ChimiqPoint[]): BoardTile[] {
  const correctKey = tileKey(question);
  const map = new Map<string, BoardTile>();
  for (const p of genericDecoyPoints) {
    const key = tileKey(p);
    map.set(key, { key, x: p.x, y: p.y, width: p.width, height: p.height, isCorrect: key === correctKey });
  }
  for (const p of question.decoyPoints) {
    const key = tileKey(p);
    map.set(key, { key, x: p.x, y: p.y, width: p.width, height: p.height, isCorrect: key === correctKey });
  }
  map.set(correctKey, { key: correctKey, x: question.x, y: question.y, width: question.width, height: question.height, isCorrect: true });
  return Array.from(map.values());
}

const GameBoardScreen: React.FC<Props> = ({ imageUrl, imageWidth, imageHeight, playerNames, questionsByPlayer, genericDecoyPoints, onFinished }) => {
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [questionIndexByPlayer, setQuestionIndexByPlayer] = useState<number[]>(() => playerNames.map(() => 0));
  const [elapsed, setElapsed] = useState(0);
  const [answers, setAnswers] = useState<ChimiqAnswerEvent[]>([]);
  const [hintShown, setHintShown] = useState(false);
  const [feedback, setFeedback] = useState<{ key: string; correct: boolean } | null>(null);

  const hasAnsweredRef = useRef(false);
  const feedbackTimeoutRef = useRef<number | null>(null);

  const currentQuestion = questionsByPlayer[currentPlayer][questionIndexByPlayer[currentPlayer]];
  const tiles = buildTiles(currentQuestion, genericDecoyPoints);

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

  function handleTileClick(tile: BoardTile) {
    if (hasAnsweredRef.current) return;
    hasAnsweredRef.current = true;
    const correct = tile.isCorrect;
    const score = correct ? scoreForAnswer(currentQuestion.price, currentQuestion.timeSeconds, elapsed, true) : 0;
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
    };
  }

  function pointPosition(point: ChimiqPoint): React.CSSProperties {
    return {
      left: `${(point.x / imageWidth) * 100}%`,
      top: `${(point.y / imageHeight) * 100}%`,
    };
  }

  return (
    <div className="ciq-page" style={{ padding: 0 }}>
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
      <div
        style={{
          position: 'relative',
          width: DISPLAY_MAX_WIDTH_CSS,
          aspectRatio: `${imageWidth} / ${imageHeight}`,
          margin: '20px auto 0',
          borderRadius: 10,
          overflow: 'hidden',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5)',
          border: '2px solid var(--ciq-border)',
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
            />
          );
        })}
      </div>
    </div>
  );
};

export default GameBoardScreen;
