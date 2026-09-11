import React from 'react';
import type { PeriodicElement } from '../model/schema.ts';
import { getCellPosition, formatGroupLabel, type TableForm } from '../tableLayout.ts';
import type { ColorIndicationMode, HighlightMode } from '../viewTypes.ts';

interface Props {
  elements: PeriodicElement[];
  form: TableForm;
  colorIndication: ColorIndicationMode;
  highlight: HighlightMode;
  highlightedSymbol?: string | null; // подсветка найденного элемента (Задача 8, Поиск)
  onSelectElement: (el: PeriodicElement) => void;
}

const CLASS_COLOR: Record<string, string> = { metal: '#e3f2fd', metalloid: '#fff3e0', nonmetal: '#e8f5e9' };
const ELECTRON_TYPE_COLOR: Record<string, string> = { s: '#ffebee', p: '#e8f5e9', d: '#e3f2fd', f: '#f3e5f5' };
const OXIDE_COLOR: Record<string, string> = { acidic: '#ffebee', basic: '#e3f2fd', amphoteric: '#fff3e0', none: '#f5f5f5' };

function cellBackground(el: PeriodicElement, mode: ColorIndicationMode): string {
  if (mode === 'class') return CLASS_COLOR[el.elementClass];
  if (mode === 'electronType') return ELECTRON_TYPE_COLOR[el.electronType];
  if (mode === 'oxideCharacter') return OXIDE_COLOR[el.oxideCharacter];
  return '#ffffff';
}

function isHighlighted(el: PeriodicElement, highlight: HighlightMode): boolean {
  if (highlight === 'none') return false;
  if (highlight === 'metal' || highlight === 'nonmetal' || highlight === 'metalloid') return el.elementClass === highlight;
  if (highlight === 's' || highlight === 'p' || highlight === 'd' || highlight === 'f') return el.electronType === highlight;
  return el.oxideCharacter === highlight;
}

const TableScreen: React.FC<Props> = ({ elements, form, colorIndication, highlight, highlightedSymbol, onSelectElement }) => {
  // 18 колонок для ОБЕИХ форм — короткая форма не схлопывает колонки
  // (см. tableLayout.ts, исправлено по находке Задачи 5), различается
  // только подпись колонки через formatGroupLabel — в видимой строке шапки
  // ниже и (дополнительно) в подсказке title самой ячейки.
  const maxCol = 18;
  const groupColumns = Array.from({ length: maxCol }, (_, i) => i + 1);

  return (
    <div>
      {/* Видимая строка подписей групп. Раньше отличие короткой формы от
          IUPAC жило ТОЛЬКО в атрибуте title (всплывающая подсказка мыши) —
          на сенсорном киоске, где мыши нет, переключение формы не давало
          пользователю вообще никакого видимого эффекта. Это отдельная
          сетка-сосед, а не строка внутри сетки элементов: так позиционирование
          элементов (getCellPosition) остаётся нетронутым. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${maxCol}, 1fr)`,
          gap: 2,
          padding: '8px 8px 0 8px',
          fontFamily: 'sans-serif',
        }}
      >
        {groupColumns.map((col) => (
          <div
            key={col}
            style={{
              boxSizing: 'border-box',
              minWidth: 56,
              padding: 4,
              background: '#eceff1',
              border: '1px solid #b0bec5',
              borderRadius: 4,
              textAlign: 'center',
              fontWeight: 'bold',
              fontSize: 13,
              color: '#263238',
            }}
            title={`Группа ${formatGroupLabel(col, form)}`}
          >
            {formatGroupLabel(col, form)}
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${maxCol}, 1fr)`,
          // Строка 8 физически пуста (подвал лантаноидов/актиноидов живёт в
          // строках 9 и 10) — задаём ей явную высоту как визуальному разрыву
          // после 7-го периода, иначе подвал читается как «периоды 8 и 9».
          gridTemplateRows: 'repeat(7, auto) 20px auto auto',
          gap: 2,
          padding: 8,
          touchAction: 'manipulation',
        }}
      >
      {elements.map((el) => {
        const pos = getCellPosition(el, form);
        const highlighted = isHighlighted(el, highlight) || el.symbol === highlightedSymbol;
        // У лантаноидов/актиноидов groupIupac === null — номера группы у них
        // нет, и подставлять запасную «группу I» нельзя: это не косметика, а
        // фактическая ошибка в химическом справочнике (группа 1 — щелочные
        // металлы). В таком случае в подсказке остаётся только название.
        const cellTitle =
          el.groupIupac === null
            ? el.nameRu
            : `${el.nameRu} — группа ${formatGroupLabel(el.groupIupac, form)}`;
        return (
          <button
            key={el.atomicNumber}
            onClick={() => onSelectElement(el)}
            style={{
              boxSizing: 'border-box',
              gridRow: pos.row,
              gridColumn: pos.col,
              background: cellBackground(el, colorIndication),
              border: highlighted ? '3px solid #d32f2f' : '1px solid #ccc',
              borderRadius: 4,
              padding: 4,
              minHeight: 56,
              minWidth: 56,
              cursor: 'pointer',
              fontFamily: 'sans-serif',
            }}
            title={cellTitle}
          >
            <div style={{ fontSize: 11, textAlign: 'left' }}>{el.atomicNumber}</div>
            <div style={{ fontSize: 18, fontWeight: 'bold' }}>{el.symbol}</div>
            <div style={{ fontSize: 9 }}>{el.nameRu}</div>
          </button>
        );
      })}
      </div>
    </div>
  );
};

export default TableScreen;
