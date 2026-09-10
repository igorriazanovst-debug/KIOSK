// packages/player/src/periodictable/screens/ElementDetailCard.tsx
import React from 'react';
import type { PeriodicElement } from '../model/schema.ts';

interface Props {
  element: PeriodicElement;
  onClose: () => void;
}

const ROW: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <tr><td style={{ fontWeight: 'bold', paddingRight: 12, verticalAlign: 'top', maxWidth: 260 }}>{label}</td><td>{value ?? '—'}</td></tr>
);

const ElementDetailCard: React.FC<Props> = ({ element, onClose }) => (
  <div style={{ background: '#fff', padding: 24, borderRadius: 8, maxWidth: 640, maxHeight: '80vh', overflow: 'auto' }}>
    <h2>{element.nameRu} ({element.symbol})</h2>
    {element.photo && (
      <img
        src={`./periodictable/photos/${element.photo.fileName}`}
        alt={`Образец: ${element.nameRu}`}
        style={{ maxWidth: 200, display: 'block', marginBottom: 12 }}
      />
    )}
    <table style={{ borderCollapse: 'collapse' }}>
      <tbody>
        <ROW label="Символ элемента" value={element.symbol} />
        <ROW label="Номер элемента" value={element.atomicNumber} />
        <ROW label="Относительная атомная масса" value={element.atomicMass} />
        <ROW label="Название элемента на русском языке" value={element.nameRu} />
        <ROW label="Название элемента на латыни" value={element.nameLatin} />
        <ROW label="Электронный тип" value={element.electronType} />
        <ROW label="Нахождение в природе" value={element.naturalOccurrence} />
        <ROW label="Агрегатное состояние при нормальных условиях" value={element.physicalStateNormal} />
        <ROW label="Тип кристаллической решётки простого вещества" value={element.crystalLattice} />
        <ROW label="Аллотропные модификации" value={element.allotropes || '—'} />
        <ROW label="Стабильные изотопы" value={element.stableIsotopes || '—'} />
        <ROW label="Положение в ряду электрохимического напряжения относительно водорода (для металлов)" value={element.electrochemicalSeriesPosition} />
        <ROW label="Характер свойств оксидов и гидроксидов" value={element.oxideCharacter} />
        <ROW label="Плотность (г/см³)" value={element.density} />
        <ROW label="Температура плавления (К)" value={element.meltingPointK} />
        <ROW label="Температура кипения (К)" value={element.boilingPointK} />
        <ROW label="Характерные степени окисления в неорганических соединениях" value={element.oxidationStates} />
        <ROW label="Электроотрицательность по шкале Полинга" value={element.electronegativityPauling} />
      </tbody>
    </table>
    <button onClick={onClose} style={{ marginTop: 16 }}>Закрыть</button>
  </div>
);

export default ElementDetailCard;
