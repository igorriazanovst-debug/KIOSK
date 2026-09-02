// packages/editor-web/src/components/ChronolineEditorModal.tsx
// Read-only галерея готовых шаблонов «Хронолинии» (Фаза 7 плана) —
// НЕ редактор контента: контент по-прежнему создаётся только на устройстве
// (см. ChronolinePropertiesSection.tsx). Выбор здесь ни на что не влияет —
// это витрина «как это может выглядеть», без сохранения куда-либо.

import React, { useState } from 'react';
import { CHRONO_TEMPLATES } from '../chronoTemplates';
import ChronolinePreview from './ChronolinePreview';
import './ChronolineEditorModal.css';

interface Props {
  onClose: () => void;
}

const ChronolineEditorModal: React.FC<Props> = ({ onClose }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = CHRONO_TEMPLATES[selectedIndex];

  return (
    <div className="chrono-editor-backdrop" onMouseDown={(e) => e.stopPropagation()}>
      <div className="chrono-editor-modal">
        <div className="chrono-editor-header">
          <h3>🕒 Шаблоны «Хронолинии»</h3>
          <button onClick={onClose}>Закрыть</button>
        </div>

        <p className="chrono-editor-note">
          Только просмотр. Сами линии, события и медиа создаются педагогом локально на устройстве после установки —
          выбор шаблона здесь ничего не сохраняет и не меняет в этом проекте.
        </p>

        {CHRONO_TEMPLATES.length === 0 ? (
          <div className="chrono-editor-empty">Шаблонов пока нет.</div>
        ) : (
          <div className="chrono-editor-body">
            <div className="chrono-editor-list">
              {CHRONO_TEMPLATES.map((tpl, index) => (
                <button
                  key={tpl.fileName}
                  type="button"
                  className={`chrono-editor-card${index === selectedIndex ? ' chrono-editor-card--active' : ''}`}
                  onClick={() => setSelectedIndex(index)}
                >
                  <div className="chrono-editor-card-title">{tpl.project.name}</div>
                  <div className="chrono-editor-card-meta">
                    {tpl.project.timelines.length} лин. · {tpl.project.timelines.reduce((s, t) => s + t.events.length, 0)} соб.
                  </div>
                </button>
              ))}
            </div>

            <div className="chrono-editor-preview">
              {selected && <ChronolinePreview key={selected.fileName} project={selected.project} widthPx={720} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChronolineEditorModal;
