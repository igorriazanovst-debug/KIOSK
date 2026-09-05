// packages/shared/src/naturalCommunities/model/geometry.ts
// Пересчёт объекта на сцене между "хранимым" видом (доли 0..1 от размера
// доски, см. ProjectObjectSchema в schema.ts) и "экранным" видом (реальные
// пиксели текущей доски) - решает ту же задачу, что convertObject/
// scaleObject у оригинала ("плакат одинаково раскладывается при разных
// масштабах области", ТЗ раздел 6), но без хранения опорного размера:
// умножение/деление на текущую ширину/высоту доски - чистые, детерминированные
// функции, не зависящие ни от какого состояния.

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FractionalRect {
  xFraction: number;
  yFraction: number;
  widthFraction: number;
  heightFraction: number;
}

/** Доли (0..1) → пиксели текущей доски */
export function toPixelRect(fractional: FractionalRect, boardWidthPx: number, boardHeightPx: number): PixelRect {
  return {
    x: fractional.xFraction * boardWidthPx,
    y: fractional.yFraction * boardHeightPx,
    width: fractional.widthFraction * boardWidthPx,
    height: fractional.heightFraction * boardHeightPx,
  };
}

/** Пиксели текущей доски → доли (0..1) - обратная операция, для сохранения после перетаскивания/ресайза объекта на сцене */
export function toFractionalRect(pixel: PixelRect, boardWidthPx: number, boardHeightPx: number): FractionalRect {
  if (boardWidthPx <= 0 || boardHeightPx <= 0) {
    throw new RangeError(`toFractionalRect: board dimensions must be positive, got ${boardWidthPx}x${boardHeightPx}`);
  }
  return {
    xFraction: pixel.x / boardWidthPx,
    yFraction: pixel.y / boardHeightPx,
    widthFraction: pixel.width / boardWidthPx,
    heightFraction: pixel.height / boardHeightPx,
  };
}
