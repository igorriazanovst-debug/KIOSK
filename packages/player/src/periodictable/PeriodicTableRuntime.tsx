// packages/player/src/periodictable/PeriodicTableRuntime.tsx
import React, { useEffect, useMemo, useState } from 'react';
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
import { toggleTab, shouldClearHighlight, decideViewSettingsClick, type BottomTab } from './tabState.ts';
import elementsJson from './content/elements.json' with { type: 'json' };

interface Props {
  properties: PeriodicTableWidgetProperties;
}

type CardMode = 'none' | 'summary' | 'detail';

const PeriodicTableRuntime: React.FC<Props> = ({ properties }) => {
  // Разбор справочника ВНУТРИ компонента и через safeParse. Раньше это был
  // `PeriodicTableContentSchema.parse(...)` на уровне модуля: Player.tsx
  // импортирует этот модуль статически, поэтому повреждённый elements.json
  // ронял бы весь Player целиком — во всех проектах, даже там, где виджета
  // «Таблица Менделеева» вообще нет. Теперь радиус поражения ограничен самим
  // виджетом, а пользователь видит понятное сообщение вместо пустого экрана.
  const parsedContent = useMemo(() => PeriodicTableContentSchema.safeParse(elementsJson), []);
  const elements: PeriodicElement[] = parsedContent.success ? parsedContent.data.elements : [];

  const [viewSettings, setViewSettings] = useState<ViewSettings>(DEFAULT_VIEW_SETTINGS);
  const [selected, setSelected] = useState<PeriodicElement | null>(null);
  const [cardMode, setCardMode] = useState<CardMode>('none');
  const [activeTab, setActiveTab] = useState<BottomTab>('none');
  const [highlightedSymbol, setHighlightedSymbol] = useState<string | null>(null);
  const [viewSettingsUnlocked, setViewSettingsUnlocked] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);

  // Единое место, откуда берётся действующий PIN — раньше `properties.
  // teacherPin ?? '0000'` повторялся в трёх разных местах компонента
  // (обработчик клика, проверка модалки, значок замка), с риском разойтись
  // при будущей правке одного из мест без остальных.
  const effectivePin = properties.teacherPin ?? '0000';

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
  // Решение вынесено в tabState.ts (shouldClearHighlight) и покрыто
  // юнит-тестами — раньше это проверялось только живым прогоном.
  function openTab(tab: BottomTab) {
    if (shouldClearHighlight(tab)) setHighlightedSymbol(null);
    setActiveTab(tab);
  }

  // Логика решения (открыть/показать PIN/закрыть) вынесена в чистую функцию
  // decideViewSettingsClick (tabState.ts) — именно в ней финальное ревью
  // всей ветки нашло дефект: пустой teacherPin («блокировка отключена»,
  // спека разд. 5) раньше оставлял вкладку «мёртвой» — клик не делал
  // видимого ничего. Теперь эта ветка покрыта юнит-тестом отдельно от React.
  function handleViewSettingsTabClick() {
    const result = decideViewSettingsClick(activeTab, viewSettingsUnlocked, effectivePin);
    if (result.action === 'close') openTab('none');
    else if (result.action === 'openDirectly') openTab('viewSettings');
    else setShowPinModal(true);
  }

  // Все хуки выше уже вызваны — ранний возврат ниже не нарушает порядок хуков.
  if (!parsedContent.success) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          textAlign: 'center',
          fontFamily: 'sans-serif',
          color: '#b71c1c',
        }}
      >
        <h2 style={{ margin: 0 }}>Данные справочника повреждены</h2>
        <p style={{ maxWidth: 520, color: '#37474f' }}>
          Таблицу Менделеева показать не удалось: файл с данными об элементах не прошёл проверку.
          Остальные материалы киоска работают как обычно. Сообщите администратору — нужно
          переустановить проект или обновить содержимое виджета.
        </p>
      </div>
    );
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
        <button onClick={() => openTab(toggleTab(activeTab, 'search'))} aria-label="Поиск" style={{ flex: 1, padding: 12 }}>Поиск</button>
        <button
          onClick={handleViewSettingsTabClick}
          aria-label={`Настройки вида${!viewSettingsUnlocked && effectivePin ? ', заблокировано PIN учителя' : ''}`}
          style={{ flex: 1, padding: 12 }}
        >
          {/* Замок показывается, только если защита реально активна: раньше
              условие не учитывало пустой teacherPin («блокировка отключена»)
              — значок оставался, хотя вкладка уже открывалась в один клик. */}
          Настройки вида {!viewSettingsUnlocked && effectivePin ? '🔒' : ''}
        </button>
        <button onClick={() => openTab(toggleTab(activeTab, 'legend'))} aria-label="Легенда" style={{ flex: 1, padding: 12 }}>Легенда</button>
      </div>

      {activeTab === 'search' && (
        <div style={{ maxHeight: '40vh', overflow: 'auto', borderTop: '1px solid #ccc' }}>
          <SearchTab elements={elements} onSelectElement={selectElement} onHighlightChange={setHighlightedSymbol} />
        </div>
      )}
      {/* Условие НЕ включает viewSettingsUnlocked намеренно: activeTab может
          стать 'viewSettings' только двумя путями — через
          handleViewSettingsTabClick (он сам проверяет viewSettingsUnlocked ||
          !pin) и через onSuccess PIN-модалки (она сама ставит unlocked=true).
          Со старым условием пустой teacherPin («замок отключён») делал вкладку
          мёртвой: клик открывал таб, но панель не рендерилась никогда. */}
      {activeTab === 'viewSettings' && (
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
          expectedPin={effectivePin}
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
              <ElementSummaryCard
                element={selected}
                form={viewSettings.tableForm}
                onMoreDetails={() => setCardMode('detail')}
                onClose={closeCard}
              />
            )}
            {cardMode === 'detail' && <ElementDetailCard element={selected} onClose={closeCard} />}
          </div>
        </div>
      )}
    </div>
  );
};

export default PeriodicTableRuntime;
