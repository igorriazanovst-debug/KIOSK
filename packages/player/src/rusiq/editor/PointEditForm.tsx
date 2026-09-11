// packages/player/src/rusiq/editor/PointEditForm.tsx
import React from 'react';
import type { RusiqLevelId, RusiqQuestion } from '../model/schema.ts';

interface Props {
  question: RusiqQuestion;
  existingThemes: string[];
  onChange: (updated: RusiqQuestion) => void;
  onDelete: () => void;
  onClose: () => void;
}

const PointEditForm: React.FC<Props> = ({ question, existingThemes, onChange, onDelete, onClose }) => {
  function set<K extends keyof RusiqQuestion>(key: K, value: RusiqQuestion[K]) {
    onChange({ ...question, [key]: value });
  }

  return (
    <div style={{ border: '1px solid #ccc', padding: 16, borderRadius: 8, background: '#fafafa', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h4 style={{ margin: 0 }}>Вопрос</h4>
        <button onClick={onClose}>×</button>
      </div>
      <label style={{ display: 'block', marginTop: 8 }}>
        Текст вопроса
        <textarea
          value={question.text}
          onChange={(e) => set('text', e.target.value)}
          style={{ display: 'block', width: '100%', padding: 6 }}
          rows={2}
        />
      </label>
      <label style={{ display: 'block', marginTop: 8 }}>
        Ответ
        <input value={question.answer} onChange={(e) => set('answer', e.target.value)} style={{ display: 'block', width: '100%', padding: 6 }} />
      </label>
      <label style={{ display: 'block', marginTop: 8 }}>
        Тема
        <input
          value={question.theme}
          onChange={(e) => set('theme', e.target.value)}
          list="rusiq-editor-themes"
          style={{ display: 'block', width: '100%', padding: 6 }}
        />
        <datalist id="rusiq-editor-themes">
          {existingThemes.map((theme) => (
            <option key={theme} value={theme} />
          ))}
        </datalist>
      </label>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <label style={{ flex: 1 }}>
          Уровень
          <select value={question.level} onChange={(e) => set('level', Number(e.target.value) as RusiqLevelId)} style={{ display: 'block', width: '100%', padding: 6 }}>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </label>
        <label style={{ flex: 1 }}>
          Вес (баллы)
          <input
            type="number"
            min={1}
            value={question.price}
            onChange={(e) => set('price', Math.max(1, Number(e.target.value)))}
            style={{ display: 'block', width: '100%', padding: 6 }}
          />
        </label>
        <label style={{ flex: 1 }}>
          Время (сек)
          <input
            type="number"
            min={1}
            value={question.timeSeconds}
            onChange={(e) => set('timeSeconds', Math.max(1, Number(e.target.value)))}
            style={{ display: 'block', width: '100%', padding: 6 }}
          />
        </label>
      </div>
      <label style={{ display: 'block', marginTop: 8 }}>
        Подсказка (необязательно)
        <textarea
          value={question.helpText}
          onChange={(e) => set('helpText', e.target.value)}
          style={{ display: 'block', width: '100%', padding: 6 }}
          rows={2}
        />
      </label>
      <button onClick={onDelete} style={{ marginTop: 12, color: '#c0392b' }}>
        Удалить этот вопрос
      </button>
    </div>
  );
};

export default PointEditForm;
