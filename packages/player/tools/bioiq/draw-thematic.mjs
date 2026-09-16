// packages/player/tools/bioiq/draw-thematic.mjs
//
// Рисует тематические изображения по биологии (FR-022 ≥3 шт, FR-023 — темы
// «внутренние органы, растения, клетки») в SVG. PNG из них делает
// render-thematic.cjs тем же Chromium, что показывает их в приложении.
//
// ПОЧЕМУ РИСУЕМ САМИ, А НЕ БЕРЁМ ГОТОВОЕ. Раздел 10 ТЗ: «разработчик должен
// обеспечить законность использования всех поставляемых изображений». Схема,
// начерченная скриптом из примитивов, — собственная разработка без правовых
// вопросов; она же воспроизводима: правка описания перерисовывает картинку, и
// не нужно искать, кто и где взял исходник. Ни одного файла из эталонного
// продукта ОС3 в поставке нет.
//
// ПОЧЕМУ СХЕМА, А НЕ ФОТОГРАФИЯ. Пособие учит НАЗЫВАТЬ структуры. На
// фотографии органа граница между печенью и желудком видна не всегда, а на
// схеме она проведена. Вдобавок на схему можно честно поставить кликабельную
// область: у неё есть край.
//
// ГЛАВНОЕ УСТРОЙСТВО ФАЙЛА: структура и её подпись описываются ОДНОЙ записью,
// и точка выноски берётся из тех же чисел, которыми структура нарисована.
// Первая версия задавала подписи отдельным списком с координатами «на глаз»,
// и на отрисовке половина выносок показывала в пустое место рядом с органом —
// нашлось это глазами на картинке, никакой проверкой поймать это было нельзя.
// Теперь разойтись им негде.
//
// Запуск: node tools/bioiq/draw-thematic.mjs [каталог вывода]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] || path.join(HERE, 'svg');

const W = 1600;
const H = 1100;

const BG = '#0d1620';
const INK = '#e8eef4';
const LINE = '#6d8ba3';

const TOP = 150;
const BOTTOM = 1050;
// Столбцы подписей сдвинуты внутрь от краёв холста: при RIGHT_X = 1300 самая
// длинная подпись («Межжелудочковая перегородка») уезжала за правый край и
// обрезалась на середине слова.
const LEFT_X = 340;
const RIGHT_X = 1240;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Собирает картинку из описаний структур.
 *
 * Подписи раскладываются САМИ: левый столбец и правый столбец сортируются по
 * высоте своей структуры и равномерно распределяются по полю. Руками
 * расставленные подписи при любой правке рисунка начинают пересекаться
 * выносками, и поправить их — отдельная работа на каждую картинку.
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
    const step = col.length > 1 ? (BOTTOM - TOP) / (col.length - 1) : 0;
    col.forEach((it, i) => {
      const ty = col.length > 1 ? TOP + i * step : (TOP + BOTTOM) / 2;
      const [px, py] = it.at;
      // Короткий горизонтальный хвостик у текста, дальше прямая к структуре:
      // так видно, какой подписи принадлежит линия, даже когда линии сходятся.
      const hx = side === 'left' ? tx + 22 : tx - 22;
      callouts.push(`<path d="M ${px} ${py} L ${hx} ${ty}" stroke="${LINE}" stroke-width="1.6" fill="none"/>
  <circle cx="${px}" cy="${py}" r="5" fill="${LINE}"/>
  <text x="${tx}" y="${ty + 7}" text-anchor="${anchor}" fill="${INK}" font-size="21" font-family="system-ui, 'Segoe UI', sans-serif">${esc(it.label)}</text>`);
    });
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <text x="46" y="60" fill="${INK}" font-size="36" font-weight="700" font-family="system-ui, 'Segoe UI', sans-serif">${esc(title)}</text>
  <line x1="46" y1="80" x2="${W - 46}" y2="80" stroke="#24384a" stroke-width="2"/>
  ${shapes}
  ${callouts.join('\n  ')}
