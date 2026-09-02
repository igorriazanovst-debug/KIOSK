// packages/player/src/chrono/board/OverviewScale.tsx
// Обзорная шкала снизу: показывает ВЕСЬ охват проекта одним взглядом, с
// окном "текущий видимый viewport" поверх. Сама полоса — переиспользует
// ScaleRuler на другом, более крупном Viewport (обзорном), а не отдельная
// система координат.
//
// Три жеста, все по той же схеме "delta каждого кадра применяется сразу",
// что и у пана/зума основной доски (BoardView.tsx) - не накопленный
// movement, коммитящийся только в конце:
//   - перетаскивание окна целиком - панорамирование viewport;
//   - растягивание одной из двух ручек по краям окна - resizeViewportWindow;
//   - клик по полосе МИМО окна - мгновенный прыжок центра viewport туда.

import React, { useMemo, useRef } from 'react';
import { useDrag } from '@use-gesture/react';
import { pxToAxisYears, type ChronoTimeline, type Viewport } from '@kiosk/shared';
import ScaleRuler from './ScaleRuler.js';
import { computeOverviewRange, windowBoundsPx } from './overviewMath.js';
import { pxDeltaToAxisYearsDelta, resizeViewportWindow } from './boardViewport.js';
import './OverviewScale.css';

export interface OverviewScaleProps {
  timelines: ChronoTimeline[];
  viewport: Viewport;
  onViewportChange: (viewport: Viewport) => void;
  widthPx: number;
  heightPx?: number;
}

const HANDLE_WIDTH_PX = 6;

const OverviewScale: React.FC<OverviewScaleProps> = ({ timelines, viewport, onViewportChange, widthPx, heightPx = 46 }) => {
  const trackRef = useRef<HTMLDivElement>(null);

  const overview = useMemo(
    () => computeOverviewRange(timelines, widthPx, viewport),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timelines, viewport.centerAxisYears, viewport.spanAxisYears, widthPx]
  );

  const bounds = windowBoundsPx(viewport, overview);

  const bindWindowDrag = useDrag(({ delta: [dx], event: nativeEvent }) => {
    nativeEvent.stopPropagation();
    onViewportChange({ ...viewport, centerAxisYears: viewport.centerAxisYears + pxDeltaToAxisYearsDelta(dx, overview) });
  });

  const bindResizeStart = useDrag(({ delta: [dx], event: nativeEvent }) => {
    nativeEvent.stopPropagation();
    onViewportChange(resizeViewportWindow(viewport, 'start', pxDeltaToAxisYearsDelta(dx, overview)));
  });

  const bindResizeEnd = useDrag(({ delta: [dx], event: nativeEvent }) => {
    nativeEvent.stopPropagation();
    onViewportChange(resizeViewportWindow(viewport, 'end', pxDeltaToAxisYearsDelta(dx, overview)));
  });

  const handleTrackClick = (e: React.MouseEvent) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    onViewportChange({ ...viewport, centerAxisYears: pxToAxisYears(e.clientX - rect.left, overview) });
  };

  return (
    <div className="chrono-overview" style={{ width: widthPx, height: heightPx }} ref={trackRef} onClick={handleTrackClick}>
      <ScaleRuler viewport={overview} heightPx={heightPx} targetTickCount={6} />
      <div className="chrono-overview__window" style={{ left: bounds.left, width: bounds.width }} {...bindWindowDrag()}>
        <div
          className="chrono-overview__handle chrono-overview__handle--start"
          style={{ width: HANDLE_WIDTH_PX }}
          {...bindResizeStart()}
        />
        <div
          className="chrono-overview__handle chrono-overview__handle--end"
          style={{ width: HANDLE_WIDTH_PX }}
          {...bindResizeEnd()}
        />
      </div>
    </div>
  );
};

export default OverviewScale;
