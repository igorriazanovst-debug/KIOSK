// packages/player/src/rusiq/screens/ResultsScreen.tsx
import React, { useState } from 'react';
import type { RusiqAnswerEvent } from '../gameLogic.ts';
import { summarizeResults } from '../gameLogic.ts';
import type { RusiqQuestion } from '../model/schema.ts';
import '../rusiqTheme.css';

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
      <div className="riq-page">
        <div className="riq-page-medium">
          <h2 className="riq-heading riq-heading-section" style={{ textAlign: 'center' }}>
            Детализация: {playerNames[detailPlayer]}
          </h2>
          <div className="riq-divider" />
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {playerAnswers.map((a, i) => (
              <li key={i} className={a.correct ? 'riq-result-correct' : 'riq-result-wrong'} style={{ padding: '8px 0', borderBottom: '1px solid var(--riq-border-soft)' }}>
                {playerQuestions[i]?.text} — {a.correct ? `верно, ${a.score} очков` : 'неверно'}
              </li>
            ))}
          </ul>
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button onClick={() => setDetailPlayer(null)} className="riq-btn riq-btn-muted">
              Назад к результатам
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="riq-page">
      <div className="riq-page-medium" style={{ textAlign: 'center' }}>
        <h2 className="riq-heading riq-heading-hero">Результаты</h2>
        <div className="riq-divider" />
        <table className="riq-table">
          <thead>
            <tr>
              <th>Игрок</th>
              <th>Очки</th>
              <th>Верных</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((s, i) => (
              <tr key={s.name}>
                <td>{s.name}</td>
                <td>
                  <strong style={{ color: 'var(--riq-gold-strong)' }}>{s.score}</strong>
                </td>
                <td>
                  {s.correctCount}/{s.totalCount}
                </td>
                <td>
                  <button onClick={() => setDetailPlayer(i)} className="riq-btn riq-btn-muted riq-btn-small">
                    Подробнее
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={onRestart} className="riq-btn riq-btn-lg">
          Новая игра
        </button>
      </div>
    </div>
  );
};

export default ResultsScreen;
