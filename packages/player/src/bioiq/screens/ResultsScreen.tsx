// packages/player/src/bioiq/screens/ResultsScreen.tsx
import React, { useState } from 'react';
import type { BioiqAnswerEvent } from '../gameLogic.ts';
import { summarizeResults } from '../gameLogic.ts';
import type { BioiqQuestion } from '../model/schema.ts';
import { bioiqItemImageUrl } from '../bioiqMediaUrl.ts';
import '../bioiqTheme.css';

interface Props {
  playerNames: string[];
  answers: BioiqAnswerEvent[];
  questionsByPlayer: BioiqQuestion[][];
  onRestart: () => void;
}

const ResultsScreen: React.FC<Props> = ({ playerNames, answers, questionsByPlayer, onRestart }) => {
  const [detailPlayer, setDetailPlayer] = useState<number | null>(null);
  const summaries = summarizeResults(playerNames, answers);

  if (detailPlayer !== null) {
    const playerAnswers = answers.filter((a) => a.playerIndex === detailPlayer);
    const playerQuestions = questionsByPlayer[detailPlayer];
    return (
      <div className="ciq-page">
        <div className="ciq-page-medium">
          <h2 className="ciq-heading ciq-heading-section" style={{ textAlign: 'center' }}>
            Детализация: {playerNames[detailPlayer]}
          </h2>
          <div className="ciq-divider" />
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {playerAnswers.map((a, i) => (
              <li
                key={i}
                className={a.correct ? 'ciq-result-correct' : 'ciq-result-wrong'}
                style={{ padding: '8px 0', borderBottom: '1px solid var(--ciq-border-soft)', display: 'flex', alignItems: 'center', gap: 10 }}
              >
                {playerQuestions[i]?.answerImage && (
                  <img
                    src={bioiqItemImageUrl(playerQuestions[i].answerImage as string)}
                    alt=""
                    style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }}
                  />
                )}
                <span>
                  {playerQuestions[i]?.text} — {a.correct ? `верно, ${a.score} очков` : 'неверно'}
                </span>
              </li>
            ))}
          </ul>
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button onClick={() => setDetailPlayer(null)} className="ciq-btn ciq-btn-muted">
              Назад к результатам
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ciq-page">
      <div className="ciq-page-medium" style={{ textAlign: 'center' }}>
        <h2 className="ciq-heading ciq-heading-hero">Результаты</h2>
        <div className="ciq-divider" />
        <table className="ciq-table">
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
                  <strong style={{ color: 'var(--ciq-accent-strong)' }}>{s.score}</strong>
                </td>
                <td>
                  {s.correctCount}/{s.totalCount}
                </td>
                <td>
                  <button onClick={() => setDetailPlayer(i)} className="ciq-btn ciq-btn-muted ciq-btn-small">
                    Подробнее
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={onRestart} className="ciq-btn ciq-btn-lg">
          Новая игра
        </button>
      </div>
    </div>
  );
};

export default ResultsScreen;
