import React, { useState } from 'react';
import type { PeriodicTableWidgetProperties } from '@kiosk/shared';
import { PeriodicTableContentSchema, type PeriodicElement } from './model/schema.ts';
import TableScreen from './screens/TableScreen.tsx';
import type { ColorIndicationMode, HighlightMode } from './viewTypes.ts';
import ElementSummaryCard from './screens/ElementSummaryCard.tsx';
import ElementDetailCard from './screens/ElementDetailCard.tsx';
import SearchTab from './screens/SearchTab.tsx';
import type { TableForm } from './tableLayout.ts';
import elementsJson from './content/elements.json' with { type: 'json' };

interface Props {
  properties: PeriodicTableWidgetProperties;
}

const { elements } = PeriodicTableContentSchema.parse(elementsJson);

type CardMode = 'none' | 'summary' | 'detail';
type BottomTab = 'none' | 'search' | 'viewSettings' | 'legend';

const PeriodicTableRuntime: React.FC<Props> = ({ properties }) => {
  const [form, setForm] = useState<TableForm>('short');
  const [colorIndication, setColorIndication] = useState<ColorIndicationMode>('class');
  const [highlight, setHighlight] = useState<HighlightMode>('none');
  const [selected, setSelected] = useState<PeriodicElement | null>(null);
  const [cardMode, setCardMode] = useState<CardMode>('none');
  const [activeTab, setActiveTab] = useState<BottomTab>('none');
  const [highlightedSymbol, setHighlightedSymbol] = useState<string | null>(null);

  function selectElement(el: PeriodicElement) {
    setSelected(el);
    setCardMode('summary');
  }

  function closeCard() {
    setCardMode('none');
    setSelected(null);
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <TableScreen
          elements={elements}
          form={form}
          colorIndication={colorIndication}
          highlight={highlight}
          highlightedSymbol={highlightedSymbol}
          onSelectElement={selectElement}
        />
      </div>

      <div style={{ display: 'flex', borderTop: '1px solid #ccc' }}>
        <button onClick={() => setActiveTab(activeTab === 'search' ? 'none' : 'search')} style={{ flex: 1, padding: 12 }}>Поиск</button>
        <button onClick={() => setActiveTab(activeTab === 'viewSettings' ? 'none' : 'viewSettings')} style={{ flex: 1, padding: 12 }}>Настройки вида</button>
        <button onClick={() => setActiveTab(activeTab === 'legend' ? 'none' : 'legend')} style={{ flex: 1, padding: 12 }}>Легенда</button>
      </div>

      {activeTab === 'search' && (
        <div style={{ maxHeight: '40vh', overflow: 'auto', borderTop: '1px solid #ccc' }}>
          <SearchTab elements={elements} onSelectElement={selectElement} onHighlightChange={setHighlightedSymbol} />
        </div>
      )}
      {/* activeTab === 'viewSettings' — заполняется Задачей 9 */}
      {/* activeTab === 'legend' — заполняется Задачей 10 */}

      {selected && cardMode !== 'none' && (
        <div
          onClick={closeCard}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div onClick={(e) => e.stopPropagation()}>
            {cardMode === 'summary' && (
              <ElementSummaryCard element={selected} onMoreDetails={() => setCardMode('detail')} onClose={closeCard} />
            )}
            {cardMode === 'detail' && <ElementDetailCard element={selected} onClose={closeCard} />}
          </div>
        </div>
      )}
    </div>
  );
};

export default PeriodicTableRuntime;
