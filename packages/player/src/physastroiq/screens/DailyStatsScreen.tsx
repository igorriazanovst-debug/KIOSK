// packages/player/src/physastroiq/screens/DailyStatsScreen.tsx
//
// FR-010 ТЗ (строка 249): сводная статистика по всем участникам,
// прошедшим викторины, включая сводную статистику ЗА ОДИН ДЕНЬ. Доступен
// из режима учителя (та же область, что каталог викторин) — это
// отчётность, а не игровой экран.

import React, { useMemo, useState } from 'react';
import { aggregateSessionsByDay, todayDateKey } from '../dailyStats.ts';
import type { PhysastroiqSession } from '../model/schema.ts';
import '../physastroiqTheme.css';

interface Props {
  sessions: PhysastroiqSession[];
  onExit: () => void;
}

const DailyStatsScreen: React.FC<Props> = ({ sessions, onExit }) => {
  const summaries = useMemo(() => aggregateSessionsByDay(sessions), [sessions]);
  const today = todayDateKey();
  const [selectedDate, setSelectedDate] = useState<string>(() => (summaries.some((s) => s.dateKey === today) ? today : (summaries[0]?.dateKey ?? today)));

  const selected = summaries.find((s) => s.dateKey === selectedDate);

  return (
    <div className="ciq-page">
      <div className="ciq-page-medium" style={{ textAlign: 'center' }}>
        <h2 className="ciq-heading ciq-heading-hero">Статистика по дням</h2>
        <div className="ciq-divider" />

        {summaries.length === 0 ? (
          <p>Ещё не сыграно ни одной партии.</p>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
              {summaries.map((s) => (
                <button
                  key={s.dateKey}
                  onClick={() => setSelectedDate(s.dateKey)}
                  className={`ciq-btn ciq-btn-small ${s.dateKey === selectedDate ? '' : 'ciq-btn-muted'}`}
                >
                  {s.dateKey === today ? `Сегодня (${s.dateKey})` : s.dateKey}
                </button>
              ))}
            </div>

            {selected && selected.players.length > 0 ? (
              <table className="ciq-table">
                <thead>
                  <tr>
                    <th>Игрок</th>
                    <th>Партий</th>
                    <th>Сумма очков</th>
                    <th>Верных ответов</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.players.map((p) => (
                    <tr key={p.name}>
                      <td>{p.name}</td>
                      <td>{p.gamesPlayed}</td>
                      <td>
                        <strong style={{ color: 'var(--ciq-accent-strong)' }}>{p.totalScore}</strong>
                      </td>
                      <td>
                        {p.totalCorrect}/{p.totalQuestions}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>За эту дату данных нет.</p>
            )}
          </>
        )}

        <div style={{ marginTop: 20 }}>
          <button onClick={onExit} className="ciq-btn ciq-btn-muted">
            Назад
          </button>
        </div>
      </div>
    </div>
  );
};

export default DailyStatsScreen;
