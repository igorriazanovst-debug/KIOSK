import React, { useState } from 'react';
import type { PeriodicTableWidgetProperties } from '@kiosk/shared';
import { PeriodicTableContentSchema, type PeriodicElement } from './model/schema.ts';
import TableScreen from './screens/TableScreen.tsx';
import type { ColorIndicationMode, HighlightMode } from './viewTypes.ts';
import ElementSummaryCard from './screens/ElementSummaryCard.tsx';
import ElementDetailCard from './screens/ElementDetailCard.tsx';
import type { TableForm } from './tableLayout.ts';
import elementsJson from './content/elements.json' with { type: 'json' };

interface Props {
  properties: PeriodicTableWidgetProperties;
}

const { elements } = PeriodicTableContentSchema.parse(elementsJson);

type CardMode = 'none' | 'summary' | 'detail';

const PeriodicTableRuntime: React.FC<Props> = () => {
  const [form, setForm] = useState<TableForm>('short');
  const [colorIndication, setColorIndication] = useState<ColorIndicationMode>('class');
  const [highlight, setHighlight] = useState<HighlightMode>('none');
  const [selected, setSelected] = useState<PeriodicElement | null>(null);
  const [cardMode, setCardMode] = useState<CardMode>('none');

  function selectElement(el: PeriodicElement) {
    setSelected(el);
    setCardMode('summary');
  }

  function closeCard() {
    setCardMode('none');
    setSelected(null);
  }

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto', fontFamily: 'sans-serif' }}>
      <TableScreen
        elements={elements}
        form={form}
        colorIndication={colorIndication}
        highlight={highlight}
        onSelectElement={selectElement}
      />
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
