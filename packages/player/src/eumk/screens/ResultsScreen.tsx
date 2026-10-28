// История результатов итогового теста текущей учётной записи.
import React from 'react';
import { formatDuration } from '../testEngine.ts';
import type { TestResult } from '../model/schema.ts';

export default function ResultsScreen({ results }: { results: TestResult[] }) {
  if (results.length === 0) return <div className="eumk-narrow"><h2>Мои результаты</h2><p className="eumk-muted">Итоговый тест ещё не проходили.</p></div>;
  return (
    <div className="eumk-narrow">
      <h2>Мои результаты</h2>
      <table className="eumk-table">
        <thead><tr><th>Дата</th><th>Баллы</th><th>Отметка</th><th>Время</th></tr></thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.id}>
              <td>{new Date(r.finishedAt).toLocaleString('ru-RU')}</td>
              <td>{r.correct} из {r.total}</td>
              <td>{r.grade}</td>
              <td>{formatDuration(r.durationSeconds)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
