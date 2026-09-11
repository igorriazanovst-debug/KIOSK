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
        style={{ fontSize: 18, padding: 8, width: '100%', boxSizing: 'border-box' }}
      />
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {results.map((el) => (
          <li key={el.atomicNumber}>
            <button
              onClick={() => { onHighlightChange(el.symbol); onSelectElement(el); }}
              style={{ width: '100%', textAlign: 'left', padding: 8 }}
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
