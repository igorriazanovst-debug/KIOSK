// packages/player/src/rusiq/editor/NewQuizModal.tsx
// Модальный шаг "название+фон" ПЕРЕД открытием EditorScreen - спека Фазы
// 2a, разд. 2.1.1: RusiqQuizSchema.image обязателен (не nullable), поэтому
// не может существовать промежуточного состояния "викторина без фона" как
// валидного RusiqQuiz. Реальные width/height берутся из самого файла (не
// вписываются вручную) - та же дисциплина, что закрыла критичную находку
// финального ревью Фазы 1 (несоответствие заявленных и реальных размеров).

import React, { useState } from 'react';

export interface NewQuizResult {
  title: string;
  imageBuffer: ArrayBuffer;
  imageMimeType: string;
  imageWidth: number;
  imageHeight: number;
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
      const imageBuffer = await file.arrayBuffer();
      onCreate({ title: title.trim(), imageBuffer, imageMimeType: file.type, imageWidth: width, imageHeight: height });
    } catch {
      setError('Не удалось прочитать изображение');
      setBusy(false);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  return (
    <div
      onClick={onCancel}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        style={{ background: '#fff', padding: 24, borderRadius: 8, width: 360, fontFamily: 'sans-serif' }}
      >
        <h3>Новая викторина</h3>
        <label style={{ display: 'block', marginBottom: 12 }}>
          Название
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ display: 'block', width: '100%', padding: 8, marginTop: 4 }}
          />
        </label>
        <label style={{ display: 'block', marginBottom: 12 }}>
          Фоновое изображение
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        {error && <p style={{ color: '#c0392b' }}>{error}</p>}
        <div style={{ textAlign: 'right', marginTop: 16 }}>
          <button type="button" onClick={onCancel} style={{ marginRight: 8 }}>
            Отмена
          </button>
          <button type="submit" disabled={!canSubmit}>
            Создать
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewQuizModal;
