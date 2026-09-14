// packages/player/src/chimiq/editor/ItemImageUpload.tsx
// FR-015 (картинка к вопросу/ответу/подсказке). Прямая копия
// rusiq/editor/ItemImageUpload.tsx (Тип 7) — доменно-независимо.

import React from 'react';

interface Props {
  label: string;
  previewUrl: string | null;
  onSelectFile: (file: File) => void;
  onRemove: () => void;
}

const ACCEPTED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

const ItemImageUpload: React.FC<Props> = ({ label, previewUrl, onSelectFile, onRemove }) => {
  return (
    <label className="ciq-field">
      {label}
      {previewUrl && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
          <img
            src={previewUrl}
            alt=""
            style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--ciq-border)' }}
          />
          <button type="button" onClick={onRemove} className="ciq-btn ciq-btn-ghost ciq-btn-small">
            Убрать
          </button>
        </div>
      )}
      <input
        type="file"
        accept={ACCEPTED_MIME_TYPES.join(',')}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onSelectFile(file);
          e.target.value = '';
        }}
        className="ciq-input"
        style={{ padding: '6px 4px' }}
      />
    </label>
  );
};

export default ItemImageUpload;
