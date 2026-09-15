// packages/player/src/inophone/components/SceneStage.tsx
// Сцена с интерактивными объектами (ТЗ строки 86, 94).
//
// ПОДЛОЖКА И КОНТУРЫ В ОДНОМ SVG, а не картинка с наложенным сверху слоем.
// Координаты хотспотов заданы в системе viewBox сцены; положив их в тот же
// viewBox, что и подложку, мы получаем совпадение при ЛЮБОМ размере окна
// бесплатно. Наложенный отдельно слой пришлось бы пересчитывать вручную, и
// расхождение на планшете нашлось бы уже у педагога: ученик тычет в кровать,
// программа засчитывает окно.
//
// ОБЪЕКТ — КНОПКА, а не картинка с обработчиком: у него есть имя для
// озвучивания экранным диктором и он достижим с клавиатуры. Это не
// формальность — на интерактивной доске мышь есть не всегда, а требование к
// образовательному ПО по доступности проверяется на приёмке.

import React from 'react';
import type { inophone } from '@kiosk/shared';
import { palette } from '../ui';
import { conceptImageUrl, sceneImageUrl } from '../mediaUrl';

type Scene = inophone.Scene;

export interface StageProps {
  scene: Scene;
  /** Подсветить все объекты — режим обучения (ТЗ строка 89) */
  highlightAll: boolean;
  /** Что показать по итогу последнего ответа */
  verdict?: { conceptId: string; correct: boolean } | null;
  /** Пока идёт пауза показа ответа, щелчки не принимаются */
  disabled?: boolean;
  onPick: (conceptId: string) => void;
  /** Подписи объектов — названия на языке интерфейса, если попросили */
  labels?: Record<string, string>;
}

/** Центр многоугольника — куда ставить подпись */
function centroid(points: string): { x: number; y: number } {
  const pairs = points.split(' ').map((p) => p.split(',').map(Number));
  const x = pairs.reduce((s, p) => s + p[0], 0) / pairs.length;
  const y = pairs.reduce((s, p) => s + p[1], 0) / pairs.length;
  return { x, y };
}

/** Рамка многоугольника — сюда вписывается рисунок предмета */
function boundingBox(points: string): { x: number; y: number; w: number; h: number } {
  const pairs = points.split(' ').map((p) => p.split(',').map(Number));
  const xs = pairs.map((p) => p[0]);
  const ys = pairs.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

const SceneStage: React.FC<StageProps> = ({
  scene,
  highlightAll,
  verdict,
  disabled,
  onPick,
  labels,
}) => {
  const { width, height } = scene.viewBox;

  return (
    <svg
      data-testid="inophone-stage"
      viewBox={`0 0 ${width} ${height}`}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        borderRadius: 18,
        background: palette.panel,
      }}
      role="group"
    >
      <image href={sceneImageUrl(scene.id)} x={0} y={0} width={width} height={height} />

      {/*
        ПРЕДМЕТЫ РИСУЕТ РАНТАЙМ, а не подложка. Раньше сборка вкладывала их
        внутрь подложки относительной ссылкой `../concepts/<id>.svg`, и в
        приложении не грузился НИ ОДИН: протокол отдаёт файл по адресу вида
        `inophonelib://asset/img%2Fscenes%2F…`, где весь путь — один
        закодированный кусок, и «..» уходит выше корня. Поле выглядело пустым,
        а в режиме обучения это маскировали подписи объектов.

        Рисунок берётся из ТЕХ ЖЕ КООРДИНАТ, что и контур попадания, поэтому
        разъехаться они больше не могут.
      */}
      {scene.hotspots.map((h) => {
        const b = boundingBox(h.points);
        return (
          <image
            key={`art-${h.conceptId}`}
            href={conceptImageUrl(h.conceptId)}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            preserveAspectRatio="xMidYMid meet"
            pointerEvents="none"
          />
        );
      })}

      {scene.hotspots.map((h) => {
        const isVerdict = verdict?.conceptId === h.conceptId;
        const stroke = isVerdict
          ? verdict!.correct
            ? palette.good
            : palette.danger
          : highlightAll
            ? palette.accent
            : 'transparent';
        const fill = isVerdict
          ? verdict!.correct
            ? 'rgba(74,157,95,0.35)'
            : 'rgba(192,68,46,0.35)'
          : highlightAll
            ? 'rgba(240,168,48,0.18)'
            : 'rgba(0,0,0,0)';

        const label = labels?.[h.conceptId];
        const c = label ? centroid(h.points) : null;

        return (
          <g key={h.conceptId}>
            <polygon
              data-testid={`inophone-hotspot-${h.conceptId}`}
              points={h.points}
              fill={fill}
              stroke={stroke}
              strokeWidth={6}
              style={{ cursor: disabled ? 'default' : 'pointer' }}
              tabIndex={disabled ? -1 : 0}
              role="button"
              aria-label={label ?? h.conceptId}
              onClick={() => {
                if (!disabled) onPick(h.conceptId);
              }}
              onKeyDown={(e) => {
                if (!disabled && (e.key === 'Enter' || e.key === ' ')) onPick(h.conceptId);
              }}
            />
            {c && (
              <text
                x={c.x}
                y={c.y}
                textAnchor="middle"
                // Подпись рисуется обводкой по контуру, а не плашкой под
                // текстом: плашка закрывала бы сам объект, который ученик и
                // должен рассмотреть
                stroke={palette.textDark}
                strokeWidth={6}
                paintOrder="stroke"
                fill={palette.text}
                fontSize={34}
                fontWeight={700}
                fontFamily="system-ui, sans-serif"
                pointerEvents="none"
              >
                {label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};

export default SceneStage;
