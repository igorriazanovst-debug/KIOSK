// packages/player/tools/physastroiq/levels-physics.mjs
//
// Три игровые карты викторины «Физика» (FR-008, строка 329: три уровня, у
// каждого свой набор вопросов). Каркас и правила расстановки — в
// level-plate.mjs, рисует draw-levels.mjs.
//
// ПОЧЕМУ УРОВНИ ИМЕННО ТАКИЕ. Уровень — это не «те же вопросы потруднее», а
// другой раздел с другой картой: электрическая цепь, простые механизмы,
// оптика. Порядок выбран по школьному курсу: условные обозначения цепи
// узнают раньше, чем ход лучей в линзе.
//
// КАЖДАЯ НАЗВАННАЯ ДЕТАЛЬ НА КАРТЕ — В СВОЁМ РОДЕ ЕДИНСТВЕННАЯ. Два резистора
// при вопросе «где резистор?» дали бы два правильных места и один
// засчитанный ответ. Поэтому на карте цепи один резистор, один реостат, одна
// лампа, и обманками служат клеммы, а не вторые экземпляры приборов.

import { plate, W, H } from './level-plate.mjs';
import {
  PALETTE as P,
  line,
  dot,
  vec,
  label,
  rectBody,
  batteryCell,
  switchSym,
  lampSym,
  resistorSym,
  meterSym,
  coilSym,
  rheostatSym,
  fuseSym,
  motorSym,
  bellSym,
  capacitorSym,
  heaterSym,
  groundSym,
  terminalSym,
  pulley,
  springCoil,
  gearWheel,
  convexLens,
  concaveLens,
  flatMirror,
  prism,
  rng,
} from './shapes.mjs';

/** Кликабельная область вокруг точки: удобнее, чем считать углы руками. */
const around = (cx, cy, w, h) => ({ x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), width: w, height: h });

// ─── Уровень 1. Электрическая цепь ─────────────────────────────────────────

function level1() {
  const p = plate(P.bg);
  const L = 260;
  const R = 1540;
  const T = 330;
  const B = 950;
  const MID = 700;

  // Провода. Рисуются с разрывами там, где стоят приборы: линия сквозь лампу
  // превращает схему в кашу.
  p.draw(
    // верхний провод, до узла параллельного участка
    line(L, T, 510, T),
    line(610, T, 835, T),
    line(965, T, 1150, T),
    line(1460, T, R, T),
    // параллельный участок: верхняя и нижняя ветви между узлами 1150 и 1460
    line(1150, T, 1150, 180),
    line(1150, 180, 1245, 180),
    line(1365, 180, 1460, 180),
    line(1460, 180, 1460, T),
    line(1150, T, 1150, 470),
    line(1150, 470, 1240, 470),
    line(1370, 470, 1460, 470),
    line(1460, 470, 1460, T),
    // правый провод
    line(R, T, R, 526),
    line(R, 594, R, 766),
    line(R, 834, R, B),
    // нижний провод
    line(R, B, 1310, B),
    line(1190, B, 1000, B),
    line(900, B, 655, B),
    line(545, B, L, B),
    // левый провод
    line(L, B, L, 834),
    line(L, 766, L, MID),
    line(L, MID, L, T),
    // средняя перемычка: делит цепь на два контура
    line(L, MID, 680, MID),
    line(955, MID, 1350, MID),
    line(1350, MID, R, MID),
    // ответвление на конденсатор вниз, к нижнему проводу
    line(1350, MID, 1350, 780),
    line(1350, 870, 1350, B),
    // ответвление на заземление
    line(1100, MID, 1100, 784)
  );

  p.put('lamp', 'Лампа накаливания', lampSym(560, T, 40), around(560, T, 110, 100));
  p.put('rheostat', 'Реостат', rheostatSym(900, T, 110, 40), around(900, T, 140, 92));
  p.put('resistor', 'Резистор', resistorSym(1305, 180, 120, 40), around(1305, 180, 140, 80));
  p.put('heater', 'Нагревательный элемент', heaterSym(1305, 470, 130, 46), around(1305, 470, 150, 82));
  p.put('ammeter', 'Амперметр', meterSym(R, 560, 'A', 34), around(R, 560, 90, 90));
  p.put('motor', 'Электродвигатель', motorSym(R, 800, 34), around(R, 800, 90, 90));
  p.put('fuse', 'Плавкий предохранитель', fuseSym(1250, B, 120, 38), around(1250, B, 140, 90));
  p.put('switch', 'Ключ', switchSym(950, B, { width: 100, lift: 42 }), around(950, B - 20, 120, 100));
  p.put('battery', 'Источник тока', batteryCell(600, B, { scale: 2.2 }), around(600, B, 120, 110));
  p.put('bell', 'Электрический звонок', bellSym(L, 800, 34), around(L, 786, 100, 90));
  p.put('coil', 'Катушка (электромагнит)', coilSym(680, MID, 5, 55), around(817, MID - 18, 275, 90));
  p.put('ground', 'Заземление', groundSym(1100, 810, 70), around(1100, 806, 110, 100));
  p.put('capacitor', 'Конденсатор', capacitorSym(1350, 825, 70, 20), around(1350, 825, 100, 96));

  // Вольтметр — ОТДЕЛЬНОЙ ВЕТВЬЮ поверх лампы, а не в разрыве провода.
  // Вольтметр в разрыве остановил бы ток: у него большое сопротивление. Схема
  // должна показывать правильное включение, иначе она учит ошибке.
  p.draw(
    line(480, T, 480, 210),
    line(480, 210, 512, 210),
    line(608, 210, 640, 210),
    line(640, 210, 640, T),
    dot(480, T, 6, P.wire),
    dot(640, T, 6, P.wire)
  );
  p.put('voltmeter', 'Вольтметр', meterSym(560, 210, 'V', 34), around(560, 210, 96, 92));

  // Точки без привязки (FR-013) — клеммы и узлы схемы. Настоящая деталь, но
  // ни один вопрос про неё не спрашивает.
  const terminals = [
    [L, T], [400, T], [1050, T], [R, T],
    [1150, T], [1460, T],
    [L, B], [760, B], [1080, B], [R, B],
    [450, MID], [1480, MID], [L, MID],
  ];
  for (const [tx, ty] of terminals) {
    const box = around(tx, ty, 34, 34);
    if (p.fits(box)) p.decoy(terminalSym(tx, ty, 13), box);
  }

  return p.build('Электрическая цепь');
}

