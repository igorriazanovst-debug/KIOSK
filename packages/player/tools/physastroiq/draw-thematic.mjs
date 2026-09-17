// packages/player/tools/physastroiq/draw-thematic.mjs
//
// Рисует тематические изображения в SVG. PNG из них делает
// render-thematic.cjs тем же Chromium, что показывает их в приложении.
//
// ЧТО ЗАКРЫВАЮТ ЭТИ КАРТИНКИ:
//   FR-022 (строка 343) — тематические изображения по основным разделам
//     физики, ≥ 6 шт. Здесь 8, по одному на раздел школьного курса:
//     механика, динамика, тепловые явления, электричество, магнетизм,
//     оптика, строение атома, гидростатика;
//   FR-023 (строка 344) — по астрономии ≥ 4 шт. Здесь 6;
//   FR-024 (строка 345) — темы по астрономии названы в ТЗ дословно:
//     «строение солнечной системы, карты звездного неба, Луны». На каждую
//     по две картинки.
//
// ПОЧЕМУ РИСУЕМ САМИ, А НЕ БЕРЁМ ГОТОВОЕ. Раздел 10 ТЗ: «разработчик должен
// обеспечить законность использования всех поставляемых изображений». Схема,
// начерченная скриптом из примитивов, — собственная разработка без правовых
// вопросов; она же воспроизводима: правка описания перерисовывает картинку, и
// не нужно искать, кто и где взял исходник. Ни одного файла из эталонного
// продукта ОС3 в поставке нет.
//
// ПОЧЕМУ СХЕМА, А НЕ ФОТОГРАФИЯ. Пособие учит НАЗЫВАТЬ то, что изображено. На
// фотографии звёздного неба созвездие теряется среди звёзд поля, на снимке
// электрической цепи не видно, где кончается провод и начинается резистор. На
// схеме граница проведена, и на неё можно честно поставить кликабельную
// область: у неё есть край.
//
// ГЛАВНОЕ УСТРОЙСТВО ФАЙЛА: там, где структуры разбросаны по полю (карта
// Луны, цепь, ход лучей), структура и её подпись описываются ОДНОЙ записью, и
// точка выноски берётся из тех же чисел, которыми структура нарисована.
// Первая версия этого инструмента для Типа 10 задавала подписи отдельным
// списком с координатами «на глаз», и на отрисовке половина выносок
// показывала в пустое место рядом с органом — нашлось это глазами на
// картинке, никакой проверкой поймать это было нельзя. Теперь разойтись им
// негде. Там, где картинка — схема потока (переходы между состояниями, ряд
// планет, круг фаз Луны), подписи стоят прямо у своего объекта: выноски в
// таком рисунке только мешают.
//
// Запуск: node tools/physastroiq/draw-thematic.mjs [каталог вывода]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PALETTE as P,
  esc,
  rng,
  label,
  dot,
  line,
  vec,
  rectBody,
  batteryCell,
  switchSym,
  lampSym,
  resistorSym,
  meterSym,
  coilSym,
  particles,
  barMagnet,
  fieldLine,
  fieldPointAt,
  planetDisc,
  sunDisc,
  starGlyph,
  constellation,
  craterMark,
  boxAround,
} from './shapes.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] || path.join(HERE, 'svg');

const W = 1600;
const H = 1100;

const TOP = 150;
const BOTTOM = 1000;
// Столбцы подписей сдвинуты внутрь от краёв холста: у самого края длинная
// подпись уезжает за границу и обрезается на середине слова.
const LEFT_X = 340;
const RIGHT_X = 1240;
const MARGIN = 46;

const LABEL_SIZE = 21;
const LABEL_LEADING = 25;
/**
 * Сколько знаков помещается в строку подписи.
 *
 * Слева у текста есть LEFT_X − MARGIN пикселей, справа W − MARGIN − RIGHT_X —
 * обе величины около 294. Средняя ширина знака в Segoe UI на кегле 21 — около
 * 10,5 пикселя, отсюда 27.
 *
 * Считать знаки, а не мерить текст, — сознательное упрощение: измерить строку
 * вне браузера нечем, а запас в проверке ниже (см. checkLabelFits) взят с
 * оглядкой на это.
 */
const LABEL_LINE_CHARS = 27;

/** Разбивает подпись на строки по словам. */
function wrapLabel(text) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > LABEL_LINE_CHARS && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * Обрывает сборку, если подпись всё равно не помещается.
 *
 * ПОЧЕМУ ЭТО ОШИБКА СБОРКИ, А НЕ ПРЕДУПРЕЖДЕНИЕ. Обрезанная подпись выглядит
 * на картинке как обычный текст — читатель не знает, что у слова отрезали
 * хвост. Первый прогон этого инструмента дал ровно такую картинку: «Плечо силы
 * l₂ — от оси до линии дей» уезжало за край холста, и заметно это было только
 * глазами. Проверка должна ловить это до того, как картинка попадёт в
 * поставку.
 */
function checkLabelFits(text, lines) {
  for (const l of lines) {
    if (l.length > LABEL_LINE_CHARS) {
      throw new Error(
        `подпись не помещается в столбец: «${l}» (${l.length} знаков при пределе ${LABEL_LINE_CHARS}). ` +
          `Полная подпись: «${text}». Разбить на более короткие слова или сократить текст.`
      );
    }
  }
  if (lines.length > 3) {
    throw new Error(
      `подпись занимает ${lines.length} строки: «${text}». Больше трёх строк выноска не выдерживает — сократить.`
    );
  }
}

/**
 * Собирает картинку из описаний структур.
 *
 * Подписи-выноски раскладываются САМИ: левый столбец и правый столбец
 * сортируются по высоте своей структуры и равномерно распределяются по полю.
 * Руками расставленные подписи при любой правке рисунка начинают пересекаться
 * выносками, и поправить их — отдельная работа на каждую картинку.
 *
 * Запись без label/at подписи не получает — так в картинку попадают детали,
 * которые называть не нужно (фон, вспомогательные линии), и тексты,
 * поставленные прямо у объекта.
 *
 * @param {string} title
 * @param {{svg: string, at?: [number, number], label?: string, side?: 'left'|'right'}[]} items
 */