</svg>`;
}

// ─── 1. Животная клетка ────────────────────────────────────────────────────

function cellAnimal() {
  const cx = 800;
  const cy = 600;
  const rx = 330;
  const ry = 270;
  const items = [];

  items.push({
    svg: `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#1d3a4d" stroke="#7fd4c1" stroke-width="7"/>`,
    // Точка на самой линии мембраны, слева-вверху: x = cx - rx·cos45, y = cy - ry·sin45
    at: [Math.round(cx - rx * 0.707), Math.round(cy - ry * 0.707)],
    label: 'Клеточная мембрана',
    side: 'left',
  });

  // Точка «цитоплазмы» — заведомо ПУСТОЕ место внутри клетки. Первый вариант
  // указывал туда, где потом оказалась митохондрия, и подпись читалась как её
  // название.
  items.push({ svg: '', at: [cx - 80, cy + 215], label: 'Цитоплазма', side: 'left' });

  const nx = cx + 10;
  const ny = cy - 30;
  items.push({
    svg: `<circle cx="${nx}" cy="${ny}" r="108" fill="#3c4f86" stroke="#9fb0e8" stroke-width="5"/>`,
    at: [nx + 62, ny + 62],
    label: 'Ядро',
    side: 'left',
  });
  items.push({
    svg: `<circle cx="${nx - 30}" cy="${ny - 28}" r="36" fill="#2a3566" stroke="#9fb0e8" stroke-width="3"/>`,
    at: [nx - 30, ny - 28],
    label: 'Ядрышко',
    side: 'left',
  });

  const mito = (x, y, rot) => `<g transform="translate(${x} ${y}) rotate(${rot})">
    <ellipse rx="72" ry="34" fill="#b5553f" stroke="#e08b6e" stroke-width="4"/>
    <path d="M -50 -12 q 20 26 0 26 M -20 -18 q 22 34 0 36 M 12 -18 q 22 34 0 36 M 42 -12 q 20 26 0 26"
          fill="none" stroke="#f0bda8" stroke-width="4"/>
  </g>`;
  items.push({ svg: mito(cx + 155, cy - 175, -20), at: [cx + 155, cy - 175], label: 'Митохондрия', side: 'right' });
  items.push({ svg: mito(cx - 180, cy + 140, 15) });

  // Шероховатая ЭПС: параллельные цистерны с рибосомами на внешней стороне.
  const erX = cx + 45;
  const erY = cy + 55;
  const er = [];
  for (let i = 0; i < 4; i += 1) {
    const y = erY + i * 34;
    er.push(`<path d="M ${erX} ${y} q 90 -26 180 0" fill="none" stroke="#86b9d6" stroke-width="7" stroke-linecap="round"/>`);
    for (let k = 0; k <= 6; k += 1) {
      const t = k / 6;
      const px = erX + t * 180;
      const py = y - 26 * 2 * t * (1 - t) - 8;
      er.push(`<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="5" fill="#d8e9f2"/>`);
    }
  }
  items.push({ svg: er.join(''), at: [erX + 180, erY + 51], label: 'Эндоплазматическая сеть', side: 'right' });

  // Аппарат Гольджи — стопка уплощённых цистерн с отшнуровывающимися
  // пузырьками. Стопка стоит СЛЕВА ОТ ЯДРА с зазором: в первом варианте она
  // налезала на ядро, а пузырьки оказывались внутри него и читались как часть
  // ядра.
  const gx = cx - 285;
  const gy = cy - 130;
  const golgi = [];
  for (let i = 0; i < 5; i += 1) {
    golgi.push(`<path d="M ${gx} ${gy + i * 21} q 70 -26 140 0" fill="none" stroke="#d8b25e" stroke-width="7" stroke-linecap="round"/>`);
  }
  golgi.push(`<circle cx="${gx + 118}" cy="${gy + 112}" r="11" fill="#d8b25e"/>`);
  golgi.push(`<circle cx="${gx + 92}" cy="${gy + 134}" r="8" fill="#d8b25e"/>`);
  items.push({ svg: golgi.join(''), at: [gx + 70, gy + 32], label: 'Аппарат Гольджи', side: 'left' });

  items.push({
    svg: `<circle cx="${cx + 60}" cy="${cy + 205}" r="27" fill="#8e6fb8" stroke="#c4a8e6" stroke-width="4"/>
    <circle cx="${cx + 135}" cy="${cy + 180}" r="18" fill="#8e6fb8" stroke="#c4a8e6" stroke-width="4"/>`,
    at: [cx + 60, cy + 205],
    label: 'Лизосома',
    side: 'right',
  });

  // Свободные рибосомы
  const ribo = [[cx - 250, cy + 45], [cx - 210, cy + 78], [cx - 268, cy - 5], [cx - 165, cy + 62], [cx - 232, cy + 118]];
  items.push({
    svg: ribo.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="8" fill="#d8e9f2"/>`).join(''),
    at: ribo[1],
    label: 'Рибосомы',
    side: 'left',
  });

  // Клеточный центр — ДВЕ ЦЕНТРИОЛИ ПОД ПРЯМЫМ УГЛОМ, каждая из трёх
  // трубочек. Первая версия рисовала две скрещённые плашки, и на картинке это
  // читалось как медицинский крест, а не как органоид.
  const ccx = cx + 215;
  const ccy = cy - 30;
  const tubes = (x, y, vertical) =>
    [0, 1, 2]
      .map((i) =>
        vertical
          ? `<rect x="${x - 4 + i * 9}" y="${y - 30}" width="6" height="60" rx="3" fill="#6fb8a2" stroke="#b6e5d7" stroke-width="2"/>`
          : `<rect x="${x - 30}" y="${y - 4 + i * 9}" width="60" height="6" rx="3" fill="#6fb8a2" stroke="#b6e5d7" stroke-width="2"/>`
      )
      .join('');
  items.push({
    svg: tubes(ccx - 26, ccy, true) + tubes(ccx + 22, ccy + 26, false),
    at: [ccx, ccy + 12],
    label: 'Клеточный центр',
    side: 'right',
  });

  return compose('Строение животной клетки', items);
}

// ─── 2. Растительная клетка ────────────────────────────────────────────────

function cellPlant() {
  const x0 = 430;
  const y0 = 230;
  const w = 740;
  const h = 640;
  const items = [];

  items.push({
    svg: `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" rx="40" fill="#25452f" stroke="#c9a66b" stroke-width="18"/>`,
    at: [x0 + w / 2, y0 - 9],
    label: 'Клеточная стенка',
    side: 'left',
  });
  items.push({
    svg: `<rect x="${x0 + 17}" y="${y0 + 17}" width="${w - 34}" height="${h - 34}" rx="30" fill="none" stroke="#7fd4c1" stroke-width="6"/>`,
    at: [x0 + 17, y0 + h / 2],
    label: 'Клеточная мембрана',
    side: 'left',
  });

  items.push({
    svg: `<rect x="${x0 + 160}" y="${y0 + 140}" width="${w - 320}" height="${h - 280}" rx="70" fill="#2b5f7a" stroke="#8fd0e8" stroke-width="5"/>`,
    at: [x0 + w / 2, y0 + h / 2],
    label: 'Вакуоль с клеточным соком',
    side: 'right',
  });

  const nx = x0 + 96;
  const ny = y0 + 120;
  items.push({
    svg: `<circle cx="${nx}" cy="${ny}" r="72" fill="#3c4f86" stroke="#9fb0e8" stroke-width="5"/>`,
    at: [nx + 46, ny + 46],
    label: 'Ядро',
    side: 'left',
  });
  items.push({
    svg: `<circle cx="${nx - 22}" cy="${ny - 20}" r="24" fill="#2a3566" stroke="#9fb0e8" stroke-width="3"/>`,
    at: [nx - 22, ny - 20],
    label: 'Ядрышко',
    side: 'left',
  });

  const chloro = (x, y, rot) => `<g transform="translate(${x} ${y}) rotate(${rot})">
    <ellipse rx="58" ry="30" fill="#3f8f4a" stroke="#8fe09a" stroke-width="4"/>
    <ellipse cx="-22" cy="0" rx="11" ry="8" fill="#d3f2c4"/>
    <ellipse cx="2" cy="-8" rx="11" ry="8" fill="#d3f2c4"/>
    <ellipse cx="24" cy="5" rx="11" ry="8" fill="#d3f2c4"/>
  </g>`;
  items.push({ svg: chloro(x0 + 86, y0 + 360, -18), at: [x0 + 86, y0 + 360], label: 'Хлоропласт', side: 'left' });
  items.push({ svg: chloro(x0 + 100, y0 + 500, 12) });
  items.push({ svg: chloro(x0 + w - 86, y0 + 200, 20) });
  items.push({ svg: chloro(x0 + w - 96, y0 + 340, -14) });

  items.push({
    svg: `<g transform="translate(${x0 + w - 92} ${y0 + 500}) rotate(-10)">
      <ellipse rx="54" ry="26" fill="#b5553f" stroke="#e08b6e" stroke-width="4"/>
      <path d="M -34 -9 q 17 20 0 22 M -8 -13 q 17 26 0 28 M 18 -11 q 17 22 0 24" fill="none" stroke="#f0bda8" stroke-width="3.5"/>
    </g>`,
    at: [x0 + w - 92, y0 + 500],
    label: 'Митохондрия',
    side: 'right',
  });

  items.push({ svg: '', at: [x0 + w - 60, y0 + 90], label: 'Цитоплазма', side: 'right' });

  return compose('Строение растительной клетки', items);
}

