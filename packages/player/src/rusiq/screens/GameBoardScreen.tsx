// packages/player/src/rusiq/screens/GameBoardScreen.tsx
import React, { useEffect, useRef, useState } from 'react';
import type { RusiqPoint, RusiqQuestion } from '../model/schema.ts';
import { scoreForAnswer, nextTurn, type RusiqAnswerEvent } from '../gameLogic.ts';

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
const POINT_SIZE = 22;
const POINT_COLOR = 'rgba(90, 90, 90, 0.55)';

const GameBoardScreen: React.FC<Props> = ({ imageUrl, imageWidth, imageHeight, playerNames, questionsByPlayer, genericDecoyPoints, onFinished }) => {
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [questionIndexByPlayer, setQuestionIndexByPlayer] = useState<number[]>(() => playerNames.map(() => 0));
  const [elapsed, setElapsed] = useState(0);
  const [answers, setAnswers] = useState<RusiqAnswerEvent[]>([]);

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

  const remainingSeconds = Math.max(0, currentQuestion.timeSeconds - elapsed);
  const liveScore = scoreForAnswer(currentQuestion.price, currentQuestion.timeSeconds, elapsed, true);

  const pointStyle: React.CSSProperties = {
    position: 'absolute',
    width: POINT_SIZE,
    height: POINT_SIZE,
    transform: 'translate(-50%, -50%)',
    borderRadius: '50%',
    background: POINT_COLOR,
    border: 'none',
    padding: 0,
    cursor: 'pointer',
  };

  function pointPosition(point: RusiqPoint): React.CSSProperties {
    return {
      left: `${(point.x / imageWidth) * 100}%`,
      top: `${(point.y / imageHeight) * 100}%`,
    };
  }

  return (
    <div style={{ fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: 12, background: '#eee' }}>
        <span>Вопрос {questionIndexByPlayer[currentPlayer] + 1}/{questionsByPlayer[currentPlayer].length}</span>
        <span>Ходит: {playerNames[currentPlayer]}</span>
        <span>Таймер: {remainingSeconds}с</span>
        <span>Очки за верный ответ сейчас: {liveScore}</span>
        <button onClick={handleGiveUp}>Сдаюсь</button>
      </div>
      <p style={{ textAlign: 'center', fontSize: 20 }}>{currentQuestion.text}</p>
      <div
        style={{
          position: 'relative',
          width: DISPLAY_MAX_WIDTH_CSS,
          aspectRatio: `${imageWidth} / ${imageHeight}`,
          margin: '0 auto',
        }}
      >
        <img src={imageUrl} alt="" style={{ width: '100%', height: '100%', display: 'block' }} />
        {/* Общие ложные точки поля (спека, разд. 5) — видны постоянно, не зависят от текущего вопроса. */}
        {genericDecoyPoints.map((point, i) => (
          <button
            key={`generic-${i}`}
            onClick={handleDecoyPointClick}
            style={{ ...pointStyle, ...pointPosition(point) }}
            aria-label={`generic-decoy-${i}`}
          />
        ))}
        {/* Ложные точки ИМЕННО текущего вопроса. */}
        {currentQuestion.decoyPoints.map((point, i) => (
          <button
            key={`decoy-${i}`}
            onClick={handleDecoyPointClick}
            style={{ ...pointStyle, ...pointPosition(point) }}
            aria-label={`decoy-${i}`}
          />
        ))}
        {/* Точка правильного ответа — идентифицируется по ссылке на currentQuestion (не по координатам, не по стилю),
            поэтому клик по ней однозначен даже если совпадает по (x,y) с чужой decoy-точкой, а внешне она неотличима
            от ложных точек до клика (находка 6 финального ревью). */}
        <button
          onClick={handleCorrectPointClick}
          style={{ ...pointStyle, ...pointPosition(currentQuestion) }}
          aria-label="correct-point"
        />
      </div>
    </div>
  );
};

export default GameBoardScreen;
