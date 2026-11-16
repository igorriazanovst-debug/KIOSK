// Теория: блоки и разделы, таблицы, блок-схемы, иллюстрации, примеры.
// Последний прочитанный раздел запоминается per-обучающийся (localStorage):
// повторный вход продолжает с места остановки, а не с первого раздела.
import React, { useEffect, useState } from 'react';
import type { EumkContent } from '../model/schema.ts';
import { splitParagraphs } from '../theoryText.ts';

type Section = EumkContent['theory'][number]['sections'][number];

function lastSectionKey(contentId: string, accountId?: string): string {
  return `eumk:${contentId}:theory:last${accountId ? ':' + accountId : ''}`;
}

function readLastSection(content: EumkContent, key: string): { blockId: string; sectionId: string } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length !== 2) return null;
    const [b, s] = parsed;
    const block = content.theory.find((x) => x.id === b);
    if (block && block.sections.some((x) => x.id === s)) return { blockId: b, sectionId: s };
  } catch {
    // повреждённая запись — начинаем с первого раздела
  }
  return null;
}

function SectionView({ section }: { section: Section }) {
  return (
    <article>
      <h2>{section.title}</h2>
      {splitParagraphs(section.text).map((p, i) => <p key={i}>{p}</p>)}
      {section.keyPoints.length > 0 && (
        <div className="eumk-card">
          <b>Главное</b>
          <ul>{section.keyPoints.map((k, i) => <li key={i}>{k}</li>)}</ul>
        </div>
      )}
      {section.table && (
        <div style={{ overflowX: 'auto' }}>
          <table className="eumk-table">
            <thead><tr>{section.table.headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
            <tbody>{section.table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
      {section.scheme && (
        <div className="eumk-scheme" aria-label="Блок-схема">
          {section.scheme.map((s, i) => (
            <React.Fragment key={i}>
              <div className="eumk-step">{s.step}</div>
              {i < section.scheme!.length - 1 && <div className="eumk-arrow">↓ {s.next ?? ''}</div>}
            </React.Fragment>
          ))}
        </div>
      )}
      {section.illustration && (
        <figure className="eumk-card" style={{ margin: '0 0 16px' }}>
          <figcaption><b>{section.illustration.caption}</b></figcaption>
          <p className="eumk-muted">{section.illustration.description}</p>
        </figure>
      )}
      {section.example && (
        <div className="eumk-note info">
          <b>Пример для ученика.</b> {section.example.task}
          {section.example.expected && <div className="eumk-muted">Ожидаемый результат: {section.example.expected}</div>}
        </div>
      )}
      {section.sources.length > 0 && (
        <details>
          <summary>Источники</summary>
          <ul>{section.sources.map((s, i) => <li key={i}>{s.title}{s.url ? ` - ${s.url}` : ''}</li>)}</ul>
        </details>
      )}
    </article>
  );
}

export default function TheoryScreen({ content, accountId }: { content: EumkContent; accountId?: string }) {
  const storageKey = lastSectionKey(content.id, accountId);
  const saved = readLastSection(content, storageKey);
  const [blockId, setBlockId] = useState(saved?.blockId ?? content.theory[0].id);
  const block = content.theory.find((b) => b.id === blockId) ?? content.theory[0];
  const [sectionId, setSectionId] = useState(saved?.sectionId ?? block.sections[0].id);
  const section = block.sections.find((s) => s.id === sectionId) ?? block.sections[0];
  const index = block.sections.indexOf(section);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify([blockId, sectionId]));
    } catch {
      // localStorage недоступен — продолжение просто не сохранится
    }
  }, [storageKey, blockId, sectionId]);

  const pickBlock = (id: string) => {
    setBlockId(id);
    setSectionId(content.theory.find((b) => b.id === id)!.sections[0].id);
  };

  return (
    <div className="eumk-split">
      {saved && section.id === saved.sectionId && (
        <div className="eumk-note info" style={{ gridColumn: '1 / -1', marginBottom: 12 }}>
          Продолжаем с раздела, где вы остановились: «{section.title}».
        </div>
      )}
      <nav className="eumk-nav" aria-label="Содержание">
        {content.theory.map((b) => (
          <div key={b.id}>
            <button type="button" className={`eumk-btn${b.id === block.id ? ' active' : ''}`} onClick={() => pickBlock(b.id)}>{b.title}</button>
            {b.id === block.id && b.sections.map((s) => (
              <button key={s.id} type="button" className={`eumk-chip${s.id === section.id ? ' chosen' : ''}`} style={{ display: 'block', margin: '0 0 6px 16px', width: 'calc(100% - 16px)', textAlign: 'left', borderRadius: 10 }}
                onClick={() => setSectionId(s.id)}>{s.title}</button>
            ))}
          </div>
        ))}
      </nav>
      <div>
        <SectionView section={section} />
        <div className="eumk-row" style={{ marginTop: 16 }}>
          <button type="button" className="eumk-btn" disabled={index === 0} onClick={() => setSectionId(block.sections[index - 1].id)}>← Назад</button>
          <button type="button" className="eumk-btn primary" disabled={index === block.sections.length - 1} onClick={() => setSectionId(block.sections[index + 1].id)}>Дальше →</button>
        </div>
      </div>
    </div>
  );
}