// ─── Уровень 2. Простые механизмы и силы ───────────────────────────────────

function level2() {
  const p = plate(P.bg);

  // Опорная рама, к которой подвешены механизмы: без неё блоки и пружина
  // висят в пустоте, и непонятно, за что они держатся.
  p.draw(
    rectBody(120, 150, W - 240, 26, { fill: P.metal, stroke: P.ink, rx: 4 }),
    line(150, 176, 150, 1120, { color: P.metal, width: 12 }),
    line(W - 150, 176, W - 150, 1120, { color: P.metal, width: 12 }),
    line(120, 1120, W - 120, 1120, { color: P.metal, width: 12 })
  );

  // — Рычаг с точкой опоры (левый верх)
  p.draw(
    `<polygon points="440,320 380,440 500,440" fill="${P.body}" stroke="${P.bodyEdge}" stroke-width="3"/>`
  );
  p.put(
    'lever',
    'Рычаг',
    rectBody(200, 300, 500, 20, { fill: P.metal, stroke: P.ink, rx: 4 }),
    { x: 545, y: 288, width: 140, height: 46 }
  );
  p.put('fulcrum', 'Точка опоры', dot(440, 310, 9, P.ink), around(440, 382, 110, 110));

  // — Пружина на штативе (левее центра)
  p.put(
    'stand',
    'Штатив',
    `${rectBody(820, 1040, 200, 22, { fill: P.metal, stroke: P.ink, rx: 4 })}
  ${line(920, 1040, 920, 560, { color: P.metal, width: 10 })}
  ${line(920, 560, 1010, 560, { color: P.metal, width: 8 })}`,
    { x: 826, y: 1026, width: 190, height: 48 }
  );
  p.put('spring', 'Пружина', springCoil(1010, 576, 800, 8, 24), around(1010, 690, 90, 200));

  // — Блоки с тросом и грузом (правый верх)
  p.draw(
    // Трос: один конец закреплён на раме, дальше идёт под подвижный блок,
    // поднимается к неподвижному и свободным концом свисает вниз — за него и
    // тянут. Раньше «трос» был отдельным отрезком, не связанным ни с чем:
    // на отрисовке он висел в воздухе и выглядел огрехом.
    line(1386, 176, 1386, 560, { color: P.ink, width: 4 }),
    line(1298, 560, 1298, 275, { color: P.ink, width: 4 }),
    line(1202, 275, 1202, 760, { color: P.ink, width: 4 })
  );
  p.put('fixed-pulley', 'Неподвижный блок', pulley(1250, 275, 48), around(1250, 275, 116, 116));
  p.put('movable-pulley', 'Подвижный блок', pulley(1342, 560, 44), around(1342, 560, 108, 108));
  p.put('rope', 'Трос', '', { x: 1168, y: 600, width: 56, height: 150 });
  p.put(
    'load',
    'Груз',
    `${line(1342, 604, 1342, 640, { color: P.ink, width: 4 })}
  ${rectBody(1278, 640, 128, 110)}`,
    { x: 1274, y: 636, width: 136, height: 118 }
  );

  // — Наклонная плоскость и клин (левый низ)
  p.put(
    'incline',
    'Наклонная плоскость',
    `<polygon points="200,1050 700,1050 700,760" fill="${P.ground}" stroke="${P.bodyEdge}" stroke-width="3"/>`,
    { x: 470, y: 940, width: 210, height: 100 }
  );
  p.put(
    'wedge',
    'Клин',
    `<polygon points="250,700 250,790 470,745" fill="${P.body}" stroke="${P.bodyEdge}" stroke-width="3"/>`,
    { x: 246, y: 696, width: 190, height: 98 }
  );

  // — Нитяной маятник (центр низа)
  p.put(
    'pendulum',
    'Нитяной маятник',
    `${line(880, 176, 960, 470, { color: P.ink, width: 3 })}
  <circle cx="960" cy="500" r="34" fill="${P.body}" stroke="${P.bodyEdge}" stroke-width="3"/>`,
    around(960, 500, 100, 100)
  );

  // — Зубчатая передача и вал с винтом (правый низ)
  p.put('gear', 'Зубчатое колесо', gearWheel(1300, 900, 74, 14), around(1300, 900, 190, 190));
  p.put(
    'axle',
    'Вал',
    `${rectBody(1436, 884, 180, 32, { fill: P.metal, stroke: P.ink, rx: 6 })}`,
    { x: 1432, y: 880, width: 188, height: 40 }
  );
  p.put(
    'screw',
    'Винт',
    `${rectBody(1180, 1010, 300, 46, { fill: P.metal, stroke: P.ink, rx: 8 })}
  ${Array.from({ length: 7 }, (_, i) => line(1196 + i * 42, 1010, 1220 + i * 42, 1056, { color: P.ink, width: 3 })).join('\n  ')}`,
    { x: 1176, y: 1006, width: 308, height: 54 }
  );

  // Точки без привязки — болты и крепёж рамы. Настоящие детали, но ни один
  // вопрос про них не спрашивает.
  const bolts = [
    [180, 163], [520, 163], [760, 163], [1020, 163], [1600, 163],
    [150, 560], [150, 900], [1650, 560], [1650, 760],
    [300, 1120], [640, 1120], [900, 1120], [1560, 1120],
  ];
  for (const [bx, by] of bolts) {
    const box = around(bx, by, 32, 32);
    if (!p.fits(box)) continue;
    p.decoy(
      `<circle cx="${bx}" cy="${by}" r="11" fill="${P.body}" stroke="${P.ink}" stroke-width="2"/>
  ${line(bx - 6, by, bx + 6, by, { color: P.ink, width: 2.4 })}`,
      box
    );
  }

  return p.build('Простые механизмы и силы');
}

