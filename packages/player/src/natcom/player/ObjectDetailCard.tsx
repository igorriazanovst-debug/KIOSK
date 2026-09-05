// packages/player/src/natcom/player/ObjectDetailCard.tsx
// Карточка объекта по клику (Тип5_бэклог.md, T5-071) - аналог
// WorkspaceObjectDetail/WorkspaceObjectAnimation оригинала: увеличенное
// изображение (или видео поведения, если оно у объекта есть), кнопка
// звука, заголовок, описание - только чтение.
//
// Ни у одного объекта поставочной библиотеки (Эпик 6, стаб-контент) пока
// нет animationMediaId - видео-ветка кода реальным контентом не покрыта,
// это ожидаемо (реальный контент - Эпик 11); путь с картинкой без анимации
// - основной для текущего MVP.

import React, { useState } from 'react';
import type { NatComLibrary, ProjectObject } from '@kiosk/shared';
import { resolveMediaUrl } from '../mediaUrl';
import './player.css';

interface ObjectDetailCardProps {
  library: NatComLibrary;
  object: ProjectObject;
  onClose: () => void;
}

const ObjectDetailCard: React.FC<ObjectDetailCardProps> = ({ library, object, onClose }) => {
  const [muted, setMuted] = useState(true);
  const libraryObject = library.objects.find((o) => o.id === object.libraryObjectId);
  const imageUrl = resolveMediaUrl(library, libraryObject?.imageMediaId ?? null);
  const animationUrl = resolveMediaUrl(library, libraryObject?.animationMediaId ?? null);
  const title = object.titleOverride || libraryObject?.name || 'Объект';
  const description = object.descriptionOverride || libraryObject?.description || '';

  return (
    <div className="natcom-detail-card__overlay" onClick={onClose}>
      <div className="natcom-detail-card" onClick={(e) => e.stopPropagation()}>
        <button className="natcom-detail-card__close" onClick={onClose}>
          Закрыть
        </button>
        <div className="natcom-detail-card__media">
          {animationUrl ? (
            <>
              <video
                className="natcom-detail-card__video"
                src={animationUrl}
                autoPlay
                loop
                muted={muted}
                playsInline
              />
              <button className="natcom-detail-card__sound" onClick={() => setMuted((m) => !m)}>
                Звук: {muted ? 'выкл' : 'вкл'}
              </button>
            </>
          ) : imageUrl ? (
            <img className="natcom-detail-card__image" src={imageUrl} alt={title} />
          ) : null}
        </div>
        <h2 className="natcom-detail-card__title">{title}</h2>
        <p className="natcom-detail-card__description">{description}</p>
      </div>
    </div>
  );
};

export default ObjectDetailCard;