// ─── 3. Цветковое растение целиком ─────────────────────────────────────────

function plantStructure() {
  const sx = 780;
  const ground = 700;
  const items = [];

  items.push({ svg: `<rect x="220" y="${ground}" width="1120" height="${H - ground}" fill="#15120c"/>
    <line x1="220" y1="${ground}" x2="1340" y2="${ground}" stroke="#4a3b2a" stroke-width="6"/>` });

  // Корень
  const roots = [`<path d="M ${sx} ${ground} L ${sx} ${ground + 250}" stroke="#c9a66b" stroke-width="16" stroke-linecap="round" fill="none"/>`];
  for (const [dy, len, dir] of [[55, 120, -1], [105, 145, 1], [155, 110, -1], [200, 80, 1]]) {
    roots.push(`<path d="M ${sx} ${ground + dy} q ${dir * len * 0.6} 20 ${dir * len} 55" stroke="#c9a66b" stroke-width="8" fill="none" stroke-linecap="round"/>`);
  }
  items.push({ svg: roots.join(''), at: [sx, ground + 200], label: 'Главный корень', side: 'left' });
  items.push({ svg: '', at: [sx + 125, ground + 155], label: 'Боковой корень', side: 'right' });

  items.push({
    svg: `<path d="M ${sx} ${ground} L ${sx} 300" stroke="#4f9a56" stroke-width="18" stroke-linecap="round" fill="none"/>`,
    at: [sx, 560],
    label: 'Стебель',
    side: 'left',
  });

  const leaf = (y, dir) => `<g transform="translate(${sx} ${y})">
    <path d="M 0 0 q ${dir * 80} -66 ${dir * 175} -16 q ${-dir * 88} 66 ${-dir * 175} 16 z" fill="#4f9a56" stroke="#8fe09a" stroke-width="4"/>
    <path d="M 0 0 q ${dir * 92} -26 ${dir * 166} -18" fill="none" stroke="#2c6234" stroke-width="3.5"/>
  </g>`;
  items.push({ svg: leaf(600, -1), at: [sx - 110, 572], label: 'Лист', side: 'left' });
  items.push({ svg: leaf(520, 1), at: [sx + 110, 492], label: 'Листовая пластинка', side: 'right' });
  items.push({ svg: leaf(430, -1) });

  items.push({
    svg: `<g transform="translate(${sx} 300)">
      ${[0, 60, 120, 180, 240, 300].map((a) => `<ellipse rx="40" ry="76" cy="-60" fill="#d86f9a" stroke="#f3b6cd" stroke-width="3.5" transform="rotate(${a})"/>`).join('')}
      <circle cy="0" r="28" fill="#e8c65e" stroke="#f6e3a6" stroke-width="4"/>
    </g>`,
    at: [sx, 240],
    label: 'Цветок',
    side: 'right',
  });

  items.push({
    svg: `<path d="M ${sx} 470 q 90 -20 126 -78" stroke="#4f9a56" stroke-width="10" fill="none"/>
      <ellipse cx="${sx + 136}" cy="378" rx="28" ry="44" fill="#a34e73" stroke="#f3b6cd" stroke-width="3.5"/>`,
    at: [sx + 136, 378],
    label: 'Бутон',
    side: 'right',
  });

  items.push({
    svg: `<path d="M ${sx} 560 q -100 -10 -142 -58" stroke="#4f9a56" stroke-width="10" fill="none"/>
      <circle cx="${sx - 154}" cy="490" r="38" fill="#c0442f" stroke="#f0a08e" stroke-width="4"/>`,
    at: [sx - 154, 490],
    label: 'Плод',
    side: 'left',
  });

  items.push({ svg: '', at: [sx, ground - 8], label: 'Корневая шейка', side: 'right' });

  return compose('Строение цветкового растения', items);
}