function compose(title, items) {
  const shapes = items.map((it) => it.svg).join('\n  ');
  const labelled = items.filter((it) => it.label && it.at);

  const columns = { left: [], right: [] };
  for (const it of labelled) columns[it.side || 'right'].push(it);

  const callouts = [];
  for (const side of ['left', 'right']) {
    const col = columns[side].slice().sort((a, b) => a.at[1] - b.at[1]);
    const tx = side === 'left' ? LEFT_X : RIGHT_X;
    const anchor = side === 'left' ? 'end' : 'start';
    // Шаг между подписями ограничен сверху, а весь столбец центрируется по
    // средней высоте своих структур.
    //
    // Раньше подписи всегда растягивались на всю высоту холста. При двух
    // подписях это разносило их в самый верх и в самый низ, и выноска шла
    // наискось через весь рисунок — на схеме атома линия к внутренней
    // оболочке пересекала ядро и обе орбиты. Ближе к своей структуре подпись
    // не только аккуратнее, но и понятнее.
    const step = col.length > 1 ? Math.min((BOTTOM - TOP) / (col.length - 1), 210) : 0;
    const span = step * (col.length - 1);
    const meanY = col.reduce((s, it) => s + it.at[1], 0) / Math.max(col.length, 1);
    const start = Math.max(TOP, Math.min(BOTTOM - span, meanY - span / 2));
    col.forEach((it, i) => {
      const ty = col.length > 1 ? start + i * step : Math.max(TOP, Math.min(BOTTOM, meanY));
      const [px, py] = it.at;
      // Короткий горизонтальный хвостик у текста, дальше прямая к структуре:
      // так видно, какой подписи принадлежит линия, даже когда линии сходятся.
      const hx = side === 'left' ? tx + 22 : tx - 22;
      const lines = wrapLabel(it.label);
      checkLabelFits(it.label, lines);
      // Многострочная подпись центрируется по своей выноске, а не свисает вниз
      // от неё: иначе линия приходит в первую строку, и подпись выглядит
      // сдвинутой относительно того, что она называет.
      const first = ty + 7 - ((lines.length - 1) * LABEL_LEADING) / 2;
      const tspans = lines
        .map((l, k) => `<tspan x="${tx}" dy="${k === 0 ? 0 : LABEL_LEADING}">${esc(l)}</tspan>`)
        .join('');
      callouts.push(`<path d="M ${px} ${py} L ${hx} ${ty}" stroke="${P.muted}" stroke-width="1.6" fill="none" opacity="0.8"/>
  <circle cx="${px}" cy="${py}" r="5" fill="${P.muted}"/>
  <text x="${tx}" y="${first}" text-anchor="${anchor}" fill="${P.ink}" font-size="${LABEL_SIZE}" font-family="system-ui, 'Segoe UI', sans-serif">${tspans}</text>`);
    });
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${P.bg}"/>
  <text x="46" y="60" fill="${P.ink}" font-size="36" font-weight="700" font-family="system-ui, 'Segoe UI', sans-serif">${esc(title)}</text>
  <line x1="46" y1="80" x2="${W - 46}" y2="80" stroke="#24384a" stroke-width="2"/>
  ${shapes}
  ${callouts.join('\n  ')}
</svg>`;
}

/** Размерная линия с засечками на концах — для плеча рычага, высоты, расстояния. */
function dimension(x1, y, x2, yTickTop, text) {
  const mid = (x1 + x2) / 2;
  return `${line(x1, yTickTop, x1, y + 10, { color: P.muted, width: 1.2, dash: '5 5' })}
  ${line(x2, yTickTop, x2, y + 10, { color: P.muted, width: 1.2, dash: '5 5' })}
  ${vec(mid, y, x1, y, { color: P.muted, width: 1.6, head: 11 })}
  ${vec(mid, y, x2, y, { color: P.muted, width: 1.6, head: 11 })}
  ${label(mid, y - 12, text, { size: 19, fill: P.muted })}`;
}

// ─── 1. Механика: рычаг ────────────────────────────────────────────────────

function mechLever() {
  const items = [];
  const axisY = 540;
  const fulcrumX = 800;
  const loadX = 560;
  const effortX = 1140;

  // Балка рычага.
  items.push({
    svg: rectBody(470, axisY - 9, 710, 18, { fill: P.metal, stroke: P.ink, rx: 4 }),
    at: [700, axisY - 9],
    label: 'Рычаг — твёрдое тело, вращающееся вокруг опоры',
    side: 'left',
  });

  // Опора. Треугольник вершиной вверх, вершина ровно под балкой.
  items.push({
    svg: `<polygon points="${fulcrumX},${axisY + 9} ${fulcrumX - 62},${axisY + 150} ${fulcrumX + 62},${axisY + 150}" fill="${P.body}" stroke="${P.bodyEdge}" stroke-width="2"/>
  ${dot(fulcrumX, axisY, 7, P.ink)}`,
    at: [fulcrumX, axisY + 120],
    label: 'Точка опоры (ось вращения)',
    side: 'right',
  });

  // Груз висит рядом с точкой приложения силы, а не на ней: иначе стрелка F₁
  // уходит внутрь нарисованного груза и перестаёт читаться.
  items.push({
    svg: `${line(loadX - 104, axisY, loadX - 104, axisY + 84, { color: P.metal, width: 2.4 })}
  ${rectBody(loadX - 152, axisY + 84, 96, 76, { fill: P.body })}
  ${label(loadX - 104, axisY + 132, 'груз', { size: 19, fill: P.muted })}`,
    at: [loadX - 104, axisY + 122],
    label: 'Груз, который поднимают рычагом',
    side: 'left',
  });

  // Обе силы направлены ВНИЗ: одна слева от оси, другая справа, поэтому они
  // вращают рычаг в разные стороны и могут уравновесить друг друга.
  //
  // Длины стрелок взяты в том же отношении, что и плечи наоборот: короткому
  // плечу — длинная стрелка. Картинка, на которой у длинного плеча стрелка
  // длиннее, показывала бы ровно противоположное правилу рычага.
  const l1 = fulcrumX - loadX;
  const l2 = effortX - fulcrumX;
  const f1len = 158;
  const f2len = (f1len * l1) / l2;
  items.push({
    svg: `${vec(loadX, axisY, loadX, axisY + f1len, { color: P.forceNormal, width: 4 })}
  ${label(loadX - 26, axisY + f1len * 0.62, 'F₁', { size: 26, anchor: 'end', fill: P.forceNormal, weight: 700 })}`,
    at: [loadX, axisY + f1len * 0.7],
    label: 'Сила F₁ на коротком плече — бо́льшая',
    side: 'left',
  });
  items.push({
    svg: `${vec(effortX, axisY, effortX, axisY + f2len, { color: P.force, width: 4 })}
  ${label(effortX + 26, axisY + f2len * 0.62, 'F₂', { size: 26, anchor: 'start', fill: P.force, weight: 700 })}`,
    at: [effortX, axisY + f2len * 0.7],
    label: 'Сила F₂ на длинном плече — меньшая',
    side: 'right',
  });

  // Плечи сил — расстояния от оси до линии действия силы.
  items.push({
    svg: dimension(loadX, 800, fulcrumX, axisY + 170, 'плечо l₁'),
    at: [(loadX + fulcrumX) / 2, 800],
    label: 'Плечо l₁ — от оси до линии F₁',
    side: 'left',
  });
  items.push({
    svg: dimension(fulcrumX, 800, effortX, axisY + 170, 'плечо l₂'),
    at: [(fulcrumX + effortX) / 2, 800],
    label: 'Плечо l₂ — от оси до линии F₂',
    side: 'right',
  });

  // Условие равновесия. Ради него вся картинка и рисуется.
  items.push({
    svg: `${label(800, 920, 'Условие равновесия рычага:  F₁ · l₁ = F₂ · l₂', { size: 27, weight: 700 })}
  ${label(800, 958, 'во сколько раз длиннее плечо, во столько раз меньше нужная сила', { size: 19, fill: P.muted })}`,
  });

  return compose('Рычаг и условие его равновесия', items);
}

// ─── 2. Динамика: силы на наклонной плоскости ──────────────────────────────

function mechIncline() {
  const items = [];
  // Наклонная плоскость: прямой угол справа внизу, подъём слева направо.
  const ax = 430;
  const ay = 900;
  const bx = 1170;
  const by = 900;
  const cx = 1170;
  const cy = 470;

  items.push({
    svg: `<polygon points="${ax},${ay} ${bx},${by} ${cx},${cy}" fill="${P.ground}" stroke="${P.bodyEdge}" stroke-width="2.4"/>`,
    at: [1000, 820],
    label: 'Наклонная плоскость',
    side: 'right',
  });

  // Единичные векторы: вдоль плоскости (вверх по склону) и внешняя нормаль.
  const dx = cx - ax;
  const dy = cy - ay;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  // Внешняя нормаль направлена от плоскости наружу, то есть вверх-влево.
  const onx = uy;
  const ony = -ux;

  // Тело на склоне: квадрат, повёрнутый по склону.
  const t = 0.52;
  const px = ax + dx * t;
  const py = ay + dy * t;
  const bcx = px + onx * 34;
  const bcy = py + ony * 34;
  const hw = 52;
  const hh = 32;
  const corner = (su, sn) =>
    `${(bcx + ux * hw * su + onx * hh * sn).toFixed(1)},${(bcy + uy * hw * su + ony * hh * sn).toFixed(1)}`;
  items.push({
    svg: `<polygon points="${corner(-1, -1)} ${corner(1, -1)} ${corner(1, 1)} ${corner(-1, 1)}" fill="${P.body}" stroke="${P.bodyEdge}" stroke-width="2.4"/>`,
    at: [bcx, bcy],
    label: 'Тело массой m',
    side: 'left',
  });

  // Сила тяжести — всегда вертикально вниз, независимо от наклона.
  items.push({
    svg: `${vec(bcx, bcy, bcx, bcy + 175, { color: P.force, width: 4 })}
  ${label(bcx + 22, bcy + 120, 'mg', { size: 24, anchor: 'start', fill: P.force, weight: 700 })}`,
    at: [bcx, bcy + 140],
    label: 'Сила тяжести mg — вертикально вниз',
    side: 'left',
  });

  // Реакция опоры — по нормали к поверхности.
  items.push({
    svg: `${vec(bcx, bcy, bcx + onx * 150, bcy + ony * 150, { color: P.forceNormal, width: 4 })}
  ${label(bcx + onx * 176 - 14, bcy + ony * 176, 'N', { size: 24, fill: P.forceNormal, weight: 700 })}`,
    at: [bcx + onx * 120, bcy + ony * 120],
    label: 'Реакция опоры N — по нормали',
    side: 'left',
  });

  // Трение — вдоль поверхности, против возможного скольжения (вверх по склону).
  items.push({
    svg: `${vec(bcx, bcy, bcx + ux * 132, bcy + uy * 132, { color: P.forceFriction, width: 4 })}
  ${label(bcx + ux * 158, bcy + uy * 158 - 14, 'Fтр', { size: 24, fill: P.forceFriction, weight: 700 })}`,
    at: [bcx + ux * 110, bcy + uy * 110],
    label: 'Трение Fтр — против скольжения',
    side: 'right',
  });

  // Скатывающая составляющая силы тяжести — пунктиром, она не самостоятельная сила.
  items.push({
    svg: `${vec(bcx, bcy, bcx - ux * 132, bcy - uy * 132, { color: P.forceResult, width: 3, dash: '8 6' })}
  ${label(bcx - ux * 160, bcy - uy * 160 + 20, 'mg·sin α', { size: 21, fill: P.forceResult })}`,
    at: [bcx - ux * 110, bcy - uy * 110],
    label: 'Составляющая mg вдоль склона',
    side: 'right',
  });

  // Угол наклона.
  items.push({
    svg: `<path d="M ${ax + 130} ${ay} A 130 130 0 0 0 ${(ax + ux * 130).toFixed(1)} ${(ay + uy * 130).toFixed(1)}" fill="none" stroke="${P.muted}" stroke-width="2"/>
  ${label(ax + 86, ay - 24, 'α', { size: 27, fill: P.muted, italic: true })}`,
    at: [ax + 104, ay - 32],
    label: 'Угол наклона α',
    side: 'left',
  });

  // Высота и основание — из них считается работа при подъёме.
  items.push({
    svg: `${line(bx, by, bx + 56, by, { color: P.muted, width: 1.2, dash: '5 5' })}
  ${vec(1214, cy, 1214, by, { color: P.muted, width: 1.6, head: 11 })}
  ${vec(1214, by, 1214, cy, { color: P.muted, width: 1.6, head: 11 })}
  ${line(cx, cy, 1230, cy, { color: P.muted, width: 1.2, dash: '5 5' })}
  ${label(1250, (cy + by) / 2, 'h', { size: 23, anchor: 'start', fill: P.muted, italic: true })}`,
  });

  items.push({
    svg: label(800, 1020, 'Выигрыша в работе наклонная плоскость не даёт: выигрывая в силе, проигрываем в пути', {
      size: 19,
      fill: P.muted,
    }),
  });

  return compose('Силы, действующие на тело на наклонной плоскости', items);
}

// ─── 3. Тепловые явления: агрегатные состояния ─────────────────────────────

function heatStates() {
  const items = [];
  const boxW = 240;
  const boxH = 240;
  const boxY = 250;
  const xs = [400, 680, 960];
  const names = ['Твёрдое тело', 'Жидкость', 'Газ'];
  const modes = ['solid', 'liquid', 'gas'];
  const notes = [
    'частицы стоят в узлах решётки,\nколеблются около своих мест',
    'частицы рядом, но порядка нет,\nперекатываются друг по другу',
    'частицы далеко друг от друга\nи движутся во все стороны',
  ];

  xs.forEach((x, i) => {
    const vessel =
      i === 2
        ? `<rect x="${x}" y="${boxY}" width="${boxW}" height="${boxH}" rx="8" fill="none" stroke="${P.vessel}" stroke-width="2.6"/>`
        : `<path d="M ${x} ${boxY} L ${x} ${boxY + boxH} L ${x + boxW} ${boxY + boxH} L ${x + boxW} ${boxY}" fill="none" stroke="${P.vessel}" stroke-width="2.6"/>`;
    const surface =
      i === 1
        ? line(x + 3, boxY + boxH * 0.4 - 18, x + boxW - 3, boxY + boxH * 0.4 - 18, {
            color: P.liquidEdge,
            width: 2.4,
          })
        : '';
    items.push({
      svg: `${vessel}
  ${surface}
  ${particles(x, boxY, boxW, boxH, modes[i], 7 + i * 31)}
  ${label(x + boxW / 2, boxY + boxH + 40, names[i], { size: 26, weight: 700 })}
  ${notes[i]
    .split('\n')
    .map((t, k) => label(x + boxW / 2, boxY + boxH + 70 + k * 25, t, { size: 18, fill: P.muted }))
    .join('\n  ')}`,
    });
  });

  // Прямые переходы между соседними состояниями — в обе стороны.
  const pairs = [
    [640, 'Плавление', 'Кристаллизация'],
    [920, 'Парообразование', 'Конденсация'],
  ];
  pairs.forEach(([x, fwd, back]) => {
    items.push({
      svg: `${vec(x - 78, 640, x + 78, 640, { color: P.hot, width: 3 })}
  ${label(x, 626, fwd, { size: 20, fill: P.hot })}
  ${vec(x + 78, 700, x - 78, 700, { color: P.cold, width: 3 })}
  ${label(x, 733, back, { size: 20, fill: P.cold })}`,
    });
  });

  // Переход через состояние — большой дугой, минуя жидкость. Подписи стоят
  // НАД своей дугой: под дугой они попадают на следующую.
  items.push({
    svg: `${label(800, 796, 'Возгонка (сублимация): твёрдое → газ, минуя жидкость', { size: 20, fill: P.hot })}
  <path d="M 520 810 Q 800 900 1080 810" fill="none" stroke="${P.hot}" stroke-width="3"/>
  ${vec(1024, 826, 1080, 810, { color: P.hot, width: 3 })}
  ${label(800, 946, 'Десублимация: газ → твёрдое, минуя жидкость', { size: 20, fill: P.cold })}
  <path d="M 545 960 Q 800 1050 1055 960" fill="none" stroke="${P.cold}" stroke-width="3"/>
  ${vec(596, 976, 545, 960, { color: P.cold, width: 3 })}`,
  });

  items.push({
    svg: `${label(800, 178, 'Красным — переходы, идущие с поглощением теплоты; синим — с выделением', { size: 19, fill: P.muted })}`,
  });

  return compose('Агрегатные состояния вещества и переходы между ними', items);
}

// ─── 4. Электричество: электрическая цепь ──────────────────────────────────

function elecCircuit() {
  const items = [];
  const xl = 480;
  const xr = 1120;
  const yt = 360;
  const yb = 830;

  // Провода. Рисуются с разрывами там, где стоят элементы, — иначе линия
  // проходит сквозь лампу и амперметр, и схема перестаёт быть схемой.
  items.push({
    svg: `${line(xl, yt, 674, yt)}
  ${line(726, yt, 920, yt)}
  ${line(1000, yt, xr, yt)}
  ${line(xr, yt, xr, yb)}
  ${line(xr, yb, 978, yb)}
  ${line(922, yb, 728, yb)}
  ${line(672, yb, xl, yb)}
  ${line(xl, yb, xl, 607)}
  ${line(xl, 553, xl, yt)}`,
    at: [xr, 620],
    label: 'Соединительные провода',
    side: 'right',
  });

  items.push({
    svg: batteryCell(700, yb, { scale: 1.5 }),
    at: [700, yb + 30],
    label: 'Источник тока (гальванический элемент)',
    side: 'left',
  });

  items.push({
    svg: switchSym(950, yb, { width: 56, lift: 30 }),
    at: [950, yb - 14],
    label: 'Ключ (показан разомкнутым)',
    side: 'right',
  });

  items.push({
    svg: lampSym(700, yt, 26),
    at: [700, yt - 26],
    label: 'Лампа накаливания — потребитель',
    side: 'left',
  });

  items.push({
    svg: resistorSym(960, yt, 78, 32),
    at: [960, yt - 16],
    label: 'Резистор: сопротивление R',
    side: 'right',
  });

  items.push({
    svg: meterSym(xl, 580, 'A', 27),
    at: [xl - 27, 580],
    label: 'Амперметр — включён ПОСЛЕДОВАТЕЛЬНО',
    side: 'left',
  });

  // Вольтметр — отдельной ветвью поверх лампы.
  items.push({
    svg: `${line(636, yt, 636, 252)}
  ${line(636, 252, 673, 252)}
  ${line(727, 252, 764, 252)}
  ${line(764, 252, 764, yt)}
  ${dot(636, yt, 5, P.wire)}
  ${dot(764, yt, 5, P.wire)}
  ${meterSym(700, 252, 'V', 27)}`,
    at: [700, 225],
    label: 'Вольтметр — включён ПАРАЛЛЕЛЬНО участку',
    side: 'left',
  });

  // Направление тока — от «+» источника по внешней цепи.
  items.push({
    svg: `${vec(560, yb - 24, 640, yb - 24, { color: P.ray, width: 3 })}
  ${vec(1096, 540, 1096, 460, { color: P.ray, width: 3 })}
  ${label(600, yb - 38, 'I', { size: 23, fill: P.ray, weight: 700, italic: true })}`,
    at: [600, yb - 24],
    label: 'Ток идёт от «+» по внешней цепи',
    side: 'right',
  });

  items.push({
    svg: `${label(800, 985, 'Закон Ома для участка цепи:  I = U / R', { size: 27, weight: 700 })}
  ${label(800, 1022, 'амперметр показывает силу тока I, вольтметр — напряжение U', { size: 19, fill: P.muted })}`,
  });

  return compose('Электрическая цепь и её элементы', items);
}

// ─── 5. Магнетизм: магнитное поле ──────────────────────────────────────────

function magnetField() {
  const items = [];

  // Полосовой магнит.
  const mx = 620;
  const my = 330;
  const mw = 360;
  const mh = 96;
  const cy = my + mh / 2;
  items.push({
    svg: barMagnet(mx, my, mw, mh),
    at: [mx + mw * 0.25, my + mh / 2],
    label: 'Северный полюс N',
    side: 'left',
  });
  items.push({
    svg: '',
    at: [mx + mw * 0.75, my + mh / 2],
    label: 'Южный полюс S',
    side: 'right',
  });

  // Линии поля вне магнита идут от N к S, огибая брусок сверху и снизу.
  const BULGES = [160, 230, 300];
  const lines = [];
  for (const b of BULGES) {
    lines.push(fieldLine(mx - 4, cy, mx + mw + 4, cy, -b));
    lines.push(fieldLine(mx - 4, cy, mx + mw + 4, cy, b));
  }
  const topApex = fieldPointAt(mx - 4, cy, mx + mw + 4, cy, -BULGES[2], 0.5);
  items.push({
    svg: lines.join('\n  '),
    at: [topApex.x, topApex.y],
    label: 'Линии поля: вне магнита от N к S',
    side: 'left',
  });

  // Магнитная стрелка встаёт ВДОЛЬ линии поля — это и есть способ поле
  // увидеть. Положение и наклон стрелок берутся прямо с кривых (fieldPointAt),
  // а не подбираются на глаз: стрелка, стоящая под своим углом рядом с линией,
  // опровергала бы подпись под ней.
  const needle = (pt) => {
    const c = Math.cos(pt.ang);
    const s = Math.sin(pt.ang);
    const L = 32;
    return `<circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="22" fill="${P.bg}" stroke="${P.muted}" stroke-width="1.8"/>
  <polygon points="${(pt.x + c * L).toFixed(1)},${(pt.y + s * L).toFixed(1)} ${(pt.x - s * 9).toFixed(1)},${(pt.y + c * 9).toFixed(1)} ${(pt.x + s * 9).toFixed(1)},${(pt.y - c * 9).toFixed(1)}" fill="${P.poleN}"/>
  <polygon points="${(pt.x - c * L).toFixed(1)},${(pt.y - s * L).toFixed(1)} ${(pt.x - s * 9).toFixed(1)},${(pt.y + c * 9).toFixed(1)} ${(pt.x + s * 9).toFixed(1)},${(pt.y - c * 9).toFixed(1)}" fill="${P.poleS}"/>`;
  };
  const n1 = fieldPointAt(mx - 4, cy, mx + mw + 4, cy, -BULGES[1], 0.22);
  const n2 = fieldPointAt(mx - 4, cy, mx + mw + 4, cy, -BULGES[1], 0.78);
  const n3 = fieldPointAt(mx - 4, cy, mx + mw + 4, cy, BULGES[2], 0.5);
  items.push({
    svg: [needle(n1), needle(n2), needle(n3)].join('\n  '),
    at: [n3.x, n3.y],
    label: 'Магнитная стрелка встаёт вдоль линии поля',
    side: 'right',
  });

  // Катушка с током: магнитное поле создаёт не только магнит, но и всякий ток.
  const kx = 590;
  const ky = 816;
  items.push({
    svg: `${coilSym(kx, ky, 9, 46)}
  ${line(kx, ky, kx - 70, ky)}
  ${line(kx - 70, ky, kx - 70, ky + 96)}
  ${line(kx - 70, ky + 96, kx + 130, ky + 96)}
  ${batteryCell(kx + 176, ky + 96, { scale: 1.4 })}
  ${line(kx + 222, ky + 96, kx + 460, ky + 96)}
  ${line(kx + 460, ky + 96, kx + 460, ky)}
  ${line(kx + 460, ky, kx + 414, ky)}
  ${vec(kx + 300, ky + 74, kx + 220, ky + 74, { color: P.ray, width: 3 })}
  ${label(kx + 260, ky + 62, 'I', { size: 22, fill: P.ray, weight: 700, italic: true })}
  ${label(kx - 20, ky - 42, 'N', { size: 28, weight: 700, fill: P.poleN })}
  ${label(kx + 434, ky - 42, 'S', { size: 28, weight: 700, fill: P.poleS })}`,
    at: [kx + 207, ky - 26],
    label: 'Катушка с током (электромагнит)',
    side: 'left',
  });
  // Какой конец катушки станет северным полюсом, определяет направление тока,
  // а не сам рисунок: на плоской схеме не видно, спереди или сзади проходит
  // виток. Подпись говорит именно это, чтобы картинка не утверждала лишнего.
  items.push({
    svg: '',
    at: [kx + 434, ky - 30],
    label: 'Какой конец станет N — задаёт направление тока',
    side: 'right',
  });

  items.push({
    svg: label(800, 1064, 'Магнитное поле создаёт и постоянный магнит, и всякий электрический ток', {
      size: 19,
      fill: P.muted,
    }),
  });

  return compose('Магнитное поле постоянного магнита и катушки с током', items);
}

// ─── 6. Оптика: собирающая линза ───────────────────────────────────────────

function opticsLens() {
  const items = [];
  const axis = 600;
  const lx = 800;
  const f = 150;
  // Предмет стоит в двойном фокусе — самый показательный случай: изображение
  // получается ровно в двойном фокусе с другой стороны и равно предмету.
  const objX = lx - 2 * f;
  const objTop = axis - 120;
  const imgX = lx + 2 * f;
  const imgBottom = axis + 120;

  items.push({
    svg: line(420, axis, 1180, axis, { color: P.muted, width: 1.6, dash: '9 7' }),
    at: [470, axis],
    label: 'Главная оптическая ось',
    side: 'left',
  });

  items.push({
    svg: `<path d="M ${lx} ${axis - 140} Q ${lx + 56} ${axis} ${lx} ${axis + 140} Q ${lx - 56} ${axis} ${lx} ${axis - 140} Z" fill="${P.lensFill}" stroke="${P.lens}" stroke-width="3"/>
  ${vec(lx, axis - 168, lx, axis - 148, { color: P.lens, width: 2.4, head: 11 })}
  ${vec(lx, axis + 168, lx, axis + 148, { color: P.lens, width: 2.4, head: 11 })}`,
    at: [lx + 40, axis - 96],
    label: 'Собирающая линза',
    side: 'right',
  });

  items.push({
    svg: dot(lx, axis, 6, P.ink),
    at: [lx, axis],
    label: 'Оптический центр O',
    side: 'right',
  });

  items.push({
    svg: `${dot(lx - f, axis, 6, P.ray)}
  ${label(lx - f, axis + 30, 'F', { size: 22, fill: P.ray, weight: 700 })}
  ${dot(lx + f, axis, 6, P.ray)}
  ${label(lx + f, axis + 30, 'F', { size: 22, fill: P.ray, weight: 700 })}`,
    at: [lx + f, axis],
    label: 'Фокус F',
    side: 'right',
  });

  items.push({
    svg: `${dot(objX, axis, 5, P.muted)}
  ${label(objX, axis + 30, '2F', { size: 21, fill: P.muted })}
  ${dot(imgX, axis, 5, P.muted)}
  ${label(imgX, axis + 30, '2F', { size: 21, fill: P.muted })}
  ${dimension(lx, 900, lx + f, axis + 150, 'фокусное расстояние F')}`,
    at: [lx + f / 2, 900],
    label: 'Фокусное расстояние',
    side: 'right',
  });

  // Предмет и изображение.
  items.push({
    svg: vec(objX, axis, objX, objTop, { color: P.forceNormal, width: 4.5 }),
    at: [objX, axis - 70],
    label: 'Предмет',
    side: 'left',
  });
  items.push({
    svg: vec(imgX, axis, imgX, imgBottom, { color: P.force, width: 4.5 }),
    at: [imgX, axis + 70],
    label: 'Действительное перевёрнутое изображение',
    side: 'right',
  });

  // Два «удобных» луча, по которым строят изображение.
  items.push({
    svg: `${line(objX, objTop, lx, objTop, { color: P.ray, width: 2.4 })}
  ${line(lx, objTop, imgX, imgBottom, { color: P.ray, width: 2.4 })}
  ${vec(lx - 90, objTop, lx - 56, objTop, { color: P.ray, width: 2.4, head: 12 })}`,
    at: [objX + 110, objTop],
    label: 'Луч вдоль оси — после линзы через фокус',
    side: 'left',
  });
  items.push({
    svg: `${line(objX, objTop, imgX, imgBottom, { color: P.lens, width: 2.4 })}`,
    at: [lx - 150, axis - 60],
    label: 'Луч через центр не преломляется',
    side: 'left',
  });

  items.push({
    svg: `${label(800, 1000, 'Формула тонкой линзы:  1/F = 1/d + 1/f', { size: 27, weight: 700 })}
  ${label(800, 1036, 'предмет в двойном фокусе — изображение тоже в двойном фокусе и той же величины', { size: 19, fill: P.muted })}`,
  });

  return compose('Собирающая линза: построение изображения', items);
}

// ─── 7. Строение атома ─────────────────────────────────────────────────────

function atomStructure() {
  const items = [];
  const cx = 800;
  const cy = 590;

  // Ядро: шесть протонов и шесть нейтронов — атом углерода.
  const rand = rng(4242);
  const core = [];
  const kinds = [];
  for (let i = 0; i < 6; i += 1) kinds.push('p', 'n');
  for (let i = 0; i < kinds.length; i += 1) {
    const a = (i / kinds.length) * Math.PI * 2 + rand() * 0.4;
    const rr = i < 3 ? 12 : 30 + rand() * 12;
    core.push(
      dot(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 15, kinds[i] === 'p' ? P.protonC : P.neutronC, P.bg)
    );
  }
  items.push({
    svg: core.join('\n  '),
    at: [cx + 34, cy + 30],
    label: 'Ядро атома',
    side: 'right',
  });
  items.push({
    svg: `${dot(400, 960, 15, P.protonC, P.bg)}
  ${label(424, 967, '— протон, заряд «+»', { size: 20, anchor: 'start' })}
  ${dot(760, 960, 15, P.neutronC, P.bg)}
  ${label(784, 967, '— нейтрон, заряда нет', { size: 20, anchor: 'start' })}
  ${dot(1140, 960, 9, P.electronC, P.bg)}
  ${label(1160, 967, '— электрон, заряд «−»', { size: 20, anchor: 'start' })}`,
  });

  // Две электронные оболочки: 2 электрона на внутренней, 4 на внешней.
  const shells = [
    { r: 175, n: 2, name: 'Внутренняя электронная оболочка' },
    { r: 330, n: 4, name: 'Внешняя (валентная) оболочка' },
  ];
  shells.forEach((sh, si) => {
    const els = [];
    for (let i = 0; i < sh.n; i += 1) {
      const a = (i / sh.n) * Math.PI * 2 + (si ? 0.55 : 0);
      els.push(dot(cx + Math.cos(a) * sh.r, cy + Math.sin(a) * sh.r, 9, P.electronC, P.bg));
    }
    items.push({
      svg: `<circle cx="${cx}" cy="${cy}" r="${sh.r}" fill="none" stroke="${P.shell}" stroke-width="1.8" stroke-dasharray="6 7"/>
  ${els.join('\n  ')}`,
      at: [cx + Math.cos(-2.3) * sh.r, cy + Math.sin(-2.3) * sh.r],
      label: sh.name,
      side: 'left',
    });
  });

  items.push({
    svg: '',
    at: [cx + Math.cos(0.55) * 330, cy + Math.sin(0.55) * 330],
    label: 'Электрон движется вокруг ядра',
    side: 'right',
  });

  items.push({
    svg: `${label(800, 178, 'Изображён атом углерода: 6 протонов, 6 нейтронов, 6 электронов', { size: 21, fill: P.muted })}
  ${label(800, 1040, 'Число протонов равно числу электронов — поэтому атом в целом электрически нейтрален', { size: 19, fill: P.muted })}`,
  });

  return compose('Строение атома', items);
}

// ─── 8. Гидростатика: архимедова сила ──────────────────────────────────────

function hydroArchimedes() {
  const items = [];
  const vx = 430;
  const vr = 1170;
  const surf = 420;
  const floor = 930;

  items.push({
    svg: `<rect x="${vx}" y="${surf}" width="${vr - vx}" height="${floor - surf}" fill="${P.liquid}"/>
  <path d="M ${vx} 300 L ${vx} ${floor} L ${vr} ${floor} L ${vr} 300" fill="none" stroke="${P.vessel}" stroke-width="3"/>
  ${line(vx, surf, vr, surf, { color: P.liquidEdge, width: 3 })}`,
    at: [vx + 60, surf],
    label: 'Свободная поверхность жидкости',
    side: 'left',
  });
  items.push({
    svg: '',
    at: [vx + 46, 700],
    label: 'Жидкость плотностью ρж',
    side: 'left',
  });

  // Тела ОДИНАКОВОГО ОБЪЁМА и все целиком погружены, поэтому архимедова сила
  // у всех трёх ОДНА И ТА ЖЕ: FА = ρж · g · V, и плотность самого тела в эту
  // формулу не входит. Различается только вес.
  //
  // На первой отрисовке стрелки FА были нарисованы разной длины — картинка
  // прямо опровергала подпись под собой («от плотности самого тела сила не
  // зависит»). Поймать это можно было только глазами: длины стрелок ниоткуда
  // не выводились, а подпись лежала отдельной строкой.
  const FA = 132;
  const cases = [
    { x: 600, mg: 84, note: 'FА > mg — тело всплывает' },
    { x: 800, mg: 132, note: 'FА = mg — тело плавает' },
    { x: 1000, mg: 184, note: 'FА < mg — тело тонет' },
  ];
  const by = 660;
  cases.forEach((c, i) => {
    items.push({
      svg: `${rectBody(c.x - 52, by - 36, 104, 72)}
  ${vec(c.x, by - 36, c.x, by - 36 - FA, { color: P.forceNormal, width: 4 })}
  ${vec(c.x, by + 36, c.x, by + 36 + c.mg, { color: P.force, width: 4 })}
  ${label(c.x, by + 6, `${i + 1}`, { size: 24, weight: 700 })}
  ${label(c.x, by - 48 - FA, 'FА', { size: 21, fill: P.forceNormal, weight: 700 })}
  ${label(c.x, by + 62 + c.mg, 'mg', { size: 21, fill: P.force, weight: 700 })}`,
      at: [c.x, by],
      label: `${i + 1}. ${c.note}`,
      side: i === 0 ? 'left' : 'right',
    });
  });

  items.push({
    svg: `${label(800, 1000, 'Архимедова сила:  FА = ρж · g · V', { size: 27, weight: 700 })}
  ${label(800, 1036, 'V — объём ПОГРУЖЁННОЙ части тела; от плотности самого тела сила не зависит', { size: 19, fill: P.muted })}`,
  });

  items.push({
    svg: `${label(800, 178, 'Три тела одинакового объёма, но разной плотности: выталкивающая сила у них одна и та же', { size: 21, fill: P.muted })}
  ${label(800, 208, 'различается только вес — он и решает, всплывёт тело или утонет', { size: 19, fill: P.muted })}`,
  });

  return compose('Архимедова сила и условия плавания тел', items);
}

// ─── 9. Астрономия: строение Солнечной системы ─────────────────────────────

function solarSystem() {
  const items = [];
  const cx = 800;
  const cy = 588;
  // Орбиты сжаты по вертикали: это вид сверху под углом, как на школьных
  // схемах. Полные круги того же радиуса вылезали бы за нижний край холста, и
  // орбита Нептуна обрезалась бы ровно там, где к ней подписан Уран.
  const SQUASH = 0.78;

  const planets = [
    { name: 'Меркурий', r: 100, pr: 8, a: 214, color: '#9a8f86' },
    { name: 'Венера', r: 140, pr: 12, a: 320, color: '#d8b07a' },
    { name: 'Земля', r: 184, pr: 13, a: 52, color: '#5b8fc9' },
    { name: 'Марс', r: 228, pr: 10, a: 134, color: '#c0664a' },
    { name: 'Юпитер', r: 332, pr: 33, a: 258, color: '#c9a179', bands: '#8a6a4c' },
    { name: 'Сатурн', r: 396, pr: 27, a: 8, color: '#d6c08a', ring: '#a9986f' },
    { name: 'Уран', r: 450, pr: 20, a: 154, color: '#8fc6c9' },
    { name: 'Нептун', r: 498, pr: 19, a: 288, color: '#5a7fc4' },
  ];

  const at = (r, aDeg) => {
    const a = (aDeg * Math.PI) / 180;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * SQUASH, a];
  };

  items.push({
    svg: planets
      .map(
        (p) =>
          `<ellipse cx="${cx}" cy="${cy}" rx="${p.r}" ry="${(p.r * SQUASH).toFixed(1)}" fill="none" stroke="${P.orbit}" stroke-width="1.4"/>`
      )
      .join('\n  '),
  });

  items.push({ svg: sunDisc(cx, cy, 44) });
  items.push({ svg: label(cx, cy + 78, 'Солнце', { size: 23, weight: 700 }) });

  // Пояс астероидов между Марсом и Юпитером — это его место в курсе.
  const rand = rng(90210);
  const belt = [];
  for (let i = 0; i < 240; i += 1) {
    const a = rand() * Math.PI * 2;
    const rr = 264 + rand() * 36;
    belt.push(dot(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * SQUASH, 1.8, P.muted));
  }
  items.push({ svg: belt.join('\n  ') });
  // Подпись пояса стоит в промежутке, где нет ни одной планеты: поверх самих
  // астероидов её было не прочесть.
  const beltAt = at(282, 168);
  items.push({
    svg: `<rect x="${(beltAt[0] - 82).toFixed(1)}" y="${(beltAt[1] - 16).toFixed(1)}" width="164" height="30" rx="7" fill="${P.bg}" opacity="0.88"/>
  ${label(beltAt[0], beltAt[1] + 6, 'Пояс астероидов', { size: 19, fill: P.muted })}`,
  });

  planets.forEach((p) => {
    const [px, py, a] = at(p.r, p.a);
    // Подпись отодвигается от центра по той же радиальной прямой, на которой
    // стоит планета: так она никогда не ляжет на свою же орбиту.
    const reach = (p.ring ? p.pr * 2.05 : p.pr) + 22;
    const lx = px + Math.cos(a) * reach;
    const ly = py + Math.sin(a) * reach * SQUASH + 7;
    const anchor = Math.cos(a) < -0.25 ? 'end' : Math.cos(a) > 0.25 ? 'start' : 'middle';
    items.push({
      svg: `${planetDisc(px, py, p.pr, p.color, { ring: p.ring, bands: p.bands })}
  ${label(lx, ly, p.name, { size: 20, anchor })}`,
    });
  });

  items.push({
    svg: `${label(800, 134, 'Восемь планет обращаются вокруг Солнца в одном направлении и почти в одной плоскости', { size: 20, fill: P.muted })}
  ${label(800, 1066, 'Размеры планет и расстояния между орбитами показаны не в масштабе', { size: 18, fill: P.muted })}`,
  });

  return compose('Строение Солнечной системы', items);
}

// ─── 10. Астрономия: сравнение планет ──────────────────────────────────────

function planetsCompare() {
  const items = [];
  // Один масштаб для всех восьми планет: k = 0,001 пикселя на километр
  // радиуса. Сравнение честное только при общем масштабе — в этом весь смысл
  // картинки, и ради него планеты земной группы получаются крошечными.
  const K = 0.001;
  const base = 560;
  const data = [
    { name: 'Меркурий', km: 2440, color: '#9a8f86', group: 'terr' },
    { name: 'Венера', km: 6052, color: '#d8b07a', group: 'terr' },
    { name: 'Земля', km: 6371, color: '#5b8fc9', group: 'terr' },
    { name: 'Марс', km: 3390, color: '#c0664a', group: 'terr' },
    { name: 'Юпитер', km: 69911, color: '#c9a179', bands: '#8a6a4c', group: 'giant' },
    { name: 'Сатурн', km: 58232, color: '#d6c08a', ring: '#a9986f', group: 'giant' },
    { name: 'Уран', km: 25362, color: '#8fc6c9', group: 'giant' },
    { name: 'Нептун', km: 24622, color: '#5a7fc4', group: 'giant' },
  ];

  let edge = 466;
  const placed = [];
  data.forEach((p, i) => {
    const r = p.km * K;
    const halfW = p.ring ? r * 2.05 : r;
    const gap = i === 0 ? 0 : i === 4 ? 56 : p.ring || data[i - 1].ring ? 26 : 22;
    const cxx = edge + gap + halfW;
    edge = cxx + halfW;
    placed.push({ ...p, r, cx: cxx });
  });

  // Край солнечного диска: Солнце на том же масштабе имеет радиус 696 пикселей
  // и целиком в кадр не помещается — это тоже часть урока.
  items.push({
    svg: `<circle cx="-430" cy="${base}" r="696" fill="${P.sun}" opacity="0.07"/>
  <circle cx="-430" cy="${base}" r="696" fill="none" stroke="${P.sunEdge}" stroke-width="2.4"/>
  ${label(292, base - 270, 'край диска Солнца', { size: 18, fill: P.sunEdge, anchor: 'start' })}
  ${label(292, base - 246, 'в том же масштабе', { size: 16, fill: P.muted, anchor: 'start' })}`,
  });

  placed.forEach((p) => {
    items.push({
      svg: planetDisc(p.cx, base, p.r, p.color, { ring: p.ring, bands: p.bands }),
    });
  });

  // Группы.
  const terr = placed.filter((p) => p.group === 'terr');
  const giants = placed.filter((p) => p.group === 'giant');
  const tL = terr[0].cx - terr[0].r - 16;
  const tR = terr[terr.length - 1].cx + terr[terr.length - 1].r + 16;
  const gL = giants[0].cx - giants[0].r - 20;
  const gR = giants[giants.length - 1].cx + giants[giants.length - 1].r + 20;
  items.push({
    svg: `${boxAround(tL, base - 40, tR - tL, 80)}
  ${label((tL + tR) / 2, base - 58, 'Планеты земной группы', { size: 21, weight: 700 })}
  ${boxAround(gL, base - 105, gR - gL, 210)}
  ${label((gL + gR) / 2, base - 124, 'Планеты-гиганты', { size: 21, weight: 700 })}`,
  });

  // Крупные планеты подписываются на месте, мелкие — во врезке ниже.
  // Уран и Нептун стоят слишком близко, чтобы подписать их на одной строке.
  giants.forEach((p, i) => {
    p.rowDy = i === 3 ? 52 : 0;
    items.push({
      svg: `${label(p.cx, base + 140 + p.rowDy, p.name, { size: 20 })}
  ${label(p.cx, base + 164 + p.rowDy, `${(p.km * 2).toLocaleString('ru-RU')} км`, { size: 17, fill: P.muted })}`,
    });
  });

  // Врезка: те же четыре планеты земной группы, увеличенные в 8 раз.
  const K2 = K * 8;
  let e2 = 470;
  const inset = terr.map((p, i) => {
    const r = p.km * K2;
    const cxx = e2 + (i === 0 ? 0 : 46) + r;
    e2 = cxx + r;
    return { ...p, r2: r, cx2: cxx };
  });
  items.push({
    svg: `${boxAround(440, 780, 520, 250, P.bodyEdge)}
  ${label(700, 812, 'Планеты земной группы, увеличено в 8 раз', { size: 19, fill: P.bodyEdge })}
  ${line(tL, base + 42, 470, 780, { color: P.bodyEdge, width: 1.4, dash: '6 6' })}
  ${line(tR, base + 42, 930, 780, { color: P.bodyEdge, width: 1.4, dash: '6 6' })}`,
  });
  inset.forEach((p) => {
    items.push({
      svg: `${planetDisc(p.cx2, 900, p.r2, p.color, {})}
  ${label(p.cx2, 972, p.name, { size: 19 })}
  ${label(p.cx2, 995, `${(p.km * 2).toLocaleString('ru-RU')} км`, { size: 16, fill: P.muted })}`,
    });
  });

  items.push({
    svg: `${label(1180, 850, 'Общий масштаб для всех восьми:', { size: 19, fill: P.muted, anchor: 'start' })}
  ${label(1180, 876, 'диаметр Юпитера больше земного', { size: 19, fill: P.muted, anchor: 'start' })}
  ${label(1180, 902, 'в 11 раз, а объём — почти в 1300 раз', { size: 19, fill: P.muted, anchor: 'start' })}`,
  });

  return compose('Планеты земной группы и планеты-гиганты', items);
}

// ─── 11. Астрономия: карта околополярных созвездий ─────────────────────────

function starMapNorth() {
  const items = [];
  const cx = 800;
  const cy = 590;
  const R = 420;

  // Круг карты и фоновые звёзды.
  const rand = rng(1618);
  const bg = [];
  for (let i = 0; i < 260; i += 1) {
    const a = rand() * Math.PI * 2;
    const rr = Math.sqrt(rand()) * (R - 8);
    bg.push(dot(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 0.9 + rand() * 1.5, P.star));
  }
  items.push({
    svg: `<circle cx="${cx}" cy="${cy}" r="${R}" fill="#0a1017" stroke="${P.constLine}" stroke-width="2.4"/>
  ${bg.join('\n  ')}`,
  });

  // Малая Медведица. Полярная — крайняя в ручке ковша.
  const umi = {
    pol: [800, 560],
    d: [856, 612],
    e: [898, 676],
    z: [866, 736],
    b: [918, 806],
    g: [972, 762],
    h: [920, 700],
  };
  items.push({
    svg: `${constellation(umi, [
      ['pol', 'd'],
      ['d', 'e'],
      ['e', 'z'],
      ['z', 'b'],
      ['b', 'g'],
      ['g', 'h'],
      ['h', 'z'],
    ])}
  ${starGlyph(...umi.pol, 2.0)}
  ${starGlyph(...umi.d, 4.3)}
  ${starGlyph(...umi.e, 4.2)}
  ${starGlyph(...umi.z, 4.3)}
  ${starGlyph(...umi.b, 2.1, { color: P.starWarm })}
  ${starGlyph(...umi.g, 3.0)}
  ${starGlyph(...umi.h, 5.0)}
  ${label(768, 548, 'Полярная', { size: 20, anchor: 'end', weight: 700 })}
  ${label(950, 834, 'Кохаб', { size: 18, fill: P.muted })}
  ${label(846, 790, 'Малая Медведица', { size: 21, anchor: 'end', fill: P.starBlue })}`,
  });

  // Большая Медведица. Мерак и Дубхе поставлены так, чтобы прямая через них
  // действительно приходила в Полярную — ради этого картинка и нужна. Ковш
  // придвинут к центру: на первой отрисовке Бенетнаш, крайняя звезда ручки,
  // оказалась ЗА краем круга карты.
  const uma = {
    dubhe: [654, 706],
    merak: [600, 760],
    fekda: [536, 726],
    megrez: [590, 678],
    alioth: [530, 644],
    mizar: [470, 620],
    benetnash: [412, 586],
  };
  items.push({
    svg: `${constellation(uma, [
      ['dubhe', 'merak'],
      ['merak', 'fekda'],
      ['fekda', 'megrez'],
      ['megrez', 'dubhe'],
      ['megrez', 'alioth'],
      ['alioth', 'mizar'],
      ['mizar', 'benetnash'],
    ])}
  ${starGlyph(...uma.dubhe, 1.8, { color: P.starWarm })}
  ${starGlyph(...uma.merak, 2.4)}
  ${starGlyph(...uma.fekda, 2.4)}
  ${starGlyph(...uma.megrez, 3.3)}
  ${starGlyph(...uma.alioth, 1.8)}
  ${starGlyph(...uma.mizar, 2.2)}
  ${starGlyph(...uma.benetnash, 1.9)}
  ${label(682, 722, 'Дубхе', { size: 18, fill: P.muted, anchor: 'start' })}
  ${label(600, 796, 'Мерак', { size: 18, fill: P.muted })}
  ${label(516, 552, 'Большая Медведица', { size: 21, fill: P.starBlue })}
  ${label(516, 576, '(Большой Ковш)', { size: 17, fill: P.muted })}`,
  });

  // Линия-указатель: она и есть способ найти Полярную звезду на небе.
  items.push({
    svg: `${line(600, 760, 800, 560, { color: P.ray, width: 1.8, dash: '9 7' })}
  ${vec(746, 616, 786, 574, { color: P.ray, width: 1.8, head: 12 })}
  ${label(756, 602, 'Мерак → Дубхе → Полярная', { size: 18, anchor: 'end', fill: P.ray })}`,
  });

  // Кассиопея — по другую сторону от полюса, чем Большая Медведица.
  const cas = {
    a: [952, 406],
    b: [1004, 452],
    c: [1050, 400],
    d: [1100, 444],
    e: [1146, 390],
  };
  items.push({
    svg: `${constellation(cas, [
      ['a', 'b'],
      ['b', 'c'],
      ['c', 'd'],
      ['d', 'e'],
    ])}
  ${Object.values(cas)
    .map((pt) => starGlyph(pt[0], pt[1], 2.4))
    .join('\n  ')}
  ${label(1048, 358, 'Кассиопея', { size: 21, fill: P.starBlue })}`,
  });

  // Дракон вьётся между двумя Медведицами. Хвост укорочен, чтобы голова не
  // заезжала в Кассиопею: на первой отрисовке они накладывались.
  const dra = [
    [700, 862],
    [780, 896],
    [864, 886],
    [934, 842],
    [1000, 776],
    [1042, 700],
    [1074, 628],
    [1098, 570],
    [1136, 542],
    [1106, 514],
  ];
  items.push({
    svg: `${dra
      .slice(0, -1)
      .map((pt, i) => line(pt[0], pt[1], dra[i + 1][0], dra[i + 1][1], { color: P.constLine, width: 1.8 }))
      .join('\n  ')}
  ${dra.map((pt) => starGlyph(pt[0], pt[1], 3.2)).join('\n  ')}
  ${label(866, 926, 'Дракон', { size: 21, fill: P.starBlue })}`,
  });

  // Полюс мира.
  items.push({
    svg: `${dot(800, 560, 3, P.ray)}
  <circle cx="800" cy="560" r="26" fill="none" stroke="${P.ray}" stroke-width="1.4" stroke-dasharray="4 5"/>
  ${label(800, 134, 'Эти созвездия видны в наших широтах круглый год: они не заходят за горизонт', { size: 20, fill: P.muted })}
  ${label(800, 1052, 'Полярная звезда стоит почти точно в северном полюсе мира; Кассиопею узнают по её букве W', { size: 19, fill: P.muted })}`,
  });

  return compose('Карта звёздного неба: околополярные созвездия', items);
}

// ─── 12. Астрономия: карта зимнего неба ────────────────────────────────────

function starMapWinter() {
  const items = [];

  const rand = rng(2718);
  const bg = [];
  for (let i = 0; i < 300; i += 1) {
    bg.push(dot(360 + rand() * 880, 150 + rand() * 830, 0.9 + rand() * 1.4, P.star));
  }
  items.push({
    svg: `<rect x="350" y="140" width="900" height="860" rx="14" fill="#0a1017" stroke="${P.constLine}" stroke-width="2.4"/>
  ${bg.join('\n  ')}`,
  });

  // СОЗВЕЗДИЙ НАМЕРЕННО НЕМНОГО. В первой версии сюда влезли ещё Возничий с
  // Капеллой, и подписи «ТЕЛЕЦ» и «ВОЗНИЧИЙ» оказались каждая у чужого
  // созвездия — места между фигурами не осталось. Карта-пособие должна
  // показывать опорную картину зимнего неба: Орион, Телец, оба Пса и
  // Близнецы, — а не всё, что видно.

  // Орион — главное созвездие зимнего неба и опора для поиска остальных.
  const ori = {
    bet: [700, 420],
    bel: [872, 400],
    min: [860, 540],
    aln: [810, 556],
    ank: [760, 572],
    sai: [700, 710],
    rig: [882, 730],
  };
  items.push({
    svg: `${constellation(ori, [
      ['bet', 'bel'],
      ['bet', 'ank'],
      ['bel', 'min'],
      ['min', 'aln'],
      ['aln', 'ank'],
      ['ank', 'sai'],
      ['min', 'rig'],
      ['sai', 'rig'],
    ])}
  ${starGlyph(...ori.bet, 0.5, { color: P.starWarm })}
  ${starGlyph(...ori.bel, 1.6)}
  ${starGlyph(...ori.min, 2.2)}
  ${starGlyph(...ori.aln, 1.7)}
  ${starGlyph(...ori.ank, 1.7)}
  ${starGlyph(...ori.sai, 2.1)}
  ${starGlyph(...ori.rig, 0.1, { color: P.starBlue })}
  ${dot(802, 626, 5, '#c98fc0')}
  ${line(810, 556, 802, 626, { color: P.constLine, width: 1.4 })}
  ${label(700, 396, 'Бетельгейзе', { size: 18, fill: P.starWarm })}
  ${label(904, 384, 'Беллатрикс', { size: 18, anchor: 'start', fill: P.muted })}
  ${label(914, 740, 'Ригель', { size: 18, anchor: 'start', fill: P.starBlue })}
  ${label(668, 726, 'Саиф', { size: 18, anchor: 'end', fill: P.muted })}
  ${label(748, 512, 'Пояс Ориона', { size: 18, anchor: 'end', fill: P.ink })}
  ${label(786, 648, 'Туманность Ориона', { size: 16, anchor: 'end', fill: '#c98fc0' })}
  ${label(786, 332, 'ОРИОН', { size: 24, weight: 700, fill: P.starBlue })}`,
  });

  // Телец: Гиады буквой V вокруг Альдебарана и рассеянное скопление Плеяды.
  const hyades = [
    [520, 420],
    [556, 378],
    [592, 336],
    [628, 296],
    [488, 372],
    [456, 326],
  ];
  const pleiades = [
    [424, 246],
    [442, 234],
    [408, 230],
    [432, 264],
    [452, 256],
    [416, 268],
  ];
  items.push({
    svg: `${line(520, 420, 628, 296, { color: P.constLine, width: 1.8 })}
  ${line(520, 420, 456, 326, { color: P.constLine, width: 1.8 })}
  ${hyades
    .map((pt, i) => starGlyph(pt[0], pt[1], i === 1 ? 0.9 : 3.5, i === 1 ? { color: P.starWarm } : {}))
    .join('\n  ')}
  ${pleiades.map((pt) => starGlyph(pt[0], pt[1], 4.2, { color: P.starBlue })).join('\n  ')}
  <circle cx="430" cy="248" r="34" fill="none" stroke="${P.constLine}" stroke-width="1.4" stroke-dasharray="4 5"/>
  ${label(586, 366, 'Альдебаран', { size: 18, anchor: 'start', fill: P.starWarm })}
  ${label(430, 198, 'Плеяды', { size: 18, fill: P.starBlue })}
  ${label(520, 462, 'ТЕЛЕЦ', { size: 22, weight: 700, fill: P.starBlue })}`,
  });

  // Большой Пёс с Сириусом — самой яркой звездой всего неба.
  const cma = [
    [960, 848],
    [1004, 896],
    [1036, 838],
    [936, 912],
  ];
  items.push({
    svg: `${line(960, 848, 1004, 896, { color: P.constLine, width: 1.8 })}
  ${line(1004, 896, 1036, 838, { color: P.constLine, width: 1.8 })}
  ${line(1004, 896, 936, 912, { color: P.constLine, width: 1.8 })}
  ${starGlyph(...cma[0], -1.5, { color: P.starBlue })}
  ${cma.slice(1).map((pt) => starGlyph(pt[0], pt[1], 2.6)).join('\n  ')}
  ${label(936, 826, 'Сириус', { size: 19, anchor: 'end', weight: 700, fill: P.starBlue })}
  ${label(936, 850, 'ярчайшая звезда неба', { size: 15, anchor: 'end', fill: P.muted })}
  ${label(1058, 918, 'БОЛЬШОЙ ПЁС', { size: 20, weight: 700, anchor: 'start', fill: P.starBlue })}`,
  });

  // Малый Пёс и Близнецы.
  items.push({
    svg: `${line(1080, 600, 1114, 656, { color: P.constLine, width: 1.8 })}
  ${starGlyph(1080, 600, 0.4, { color: P.star })}
  ${starGlyph(1114, 656, 2.9)}
  ${label(1102, 592, 'Процион', { size: 18, anchor: 'start' })}
  ${label(1102, 616, 'МАЛЫЙ ПЁС', { size: 17, anchor: 'start', fill: P.starBlue })}
  ${line(1086, 268, 1126, 330, { color: P.constLine, width: 1.8 })}
  ${line(1086, 268, 1040, 364, { color: P.constLine, width: 1.8 })}
  ${line(1126, 330, 1086, 418, { color: P.constLine, width: 1.8 })}
  ${line(1040, 364, 1008, 444, { color: P.constLine, width: 1.8 })}
  ${line(1086, 418, 1064, 496, { color: P.constLine, width: 1.8 })}
  ${starGlyph(1086, 268, 1.6)}
  ${starGlyph(1126, 330, 1.1, { color: P.starWarm })}
  ${[[1040, 364], [1086, 418], [1008, 444], [1064, 496]].map((pt) => starGlyph(pt[0], pt[1], 3.2)).join('\n  ')}
  ${label(1064, 254, 'Кастор', { size: 17, anchor: 'end' })}
  ${label(1150, 336, 'Поллукс', { size: 17, anchor: 'start', fill: P.starWarm })}
  ${label(1150, 292, 'БЛИЗНЕЦЫ', { size: 19, weight: 700, anchor: 'start', fill: P.starBlue })}`,
  });

  // Зимний треугольник — приём, которым созвездия и связывают в одну картину.
  items.push({
    svg: `${line(700, 420, 960, 848, { color: P.ray, width: 1.6, dash: '10 8' })}
  ${line(960, 848, 1080, 600, { color: P.ray, width: 1.6, dash: '10 8' })}
  ${line(1080, 600, 700, 420, { color: P.ray, width: 1.6, dash: '10 8' })}
  ${label(858, 508, 'Зимний треугольник', { size: 19, fill: P.ray })}`,
  });

  // Горизонт: без него карта не привязана к земле.
  items.push({
    svg: `<path d="M 350 1000 L 350 962 Q 520 930 700 952 Q 900 978 1060 940 Q 1160 918 1250 946 L 1250 1000 Z" fill="${P.ground}" stroke="${P.bodyEdge}" stroke-width="1.6"/>
  ${label(800, 1042, 'Вид на южную сторону неба зимним вечером; над горизонтом — Орион и окружающие его созвездия', { size: 19, fill: P.muted })}
  ${label(392, 988, 'горизонт', { size: 17, anchor: 'start', fill: P.muted })}`,
  });

  return compose('Карта звёздного неба: зимние созвездия', items);
}

// ─── 13. Астрономия: фазы Луны ─────────────────────────────────────────────

/**
 * Диск Луны в фазе. k — освещённая доля от 0 до 1; litRight — с какой стороны
 * виден освещённый край.
 *
 * Терминатор — эллипс с полуосью r·|2k−1|: при k = 0,5 он вырождается в
 * прямую, при k = 0 и k = 1 совпадает с краем диска. Рисовать фазу двумя
 * окружностями (как «откушенный» диск) нельзя — получается не фаза, а
 * затмение, и это ровно та ошибка, которую пособие должно снимать.
 */
function moonPhaseDisc(cx, cy, r, k, litRight) {
  const a = r * Math.abs(2 * k - 1);
  const outer = litRight ? 1 : 0;
  const inner = k > 0.5 ? outer : 1 - outer;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${P.moonDark}" stroke="${P.muted}" stroke-width="1.4"/>
  <path d="M ${cx} ${cy - r} A ${r} ${r} 0 0 ${outer} ${cx} ${cy + r} A ${a.toFixed(2)} ${r} 0 0 ${inner} ${cx} ${cy - r} Z" fill="${P.moonLit}"/>`;
}

function moonPhases() {
  const items = [];
  const ex = 940;
  const ey = 590;
  const orbit = 205;
  const ring = 300;
  const labelR = 346;

  // Солнце и параллельный пучок его лучей.
  items.push({
    svg: `${sunDisc(250, ey, 34)}
  ${[480, 535, 590, 645, 700].map((y) => vec(300, y, 400, y, { color: P.sunEdge, width: 2.4, head: 12 })).join('\n  ')}
  ${label(250, ey + 68, 'Солнце', { size: 21, weight: 700 })}
  ${label(350, 452, 'солнечные лучи', { size: 17, fill: P.muted })}`,
  });

  // Земля обращена к Солнцу освещённой стороной — левой.
  items.push({
    svg: `${moonPhaseDisc(ex, ey, 40, 0.5, false).replace(P.moonLit, '#5b8fc9').replace(P.moonDark, '#1b2b3a')}
  ${label(ex, ey + 68, 'Земля', { size: 21, weight: 700 })}
  <circle cx="${ex}" cy="${ey}" r="${orbit}" fill="none" stroke="${P.orbit}" stroke-width="1.6" stroke-dasharray="8 8"/>`,
  });

  const phases = [
    { a: 180, name: 'Новолуние', note: 'Луна между Землёй и Солнцем' },
    { a: 135, name: 'Растущий серп', note: '' },
    { a: 90, name: 'Первая четверть', note: 'видна правая половина' },
    { a: 45, name: 'Растущая Луна', note: '' },
    { a: 0, name: 'Полнолуние', note: 'Земля между Луной и Солнцем' },
    { a: 315, name: 'Убывающая Луна', note: '' },
    { a: 270, name: 'Последняя четверть', note: 'видна левая половина' },
    { a: 225, name: 'Старый месяц', note: '' },
  ];

  phases.forEach((ph) => {
    const rad = (ph.a * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const mx = ex + cos * orbit;
    const my = ey - sin * orbit;
    // Освещённая доля, видимая с Земли, зависит только от угла: k = (1+cos)/2.
    const k = (1 + cos) / 2;
    // Верхняя половина круга — растущая Луна, освещённый край справа.
    const litRight = sin > 0.001 || (Math.abs(sin) <= 0.001 && cos > 0);
    // Сама Луна в пространстве всегда освещена со стороны Солнца, то есть
    // слева, — в каком бы месте орбиты она ни была.
    items.push({ svg: moonPhaseDisc(mx, my, 24, 0.5, false) });

    const vx = ex + cos * ring;
    const vy = ey - sin * ring;
    const reach = Math.abs(cos) <= 0.3 ? labelR + 16 : labelR;
    const lx = ex + cos * reach;
    const ly = ey - sin * reach;
    // Подпись УХОДИТ ОТ ДИСКА наружу: по бокам — вбок (выключка к краю),
    // сверху и снизу — вверх и вниз. С подписью, всегда выключенной по центру,
    // «Новолуние» и «Полнолуние» ложились прямо на свои же диски.
    const anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle';
    const noteDy = 24;
    items.push({
      svg: `${line(mx + cos * 26, my - sin * 26, vx - cos * 30, vy + sin * 30, { color: P.orbit, width: 1.2, dash: '4 5' })}
  ${moonPhaseDisc(vx, vy, 28, k, litRight)}
  ${label(lx, ly + 6, ph.name, { size: 20, weight: 700, anchor })}
  ${ph.note ? label(lx, ly + 6 + noteDy, ph.note, { size: 16, fill: P.muted, anchor }) : ''}`,
    });
  });

  items.push({
    svg: `${label(800, 128, 'Луна всегда освещена Солнцем ровно наполовину — меняется лишь то, какую часть освещённой половины видно с Земли', { size: 19, fill: P.muted })}
  ${label(800, 1062, 'Полный оборот фаз — синодический месяц, около 29,5 суток', { size: 19, fill: P.muted })}`,
  });

  return compose('Фазы Луны', items);
}

// ─── 14. Астрономия: поверхность Луны ──────────────────────────────────────

function moonSurface() {
  const items = [];
  const cx = 800;
  const cy = 578;
  const R = 396;

  items.push({
    svg: `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${P.moonLit}" stroke="${P.craterEdge}" stroke-width="2"/>`,
  });

  // Моря — застывшие лавовые равнины, тёмные и почти без кратеров.
  const maria = [
    { n: 'Море Дождей', x: 646, y: 380, rx: 122, ry: 96, side: 'left' },
    { n: 'Море Ясности', x: 856, y: 336, rx: 80, ry: 66, side: 'right' },
    { n: 'Море Спокойствия', x: 986, y: 486, rx: 82, ry: 74, side: 'right' },
    { n: 'Океан Бурь', x: 512, y: 560, rx: 92, ry: 168, side: 'left' },
    { n: 'Море Кризисов', x: 1086, y: 424, rx: 54, ry: 46, side: 'right' },
    { n: 'Море Облаков', x: 626, y: 752, rx: 78, ry: 56, side: 'left' },
  ];
  maria.forEach((m) => {
    items.push({
      svg: `<ellipse cx="${m.x}" cy="${m.y}" rx="${m.rx}" ry="${m.ry}" fill="${P.mare}"/>
  <ellipse cx="${m.x}" cy="${m.y}" rx="${m.rx}" ry="${m.ry}" fill="none" stroke="${P.mare}" stroke-width="10" opacity="0.5"/>`,
      at: [m.x, m.y],
      label: m.n,
      side: m.side,
    });
  });

  // Материки — светлые и сплошь покрытые кратерами. Разница в плотности
  // кратеров и есть главное, что видно на диске в бинокль.
  const rand = rng(31415);
  const small = [];
  let placed = 0;
  let guard = 0;
  while (placed < 130 && guard < 6000) {
    guard += 1;
    const a = rand() * Math.PI * 2;
    const rr = Math.sqrt(rand()) * (R - 26);
    const px = cx + Math.cos(a) * rr;
    const py = cy + Math.sin(a) * rr;
    // Внутрь морей мелкие кратеры не ставим: их там почти нет, и это заметный
    // на глаз признак, по которому море отличают от материка.
    const inMare = maria.some(
      (m) => ((px - m.x) / (m.rx + 12)) ** 2 + ((py - m.y) / (m.ry + 12)) ** 2 < 1
    );
    if (inMare) continue;
    small.push(craterMark(px, py, 5 + rand() * 16));
    placed += 1;
  }
  items.push({
    svg: small.join('\n  '),
    at: [cx + 150, cy + 290],
    label: 'Материки — светлые, сплошь в кратерах',
    side: 'right',
  });

  // Тихо с лучевой системой — самая заметная деталь на полной Луне.
  const rays = [];
  for (let i = 0; i < 26; i += 1) {
    const a = (i / 26) * Math.PI * 2 + 0.1;
    const l = 150 + rand() * 210;
    const x2 = 748 + Math.cos(a) * l;
    const y2 = 852 + Math.sin(a) * l;
    const d = Math.hypot(x2 - cx, y2 - cy);
    const clamp = d > R - 6 ? (R - 6) / d : 1;
    rays.push(
      line(748, 852, cx + (x2 - cx) * clamp, cy + (y2 - cy) * clamp, {
        color: '#ffffff',
        width: 3.4,
      }).replace('/>', ' opacity="0.28"/>')
    );
  }
  items.push({
    svg: rays.join('\n  '),
    at: [748 + Math.cos((20 / 26) * Math.PI * 2 + 0.1) * 200, 852 + Math.sin((20 / 26) * Math.PI * 2 + 0.1) * 200],
    label: 'Лучи — выброс вещества при ударе',
    side: 'left',
  });
  items.push({
    svg: `${craterMark(748, 852, 30)}
  <circle cx="748" cy="852" r="30" fill="none" stroke="${P.craterEdge}" stroke-width="3"/>`,
    at: [748, 852],
    label: 'Кратер Тихо',
    side: 'left',
  });

  items.push({
    svg: `${craterMark(660, 520, 27)}
  <circle cx="660" cy="520" r="27" fill="none" stroke="${P.craterEdge}" stroke-width="2.6"/>`,
    at: [660, 520],
    label: 'Кратер Коперник',
    side: 'left',
  });

  items.push({
    svg: `${craterMark(1010, 640, 22)}
  <circle cx="1010" cy="640" r="22" fill="none" stroke="${P.craterEdge}" stroke-width="2.4"/>`,
    at: [1010, 640],
    label: 'Кратер — след удара метеорита',
    side: 'right',
  });

  items.push({
    svg: `${label(800, 128, 'Видимая сторона Луны: к Земле она всегда обращена одной и той же стороной', { size: 20, fill: P.muted })}
  ${label(800, 1066, 'Тёмные равнины назвали морями, когда думали, что в них есть вода; воды на Луне в них нет', { size: 19, fill: P.muted })}`,
  });

  return compose('Поверхность Луны: моря, материки и кратеры', items);
}

// ─── Сборка ────────────────────────────────────────────────────────────────

const DRAWINGS = [
  ['mech_lever', mechLever],
  ['mech_incline', mechIncline],
  ['heat_states', heatStates],
  ['elec_circuit', elecCircuit],
  ['magnet_field', magnetField],
  ['optics_lens', opticsLens],
  ['atom_structure', atomStructure],
  ['hydro_archimedes', hydroArchimedes],
  ['astro_solar_system', solarSystem],
  ['astro_planets_compare', planetsCompare],
  ['astro_star_map_north', starMapNorth],
  ['astro_star_map_winter', starMapWinter],
  ['astro_moon_phases', moonPhases],
  ['astro_moon_surface', moonSurface],
];

fs.mkdirSync(OUT, { recursive: true });
for (const [name, draw] of DRAWINGS) {
  const svg = draw();
  fs.writeFileSync(path.join(OUT, `${name}.svg`), svg, 'utf-8');
  console.log(`нарисовано: ${name}.svg (${svg.length} байт)`);
}
console.log(`\nвсего ${DRAWINGS.length}; PNG делает render-thematic.cjs`);
