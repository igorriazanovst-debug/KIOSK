// packages/player/src/natcom/editor/ObjectRibbon.tsx
// Лента объектов активной категории (Тип5_бэклог.md, T5-061) - drag-and-drop
// на сцену через нативный HTML5 DnD (Workspace.tsx принимает drop и переводит
// экранные координаты в доли доски). Клик по миниатюре тоже добавляет объект
// (в центр доски) - на случай, если у устройства нет мыши с полноценным drag
// (сенсорный экран киоска).

import React, { useState } from 'react';
import type { NatComLibrary } from '@kiosk/shared';
import { resolveMediaUrl } from '../mediaUrl';
import './editor.css';

interface ObjectRibbonProps {
  library: NatComLibrary;
  onAddObject: (libraryObjectId: string) => void;
}

const ObjectRibbon: React.FC<ObjectRibbonProps> = ({ library, onAddObject }) => {
  const [activeCategoryId, setActiveCategoryId] = useState(library.categories[0]?.id ?? '');
  const objects = library.objects.filter((o) => o.categoryId === activeCategoryId);

  return (
    <div className="natcom-ribbon">
      <div className="natcom-ribbon__categories">
        {library.categories.map((category) => (
          <button
            key={category.id}
            className={`natcom-ribbon__category ${category.id === activeCategoryId ? 'natcom-ribbon__category--active' : ''}`}
            onClick={() => setActiveCategoryId(category.id)}
          >
            {category.name}
          </button>
        ))}
      </div>
      <div className="natcom-ribbon__objects">
        {objects.map((object) => {
          const url = resolveMediaUrl(library, object.imageMediaId);
          return (
            <div
              key={object.id}
              className="natcom-ribbon__object"
              draggable
              onDragStart={(e) => e.dataTransfer.setData('application/x-natcom-object-id', object.id)}
              onClick={() => onAddObject(object.id)}
              title={object.name}
            >
              {url ? <img src={url} alt={object.name} /> : null}
              <span>{object.name}</span>
            </div>
          );
        })}
        {objects.length === 0 && <p className="natcom-ribbon__empty">В этой категории пока нет объектов.</p>}
      </div>
    </div>
  );
};

export default ObjectRibbon;
