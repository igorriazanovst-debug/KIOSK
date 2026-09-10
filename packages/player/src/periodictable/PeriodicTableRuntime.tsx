import React, { useState } from 'react';
import type { PeriodicTableWidgetProperties } from '@kiosk/shared';
import { PeriodicTableContentSchema, type PeriodicElement } from './model/schema.ts';
import TableScreen from './screens/TableScreen.tsx';
import type { ColorIndicationMode, HighlightMode } from './viewTypes.ts';
import type { TableForm } from './tableLayout.ts';
import elementsJson from './content/elements.json' with { type: 'json' };

interface Props {
  properties: PeriodicTableWidgetProperties;
}

const { elements } = PeriodicTableContentSchema.parse(elementsJson);

const PeriodicTableRuntime: React.FC<Props> = () => {
  const [form, setForm] = useState<TableForm>('short');
  const [colorIndication, setColorIndication] = useState<ColorIndicationMode>('class');
  const [highlight, setHighlight] = useState<HighlightMode>('none');
  const [selected, setSelected] = useState<PeriodicElement | null>(null);

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto', fontFamily: 'sans-serif' }}>
      <TableScreen
        elements={elements}
        form={form}
        colorIndication={colorIndication}
        highlight={highlight}
        onSelectElement={setSelected}
      />
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', padding: 24, borderRadius: 8, maxWidth: 480 }}>
            <h2>{selected.nameRu} ({selected.symbol})</h2>
            <p>№ {selected.atomicNumber}, масса {selected.atomicMass}</p>
            <button onClick={() => setSelected(null)}>Закрыть</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PeriodicTableRuntime;
