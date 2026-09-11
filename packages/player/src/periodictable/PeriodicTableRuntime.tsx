// packages/player/src/periodictable/PeriodicTableRuntime.tsx
import React, { useEffect, useState } from 'react';
import type { PeriodicTableWidgetProperties } from '@kiosk/shared';
import { PeriodicTableContentSchema, type PeriodicElement } from './model/schema.ts';
import TableScreen from './screens/TableScreen.tsx';
import ElementSummaryCard from './screens/ElementSummaryCard.tsx';
import ElementDetailCard from './screens/ElementDetailCard.tsx';
import SearchTab from './screens/SearchTab.tsx';
import ViewSettingsTab from './screens/ViewSettingsTab.tsx';
import LegendTab from './screens/LegendTab.tsx';
import TeacherPinModal from './screens/TeacherPinModal.tsx';
import { loadViewSettings, saveViewSettings, DEFAULT_VIEW_SETTINGS, type ViewSettings } from './viewSettingsStorage.ts';
import elementsJson from './content/elements.json' with { type: 'json' };

interface Props {
  properties: PeriodicTableWidgetProperties;
}

const { elements } = PeriodicTableContentSchema.parse(elementsJson);

type CardMode = 'none' | 'summary' | 'detail';
type BottomTab = 'none' | 'search' | 'viewSettings' | 'legend';

const PeriodicTableRuntime: React.FC<Props> = ({ properties }) => {
  const [viewSettings, setViewSettings] = useState<ViewSettings>(DEFAULT_VIEW_SETTINGS);
  const [selected, setSelected] = useState<PeriodicElement | null>(null);
  const [cardMode, setCardMode] = useState<CardMode>('none');
  const [activeTab, setActiveTab] = useState<BottomTab>('none');
  const [highlightedSymbol, setHighlightedSymbol] = useState<string | null>(null);
  const [viewSettingsUnlocked, setViewSettingsUnlocked] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);

  useEffect(() => {
    setViewSettings(loadViewSettings());
  }, []);

  function updateViewSettings(next: ViewSettings) {
    setViewSettings(next);
    saveViewSettings(next);
  }

  function selectElement(el: PeriodicElement) {
    setSelected(el);
    setCardMode('summary');
  }

  function closeCard() {
    setCardMode('none');
    setSelected(null);
  }

  // Подсветка найденного элемента живёт только пока открыт Поиск: иначе
  // ученик, сузивший выдачу до одного элемента и закрывший вкладку, остаётся
  // с намертво обведённой ячейкой и без единого видимого способа её снять.
  function openTab(tab: BottomTab) {
    if (tab !== 'search') setHighlightedSymbol(null);
    setActiveTab(tab);
  }

  function handleViewSettingsTabClick() {
    if (activeTab === 'viewSettings') {
      openTab('none');
      return;
    }
    const pin = properties.teacherPin ?? '0000';
    if (viewSettingsUnlocked || !pin) {
      openTab('viewSettings');
    } else {
      setShowPinModal(true);
    }
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: 'sans-serif' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <TableScreen
          elements={elements}
          form={viewSettings.tableForm}
          colorIndication={viewSettings.colorIndication}
          highlight={viewSettings.highlight}
          highlightedSymbol={highlightedSymbol}
          onSelectElement={selectElement}
        />
      </div>

      <div style={{ display: 'flex', borderTop: '1px solid #ccc' }}>
        <button onClick={() => openTab(activeTab === 'search' ? 'none' : 'search')} style={{ flex: 1, padding: 12 }}>Поиск</button>
        <button onClick={handleViewSettingsTabClick} style={{ flex: 1, padding: 12 }}>Настройки вида {!viewSettingsUnlocked ? '🔒' : ''}</button>
        <button onClick={() => openTab(activeTab === 'legend' ? 'none' : 'legend')} style={{ flex: 1, padding: 12 }}>Легенда</button>
      </div>

      {activeTab === 'search' && (
        <div style={{ maxHeight: '40vh', overflow: 'auto', borderTop: '1px solid #ccc' }}>
          <SearchTab elements={elements} onSelectElement={selectElement} onHighlightChange={setHighlightedSymbol} />
        </div>
      )}
      {activeTab === 'viewSettings' && viewSettingsUnlocked && (
        <div style={{ maxHeight: '40vh', overflow: 'auto', borderTop: '1px solid #ccc' }}>
          <ViewSettingsTab settings={viewSettings} onChange={updateViewSettings} />
        </div>
      )}
      {activeTab === 'legend' && (
        <div style={{ maxHeight: '40vh', overflow: 'auto', borderTop: '1px solid #ccc' }}>
          <LegendTab colorIndication={viewSettings.colorIndication} />
        </div>
      )}

      {showPinModal && (
        <TeacherPinModal
          expectedPin={properties.teacherPin ?? '0000'}
          onSuccess={() => { setViewSettingsUnlocked(true); setShowPinModal(false); openTab('viewSettings'); }}
          onCancel={() => setShowPinModal(false)}
        />
      )}

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
