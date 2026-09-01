// packages/shared/src/chrono/scale/projection.ts
// Проекция год↔пиксель. Считается ОТНОСИТЕЛЬНО ЯКОРЯ (центра видимой
// области) — сначала вычитание, потом масштабирование — решение
// архитектурного ревью ("прочие риски", Хронолайнер_план_реализации.md,
// Фаза 2): при глубоком зуме с центром далеко от нуля (например, viewport
// на 4,5 млрд лет, всматриваемся в отдельные годы) вычитание двух больших
// чисел double ПЕРЕД делением на span даёт катастрофическую потерю
// значимости — тики начинают дрожать. Если сначала вычесть якорь (центр),
// а масштабировать уже маленькую разность, эта проблема не возникает.

export interface Viewport {
  /** Центр видимого диапазона, в приблизительных годах (toAxisYears) */
  centerAxisYears: number;
  /** Ширина видимого диапазона, в приблизительных годах — должна быть положительной */
  spanAxisYears: number;
  /** Ширина области отрисовки в пикселях */
  widthPx: number;
}

function assertValidViewport(viewport: Viewport): void {
  if (!(viewport.spanAxisYears > 0) || !Number.isFinite(viewport.spanAxisYears)) {
    throw new RangeError(`Viewport.spanAxisYears must be a positive finite number, got ${viewport.spanAxisYears}`);
  }
  if (!(viewport.widthPx > 0) || !Number.isFinite(viewport.widthPx)) {
    throw new RangeError(`Viewport.widthPx must be a positive finite number, got ${viewport.widthPx}`);
  }
}

/** Год (приблизительная ось) → пиксель X внутри области шириной viewport.widthPx */
export function axisYearsToPx(axisYears: number, viewport: Viewport): number {
  assertValidViewport(viewport);
  const deltaFromCenter = axisYears - viewport.centerAxisYears; // якорь вычитается ПЕРВЫМ действием
  const fractionOfSpan = deltaFromCenter / viewport.spanAxisYears;
  return viewport.widthPx / 2 + fractionOfSpan * viewport.widthPx;
}

/** Пиксель X → год (приблизительная ось) */
export function pxToAxisYears(px: number, viewport: Viewport): number {
  assertValidViewport(viewport);
  const fractionOfSpan = (px - viewport.widthPx / 2) / viewport.widthPx;
  return viewport.centerAxisYears + fractionOfSpan * viewport.spanAxisYears;
}
