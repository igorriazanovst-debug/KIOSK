// packages/player/src/physastroiq/editor/PointEditForm.tsx
import React, { useRef } from 'react';
import type { PhysastroiqQuestion } from '../model/schema.ts';
import SpecialCharPicker from './SpecialCharPicker.tsx';
import ItemImageUpload from './ItemImageUpload.tsx';
import type { PhysastroiqItemImageKind } from './quizStore.ts';

interface Props {
  question: PhysastroiqQuestion;
  existingThemes: string[];
  onChange: (updated: PhysastroiqQuestion) => void;
  onDelete: () => void;
  onClose: () => void;
  getImagePreviewUrl: (kind: PhysastroiqItemImageKind) => string | null;
  onSelectImage: (kind: PhysastroiqItemImageKind, file: File) => void;
  onRemoveImage: (kind: PhysastroiqItemImageKind) => void;
}

// Отличие от rusiq/editor/PointEditForm.tsx (Тип 7): НЕТ поля «Уровень».
// У rusiq одно общее изображение на всю викторину — смена уровня вопроса
// была безопасна (координаты x/y оставались в том же пространстве). У
// ФизАстроIQ своя картинка на каждый уровень (план реализации §3) — уровень
// вопроса определяется тем, НА КАКОЙ ВКЛАДКЕ (изображении) он размещён в
// EditorScreen, а не редактируемым полем формы; разрешить его тут значило
// бы дать молча "оторвать" точку от картинки, для которой её координаты
// реально измерялись, и превратить x/y в координаты для чужого изображения
// без предупреждения.
const PointEditForm: React.FC<Props> = ({ question, existingThemes, onChange, onDelete, onClose, getImagePreviewUrl, onSelectImage, onRemoveImage }) => {
  const textRef = useRef<HTMLTextAreaElement>(null);
  const answerRef = useRef<HTMLInputElement>(null);
  const helpTextRef = useRef<HTMLTextAreaElement>(null);

  function set<K extends keyof PhysastroiqQuestion>(key: K, value: PhysastroiqQuestion[K]) {
    onChange({ ...question, [key]: value });
  }

  return (
    <div className="ciq-card" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 className="ciq-heading" style={{ margin: 0, fontSize: 16 }}>
          Вопрос (уровень {question.level})
        </h4>
        <button onClick={onClose} className="ciq-btn ciq-btn-ghost ciq-btn-small" style={{ padding: '2px 10px' }}>
          ×
        </button>
      </div>
      <label className="ciq-field">
        Текст вопроса
        <textarea ref={textRef} value={question.text} onChange={(e) => set('text', e.target.value)} className="ciq-input" rows={2} />
      </label>
      <SpecialCharPicker targetRef={textRef} onInsert={(next) => set('text', next)} />
      <ItemImageUpload
        label="Картинка к вопросу (необязательно)"
        previewUrl={getImagePreviewUrl('question')}
        onSelectFile={(file) => onSelectImage('question', file)}
        onRemove={() => onRemoveImage('question')}
      />
      <label className="ciq-field">
        Ответ
        <input ref={answerRef} value={question.answer} onChange={(e) => set('answer', e.target.value)} className="ciq-input" />
      </label>
      <SpecialCharPicker targetRef={answerRef} onInsert={(next) => set('answer', next)} />
      <ItemImageUpload
        label="Картинка к ответу (необязательно)"
        previewUrl={getImagePreviewUrl('answer')}
        onSelectFile={(file) => onSelectImage('answer', file)}
        onRemove={() => onRemoveImage('answer')}
      />
      <label className="ciq-field">
        Тема
        <input value={question.theme} onChange={(e) => set('theme', e.target.value)} list="physastroiq-editor-themes" className="ciq-input" />
        <datalist id="physastroiq-editor-themes">
          {existingThemes.map((theme) => (
            <option key={theme} value={theme} />
          ))}
        </datalist>
      </label>
      <div style={{ display: 'flex', gap: 10 }}>
        <label className="ciq-field" style={{ flex: 1 }}>
          Ширина области клика
          <input type="number" min={1} value={question.width} onChange={(e) => set('width', Math.max(1, Number(e.target.value)))} className="ciq-input" />
        </label>
        <label className="ciq-field" style={{ flex: 1 }}>
          Высота области клика
          <input type="number" min={1} value={question.height} onChange={(e) => set('height', Math.max(1, Number(e.target.value)))} className="ciq-input" />
        </label>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <label className="ciq-field" style={{ flex: 1 }}>
          Вес (баллы)
          <input
            type="number"
            min={1}
            value={question.price}
            onChange={(e) => set('price', Math.max(1, Number(e.target.value)))}
            className="ciq-input"
          />
        </label>
        <label className="ciq-field" style={{ flex: 1 }}>
          Время (сек)
          <input
            type="number"
            min={1}
            value={question.timeSeconds}
            onChange={(e) => set('timeSeconds', Math.max(1, Number(e.target.value)))}
            className="ciq-input"
          />
        </label>
      </div>
      <label className="ciq-field">
        Подсказка (необязательно)
        <textarea ref={helpTextRef} value={question.helpText} onChange={(e) => set('helpText', e.target.value)} className="ciq-input" rows={2} />
      </label>
      <SpecialCharPicker targetRef={helpTextRef} onInsert={(next) => set('helpText', next)} />
      <ItemImageUpload
        label="Картинка к подсказке (необязательно)"
        previewUrl={getImagePreviewUrl('hint')}
        onSelectFile={(file) => onSelectImage('hint', file)}
        onRemove={() => onRemoveImage('hint')}
      />
      <button onClick={onDelete} className="ciq-btn ciq-btn-danger ciq-btn-small" style={{ marginTop: 4 }}>
        Удалить этот вопрос
      </button>
    </div>
  );
};

export default PointEditForm;
