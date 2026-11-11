// Результаты группы (K5-2/K5-3): преподаватель видит итоги всех
// обучающихся, сбрасывает пароли и выгружает данные - CSV-файлом или на
// печать. Результаты только читаются; единственное изменение - сброс
// пароля обучающегося (после сброса ученик задаёт новый при входе).
import React, { useMemo, useState } from 'react';
import { formatDuration } from '../testEngine.ts';
import type { EumkUserData } from '../model/schema.ts';
import { buildResultsHtml, resultsToCsv, rowsOf, studentsOf } from '../teacher.ts';

interface Props {
  data: EumkUserData;
  onResetPassword: (accountId: string) => void; // сброс пароля обучающегося
}

export default function TeacherScreen({ data, onResetPassword }: Props) {
  const [filter, setFilter] = useState<string>('');
  const [resetId, setResetId] = useState<string | null>(null);
  const students = useMemo(() => studentsOf(data), [data]);
  const rows = useMemo(() => rowsOf(data, filter === '' ? null : filter), [data, filter]);
  const studentName = (id: string) => students.find((s) => s.id === id)?.name ?? '—';

  const exportCsv = () => {
    // BOM - чтобы Excel открыл файл с кириллицей корректно.
    const blob = new Blob([`﻿${resultsToCsv(rows)}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filter === '' ? 'итоги-группы.csv' : `итоги-${studentName(filter)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const print = () => {
    const title = filter === '' ? 'Итоги группы' : `Итоги: ${studentName(filter)}`;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return; // блокировка всплывающих окон - молча не исчезаем
    win.document.write(buildResultsHtml(rows, title));
    win.document.close();
    win.focus();
    win.print();
  };

  const confirmReset = () => {
    if (resetId !== null) {
      onResetPassword(resetId);
      setResetId(null);
    }
  };

  return (
    <div className="eumk-narrow">
      <h2>Результаты группы</h2>
      <div className="eumk-row" style={{ flexWrap: 'wrap', gap: 8 }}>
        <select className="eumk-input" aria-label="Обучающийся" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Все обучающиеся</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button type="button" className="eumk-btn" onClick={exportCsv}>Экспорт CSV</button>
        <button type="button" className="eumk-btn" onClick={print}>Печать</button>
      </div>

      {rows.length === 0 ? (
        <p className="eumk-muted">Итоговый тест ещё никто не проходил.</p>
      ) : (
        <table className="eumk-table">
          <thead><tr><th>Обучающийся</th><th>Дата</th><th>Баллы</th><th>Отметка</th><th>Время</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.studentName}</td>
                <td>{new Date(r.result.finishedAt).toLocaleString('ru-RU')}</td>
                <td>{r.result.correct} из {r.result.total}</td>
                <td>{r.result.grade}</td>
                <td>{formatDuration(r.result.durationSeconds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>Сброс пароля обучающегося</h3>
      <p className="eumk-muted">После сброса обучающийся задаст новый пароль при следующем входе. Другие данные не затрагиваются.</p>
      <div className="eumk-row" style={{ flexWrap: 'wrap', gap: 8 }}>
        <select className="eumk-input" aria-label="Сброс: обучающийся" value={resetId ?? ''} onChange={(e) => setResetId(e.target.value || null)}>
          <option value="">Выберите обучающегося…</option>
          {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button type="button" className="eumk-btn" disabled={resetId === null} onClick={confirmReset}>Сбросить пароль</button>
      </div>
    </div>
  );
}