// ─── 4. Строение цветка в разрезе ──────────────────────────────────────────

function plantFlower() {
  const cx = 800;
  const base = 860;
  const items = [];

  items.push({
    svg: `<path d="M ${cx} ${base + 160} L ${cx} ${base}" stroke="#4f9a56" stroke-width="16" stroke-linecap="round"/>`,
    at: [cx, base + 120],
    label: 'Цветоножка',
    side: 'left',
  });
  items.push({
    svg: `<path d="M ${cx - 104} ${base} q 104 86 208 0 z" fill="#4f9a56" stroke="#8fe09a" stroke-width="4"/>`,
    at: [cx, base + 34],
    label: 'Цветоложе',
    side: 'left',
  });

  items.push({
    svg: `<path d="M ${cx - 100} ${base - 6} q -78 -48 -116 -134 q 86 38 126 114 z" fill="#3f7a46" stroke="#8fe09a" stroke-width="3.5"/>
      <path d="M ${cx + 100} ${base - 6} q 78 -48 116 -134 q -86 38 -126 114 z" fill="#3f7a46" stroke="#8fe09a" stroke-width="3.5"/>`,
    at: [cx - 168, base - 78],
    label: 'Чашелистик',
    side: 'left',
  });

  items.push({
    svg: `<path d="M ${cx - 96} ${base - 20} q -180 -170 -104 -370 q 124 124 172 332 z" fill="#d86f9a" stroke="#f3b6cd" stroke-width="4"/>
      <path d="M ${cx + 96} ${base - 20} q 180 -170 104 -370 q -124 124 -172 332 z" fill="#d86f9a" stroke="#f3b6cd" stroke-width="4"/>`,
    at: [cx - 168, base - 240],
    label: 'Лепесток',
    side: 'left',
  });

  const stamen = (dx) => `<g>
    <path d="M ${cx + dx * 0.35} ${base - 30} q ${dx * 0.4} -140 ${dx} -236" stroke="#e8c65e" stroke-width="7" fill="none"/>
    <ellipse cx="${cx + dx}" cy="${base - 268}" rx="24" ry="40" fill="#e8c65e" stroke="#f6e3a6" stroke-width="3.5" transform="rotate(${dx / 7} ${cx + dx} ${base - 268})"/>
  </g>`;
  items.push({ svg: stamen(-180), at: [cx - 180, base - 268], label: 'Пыльник', side: 'left' });
  items.push({ svg: stamen(-114) });
  items.push({ svg: stamen(114), at: [cx + 150, base - 180], label: 'Тычиночная нить', side: 'right' });
  items.push({ svg: stamen(180) });

  items.push({
    svg: `<ellipse cx="${cx}" cy="${base - 96}" rx="82" ry="100" fill="#6fb8a2" stroke="#b6e5d7" stroke-width="5"/>`,
    at: [cx + 52, base - 60],
    label: 'Завязь',
    side: 'right',
  });
  items.push({
    svg: `<circle cx="${cx - 28}" cy="${base - 106}" r="18" fill="#d3f2c4" stroke="#8fe09a" stroke-width="3"/>
      <circle cx="${cx + 28}" cy="${base - 86}" r="18" fill="#d3f2c4" stroke="#8fe09a" stroke-width="3"/>`,
    at: [cx - 28, base - 106],
    label: 'Семязачаток',
    side: 'right',
  });
  items.push({
    svg: `<path d="M ${cx} ${base - 196} L ${cx} ${base - 352}" stroke="#6fb8a2" stroke-width="15" stroke-linecap="round"/>`,
    at: [cx, base - 290],
    label: 'Столбик',
    side: 'right',
  });
  items.push({
    svg: `<ellipse cx="${cx}" cy="${base - 374}" rx="56" ry="29" fill="#b6e5d7" stroke="#d9f6ee" stroke-width="4"/>`,
    at: [cx, base - 374],
    label: 'Рыльце',
    side: 'right',
  });

  return compose('Строение цветка', items);
}

