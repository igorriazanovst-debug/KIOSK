import React from 'react';
import type { PeriodicElement } from '../model/schema.ts';
import { getCellPosition, formatGroupLabel, type TableForm } from '../tableLayout.ts';
import type { ColorIndicationMode, HighlightMode } from '../viewTypes.ts';
import { CLASS_COLOR, ELECTRON_TYPE_COLOR, OXIDE_COLOR } from '../colorPalette.ts';

interface Props {
  elements: PeriodicElement[];
  form: TableForm;
  colorIndication: ColorIndicationMode;
  highlight: HighlightMode;
  highlightedSymbol?: string | null; // подсветка найденного элемента (Задача 8, Поиск)
  onSelectElement: (el: PeriodicElement) => void;
}

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

// Явные значения по всем четырём сторонам через ЧЕТЫРЕ отдельных longhand
// (borderTop/Right/Bottom/Left), без shorthand `border` — на варианте,
// смешивавшем `border: ...` и точечный `borderTop: highlighted ? ... :
// undefined` в одном объекте стилей, нормальные (не подсвеченные, не
// подвальные) ячейки живьём отрисовывались с ЧЁРНОЙ рамкой вместо #ccc
// (найдено CDP-проверкой при финальной доработке): назначение `border`,
// а следом `borderTop: undefined` в одном React-стиле не гарантированно
// откатывается к тому, что уже выставил `border`. Явные значения на каждой
// из четырёх сторон при каждом рендере — предсказуемо в любом браузере.
function cellBorderSide(highlighted: boolean, isFooterTopEdge: boolean): string {
  if (highlighted) return '3px solid #d32f2f';
  if (isFooterTopEdge) return '2px solid #90a4ae';
  return '1px solid #ccc';
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
      {/* Один общий <style> на весь экран таблицы, а не хук состояния
          hover на каждую из ~118 кнопок: :hover — обычное CSS-псевдо-
          состояние, оно не требует перерисовки React-дерева при наведении.
          Класс специфичен для виджета (periodictable-cell), чтобы не
          зацепить стили других виджетов плеера на том же экране. */}
      <style>{`
        .periodictable-cell {
          transition: transform 0.12s ease, box-shadow 0.12s ease;
        }
        .periodictable-cell:hover {
          transform: scale(1.05);
          box-shadow: 0 2px 8px rgba(0,0,0,0.25);
          z-index: 1;
        }
      `}</style>
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
            role="columnheader"
            aria-label={`Группа ${formatGroupLabel(col, form)}`}
            style={{
              boxSizing: 'border-box',
              minWidth: 56,
              padding: 4,
              background: '#37474f',
              border: '1px solid #263238',
              borderRadius: 6,
              textAlign: 'center',
              fontWeight: 'bold',
              fontSize: 13,
              color: '#ffffff',
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
          // 28px (не 20px) + верхняя рамка у первой строки подвала (ниже) —
          // разрыв виднее, ближе к тому, как разрыв смотрится на бумажных
          // изданиях короткой формы.
          gridTemplateRows: 'repeat(7, auto) 28px auto auto',
          gap: 2,
          padding: 8,
          touchAction: 'manipulation',
        }}
      >
      {elements.map((el) => {
        const pos = getCellPosition(el, form);
        const highlighted = isHighlighted(el, highlight) || el.symbol === highlightedSymbol;
        const isFooterRow = pos.row === 9 || pos.row === 10;
        // У лантаноидов/актиноидов groupIupac === null — номера группы у них
        // нет, и подставлять запасную «группу I» нельзя: это не косметика, а
        // фактическая ошибка в химическом справочнике (группа 1 — щелочные
        // металлы). В таком случае в подсказке остаётся только название.
        const cellTitle =
          el.groupIupac === null
            ? el.nameRu
            : `${el.nameRu} — группа ${formatGroupLabel(el.groupIupac, form)}`;
        const sideBorder = cellBorderSide(highlighted, false);
        return (
          <button
            key={el.atomicNumber}
            className="periodictable-cell"
            onClick={() => onSelectElement(el)}
            aria-label={cellTitle}
            style={{
              boxSizing: 'border-box',
              gridRow: pos.row,
              gridColumn: pos.col,
              background: cellBackground(el, colorIndication),
              // Верхняя сторона отдельно: у первой строки подвала она толще
              // и другого цвета — дополнительный (к пустой строке 8 выше)
              // визуальный сигнал «это отдельный блок ниже основной таблицы»,
              // не просто «периоды 8/9». Три остальные стороны — как обычно.
              borderTop: cellBorderSide(highlighted, isFooterRow),
              borderRight: sideBorder,
              borderBottom: sideBorder,
              borderLeft: sideBorder,
              borderRadius: 8,
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
