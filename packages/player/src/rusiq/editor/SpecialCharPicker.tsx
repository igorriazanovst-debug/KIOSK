// packages/player/src/rusiq/editor/SpecialCharPicker.tsx
// FR-014 (Фаза 2b) - спецсимволы в тексте вопроса/ответа/подсказки.
// RusiqQuestionSchema.text/answer/helpText уже принимают любую строку (см.
// Тип7_трассировочная_матрица.md - схема не блокировала спецсимволы и
// раньше), не хватало только UI для их удобной вставки - обычная <textarea>/
// <input> не даёт «№», «—», «…» и т.п. без переключения раскладки клавиатуры.
// Вставка через ручной срез selectionStart/selectionEnd (не
// document.execCommand('insertText', ...) - устаревший API) с возвратом
// курсора сразу после вставленного символа, чтобы вставка нескольких
// символов подряд в середину текста была предсказуемой.

import React from 'react';

const RU_SPECIAL_CHARS = ['«', '»', '—', '–', '…', '№', '§', 'ё', 'Ё', '©'];

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
      {RU_SPECIAL_CHARS.map((char) => (
        <button
          key={char}
          type="button"
          onClick={() => insert(char)}
          className="riq-btn riq-btn-ghost riq-btn-small"
          style={{ minWidth: 26, padding: '2px 6px' }}
        >
          {char}
        </button>
      ))}
    </div>
  );
};

export default SpecialCharPicker;