// ─── 5. Внутренние органы человека ─────────────────────────────────────────

function organsTorso() {
  const cx = 800;
  const items = [];

  // Силуэт задан ЗЕРКАЛЬНО и замкнут явно, в обе стороны от шеи.
  //
  // Первый вариант шёл по контуру одной цепочкой относительных команд и
  // заканчивался не там, где начинался; `z` дорисовывал недостающее прямой
  // чертой — поперёк плеч через треть ширины картинки. Вдобавок низ выходил
  // смещённым вбок, и туловище оказывалось несимметричным. Абсолютные
  // координаты, посчитанные от cx, такого допустить не дают.
  const torso = `M ${cx - 40} 150
    L ${cx + 40} 150
    C ${cx + 130} 160, ${cx + 214} 200, ${cx + 230} 300
    C ${cx + 243} 420, ${cx + 198} 520, ${cx + 186} 620
    C ${cx + 176} 700, ${cx + 214} 760, ${cx + 213} 830
    C ${cx + 211} 920, ${cx + 190} 990, ${cx + 178} 1050
    L ${cx - 178} 1050
    C ${cx - 190} 990, ${cx - 211} 920, ${cx - 213} 830
    C ${cx - 214} 760, ${cx - 176} 700, ${cx - 186} 620
    C ${cx - 198} 520, ${cx - 243} 420, ${cx - 230} 300
    C ${cx - 214} 200, ${cx - 130} 160, ${cx - 40} 150
    Z`;
  items.push({ svg: `<path d="${torso}" fill="#16232e" stroke="#3d5568" stroke-width="4"/>` });

  items.push({
    svg: `<path d="M ${cx} 188 L ${cx} 296" stroke="#9fb3c4" stroke-width="16" stroke-linecap="round"/>`,
    at: [cx, 226],
    label: 'Трахея',
    side: 'left',
  });

  items.push({
    svg: `<path d="M ${cx - 22} 300 q -104 20 -122 126 q -14 96 26 142 q 66 22 98 -42 q 20 -100 -2 -226 z" fill="#5f8fb0" stroke="#a8cfe6" stroke-width="4"/>
      <path d="M ${cx + 22} 300 q 104 20 122 126 q 14 96 -26 142 q -66 22 -98 -42 q -20 -100 2 -226 z" fill="#5f8fb0" stroke="#a8cfe6" stroke-width="4"/>`,
    at: [cx - 104, 430],
    label: 'Лёгкое',
    side: 'left',
  });

  items.push({
    svg: `<path d="M ${cx - 12} 352 q 56 -42 92 6 q 28 44 -16 92 q -32 34 -80 58 q -38 -62 -34 -106 q 2 -32 38 -50 z" fill="#c0442f" stroke="#f0a08e" stroke-width="4"/>`,
    at: [cx + 26, 420],
    label: 'Сердце',
    side: 'right',
  });

  items.push({
    svg: `<path d="M ${cx - 172} 580 q 88 -22 184 6 q 22 62 -38 88 q -106 24 -146 -26 q -16 -36 0 -68 z" fill="#8a4a33" stroke="#d09274" stroke-width="4"/>`,
    at: [cx - 100, 618],
    label: 'Печень',
    side: 'left',
  });

  items.push({
    svg: `<path d="M ${cx + 44} 578 q 104 -6 114 76 q 6 72 -66 88 q -66 12 -76 -46 q -6 -62 28 -118 z" fill="#c98a4e" stroke="#f0c79a" stroke-width="4"/>`,
    at: [cx + 108, 650],
    label: 'Желудок',
    side: 'right',
  });

  items.push({
    svg: `<ellipse cx="${cx + 162}" cy="612" rx="32" ry="50" fill="#6d3f66" stroke="#c79fc0" stroke-width="4" transform="rotate(20 ${cx + 162} 612)"/>`,
    at: [cx + 162, 612],
    label: 'Селезёнка',
    side: 'right',
  });

  // Диафрагма рисуется ПОСЛЕ печени, желудка и селезёнки. Нарисованная до
  // них, она пряталась под ними почти целиком, и выноска упиралась в желудок:
  // подпись показывала на орган, который называется иначе. Порядок вдобавок
  // анатомически верен — диафрагма лежит НАД печенью.
  items.push({
    svg: `<path d="M ${cx - 178} 556 q 178 76 356 0" fill="none" stroke="#b58ea8" stroke-width="9"/>`,
    at: [cx, 594],
    label: 'Диафрагма',
    side: 'right',
  });

  items.push({
    svg: `<path d="M ${cx - 56} 700 q 126 -26 208 28" fill="none" stroke="#d8b25e" stroke-width="18" stroke-linecap="round"/>`,
    at: [cx + 66, 700],
    label: 'Поджелудочная железа',
    side: 'right',
  });

  items.push({
    svg: `<path d="M ${cx - 184} 698 q -42 4 -44 54 q -2 48 40 54 q 20 2 22 -26 q -28 -28 -28 -56 q 0 -24 10 -26 z" fill="#7a4a58" stroke="#d2a0ae" stroke-width="4"/>
      <path d="M ${cx + 184} 698 q 42 4 44 54 q 2 48 -40 54 q -20 2 -22 -26 q 28 -28 28 -56 q 0 -24 -10 -26 z" fill="#7a4a58" stroke="#d2a0ae" stroke-width="4"/>`,
    at: [cx - 200, 752],
    label: 'Почка',
    side: 'left',
  });

  items.push({
    svg: `<path d="M ${cx - 146} 906 L ${cx - 146} 792 q 0 -28 28 -28 L ${cx + 118} 764 q 28 0 28 28 L ${cx + 146} 906"
      fill="none" stroke="#a8763f" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>`,
    at: [cx - 146, 850],
    label: 'Толстая кишка',
    side: 'left',
  });

  items.push({
    svg: `<path d="M ${cx - 92} 822 q 58 -28 96 10 q 38 38 -20 60 q -68 22 -10 56 q 60 32 116 -2" fill="none" stroke="#c98a4e" stroke-width="17" stroke-linecap="round"/>
      <path d="M ${cx - 86} 900 q 68 24 146 -10" fill="none" stroke="#c98a4e" stroke-width="17" stroke-linecap="round"/>`,
    at: [cx - 10, 884],
    label: 'Тонкая кишка',
    side: 'right',
  });

  items.push({
    svg: `<path d="M ${cx - 52} 952 q 52 -24 104 0 q 12 58 -52 70 q -64 -12 -52 -70 z" fill="#4e7f96" stroke="#a8cfe6" stroke-width="4"/>`,
    at: [cx, 990],
    label: 'Мочевой пузырь',
    side: 'left',
  });

  return compose('Внутренние органы человека', items);
}

