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

import React, { useRef, useState } from 'react';
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
  const [soundPlaying, setSoundPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const libraryObject = library.objects.find((o) => o.id === object.libraryObjectId);
  const imageUrl = resolveMediaUrl(library, libraryObject?.imageMediaId ?? null);
  const animationUrl = resolveMediaUrl(library, libraryObject?.animationMediaId ?? null);
  // T5-112: звук без видео - для объектов, у которых нашлась реальная
  // звукозапись, но нет (дорогого в производстве) видео поведения.
  const soundUrl = animationUrl ? null : resolveMediaUrl(library, libraryObject?.soundMediaId ?? null);
  const title = object.titleOverride || libraryObject?.name || 'Объект';
  const description = object.descriptionOverride || libraryObject?.description || '';

  const toggleSound = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (soundPlaying) {
      audio.pause();
      audio.currentTime = 0;
      setSoundPlaying(false);
    } else {
      audio.play();
      setSoundPlaying(true);
    }
  };

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
            <>
              <img className="natcom-detail-card__image" src={imageUrl} alt={title} />
              {soundUrl && (
                <>
                  <audio
                    ref={audioRef}
                    src={soundUrl}
                    onEnded={() => setSoundPlaying(false)}
                  />
                  <button className="natcom-detail-card__sound" onClick={toggleSound}>
                    {soundPlaying ? '⏸ Остановить звук' : '▶ Звук животного'}
                  </button>
                </>
              )}
            </>
          ) : null}
        </div>
        <h2 className="natcom-detail-card__title">{title}</h2>
        <p className="natcom-detail-card__description">{description}</p>
      </div>
    </div>
  );
};

export default ObjectDetailCard;
