// Справочные материалы: нормативные документы, литература, термины и сокращения.
import React, { useState } from 'react';
import type { EumkContent } from '../model/schema.ts';

type Tab = 'normative' | 'literature' | 'terms';

export default function ReferencesScreen({ content }: { content: EumkContent }) {
  const [tab, setTab] = useState<Tab>('normative');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const { normative, literature, terms } = content.references;
  const hit = (text: string) => q === '' || text.toLowerCase().includes(q);
  const tabs: { id: Tab; title: string; count: number }[] = [
    { id: 'normative', title: 'Нормативные документы', count: normative.length },
    { id: 'literature', title: 'Список литературы', count: literature.length },
    { id: 'terms', title: 'Термины и сокращения', count: terms.length },
  ];
  return (
    <div className="eumk-narrow">
      <h2>Справочные материалы</h2>
      <div className="eumk-tabs" role="group" aria-label="Вид справочника">
        {tabs.map((t) => (
          <button key={t.id} type="button" aria-pressed={tab === t.id} className={`eumk-chip${tab === t.id ? ' chosen' : ''}`} onClick={() => setTab(t.id)}>{t.title} ({t.count})</button>
        ))}
      </div>
      <input className="eumk-input" style={{ width: '100%', marginBottom: 16 }} aria-label="Поиск" placeholder="Поиск" value={query} onChange={(e) => setQuery(e.target.value)} />
      {tab === 'normative' && normative.filter((n) => hit(`${n.title} ${n.number}`)).map((n, i) => (
        <div key={i} className="eumk-card"><b>{n.title}</b><div className="eumk-muted">{[n.number, n.date].filter(Boolean).join(', ')}</div>{n.url && <div className="eumk-muted">{n.url}</div>}</div>
      ))}
      {tab === 'literature' && literature.filter((l) => hit(l.citation)).map((l, i) => (
        <div key={i} className="eumk-card">{l.citation}{l.url && <div className="eumk-muted">{l.url}</div>}</div>
      ))}
      {tab === 'terms' && terms.filter((t) => hit(`${t.term} ${t.definition}`)).map((t, i) => (
        <div key={i} className="eumk-card"><b>{t.term}</b><div>{t.definition}</div>{t.source && <div className="eumk-muted">{t.source}</div>}</div>
      ))}
    </div>
  );
}
