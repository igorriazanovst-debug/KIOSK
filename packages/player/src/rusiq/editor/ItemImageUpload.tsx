// packages/player/src/rusiq/editor/ItemImageUpload.tsx
// FR-015 (Фаза 2b) - картинка к вопросу/ответу/подсказке. Загрузка отложена
// до сохранения всей викторины (EditorScreen.tsx хранит выбранный файл в
// pendingItemImages) - тот же принцип, что уже применён к общему фону
// (pendingBg), чтобы отменённое до Save создание/правку викторины не
// оставляло на диске файл, на который никто не ссылается.

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
    <label className="riq-field">
      {label}
      {previewUrl && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0' }}>
          <img
            src={previewUrl}
            alt=""
            style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--riq-border)' }}
          />
          <button type="button" onClick={onRemove} className="riq-btn riq-btn-ghost riq-btn-small">
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
          e.target.value = ''; // позволяет выбрать тот же файл повторно после «Убрать»
        }}
        className="riq-input"
        style={{ padding: '6px 4px' }}
      />
    </label>
  );
};

export default ItemImageUpload;
