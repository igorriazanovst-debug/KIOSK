// packages/player/src/physastroiq/editor/NewQuizModal.tsx
// Модальный шаг "название + карта уровня 1" перед открытием EditorScreen.
// Отличие от rusiq/editor/NewQuizModal.tsx (Тип 7): там PhysastroiqQuizSchema-
// аналог требует ОДНО общее изображение сразу — здесь требуется только
// картинка уровня «Начинающий» (levels[0]), уровни «Опытный»/«Профессионал»
// добавляются позже прямо в EditorScreen (своя картинка на каждый уровень,
// план реализации §3) — иначе создание викторины требовало бы подготовить
// сразу три файла, прежде чем увидеть редактор вообще. Реальные
// width/height берутся из самого файла (не вписываются вручную) — та же
// дисциплина измерения, что закрыла критичную находку финального ревью
// Фазы 1 РусIQ (несоответствие заявленных и реальных размеров).

import React, { useState } from 'react';

export interface NewQuizResult {
  title: string;
  level1ImageBuffer: ArrayBuffer;
  level1ImageMimeType: string;
  level1ImageWidth: number;
  level1ImageHeight: number;
}

interface Props {
  onCreate: (result: NewQuizResult) => void;
  onCancel: () => void;
}

const ACCEPTED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

function readImageDimensions(objectUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Не удалось прочитать изображение'));
    img.src = objectUrl;
  });
}

const NewQuizModal: React.FC<Props> = ({ onCreate, onCancel }) => {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = title.trim().length > 0 && file !== null && !busy;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !ACCEPTED_MIME_TYPES.includes(file.type)) {
      setError('Выберите файл изображения (PNG, JPEG, GIF или WEBP)');
      return;
    }
    setBusy(true);
    setError(null);
    const objectUrl = URL.createObjectURL(file);
    try {
      const { width, height } = await readImageDimensions(objectUrl);
      const level1ImageBuffer = await file.arrayBuffer();
      onCreate({ title: title.trim(), level1ImageBuffer, level1ImageMimeType: file.type, level1ImageWidth: width, level1ImageHeight: height });
    } catch {
      setError('Не удалось прочитать изображение');
      setBusy(false);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  return (
    <div className="ciq-modal-backdrop" onClick={onCancel}>
      <form className="ciq-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h3>Новая викторина</h3>
        <label className="ciq-field">
          Название
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className="ciq-input" />
        </label>
        <label className="ciq-field">
          Изображение-карта для уровня «Начинающий»
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="ciq-input"
            style={{ padding: '8px 6px' }}
          />
        </label>
        <p style={{ fontSize: 12, color: '#4a7a68', margin: '2px 0 0' }}>
          Картинки для «Опытного» и «Профессионала» можно добавить сразу после создания — переключитесь на нужную вкладку уровня в редакторе.
        </p>
        {error && <p className="ciq-error">{error}</p>}
        <div className="ciq-modal-actions">
          <button type="button" onClick={onCancel} className="ciq-btn ciq-btn-ghost">
            Отмена
          </button>
          <button type="submit" disabled={!canSubmit} className="ciq-btn">
            Создать
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewQuizModal;
