// packages/player/src/inophone/screens/CatalogueScreen.tsx
// Каталог тем и сцен (ТЗ строка 97).
//
// Темы РАСКРЫВАЮТСЯ НА МЕСТЕ, а не открывают отдельный экран сцен. Тем по ТЗ
// не меньше пяти, сцен не меньше тридцати одной: список из пяти строк, за
// каждой из которых спрятан ещё один экран, заставляет педагога ходить
// туда-сюда, чтобы вспомнить, где какая сцена. Раскрытый список показывает
// всё сразу.

import React from 'react';
import { inophone } from '@kiosk/shared';
import type { LanguageCode } from '../types';
import { Panel, ScreenHeader, palette } from '../ui';
import type { InophoneLibrary } from '../types';

interface Props {
  library: InophoneLibrary;
  interfaceLanguage: LanguageCode;
  onOpenScene: (sceneId: string) => void;
  onBack: () => void;
  right?: React.ReactNode;
}

const CatalogueScreen: React.FC<Props> = ({
  library,
  interfaceLanguage,
  onOpenScene,
  onBack,
  right,
}) => (
  <div>
    <ScreenHeader title="Темы" onBack={onBack} right={right} />

    <div style={{ display: 'grid', gap: 20 }}>
      {library.themes.map((theme) => {
        const scenes = theme.sceneIds
          .map((id) => library.scenes.find((s) => s.id === id))
          .filter((s): s is NonNullable<typeof s> => !!s);
        return (
          <Panel key={theme.id}>
            <div style={{ fontSize: 26, fontWeight: 700, color: palette.accent, marginBottom: 12 }}>
              {inophone.localTitle(theme.titles, interfaceLanguage)}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: 12,
              }}
            >
              {scenes.map((scene) => (
                <button
                  key={scene.id}
                  type="button"
                  data-testid={`inophone-scene-${scene.id}`}
                  onClick={() => onOpenScene(scene.id)}
                  style={{
                    background: palette.panelEdge,
                    color: palette.text,
                    border: 'none',
                    borderRadius: 12,
                    minHeight: 64,
                    padding: '12px 16px',
                    fontSize: 20,
                    fontWeight: 600,
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  {inophone.localTitle(scene.titles, interfaceLanguage)}
                  <div style={{ fontSize: 15, fontWeight: 400, color: palette.textDim }}>
                    объектов: {scene.hotspots.length}
                  </div>
                </button>
              ))}
            </div>
          </Panel>
        );
      })}
    </div>
  </div>
);

export default CatalogueScreen;
