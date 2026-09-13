// packages/player/src/periodictable/screens/SearchTab.tsx
import React, { useState } from 'react';
import type { PeriodicElement } from '../model/schema.ts';
import { searchElements } from '../search.ts';

interface Props {
  elements: PeriodicElement[];
  onSelectElement: (el: PeriodicElement) => void;
  onHighlightChange: (symbol: string | null) => void;
}

const SearchTab: React.FC<Props> = ({ elements, onSelectElement, onHighlightChange }) => {
  const [query, setQuery] = useState('');
  const results = searchElements(elements, query);

  function handleChange(value: string) {
    setQuery(value);
    const found = searchElements(elements, value);
    onHighlightChange(found.length === 1 ? found[0].symbol : null);
  }

  return (
    <div style={{ padding: 16 }}>
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Название, номер, символ или масса"
        aria-label="Поиск химического элемента"
        style={{
          fontSize: 18,
          padding: '10px 14px',
          width: '100%',
          boxSizing: 'border-box',
          border: '1px solid #cfd8dc',
          borderRadius: 8,
          outline: 'none',
        }}
      />
      <ul style={{ listStyle: 'none', padding: 0, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {results.map((el) => (
          <li key={el.atomicNumber}>
            <button
              className="periodictable-cell"
              onClick={() => { onHighlightChange(el.symbol); onSelectElement(el); }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 14px',
                background: '#fafafa',
                border: '1px solid #eceff1',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 15,
              }}
            >
              № {el.atomicNumber} — {el.nameRu} ({el.symbol})
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SearchTab;
