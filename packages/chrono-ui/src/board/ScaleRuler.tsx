// packages/player/src/chrono/board/ScaleRuler.tsx
// Шкала времени с автоматическим пересчётом делений и обязательным
// подписанием при изменении масштаба (строка 25 ТЗ). Чистый рендер поверх
// уже готового домена — сама логика подбора шага и позиционирования живёт
// в @kiosk/shared (generateTicks/axisYearsToPx), эта компонента только
// раскладывает результат по DOM (абсолютное позиционирование, как у
// эталона — Хронолайнер_план_реализации.md, Фаза 3, п.20).

import React, { useMemo } from 'react';
import { generateTicks, axisYearsToPx, type Viewport } from '@kiosk/shared';
import { visibleAxisRange } from './boardViewport.js';
import { formatTickLabel } from './tickLabel.js';
import { computeTodayMarkerPx } from './todayMarker.js';
import './ScaleRuler.css';

export interface ScaleRulerProps {
  viewport: Viewport;
  /** Сколько делений примерно уместить в видимой области (не точное число — реальное зависит от "красивого" шага) */
  targetTickCount?: number;
  heightPx?: number;
}

const ScaleRuler: React.FC<ScaleRulerProps> = ({ viewport, targetTickCount = 8, heightPx = 40 }) => {
  const ticks = useMemo(() => {
    const range = visibleAxisRange(viewport);
    return generateTicks(range.start, range.end, targetTickCount);
    // viewport передаётся объектом, но пересчёт должен реагировать именно
    // на его поля, а не на ссылочное равенство — иначе смена только
    // widthPx (ресайз окна) без изменения центра/охвата не даст новый
    // список делений.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewport.centerAxisYears, viewport.spanAxisYears, viewport.widthPx, targetTickCount]);

  // FR-030 ТЗ: маркер текущей даты на шкале, только если она попадает в
  // видимый диапазон. "now" не тикает live таймером - обновляется вместе с
  // обычным ре-рендером доски (пан/зум/правки), этого достаточно для
  // масштаба "школьный урок", отдельный интервал ради минутной точности не
  // оправдан.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const todayMarkerPx = useMemo(() => computeTodayMarkerPx(viewport, new Date()), [
    viewport.centerAxisYears,
    viewport.spanAxisYears,
    viewport.widthPx,
  ]);

  return (
    <div className="chrono-scale-ruler" style={{ width: viewport.widthPx, height: heightPx }}>
      {todayMarkerPx !== null && (
        <div className="chrono-scale-today-marker" style={{ left: todayMarkerPx }}>
          <div className="chrono-scale-today-marker-line" />
          <span className="chrono-scale-today-marker-label">Сегодня</span>
        </div>
      )}
      {ticks.map((tick) => {
        const px = axisYearsToPx(tick.axisYears, viewport);
        return (
          <div
            key={`${tick.unit}-${tick.axisYears}`}
            className="chrono-scale-tick"
            style={{ left: px }}
          >
            <div className="chrono-scale-tick-line" />
            <span className="chrono-scale-tick-label">{formatTickLabel(tick)}</span>
          </div>
        );
      })}
    </div>
  );
};

export default ScaleRuler;
