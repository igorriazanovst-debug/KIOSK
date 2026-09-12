// packages/player/src/rusiq/screens/GameBoardScreen.tsx
import React, { useEffect, useRef, useState } from 'react';
import type { RusiqPoint, RusiqQuestion } from '../model/schema.ts';
import { scoreForAnswer, nextTurn, type RusiqAnswerEvent } from '../gameLogic.ts';
import '../rusiqTheme.css';

interface Props {
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  playerNames: string[];
  questionsByPlayer: RusiqQuestion[][];
  genericDecoyPoints: RusiqPoint[];
  onFinished: (answers: RusiqAnswerEvent[]) => void;
}

// Точки поля рендерятся в % от натурального размера изображения (раздел 5
// спеки), а не в абсолютных пикселях исходной картинки — сама картинка
// (1919×1080, см. rusiqContent.json `image`) показывается в ограниченном
// по ширине контейнере с сохранением пропорций через CSS `aspect-ratio`.
// Благодаря этому позиционирование корректно при любом фактическом размере
// показа: не нужно вручную пересчитывать масштаб-фактор для каждой точки.
const DISPLAY_MAX_WIDTH_CSS = 'min(1200px, 92vw)';

// Единый стиль для ВСЕХ точек в состоянии "не нажато" — правильный ответ,
// ложные точки текущего вопроса (`decoyPoints`) и общие ложные точки поля
// (`genericDecoyPoints`) визуально неотличимы (находка 6 финального ревью):
// иначе цвет точки сам по себе становится подсказкой правильного ответа.
const POINT_COLOR = 'rgba(90, 90, 90, 0.55)';
const POINT_RING = '2px solid rgba(255, 255, 255, 0.5)';

