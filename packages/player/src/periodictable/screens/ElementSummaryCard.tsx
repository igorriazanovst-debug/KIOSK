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
  <div style={{ background: '#fff', padding: 28, borderRadius: 14, maxWidth: 560, width: '90vw', boxShadow: '0 12px 32px rgba(0,0,0,0.28)' }}>
    <h2 style={{ margin: '0 0 16px', paddingBottom: 12, borderBottom: '1px solid #eceff1' }}>
      {element.nameRu} ({element.nameLatin}) — {element.symbol}
    </h2>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
      <tbody>
        <tr><td style={{ padding: '6px 0', color: '#607d8b' }}>Номер</td><td style={{ padding: '6px 0', fontWeight: 'bold' }}>{element.atomicNumber}</td></tr>
        <tr><td style={{ padding: '6px 0', color: '#607d8b' }}>Атомная масса</td><td style={{ padding: '6px 0', fontWeight: 'bold' }}>{element.atomicMass}</td></tr>
        {/* Подпись группы должна совпадать с тем, что видно в шапке таблицы
            для текущей формы: в короткой форме — римская цифра, в IUPAC —
            арабская. У лантаноидов/актиноидов подвала groupIupac === null,
            номера группы у них нет — показываем «—», как и в подсказке ячейки. */}
        <tr><td style={{ padding: '6px 0', color: '#607d8b' }}>Период / группа</td><td style={{ padding: '6px 0', fontWeight: 'bold' }}>{element.period} / {element.groupIupac === null ? '—' : formatGroupLabel(element.groupIupac, form)}</td></tr>
        <tr><td style={{ padding: '6px 0', color: '#607d8b' }}>Электронная конфигурация</td><td style={{ padding: '6px 0', fontWeight: 'bold' }}>{element.electronConfiguration}</td></tr>
        <tr><td style={{ padding: '6px 0', color: '#607d8b' }}>Электронный тип</td><td style={{ padding: '6px 0', fontWeight: 'bold' }}>{element.electronType}</td></tr>
      </tbody>
    </table>
    <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
      <button
        onClick={onMoreDetails}
        style={{ padding: '10px 18px', background: '#1565c0', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 'bold', cursor: 'pointer' }}
      >
        Подробнее
      </button>
      <button
        onClick={onClose}
        style={{ padding: '10px 18px', background: '#eceff1', color: '#37474f', border: 'none', borderRadius: 8, cursor: 'pointer' }}
      >
        Закрыть
      </button>
    </div>
  </div>
);

export default ElementSummaryCard;
