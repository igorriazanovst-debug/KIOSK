// Кейсы: профессиональная ситуация, вопросы и эталонный разбор по запросу.
import React, { useState } from 'react';
import type { EumkContent } from '../model/schema.ts';

export default function CasesScreen({ content }: { content: EumkContent }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const current = content.cases.find((c) => c.id === openId) ?? null;

  if (!current) {
    return (
      <div className="eumk-narrow">
        <h2>Кейсы</h2>
        <div className="eumk-tiles">
          {content.cases.map((c) => (
            <button key={c.id} type="button" className="eumk-tile" onClick={() => setOpenId(c.id)}>
              <b>{c.title}</b>
              <span>{c.group}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="eumk-narrow">
      <button type="button" className="eumk-btn" onClick={() => setOpenId(null)}>← Все кейсы</button>
      <h2 style={{ marginTop: 16 }}>{current.title}</h2>
      {current.group && <p className="eumk-muted">{current.group}</p>}
      <div className="eumk-card"><b>Ситуация.</b> {current.situation}</div>
      {current.questions.map((q, i) => {
        const key = `${current.id}-${i}`;
        return (
          <div key={key} className="eumk-card">
            <b>{i + 1}. {q.q}</b>
            <p className="eumk-muted">Сформулируйте свой ответ, затем сравните с эталонным разбором.</p>
            {shown[key] ? <div className="eumk-note good">{q.model}</div> : <button type="button" className="eumk-btn" onClick={() => setShown({ ...shown, [key]: true })}>Показать разбор</button>}
          </div>
        );
      })}
      {current.criteria.length > 0 && (
        <details className="eumk-card">
          <summary>Критерии оценки ответа</summary>
          <ul>{current.criteria.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </details>
      )}
    </div>
  );
}
