// packages/player/src/bioiq/editor/SpecialCharPicker.tsx
// FR-015 ТЗ 10 (строка 309) — «вставить в текст вопроса, ответа или подсказки
// спецсимволы». Механика вставки — прямая копия rusiq/editor/
// SpecialCharPicker.tsx (Тип 7): срез selectionStart/selectionEnd, курсор
// возвращается сразу после вставленного символа.
//
// Сам набор символов и обоснование его состава — в specialChars.ts, отдельным
// модулем: прогон тестов идёт через `node --experimental-strip-types`, а он
// понимает .ts и не понимает .tsx, и иначе состав набора нечем было бы
// проверить.

import React from 'react';
import { BIOIQ_SPECIAL_CHARS } from './specialChars.ts';

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
