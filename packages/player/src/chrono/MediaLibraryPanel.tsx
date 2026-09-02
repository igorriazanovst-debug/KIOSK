// packages/player/src/chrono/MediaLibraryPanel.tsx
// Единая медиатека проекта (FR-020 ТЗ: "показ/добавление/удаление всех
// медиафайлов хронолинии в одном месте") - до этого медиа управлялось
// только поштучно, через карточку конкретного события (EventDetailCard).
// Здесь - весь project.media[] разом, независимо от того, к какому
// событию (если вообще к какому-то) файл прикреплён.

import React from 'react';
import type { ChronoMedia } from '@kiosk/shared';
import './MediaLibraryPanel.css';

export interface MediaLibraryPanelProps {
  media: ChronoMedia[];
  getMediaUrl: (media: ChronoMedia) => string;
  onAdd: () => void;
  adding: boolean;
  onDelete: (media: ChronoMedia) => void;
  onClose: () => void;
}

const MediaLibraryPanel: React.FC<MediaLibraryPanelProps> = ({ media, getMediaUrl, onAdd, adding, onDelete, onClose }) => {
  const handleDelete = (m: ChronoMedia) => {
    if (!window.confirm(`Удалить «${m.fileName}» из медиатеки? Файл открепится от всех событий, где он используется.`)) {
      return;
    }
    onDelete(m);
  };

  return (
    <div className="chrono-media-library__overlay" onClick={onClose}>
      <div className="chrono-media-library" onClick={(e) => e.stopPropagation()}>
        <h3 className="chrono-media-library__title">Медиатека проекта</h3>

        <div className="chrono-media-library__grid">
          {media.map((m) => (
            <div key={m.id} className="chrono-media-library__item" title={m.fileName}>
              {m.mimeType.startsWith('image/') ? (
                <img src={getMediaUrl(m)} alt={m.fileName} />
              ) : (
                <div className="chrono-media-library__placeholder">
                  {m.mimeType.startsWith('video/') ? '🎬' : m.mimeType.startsWith('audio/') ? '🎵' : '📄'}
                </div>
              )}
              <span className="chrono-media-library__item-name">{m.fileName}</span>
              <button
                type="button"
                className="chrono-media-library__item-delete"
                title="Удалить из медиатеки"
                onClick={() => handleDelete(m)}
              >
                ×
              </button>
            </div>
          ))}
          {media.length === 0 && <div className="chrono-media-library__empty">Медиатека пуста</div>}
        </div>

        <div className="chrono-media-library__actions">
          <button type="button" onClick={onAdd} disabled={adding}>
            {adding ? '…' : '+ Добавить файл'}
          </button>
          <span className="chrono-media-library__actions-spacer" />
          <button type="button" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

export default MediaLibraryPanel;