const GameBoardScreen: React.FC<Props> = ({ imageUrl, imageWidth, imageHeight, playerNames, questionsByPlayer, genericDecoyPoints, onFinished }) => {
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [questionIndexByPlayer, setQuestionIndexByPlayer] = useState<number[]>(() => playerNames.map(() => 0));
  const [elapsed, setElapsed] = useState(0);
  const [answers, setAnswers] = useState<RusiqAnswerEvent[]>([]);
  const [hintShown, setHintShown] = useState(false);

  // Защита от двойного advance() на один и тот же вопрос — единственная
  // точка входа для "истёк таймер"/"клик по точке"/"сдался", см. advance().
  const hasAnsweredRef = useRef(false);

  const currentQuestion = questionsByPlayer[currentPlayer][questionIndexByPlayer[currentPlayer]];

  // Обнуляет таймер и заводит секундный тик на каждый новый вопрос
  // (смена currentPlayer или его индекса вопроса). Само истечение времени
  // обрабатывается ОТДЕЛЬНЫМ эффектом ниже, реагирующим на `elapsed` — так
  // он всегда видит свежие currentQuestion/currentPlayer из замыкания
  // текущего рендера, без риска устаревшего замыкания внутри setInterval.
  useEffect(() => {
    setElapsed(0);
    setHintShown(false);
    hasAnsweredRef.current = false;
    const interval = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [currentPlayer, questionIndexByPlayer[currentPlayer]]);

  // Истечение времени вопроса (находка 4 финального ревью): раньше ничего
  // не вызывало advance() при elapsed >= timeSeconds, из-за чего вопрос
  // можно было держать открытым бесконечно. advance() сам себя защищает от
  // повторного вызова через hasAnsweredRef, поэтому даже если этот эффект
  // сработает несколько раз подряд, пока не остановился интервал/не
  // применился переход на новый вопрос, advance() выполнится не более
  // одного раза на вопрос.
  useEffect(() => {
    if (elapsed >= currentQuestion.timeSeconds) {
      advance({ playerIndex: currentPlayer, score: 0, correct: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed]);

  function advance(event: RusiqAnswerEvent) {
    if (hasAnsweredRef.current) return;
    hasAnsweredRef.current = true;

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

  function handleCorrectPointClick() {
    const score = scoreForAnswer(currentQuestion.price, currentQuestion.timeSeconds, elapsed, true);
    advance({ playerIndex: currentPlayer, score, correct: true });
  }

  function handleDecoyPointClick() {
    advance({ playerIndex: currentPlayer, score: 0, correct: false });
  }

  function handleGiveUp() {
    advance({ playerIndex: currentPlayer, score: 0, correct: false });
  }

  function handleShowHint() {
    setHintShown(true);
  }

  const remainingSeconds = Math.max(0, currentQuestion.timeSeconds - elapsed);
  const liveScore = scoreForAnswer(currentQuestion.price, currentQuestion.timeSeconds, elapsed, true);

  // Кликабельная область — прямоугольник со своими width/height у каждой
  // точки (то же пространство координат, что x/y), выражен в % от контейнера
  // (не в px): контейнер задан через aspect-ratio, поэтому % ширины/высоты
  // масштабируется ровно так же, как x/y в pointPosition ниже, при любом
  // фактическом размере показа. Раньше все точки были фиксированным 22px
  // КРУГОМ вне зависимости от точного пикселя клика — при высокой плотности
  // decoy-точек на одной видимой картинке-ответе (найдено живьём 2026-09-12)
  // это делало результат клика "куда-то в правильный ответ" непредсказуемым.
  // Первая попытка (просто увеличенный радиус круга) не решила суть: нужна
  // именно область, привязанная к силуэту/иконке конкретного ответа (обычно
  // прямоугольная плитка), а не абстрактный круг любого размера — обратная
  // связь пользователя после первой попытки.
  function pointStyle(point: { width: number; height: number }): React.CSSProperties {
    return {
      position: 'absolute',
      width: `${(point.width / imageWidth) * 100}%`,
      height: `${(point.height / imageHeight) * 100}%`,
      transform: 'translate(-50%, -50%)',
      borderRadius: 6,
      background: POINT_COLOR,
      border: POINT_RING,
      boxShadow: '0 0 6px rgba(0, 0, 0, 0.4)',
      padding: 0,
      cursor: 'pointer',
    };
  }

  function pointPosition(point: RusiqPoint): React.CSSProperties {
    return {
      left: `${(point.x / imageWidth) * 100}%`,
      top: `${(point.y / imageHeight) * 100}%`,
    };
  }

  return (
    <div className="riq-page" style={{ padding: 0 }}>
      <div className="riq-scoreboard">
        <span className="riq-scoreboard-item">
          Вопрос <strong>{questionIndexByPlayer[currentPlayer] + 1}</strong>/{questionsByPlayer[currentPlayer].length}
        </span>
        <span className="riq-scoreboard-item">
          Ходит: <strong>{playerNames[currentPlayer]}</strong>
        </span>
        <span className={`riq-scoreboard-item ${remainingSeconds <= 5 ? 'riq-scoreboard-timer-urgent' : 'riq-scoreboard-timer'}`}>
          Таймер: <strong>{remainingSeconds}с</strong>
        </span>
        <span className="riq-scoreboard-item">
          Очки сейчас: <strong>{liveScore}</strong>
        </span>
        <button onClick={handleGiveUp} className="riq-btn riq-btn-danger riq-btn-small">
          Сдаюсь
        </button>
      </div>
      <p className="riq-question-text">{currentQuestion.text}</p>
      {currentQuestion.helpText.length > 0 && (
        <div className="riq-hint">
          {hintShown ? (
            <p className="riq-hint-text">Подсказка: {currentQuestion.helpText}</p>
          ) : (
            <button onClick={handleShowHint} className="riq-btn riq-btn-ghost riq-btn-small">
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
          border: '2px solid var(--riq-border)',
        }}
      >
        <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', display: 'block' }} />
        {/* Общие ложные точки поля (спека, разд. 5) — видны постоянно, не зависят от текущего вопроса. */}
        {genericDecoyPoints.map((point, i) => (
          <button
            key={`generic-${i}`}
            onClick={handleDecoyPointClick}
            style={{ ...pointStyle(point), ...pointPosition(point) }}
            aria-label={`generic-decoy-${i}`}
          />
        ))}
        {/* Ложные точки ИМЕННО текущего вопроса. */}
        {currentQuestion.decoyPoints.map((point, i) => (
          <button
            key={`decoy-${i}`}
            onClick={handleDecoyPointClick}
            style={{ ...pointStyle(point), ...pointPosition(point) }}
            aria-label={`decoy-${i}`}
          />
        ))}
        {/* Точка правильного ответа — идентифицируется по ссылке на currentQuestion (не по координатам, не по стилю),
            поэтому клик по ней однозначен даже если совпадает по (x,y) с чужой decoy-точкой, а внешне она неотличима
            от ложных точек до клика (находка 6 финального ревью). */}
        <button
          onClick={handleCorrectPointClick}
          style={{ ...pointStyle(currentQuestion), ...pointPosition(currentQuestion) }}
          aria-label="correct-point"
        />
      </div>
    </div>
  );
};

export default GameBoardScreen;
