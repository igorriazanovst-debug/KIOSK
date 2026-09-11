// packages/player/src/periodictable/screens/ElementSummaryCard.tsx
import React from 'react';
import type { PeriodicElement } from '../model/schema.ts';
import { formatGroupLabel, type TableForm } from '../tableLayout.ts';

interface Props {
  element: PeriodicElement;
  form: TableForm;
  onMoreDetails: () => void;
  onClose: () => void;
}

const ElementSummaryCard: React.FC<Props> = ({ element, form, onMoreDetails, onClose }) => (
  <div style={{ background: '#fff', padding: 24, borderRadius: 8, maxWidth: 480 }}>
    <h2>{element.nameRu} ({element.nameLatin}) — {element.symbol}</h2>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <tbody>
        <tr><td>Номер</td><td>{element.atomicNumber}</td></tr>
        <tr><td>Атомная масса</td><td>{element.atomicMass}</td></tr>
        {/* Подпись группы должна совпадать с тем, что видно в шапке таблицы
            для текущей формы: в короткой форме — римская цифра, в IUPAC —
            арабская. У лантаноидов/актиноидов подвала groupIupac === null,
            номера группы у них нет — показываем «—», как и в подсказке ячейки. */}
        <tr><td>Период / группа</td><td>{element.period} / {element.groupIupac === null ? '—' : formatGroupLabel(element.groupIupac, form)}</td></tr>
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
