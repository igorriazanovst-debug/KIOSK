// packages/natcom-student-web/src/StudentDetailCard.tsx
// Тот же принцип, что packages/player/src/natcom/player/ObjectDetailCard.tsx
// (карточка объекта: увеличенное изображение или видео поведения с кнопкой
// звука, заголовок, описание - только чтение).

import React, { useState } from 'react';
import type { NatComLibrary, ProjectObject } from '@kiosk/shared';
import { resolveMediaUrl } from './mediaUrl';

interface StudentDetailCardProps {
  library: NatComLibrary;
  object: ProjectObject;
  onClose: () => void;
}

const StudentDetailCard: React.FC<StudentDetailCardProps> = ({ library, object, onClose }) => {
  const [muted, setMuted] = useState(true);
  const libraryObject = library.objects.find((o) => o.id === object.libraryObjectId);
  const imageUrl = resolveMediaUrl(library, libraryObject?.imageMediaId ?? null);
  const animationUrl = resolveMediaUrl(library, libraryObject?.animationMediaId ?? null);
  const title = object.titleOverride || libraryObject?.name || 'Объект';
  const description = object.descriptionOverride || libraryObject?.description || '';

  return (
    <div className="detail-card__overlay" onClick={onClose}>
      <div className="detail-card" onClick={(e) => e.stopPropagation()}>
        <button className="detail-card__close" onClick={onClose}>
          Закрыть
        </button>
        <div className="detail-card__media">
          {animationUrl ? (
            <>
              <video className="detail-card__video" src={animationUrl} autoPlay loop muted={muted} playsInline />
              <button className="detail-card__sound" onClick={() => setMuted((m) => !m)}>
                Звук: {muted ? 'выкл' : 'вкл'}
              </button>
            </>
          ) : imageUrl ? (
            <img className="detail-card__image" src={imageUrl} alt={title} />
          ) : null}
        </div>
        <h2 className="detail-card__title">{title}</h2>
        <p className="detail-card__description">{description}</p>
      </div>
    </div>
  );
};

export default StudentDetailCard;
