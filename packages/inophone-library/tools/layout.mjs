// packages/inophone-library/tools/layout.mjs
// Раскладка объектов по сцене.
//
// ГЛАВНОЕ СВОЙСТВО: контуры НЕ МОГУТ НАЛОЖИТЬСЯ. Объекты раскладываются по
// ячейкам сетки, и каждый сидит внутри своей ячейки с обязательным зазором.
// Это не осторожность, а следствие устройства игры: два перекрывающихся
// контура дают точку, где щелчок принадлежит обоим объектам, программа молча
// засчитывает нарисованный позже, и ученик не понимает, почему «неверно».
// Проверка `checkGeometry` в @kiosk/shared ловит такое, но ловить нечего, если
// раскладка не умеет их создавать.
//
// РЯДЫ РАЗНОЙ ДЛИНЫ, А НЕ РОВНАЯ ТАБЛИЦА. Четыре на три — это страница
// каталога, а не сцена; ученик разглядывает её как список и перестаёт искать
// глазами. Ряды 5–4–3 с разной высотой и разным размером предметов читаются
// как расставленные вещи.
//
// РАЗМЕР ЗАВИСИТ ОТ ПРЕДМЕТА. Шкаф, нарисованный с яблоко, узнаётся хуже
// яблока, нарисованного со шкаф: у ребёнка нет другого масштаба, кроме
// соседних предметов на той же сцене.

/** Детерминированный генератор: одна и та же сцена собирается одинаково */
function rngFor(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 100000) / 100000;
  };
}

export const VIEW = { width: 1280, height: 800 };

/** Полоса, занятая рядами объектов; выше — «небо» сцены, ниже — «пол» */
const AREA = { x: 40, y: 56, width: 1200, height: 724 };

/** Обязательный зазор между соседними объектами, в единицах viewBox */
const GAP = 18;

/**
 * Крупные предметы. Список именно ОБЪЕКТОВ, а не категорий: «мебель крупная»
 * сломалось бы на табурете, а «техника крупная» — на пульте.
 */
const BIG = new Set([
  'wardrobe', 'bed', 'sofa', 'bookcase', 'fridge', 'stove', 'washer', 'bath', 'cot',
  'desk', 'table', 'house', 'shelves', 'fridge_shop', 'hospitalbed', 'ambulance',
  'train', 'bus', 'car', 'truck', 'tram', 'trolleybus', 'plane', 'helicopter',
  'tractor', 'ship', 'greenhouse', 'lighthouse', 'mountain', 'tree', 'fir', 'piano',
  'stage', 'goal', 'schooldesk', 'blackboard', 'counter', 'coathanger', 'waitingroom',
  'gymhall', 'canteen', 'corridor', 'metro', 'cave', 'waterfall', 'bridge', 'road',
  'horse', 'cow', 'sea_water', 'beach', 'lawn', 'field', 'wheat',
]);

/** Мелкие предметы — им нужна не столько площадь, сколько попадаемость пальцем */
const SMALL = new Set([
  'key', 'button', 'salt', 'sugar', 'straw', 'plaster', 'pricetag', 'receipt',
  'chalk', 'rubber', 'sharpener', 'glue', 'coin', 'berry', 'cone', 'moss', 'bee',
  'grasshopper', 'shell', 'starfish', 'whistle', 'medal', 'notes', 'stopwatch',
  'tooth', 'finger', 'nose', 'eye', 'ear',
]);

/** Три ряда: сколько объектов в каждом и какую долю высоты он занимает */
const ROWS = [
  { count: 5, share: 0.30 },
  { count: 4, share: 0.34 },
  { count: 3, share: 0.36 },
];

/**
 * Разложить объекты сцены.
 *
 * @param {string} sceneId — зерно раскладки: одна сцена всегда собирается одинаково
 * @param {string[]} ids — идентификаторы понятий, ровно двенадцать
 * @returns {{id: string, x: number, y: number, w: number, h: number, points: string}[]}
 */
export function layoutScene(sceneId, ids) {
  const expected = ROWS.reduce((s, r) => s + r.count, 0);
  if (ids.length !== expected) {
    throw new Error(`сцена ${sceneId}: объектов ${ids.length}, а раскладка рассчитана на ${expected}`);
  }

  const rnd = rngFor(sceneId);
  const out = [];
  let cursor = 0;
  let top = AREA.y;

  for (const row of ROWS) {
    const rowHeight = AREA.height * row.share;
    const cellWidth = AREA.width / row.count;

    for (let i = 0; i < row.count; i++) {
      const id = ids[cursor++];
      const cellX = AREA.x + i * cellWidth;

      // Доля ячейки, которую займёт предмет. Крупный берёт почти всю, мелкий —
      // заметно меньше, но НЕ МЕНЬШЕ ЧЕТВЕРТИ: контур мельче примерно ста
      // единиц viewBox на доске становится непопадаемым пальцем
      const base = BIG.has(id) ? 0.9 : SMALL.has(id) ? 0.52 : 0.72;
      const wiggle = 0.92 + rnd() * 0.16;
      const scale = Math.min(0.94, base * wiggle);

      // КОНТУР КВАДРАТНЫЙ, как и сам рисунок. Иллюстрации понятий квадратные и
      // вписываются в ячейку по короткой стороне; прямоугольный контур был бы
      // ШИРЕ нарисованного предмета, и щелчок по пустому месту рядом с ним
      // засчитывался бы как попадание в предмет. Увидено на отрисованной
      // сцене: между кошкой и собакой оставался зазор, который принадлежал
      // кошке
      const maxW = cellWidth - GAP * 2;
      const maxH = rowHeight - GAP * 2;
      const side = Math.round(Math.min(maxW, maxH) * scale);
      const w = side;
      const h = side;

      // Смещение внутри свободной части ячейки. Предмет никогда не выходит за
      // её границы, поэтому соседи не пересекаются НИ ПРИ КАКИХ значениях rnd
      const slackX = maxW - w;
      const slackY = maxH - h;
      const x = Math.round(cellX + GAP + slackX * rnd());
      const y = Math.round(top + GAP + slackY * rnd());

      out.push({
        id,
        x,
        y,
        w,
        h,
        points: `${x},${y} ${x + w},${y} ${x + w},${y + h} ${x},${y + h}`,
      });
    }
    top += rowHeight;
  }

  return out;
}

export { AREA, GAP, ROWS };
