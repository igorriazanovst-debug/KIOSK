// packages/player/src/natcom/editor/ObjectEditPanel.tsx
// Правка заголовка/описания объекта на сцене (Тип5_бэклог.md, T5-063) -
// простое контролируемое текстовое поле поверх библиотечного значения, НЕ
// полноценный rich-text (по решению бэклога - для двух коротких строк это
// избыточно).

import React from 'react';
import type { NatComLibrary, ProjectObject } from '@kiosk/shared';
import './editor.css';

interface ObjectEditPanelProps {
  library: NatComLibrary;
  object: ProjectObject;
  onChange: (patch: Partial<Pick<ProjectObject, 'titleOverride' | 'descriptionOverride'>>) => void;
}

const ObjectEditPanel: React.FC<ObjectEditPanelProps> = ({ library, object, onChange }) => {
  const libraryObject = library.objects.find((o) => o.id === object.libraryObjectId);

  return (
    <div className="natcom-edit-panel">
      <h3>{libraryObject?.name ?? 'Объект'}</h3>
      <label className="natcom-edit-panel__field">
        <span>Заголовок (необязательно, заменяет название из библиотеки)</span>
        <input
          value={object.titleOverride ?? ''}
          placeholder={libraryObject?.name}
          onChange={(e) => onChange({ titleOverride: e.target.value || null })}
        />
      </label>
      <label className="natcom-edit-panel__field">
        <span>Описание (необязательно, заменяет описание из библиотеки)</span>
        <textarea
          value={object.descriptionOverride ?? ''}
          placeholder={libraryObject?.description}
          rows={4}
          onChange={(e) => onChange({ descriptionOverride: e.target.value || null })}
        />
      </label>
    </div>
  );
};

export default ObjectEditPanel;
