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
    <div className="riq-card" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 className="riq-heading" style={{ margin: 0, fontSize: 16 }}>
          Вопрос
        </h4>
        <button onClick={onClose} className="riq-btn riq-btn-ghost riq-btn-small" style={{ padding: '2px 10px' }}>
          ×
        </button>
      </div>
      <label className="riq-field">
        Текст вопроса
        <textarea value={question.text} onChange={(e) => set('text', e.target.value)} className="riq-input" rows={2} />
      </label>
      <label className="riq-field">
        Ответ
        <input value={question.answer} onChange={(e) => set('answer', e.target.value)} className="riq-input" />
      </label>
      <label className="riq-field">
        Тема
        <input value={question.theme} onChange={(e) => set('theme', e.target.value)} list="rusiq-editor-themes" className="riq-input" />
        <datalist id="rusiq-editor-themes">
          {existingThemes.map((theme) => (
            <option key={theme} value={theme} />
          ))}
        </datalist>
      </label>
      <div style={{ display: 'flex', gap: 10 }}>
        <label className="riq-field" style={{ flex: 1 }}>
          Ширина области клика
          <input type="number" min={1} value={question.width} onChange={(e) => set('width', Math.max(1, Number(e.target.value)))} className="riq-input" />
        </label>
        <label className="riq-field" style={{ flex: 1 }}>
          Высота области клика
          <input type="number" min={1} value={question.height} onChange={(e) => set('height', Math.max(1, Number(e.target.value)))} className="riq-input" />
        </label>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <label className="riq-field" style={{ flex: 1 }}>
          Уровень
          <select value={question.level} onChange={(e) => set('level', Number(e.target.value) as RusiqLevelId)} className="riq-input">
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </label>
        <label className="riq-field" style={{ flex: 1 }}>
          Вес (баллы)
          <input
            type="number"
            min={1}
            value={question.price}
            onChange={(e) => set('price', Math.max(1, Number(e.target.value)))}
            className="riq-input"
          />
        </label>
        <label className="riq-field" style={{ flex: 1 }}>
          Время (сек)
          <input
            type="number"
            min={1}
            value={question.timeSeconds}
            onChange={(e) => set('timeSeconds', Math.max(1, Number(e.target.value)))}
            className="riq-input"
          />
        </label>
      </div>
      <label className="riq-field">
        Подсказка (необязательно)
        <textarea value={question.helpText} onChange={(e) => set('helpText', e.target.value)} className="riq-input" rows={2} />
      </label>
      <button onClick={onDelete} className="riq-btn riq-btn-danger riq-btn-small" style={{ marginTop: 4 }}>
        Удалить этот вопрос
      </button>
    </div>
  );
};

export default PointEditForm;
