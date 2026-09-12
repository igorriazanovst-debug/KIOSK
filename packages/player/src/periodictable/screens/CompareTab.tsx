// packages/player/src/periodictable/screens/CompareTab.tsx
import React, { useState } from 'react';
import type { PeriodicElement } from '../model/schema.ts';
import { searchElements } from '../search.ts';
import { ELEMENT_FIELDS, displayFieldValue } from '../elementFields.ts';
import { MAX_COMPARE } from '../compareSelection.ts';

interface Props {
  elements: PeriodicElement[];
  selected: PeriodicElement[];
  onAdd: (el: PeriodicElement) => void;
  onRemove: (atomicNumber: number) => void;
}

const CompareTab: React.FC<Props> = ({ elements, selected, onAdd, onRemove }) => {
  const [query, setQuery] = useState('');
  const results = query.trim() ? searchElements(elements, query).slice(0, 6) : [];
  const atMax = selected.length >= MAX_COMPARE;

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 'bold', fontSize: 15, color: '#0d47a1', marginBottom: 4 }}>Сравнение элементов</div>
        <div style={{ fontSize: 13, color: '#607d8b' }}>
          Добавьте до {MAX_COMPARE} элементов, чтобы увидеть все характеристики рядом.
        </div>
      </div>

      {!atMax && (
        <div style={{ marginBottom: 12 }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найдите элемент, чтобы добавить"
            aria-label="Поиск элемента для сравнения"
            style={{ fontSize: 15, padding: '10px 14px', width: '100%', boxSizing: 'border-box', border: '1px solid #cfd8dc', borderRadius: 8, outline: 'none' }}
          />
          {results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {results.map((el) => {
                const alreadyIn = selected.some((s) => s.atomicNumber === el.atomicNumber);
                return (
                  <button
                    key={el.atomicNumber}
                    disabled={alreadyIn}
                    onClick={() => {
                      onAdd(el);
                      setQuery('');
                    }}
                    style={{
                      textAlign: 'left',
                      padding: '8px 12px',
                      background: alreadyIn ? '#eceff1' : '#fafafa',
                      border: '1px solid #eceff1',
                      borderRadius: 8,
                      cursor: alreadyIn ? 'not-allowed' : 'pointer',
                      color: alreadyIn ? '#90a4ae' : '#212121',
                    }}
                  >
                    № {el.atomicNumber} — {el.nameRu} ({el.symbol}) {alreadyIn ? '— уже добавлен' : ''}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      {atMax && (
        <div style={{ fontSize: 13, color: '#78909c', marginBottom: 12 }}>
          Достигнут максимум ({MAX_COMPARE}) — уберите элемент, чтобы добавить другой.
        </div>
      )}

      {selected.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: '#90a4ae' }}>Пока ничего не выбрано для сравнения.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 320 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 12, color: '#607d8b' }} />
                {selected.map((el) => (
                  <th key={el.atomicNumber} style={{ padding: '8px 10px', textAlign: 'left', minWidth: 160 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 'bold', fontSize: 15 }}>
                        {el.nameRu} ({el.symbol})
                      </span>
                      <button
                        onClick={() => onRemove(el.atomicNumber)}
                        aria-label={`Убрать ${el.nameRu} из сравнения`}
                        style={{ border: 'none', background: '#eceff1', borderRadius: 6, width: 22, height: 22, cursor: 'pointer', lineHeight: 1, color: '#37474f' }}
                      >
                        ✕
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ELEMENT_FIELDS.map((field, i) => (
                <tr key={field.key} style={{ background: i % 2 === 0 ? '#fafafa' : '#ffffff' }}>
                  <td style={{ padding: '8px 10px', fontSize: 13, color: '#607d8b', whiteSpace: 'nowrap' }}>{field.label}</td>
                  {selected.map((el) => (
                    <td key={el.atomicNumber} style={{ padding: '8px 10px', fontSize: 14 }}>
                      {displayFieldValue(field.getValue(el))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CompareTab;
