// packages/natcom-student-web/src/StudentStage.tsx
// Тот же принцип, что packages/player/src/natcom/player/PlayerStage.tsx
// (read-only показ, геометрия через toPixelRect) - отдельная копия, т.к.
// этот пакет не может импортировать код player'а (тот завязан на Electron
// IPC/protocol-хендлеры, недоступные в обычной вкладке браузера).

import React from 'react';
import { Stage, Layer, Image as KonvaImage, Group, Rect } from 'react-konva';
import type { NatComLibrary, ProjectObject } from '@kiosk/shared';
import { toPixelRect } from '@kiosk/shared';
import { useHtmlImage } from './useHtmlImage';
import { resolveMediaUrl } from './mediaUrl';

interface StudentObjectNodeProps {
  object: ProjectObject;
  library: NatComLibrary;
  boardWidthPx: number;
  boardHeightPx: number;
  onClick: () => void;
}

const StudentObjectNode: React.FC<StudentObjectNodeProps> = ({ object, library, boardWidthPx, boardHeightPx, onClick }) => {
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
      <Rect width={px.width} height={px.height} fill="transparent" listening />
      {image ? <KonvaImage image={image} width={px.width} height={px.height} listening={false} /> : null}
    </Group>
  );
};

interface StudentStageProps {
  library: NatComLibrary;
  backgroundUrl: string | null;
  objects: ProjectObject[];
  boardWidthPx: number;
  boardHeightPx: number;
  onObjectClick: (objectId: string) => void;
}

const StudentStage: React.FC<StudentStageProps> = ({ library, backgroundUrl, objects, boardWidthPx, boardHeightPx, onObjectClick }) => {
  const backgroundImage = useHtmlImage(backgroundUrl);

  return (
    <Stage width={boardWidthPx} height={boardHeightPx}>
      <Layer>
        {backgroundImage && (
          <KonvaImage image={backgroundImage} x={0} y={0} width={boardWidthPx} height={boardHeightPx} listening={false} />
        )}
        {objects.map((object) => (
          <StudentObjectNode
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

export default StudentStage;
