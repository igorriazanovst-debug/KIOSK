// packages/player/src/natcom/player/PlayerStage.tsx
// Read-only показ презентации (Тип5_бэклог.md, Эпик 8, T5-070) - аналог
// Workspace оригинала в режиме просмотра: та же геометрия (toPixelRect,
// доля от текущего размера доски), но без Transformer/drag/ribbon - у
// объектов есть только клик, открывающий карточку (T5-071).

import React from 'react';
import { Stage, Layer, Image as KonvaImage, Group, Rect } from 'react-konva';
import type { NatComLibrary, ProjectObject } from '@kiosk/shared';
import { toPixelRect } from '@kiosk/shared';
import { useHtmlImage } from '../useHtmlImage';
import { resolveMediaUrl } from '../mediaUrl';

interface PlayerObjectNodeProps {
  object: ProjectObject;
  library: NatComLibrary;
  boardWidthPx: number;
  boardHeightPx: number;
  onClick: () => void;
}

const PlayerObjectNode: React.FC<PlayerObjectNodeProps> = ({ object, library, boardWidthPx, boardHeightPx, onClick }) => {
  const libraryObject = library.objects.find((o) => o.id === object.libraryObjectId);
  const imageUrl = resolveMediaUrl(library, libraryObject?.imageMediaId ?? null);
  const image = useHtmlImage(imageUrl);

  const px = toPixelRect(object, boardWidthPx, boardHeightPx);
  const centerX = px.x + px.width / 2;
  const centerY = px.y + px.height / 2;

  return (
    <Group
      x={centerX}
      y={centerY}
      offsetX={px.width / 2}
      offsetY={px.height / 2}
      rotation={object.rotation}
      scaleX={object.flip ? -1 : 1}
      scaleY={1}
      onClick={onClick}
      onTap={onClick}
    >
      {/* Невидимый перехватчик кликов - без него, пока картинка не
          загрузилась, Konva не находит объект под курсором (см. тот же
          баг/фикс в Workspace.tsx, Эпик 7). */}
      <Rect width={px.width} height={px.height} fill="transparent" listening />
      {image ? <KonvaImage image={image} width={px.width} height={px.height} listening={false} /> : null}
    </Group>
  );
};

interface PlayerStageProps {
  library: NatComLibrary;
  backgroundUrl: string | null;
  objects: ProjectObject[];
  boardWidthPx: number;
  boardHeightPx: number;
  onObjectClick: (objectId: string) => void;
}

const PlayerStage: React.FC<PlayerStageProps> = ({ library, backgroundUrl, objects, boardWidthPx, boardHeightPx, onObjectClick }) => {
  const backgroundImage = useHtmlImage(backgroundUrl);

  return (
    <Stage width={boardWidthPx} height={boardHeightPx}>
      <Layer>
        {backgroundImage && (
          <KonvaImage image={backgroundImage} x={0} y={0} width={boardWidthPx} height={boardHeightPx} listening={false} />
        )}
        {objects.map((object) => (
          <PlayerObjectNode
            key={object.id}
            object={object}
            library={library}
            boardWidthPx={boardWidthPx}
            boardHeightPx={boardHeightPx}
            onClick={() => onObjectClick(object.id)}
          />
        ))}
      </Layer>
    </Stage>
  );
};

export default PlayerStage;