// ─── Уровень 3. Оптика ─────────────────────────────────────────────────────

function level3() {
  const p = plate(P.bg);

  // — Панель 1: собирающая линза, построение изображения (левый верх)
  const ax1 = 410;
  const lx1 = 520;
  const f1 = 120;
  p.draw(
    line(150, ax1, 880, ax1, { color: P.muted, width: 1.8, dash: '10 8' }),
    dot(lx1, ax1, 6, P.ink),
    // два луча построения
    line(280, 310, lx1, 310, { color: P.ray, width: 2.6 }),
    line(lx1, 310, 760, 510, { color: P.ray, width: 2.6 }),
    line(280, 310, 760, 510, { color: P.lens, width: 2.6 })
  );
  p.put('convex-lens', 'Собирающая линза', convexLens(lx1, ax1, 130, 44), { x: 478, y: 330, width: 84, height: 160 });
  p.put('focus', 'Фокус', dot(lx1 + f1, ax1, 7, P.ray), around(lx1 + f1, ax1, 74, 74));
  p.put('optical-axis', 'Главная оптическая ось', '', { x: 150, y: 384, width: 100, height: 52 });
  p.put('object-arrow', 'Предмет', vec(280, ax1, 280, 300, { color: P.forceNormal, width: 5 }), {
    x: 240,
    y: 296,
    width: 80,
    height: 84,
  });
  p.put('image-arrow', 'Изображение', vec(760, ax1, 760, 520, { color: P.force, width: 5 }), {
    x: 716,
    y: 432,
    width: 88,
    height: 96,
  });

  // — Панель 2: плоское зеркало, падающий и отражённый лучи (правый верх)
  const mx = 1120;
  const my = 355;
  p.draw(
    line(mx, my, 1440, my, { color: P.muted, width: 1.8, dash: '8 7' }),
    line(1430, 205, mx, my, { color: P.ray, width: 2.8 }),
    line(mx, my, 1430, 505, { color: P.ray, width: 2.8 }),
    dot(mx, my, 6, P.ink)
  );
  p.put('flat-mirror', 'Плоское зеркало', flatMirror(mx, 190, 520), { x: 1088, y: 196, width: 74, height: 124 });
  p.put('normal', 'Перпендикуляр к зеркалу', '', { x: 1248, y: 328, width: 116, height: 54 });
  p.put('incident-ray', 'Падающий луч', '', { x: 1312, y: 226, width: 96, height: 66 });
  p.put('reflected-ray', 'Отражённый луч', '', { x: 1312, y: 444, width: 96, height: 66 });
  p.put(
    'light-source',
    'Источник света',
    `<circle cx="1470" cy="172" r="30" fill="${P.sun}" stroke="${P.sunEdge}" stroke-width="2.4"/>
  ${Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return line(1470 + Math.cos(a) * 36, 172 + Math.sin(a) * 36, 1470 + Math.cos(a) * 48, 172 + Math.sin(a) * 48, {
      color: P.sunEdge,
      width: 2.6,
    });
  }).join('\n  ')}`,
    around(1470, 172, 110, 110)
  );

  // — Панель 3: призма и спектр (правый низ)
  const spectrum = ['#e0724f', '#e0a24f', '#e6dd63', '#6fd08a', '#5fa8e0', '#7f7fe0', '#b07fd8'];
  p.draw(
    line(960, 800, 1130, 848, { color: '#f4f6f8', width: 4 }),
    ...spectrum.map((c, i) =>
      line(1246, 880 + i * 6, 1660, 856 + i * 26, { color: c, width: 4 })
    )
  );
  p.put('prism', 'Треугольная призма', prism(1180, 880, 200), { x: 1120, y: 828, width: 124, height: 112 });
  p.put('white-ray', 'Белый луч', '', { x: 968, y: 772, width: 110, height: 64 });
  p.put('spectrum', 'Спектр', '', { x: 1470, y: 916, width: 170, height: 132 });

  // — Панель 4: рассеивающая линза (левый низ)
  const ax2 = 900;
  const lx2 = 500;
  p.draw(
    line(160, ax2, 880, ax2, { color: P.muted, width: 1.8, dash: '10 8' }),
    ...[-90, -45, 45, 90].map((dy) => line(180, ax2 + dy, lx2, ax2 + dy, { color: P.ray, width: 2.4 })),
    ...[-90, -45, 45, 90].map((dy) => line(lx2, ax2 + dy, 870, ax2 + dy * 2.1, { color: P.ray, width: 2.4 }))
  );
  p.put('concave-lens', 'Рассеивающая линза', concaveLens(lx2, ax2, 120, 18), around(lx2, ax2, 96, 110));
  p.put('refracted-ray', 'Преломлённый луч', '', { x: 700, y: 990, width: 130, height: 76 });

  // Точки без привязки — крепления оптической скамьи под каждой панелью.
  const mounts = [
    [220, 600], [360, 600], [660, 600], [820, 600],
    [220, 1090], [380, 1090], [620, 1090], [880, 1090],
    [1020, 560], [1250, 560], [1560, 560],
    [1020, 1080], [1330, 1080], [1620, 1080],
  ];
  for (const [bx, by] of mounts) {
    const box = around(bx, by - 6, 40, 44);
    if (!p.fits(box)) continue;
    p.decoy(
      `<rect x="${bx - 16}" y="${by - 12}" width="32" height="24" rx="4" fill="${P.body}" stroke="${P.metal}" stroke-width="2"/>
  ${line(bx, by - 12, bx, by - 24, { color: P.metal, width: 3 })}`,
      box
    );
  }

  return p.build('Оптика: линзы, зеркала и ход лучей');
}

export default {
  id: 'physics',
  prefix: 'phys',
  title: 'Физика',
  levels: { 1: level1, 2: level2, 3: level3 },
};
