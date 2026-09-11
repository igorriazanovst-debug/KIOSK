// packages/player/src/rusiq/screens/ResultsScreen.tsx
import React, { useState } from 'react';
import type { RusiqAnswerEvent } from '../gameLogic.ts';
import { summarizeResults } from '../gameLogic.ts';
import type { RusiqQuestion } from '../model/schema.ts';

interface Props {
  playerNames: string[];
  answers: RusiqAnswerEvent[];
  questionsByPlayer: RusiqQuestion[][];
  onRestart: () => void;
}

const ResultsScreen: React.FC<Props> = ({ playerNames, answers, questionsByPlayer, onRestart }) => {
  const [detailPlayer, setDetailPlayer] = useState<number | null>(null);
  const summaries = summarizeResults(playerNames, answers);

  if (detailPlayer !== null) {
    const playerAnswers = answers.filter((a) => a.playerIndex === detailPlayer);
    const playerQuestions = questionsByPlayer[detailPlayer];
    return (
      <div style={{ maxWidth: 600, margin: '40px auto', fontFamily: 'sans-serif' }}>
        <h2>Детализация: {playerNames[detailPlayer]}</h2>
        <ul>
          {playerAnswers.map((a, i) => (
            <li key={i} style={{ color: a.correct ? 'green' : 'red' }}>
              {playerQuestions[i]?.text} — {a.correct ? `верно, ${a.score} очков` : 'неверно'}
            </li>
          ))}
        </ul>
        <button onClick={() => setDetailPlayer(null)}>Назад к результатам</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <h2>Результаты</h2>
      <table style={{ margin: '0 auto', width: '100%' }}>
        <thead>
          <tr><th>Игрок</th><th>Очки</th><th>Верных</th><th></th></tr>
        </thead>
        <tbody>
          {summaries.map((s, i) => (
            <tr key={s.name}>
              <td>{s.name}</td>
              <td>{s.score}</td>
              <td>{s.correctCount}/{s.totalCount}</td>
              <td><button onClick={() => setDetailPlayer(i)}>Подробнее</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={onRestart} style={{ marginTop: 24, fontSize: 18, padding: '10px 24px' }}>Новая игра</button>
    </div>
  );
};

export default ResultsScreen;
