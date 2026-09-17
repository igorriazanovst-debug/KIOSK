// packages/player/src/physastroiq/screens/ThematicGalleryScreen.tsx
//
// FR-021…FR-024 ТЗ 11 (строки 342–345) — витрина методических тематических
// изображений, доступная прямо с интро-экрана (не спрятана за режим учителя:
// это справочный контент продукта, а не инструмент редактирования).
//
// ПОЧЕМУ ДВА РАЗДЕЛА, А НЕ ОДНА ОБЩАЯ СЕТКА. Требования к физике (FR-022,
// ≥ 6 по основным разделам) и к астрономии (FR-023, ≥ 4; FR-024, три
// названные темы) РАЗНЫЕ, и выполнение каждого проверяется отдельно. Общий
// список из четырнадцати плиток пересчитать по предметам можно только вручную
// — а на экране, разделённом по предметам, и педагог, и приёмка видят состав
// сразу.

import React, { useState } from 'react';
import {
  PHYSASTROIQ_THEMATIC_IMAGES,
  physastroiqThematicImageUrl,
  physastroiqImagesBySubject,
  type PhysastroiqSubject,
} from '../thematicImages.ts';
import '../physastroiqTheme.css';

interface Props {
  onExit: () => void;
}

const SUBJECTS: { id: PhysastroiqSubject; russian: string }[] = [
  { id: 'physics', russian: 'Физика' },
  { id: 'astronomy', russian: 'Астрономия' },
];

const ThematicGalleryScreen: React.FC<Props> = ({ onExit }) => {
  // Открытая картинка помнится по идентификатору, а не по номеру в списке:
  // плитки теперь разложены по двум разделам, и номер в общем массиве перестал
  // совпадать с тем, что видно на экране.
  const [openId, setOpenId] = useState<string | null>(null);

  const open = openId ? PHYSASTROIQ_THEMATIC_IMAGES.find((i) => i.id === openId) : undefined;

  if (open) {
    return (
      <div className="ciq-page">
        <div className="ciq-page-medium" style={{ textAlign: 'center' }} data-testid="physastroiq-thematic-view">
          <h2 className="ciq-heading ciq-heading-section">{open.title}</h2>
          <div className="ciq-divider" />
          <img
            src={physastroiqThematicImageUrl(open.fileName)}
            alt={open.title}
            style={{ maxWidth: '100%', borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.5)' }}
          />
          <p style={{ marginTop: 14 }}>{open.caption}</p>
          <button onClick={() => setOpenId(null)} className="ciq-btn ciq-btn-muted" style={{ marginTop: 10 }}>
            Назад к списку
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ciq-page">
      <div className="ciq-page-medium" style={{ textAlign: 'center' }} data-testid="physastroiq-thematic-gallery">
        <h2 className="ciq-heading ciq-heading-hero">Справочные материалы</h2>
        <div className="ciq-divider" />

        {SUBJECTS.map((subject) => {
          const images = physastroiqImagesBySubject(subject.id);
          return (
            <section key={subject.id} data-testid={`physastroiq-thematic-${subject.id}`} style={{ marginBottom: 26 }}>
              <h3 className="ciq-heading ciq-heading-section" style={{ textAlign: 'left', marginBottom: 10 }}>
                {subject.russian}
                <span style={{ opacity: 0.6, fontWeight: 400, marginLeft: 10, fontSize: '0.8em' }}>
                  {images.length} изобр.
                </span>
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                {images.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => setOpenId(img.id)}
                    className="ciq-btn ciq-btn-muted"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      padding: 10,
                      height: 'auto',
                    }}
                  >
                    <img
                      src={physastroiqThematicImageUrl(img.fileName)}
                      alt={img.title}
                      // contain, а не cover: это чертежи, а не фотографии. При
                      // обрезке по краям с карты звёздного неба пропадают
                      // созвездия, а со схемы цепи — приборы, и по плитке уже
                      // не понять, что за материал за ней.
                      style={{
                        width: '100%',
                        height: 140,
                        objectFit: 'contain',
                        borderRadius: 8,
                        marginBottom: 8,
                        background: 'rgba(0,0,0,0.25)',
                      }}
                    />
                    <span>{img.title}</span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}

        <div style={{ marginTop: 20 }}>
          <button onClick={onExit} className="ciq-btn ciq-btn-muted">
            Назад
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThematicGalleryScreen;