// ─── 6. Строение сердца ────────────────────────────────────────────────────

function organsHeart() {
  const cx = 790;
  const items = [];

  items.push({
    svg: `<path d="M ${cx} 268 q 146 -38 224 88 q 68 116 30 292 q -40 174 -186 262 q -38 24 -78 -10 q -146 -106 -184 -262 q -38 -176 30 -292 q 78 -126 164 -78 z"
      fill="#3a1f21" stroke="#e08b6e" stroke-width="5"/>` });

  // Сосуды рисуются ПЕРВЫМИ, чтобы камеры легли поверх и сосуды выходили
  // из-под контура, а не лежали на нём.
  items.push({
    svg: `<path d="M ${cx + 24} 300 q 10 -126 -126 -146" fill="none" stroke="#c0442f" stroke-width="34" stroke-linecap="round"/>`,
    at: [cx - 70, 172],
    label: 'Аорта',
    side: 'left',
  });
  items.push({
    svg: `<path d="M ${cx - 38} 310 q -28 -116 58 -164" fill="none" stroke="#4e7f96" stroke-width="28" stroke-linecap="round"/>`,
    at: [cx + 16, 152],
    label: 'Лёгочный ствол',
    side: 'right',
  });
  items.push({
    svg: `<path d="M ${cx - 166} 356 q -106 -28 -136 -106" fill="none" stroke="#4e7f96" stroke-width="26" stroke-linecap="round"/>`,
    at: [cx - 270, 288],
    label: 'Верхняя полая вена',
    side: 'left',
  });
  items.push({
    svg: `<path d="M ${cx - 174} 466 q -116 30 -146 118" fill="none" stroke="#4e7f96" stroke-width="24" stroke-linecap="round"/>`,
    at: [cx - 282, 552],
    label: 'Нижняя полая вена',
    side: 'left',
  });
  items.push({
    svg: `<path d="M ${cx + 172} 376 q 106 -20 146 -88" fill="none" stroke="#c0442f" stroke-width="22" stroke-linecap="round"/>`,
    at: [cx + 280, 312],
    label: 'Лёгочные вены',
    side: 'right',
  });

  items.push({
    svg: `<path d="M ${cx - 10} 322 q -146 -10 -176 88 q -14 58 38 74 q 88 22 138 -30 z" fill="#3f6f9a" stroke="#a8cfe6" stroke-width="4"/>`,
    at: [cx - 108, 398],
    label: 'Правое предсердие',
    side: 'left',
  });
  items.push({
    svg: `<path d="M ${cx + 10} 322 q 146 -10 176 88 q 14 58 -38 74 q -88 22 -138 -30 z" fill="#8a3a30" stroke="#f0a08e" stroke-width="4"/>`,
    at: [cx + 108, 398],
    label: 'Левое предсердие',
    side: 'right',
  });

  items.push({
    svg: `<path d="M ${cx - 12} 520 q -126 10 -146 126 q -16 106 88 186 q 38 26 60 -10 z" fill="#3f6f9a" stroke="#a8cfe6" stroke-width="4"/>`,
    at: [cx - 86, 652],
    label: 'Правый желудочек',
    side: 'left',
  });
  items.push({
    svg: `<path d="M ${cx + 12} 520 q 136 10 156 126 q 18 116 -98 194 q -38 24 -58 -14 z" fill="#8a3a30" stroke="#f0a08e" stroke-width="4"/>`,
    at: [cx + 96, 660],
    label: 'Левый желудочек',
    side: 'right',
  });

  items.push({
    svg: `<path d="M ${cx - 146} 502 q 68 38 134 0" fill="none" stroke="#f6e3a6" stroke-width="8"/>`,
    at: [cx - 80, 516],
    label: 'Трёхстворчатый клапан',
    side: 'left',
  });
  items.push({
    svg: `<path d="M ${cx + 12} 502 q 70 38 142 0" fill="none" stroke="#f6e3a6" stroke-width="8"/>`,
    at: [cx + 84, 516],
    label: 'Двустворчатый клапан',
    side: 'right',
  });

  items.push({
    svg: `<path d="M ${cx} 322 L ${cx} 826" stroke="#e0b8a8" stroke-width="10"/>`,
    at: [cx, 740],
    label: 'Межжелудочковая перегородка',
    side: 'right',
  });

  return compose('Строение сердца', items);
}

// ─── сборка ────────────────────────────────────────────────────────────────

const DRAWINGS = [
  ['cell_animal', cellAnimal],
  ['cell_plant', cellPlant],
  ['plant_structure', plantStructure],
  ['plant_flower', plantFlower],
  ['organs_torso', organsTorso],
  ['organs_heart', organsHeart],
];

fs.mkdirSync(OUT, { recursive: true });
for (const [name, draw] of DRAWINGS) {
  const svg = draw();
  fs.writeFileSync(path.join(OUT, `${name}.svg`), svg, 'utf-8');
  console.log(`нарисовано: ${name}.svg (${svg.length} байт)`);
}
console.log(`\nвсего ${DRAWINGS.length}; PNG делает render-thematic.cjs`);
