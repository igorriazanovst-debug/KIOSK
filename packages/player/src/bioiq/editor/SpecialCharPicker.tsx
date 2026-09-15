// packages/player/src/bioiq/editor/SpecialCharPicker.tsx
// FR-014 ТЗ (строка 253) - спецсимволы в тексте вопроса/ответа/подсказки.
// Механика вставки — прямая копия rusiq/editor/SpecialCharPicker.tsx (Тип
// 7): срез selectionStart/selectionEnd, курсор возвращается сразу после
// вставленного символа.
//
// НАБОР СИМВОЛОВ ОТЛИЧАЕТСЯ ОТ РусIQ — ключевое требование эталона для
// химии (`БиоIQ_3.1.1_разбор.md` §5, справка 4.4: «панель надстрочных и
// подстрочных знаков... критично для химических формул, индексов,
// зарядов»): подстрочные и надстрочные цифры для индексов формул (H₂O,
// KMnO₄) и зарядов ионов (Na⁺, SO₄²⁻), плюс стрелка реакции. Общий
// русскоязычный набор РусIQ сохранён — он нужен для обычного текста
// вопроса не меньше, чем химический.

import React from 'react';

const GENERAL_CHARS = ['«', '»', '—', '–', '…', '№', '§', 'ё', 'Ё', '©'];
const SUBSCRIPT_DIGITS = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
const SUPERSCRIPT_DIGITS = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
const CHARGE_SIGNS = ['⁺', '⁻'];
const REACTION_ARROW = ['→'];

const BIOIQ_SPECIAL_CHARS = [...GENERAL_CHARS, ...SUBSCRIPT_DIGITS, ...SUPERSCRIPT_DIGITS, ...CHARGE_SIGNS, ...REACTION_ARROW];

interface Props {
  targetRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
  onInsert: (nextValue: string) => void;
}

const SpecialCharPicker: React.FC<Props> = ({ targetRef, onInsert }) => {
  function insert(char: string) {
    const el = targetRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + char + el.value.slice(end);
    onInsert(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + char.length, start + char.length);
    });
  }

  return (
    <div role="group" aria-label="Вставить спецсимвол" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
      {BIOIQ_SPECIAL_CHARS.map((char, i) => (
        <button
          key={`${char}-${i}`}
          type="button"
          onClick={() => insert(char)}
          className="ciq-btn ciq-btn-ghost ciq-btn-small"
          style={{ minWidth: 26, padding: '2px 6px' }}
        >
          {char}
        </button>
      ))}
    </div>
  );
};

export default SpecialCharPicker;
