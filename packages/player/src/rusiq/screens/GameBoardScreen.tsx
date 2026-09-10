// packages/player/src/rusiq/screens/GameBoardScreen.tsx
import React, { useEffect, useState } from 'react';
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

const GameBoardScreen: React.FC<Props> = ({ imageUrl, imageWidth, imageHeight, playerNames, questionsByPlayer, genericDecoyPoints, onFinished }) => {
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [questionIndexByPlayer, setQuestionIndexByPlayer] = useState<number[]>(() => playerNames.map(() => 0));
  const [elapsed, setElapsed] = useState(0);
  const [answers, setAnswers] = useState<RusiqAnswerEvent[]>([]);

  const currentQuestion = questionsByPlayer[currentPlayer][questionIndexByPlayer[currentPlayer]];

  useEffect(() => {
    setElapsed(0);
    const interval = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [currentPlayer, questionIndexByPlayer[currentPlayer]]);

  function advance(event: RusiqAnswerEvent) {
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
      <div style={{ position: 'relative', width: imageWidth, height: imageHeight, margin: '0 auto' }}>
        <img src={imageUrl} width={imageWidth} height={imageHeight} alt="" />
        {/* Общие ложные точки поля (спека, разд. 5) — видны постоянно, не зависят от текущего вопроса. */}
        {genericDecoyPoints.map((point, i) => (
          <button
            key={`generic-${i}`}
            onClick={handleDecoyPointClick}
            style={{ position: 'absolute', left: point.x - 10, top: point.y - 10, width: 20, height: 20, borderRadius: '50%', background: '#999', border: 'none' }}
            aria-label={`generic-decoy-${i}`}
          />
        ))}
        {/* Ложные точки ИМЕННО текущего вопроса. */}
        {currentQuestion.decoyPoints.map((point, i) => (
          <button
            key={`decoy-${i}`}
            onClick={handleDecoyPointClick}
            style={{ position: 'absolute', left: point.x - 10, top: point.y - 10, width: 20, height: 20, borderRadius: '50%', background: 'red', border: 'none' }}
            aria-label={`decoy-${i}`}
          />
        ))}
        {/* Точка правильного ответа — идентифицируется по ссылке на currentQuestion (не по координатам), поэтому клик по ней однозначен даже если совпадает по (x,y) с чужой decoy-точкой. */}
        <button
          onClick={handleCorrectPointClick}
          style={{ position: 'absolute', left: currentQuestion.x - 10, top: currentQuestion.y - 10, width: 20, height: 20, borderRadius: '50%', background: 'red', border: 'none' }}
          aria-label="correct-point"
        />
      </div>
    </div>
  );
};

export default GameBoardScreen;
