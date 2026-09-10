// packages/player/src/periodictable/screens/ElementSummaryCard.tsx
import React from 'react';
import type { PeriodicElement } from '../model/schema.ts';

interface Props {
  element: PeriodicElement;
  onMoreDetails: () => void;
  onClose: () => void;
}

const ElementSummaryCard: React.FC<Props> = ({ element, onMoreDetails, onClose }) => (
  <div style={{ background: '#fff', padding: 24, borderRadius: 8, maxWidth: 480 }}>
    <h2>{element.nameRu} ({element.nameLatin}) — {element.symbol}</h2>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <tbody>
        <tr><td>Номер</td><td>{element.atomicNumber}</td></tr>
        <tr><td>Атомная масса</td><td>{element.atomicMass}</td></tr>
        <tr><td>Период / группа</td><td>{element.period} / {element.groupIupac ?? '—'}</td></tr>
        <tr><td>Электронная конфигурация</td><td>{element.electronConfiguration}</td></tr>
        <tr><td>Электронный тип</td><td>{element.electronType}</td></tr>
      </tbody>
    </table>
    <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
      <button onClick={onMoreDetails}>Подробнее</button>
      <button onClick={onClose}>Закрыть</button>
    </div>
  </div>
);

export default ElementSummaryCard;
