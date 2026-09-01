// packages/player/src/chrono/board/CompareStrip.tsx
// Полоса сравнения (Фаза 6, план: "привязана к дате, не к пикселю") -
// вертикальная линия через все дорожки на конкретной позиции ОСИ ЛЕТ, не
// на фиксированном пикселе экрана: при пане/зуме линия остаётся на той же
// дате, её пиксельная позиция каждый раз пересчитывается из axisYears
// через уже готовый axisYearsToPx (та же математика, что и у событий и
// делений шкалы - не отдельная система координат).
//
// Позиция полосы - ЭФЕМЕРНОЕ состояние взаимодействия, как и сам viewport
// (пан/зум тоже не сохраняются в project.json) - не персистентность
// project.compareStrip (schema.ts хранит только enabled/color, оформление
// на будущее, не текущую позицию).

import React from 'react';
import { useDrag } from '@use-gesture/react';
import { axisYearsToPx, type Viewport } from '@kiosk/shared';
import { pxDeltaToAxisYearsDelta } from './boardViewport.ts';
import { formatCompareStripLabel } from './compareStripLabel.ts';
import './CompareStrip.css';

export interface CompareStripProps {
  axisYears: number;
  viewport: Viewport;
  onMove: (axisYears: number) => void;
  onRemove: () => void;
}

const CompareStrip: React.FC<CompareStripProps> = ({ axisYears, viewport, onMove, onRemove }) => {
  // delta (дельта ТЕКУЩЕГО кадра), не накопленный movement от начала жеста -
  // тот же паттерн, что и у собственного пана BoardView: каждый кадр
  // прибавляется к СВЕЖЕМУ axisYears из пропсов, а не к значению на момент
  // начала перетаскивания. С накопленным movement пришлось бы либо держать
  // локальное состояние на время жеста (как в EventNode.tsx), либо
  // рисковать рассинхроном между movement и уже обновившимся axisYears
  // после каждого onMove.
  const bindDrag = useDrag(({ delta: [dx], event: nativeEvent }) => {
    // Та же причина, что и у ручек resize события (EventNode.tsx) - полоса
    // лежит внутри области дорожек, которая слушает те же pointer-события
    // для собственного пана.
    nativeEvent.stopPropagation();
    onMove(axisYears + pxDeltaToAxisYearsDelta(dx, viewport));
  });

  const left = axisYearsToPx(axisYears, viewport);

  return (
    <div className="chrono-compare-strip" style={{ left }}>
      <div className="chrono-compare-strip__line" />
      <div className="chrono-compare-strip__handle" {...bindDrag()}>
        <span className="chrono-compare-strip__label">{formatCompareStripLabel(axisYears)}</span>
        <button
          type="button"
          className="chrono-compare-strip__remove"
          title="Убрать полосу сравнения"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default CompareStrip;
