// packages/player/src/periodictable/screens/ElementDetailCard.tsx
import React from 'react';
import type { PeriodicElement, OxideCharacter, ElectronType } from '../model/schema.ts';

interface Props {
  element: PeriodicElement;
  onClose: () => void;
}

// Карточка — русскоязычный справочник для ученика: машинные значения
// схемы ('basic'/'acidic'/...) показывать нельзя. Формулировки те же, что
// в LegendTab.tsx, чтобы легенда и карточка называли характер одинаково.
const OXIDE_CHARACTER_RU: Record<OxideCharacter, string> = {
  acidic: 'кислотный',
  basic: 'основной',
  amphoteric: 'амфотерный',
  none: 'не выражен',
};

// То же самое для электронного типа — бывшая версия карточки выводила
// голую букву (s/p/d/f), тогда как легенда и настройки вида везде говорят
// «s-элементы». Буква остаётся частью текста (это стандартная химическая
// нотация), но со словом «элемент», а не в одиночку.
const ELECTRON_TYPE_RU: Record<ElectronType, string> = {
  s: 's-элемент',
  p: 'p-элемент',
  d: 'd-элемент',
  f: 'f-элемент',
};

// Единая обработка «пусто» для всей карточки: и null/undefined (поле
// структурно необязательно — например electrochemicalSeriesPosition у
// неметаллов), и пустая строка (аллотропные модификации/стабильные изотопы
// у части элементов по факту химии, не по недосмотру) отображаются одним
// и тем же прочерком. Раньше только 2 поля из 18 обрабатывали пустую
// строку особым `|| '—'`, остальные — нет; сейчас правило одно на все 18.
function displayValue(value: React.ReactNode): React.ReactNode {
  if (value === null || value === undefined || value === '') return '—';
  return value;
}

// Плитка «подпись сверху / значение снизу» вместо строки узкой таблицы —
// на широкой карточке (см. ниже) это заметно легче сканировать глазами,
// чем колонку из 18 строк с текстом, прижатым к левому краю.
const FIELD: React.FC<{ label: string; value: React.ReactNode; wide?: boolean }> = ({ label, value, wide }) => (
  <div style={{ gridColumn: wide ? '1 / -1' : undefined, padding: '10px 12px', background: '#fafafa', border: '1px solid #eceff1', borderRadius: 8 }}>
    <div style={{ fontSize: 12, color: '#607d8b', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 15, color: '#212121' }}>{displayValue(value)}</div>
  </div>
);

const ElementDetailCard: React.FC<Props> = ({ element, onClose }) => (
  <div
    style={{
      background: '#fff',
      padding: 28,
      borderRadius: 14,
      maxWidth: 'min(920px, 92vw)',
      width: '92vw',
      maxHeight: '88vh',
      overflow: 'auto',
      boxShadow: '0 16px 40px rgba(0,0,0,0.3)',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #eceff1' }}>
      {element.photo && (
        <img
          src={`./periodictable/photos/${element.photo.fileName}`}
          alt={`Образец: ${element.nameRu}`}
          aria-label={`Фотография образца: ${element.nameRu}`}
          style={{ width: 140, height: 140, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }}
        />
      )}
      <h2 style={{ margin: 0 }}>{element.nameRu} ({element.symbol})</h2>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
      <FIELD label="Символ элемента" value={element.symbol} />
      <FIELD label="Номер элемента" value={element.atomicNumber} />
      <FIELD label="Относительная атомная масса" value={element.atomicMass} />
      <FIELD label="Название элемента на русском языке" value={element.nameRu} />
      <FIELD label="Название элемента на латыни" value={element.nameLatin} />
      <FIELD label="Электронный тип" value={ELECTRON_TYPE_RU[element.electronType]} />
      <FIELD label="Нахождение в природе" value={element.naturalOccurrence} wide />
      <FIELD label="Агрегатное состояние при нормальных условиях" value={element.physicalStateNormal} />
      <FIELD label="Тип кристаллической решётки простого вещества" value={element.crystalLattice} />
      <FIELD label="Аллотропные модификации" value={element.allotropes} />
      <FIELD label="Стабильные изотопы" value={element.stableIsotopes} />
      <FIELD label="Положение в ряду электрохимического напряжения относительно водорода (для металлов)" value={element.electrochemicalSeriesPosition} wide />
      <FIELD label="Характер свойств оксидов и гидроксидов" value={OXIDE_CHARACTER_RU[element.oxideCharacter]} />
      <FIELD label="Плотность (г/см³)" value={element.density} />
      <FIELD label="Температура плавления (К)" value={element.meltingPointK} />
      <FIELD label="Температура кипения (К)" value={element.boilingPointK} />
      <FIELD label="Характерные степени окисления в неорганических соединениях" value={element.oxidationStates} wide />
      <FIELD label="Электроотрицательность по шкале Полинга" value={element.electronegativityPauling} />
    </div>
    <button
      onClick={onClose}
      style={{ marginTop: 20, padding: '10px 18px', background: '#eceff1', color: '#37474f', border: 'none', borderRadius: 8, cursor: 'pointer' }}
    >
      Закрыть
    </button>
  </div>
);

export default ElementDetailCard;
