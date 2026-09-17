// packages/player/src/physastroiq/screens/ThematicGalleryScreen.tsx
//
// FR-021/FR-022 ТЗ 11 (строки 342-316) — витрина методических тематических
// изображений, доступная прямо с интро-экрана (не спрятана за режим учителя:
// это справочный контент продукта, а не инструмент редактирования).

import React, { useState } from 'react';
import { PHYSASTROIQ_THEMATIC_IMAGES, physastroiqThematicImageUrl } from '../thematicImages.ts';
import '../physastroiqTheme.css';

interface Props {
  onExit: () => void;
}

const ThematicGalleryScreen: React.FC<Props> = ({ onExit }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (openIndex !== null) {
    const img = PHYSASTROIQ_THEMATIC_IMAGES[openIndex];
    return (
      <div className="ciq-page">
        <div className="ciq-page-medium" style={{ textAlign: 'center' }}>
          <h2 className="ciq-heading ciq-heading-section">{img.title}</h2>
          <div className="ciq-divider" />
          <img
            src={physastroiqThematicImageUrl(img.fileName)}
            alt={img.title}
            style={{ maxWidth: '100%', borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.5)' }}
          />
          <p style={{ marginTop: 14 }}>{img.caption}</p>
          <button onClick={() => setOpenIndex(null)} className="ciq-btn ciq-btn-muted" style={{ marginTop: 10 }}>
            Назад к списку
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ciq-page">
      <div className="ciq-page-medium" style={{ textAlign: 'center' }}>
        <h2 className="ciq-heading ciq-heading-hero">Справочные материалы</h2>
        <div className="ciq-divider" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {PHYSASTROIQ_THEMATIC_IMAGES.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setOpenIndex(i)}
              className="ciq-btn ciq-btn-muted"
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 10, height: 'auto' }}
            >
              <img
                src={physastroiqThematicImageUrl(img.fileName)}
                alt={img.title}
                style={{ width: '100%', height: 140, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }}
              />
              <span>{img.title}</span>
            </button>
          ))}
        </div>
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
