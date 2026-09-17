// packages/player/tools/physastroiq/levels-astro.mjs
//
// Три игровые карты викторины «Астрономия» (FR-008, строка 329). Каркас и
// правила расстановки — в level-plate.mjs, рисует draw-levels.mjs.
//
// ПОРЯДОК УРОВНЕЙ — от того, что видно глазом, к тому, что нужно вывести:
// Солнечная система (объекты и их порядок) → звёздное небо (найти созвездие)
// → система Земля—Луна (объяснить фазы и затмения).
//
// ЗВЁЗДЫ ФОНА — ОБМАНКИ, И ЭТО НЕ СЛУЧАЙНОСТЬ. На карте неба безымянная
// звезда выглядит ровно как названная: щёлкнув по ней, ученик ошибается
// осмысленно. Точки без привязки (FR-013, строка 334) здесь получаются сами
// собой из предмета, а не приделаны к нему.

import { plate, W, H } from './level-plate.mjs';
import {
  PALETTE as P,
  line,
  dot,
  rectBody,
  planetDisc,
  sunDisc,
  starGlyph,
  craterMark,
  rng,
} from './shapes.mjs';

const around = (cx, cy, w, h) => ({ x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), width: w, height: h });

// ─── Уровень 1. Солнечная система ──────────────────────────────────────────

function level1() {
  const p = plate(P.bg);
  const cx = 900;
  const cy = 620;
  const SQ = 0.74;

  const at = (r, aDeg) => {
    const a = (aDeg * Math.PI) / 180;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * SQ];
  };

  const planets = [
    { id: 'mercury', label: 'Меркурий', r: 152, pr: 13, a: 200, color: '#9a8f86' },
    { id: 'venus', label: 'Венера', r: 204, pr: 19, a: 318, color: '#d8b07a' },
    { id: 'earth', label: 'Земля', r: 258, pr: 21, a: 46, color: '#5b8fc9' },
    { id: 'mars', label: 'Марс', r: 312, pr: 16, a: 142, color: '#c0664a' },
    { id: 'jupiter', label: 'Юпитер', r: 424, pr: 46, a: 254, color: '#c9a179', bands: '#8a6a4c' },
    { id: 'saturn', label: 'Сатурн', r: 490, pr: 38, a: 356, color: '#d6c08a', ring: '#a9986f' },
    { id: 'uranus', label: 'Уран', r: 540, pr: 28, a: 158, color: '#8fc6c9' },
    { id: 'neptune', label: 'Нептун', r: 586, pr: 27, a: 292, color: '#5a7fc4' },
  ];

  // Орбиты.
  p.draw(
    planets
      .map(
        (pl) =>
          `<ellipse cx="${cx}" cy="${cy}" rx="${pl.r}" ry="${(pl.r * SQ).toFixed(1)}" fill="none" stroke="${P.orbit}" stroke-width="1.6"/>`
      )
      .join('\n  ')
  );

  p.put('sun', 'Солнце', sunDisc(cx, cy, 58), around(cx, cy, 150, 150));

  for (const pl of planets) {
    const [px, py] = at(pl.r, pl.a);
    // У Сатурна область — только диск: кольца спрашиваются отдельным вопросом,
    // и область планеты не должна их накрывать.
    const side = pl.ring ? 70 : Math.max(pl.pr * 2 + 30, 76);
    p.put(pl.id, pl.label, planetDisc(px, py, pl.pr, pl.color, { bands: pl.bands, ring: pl.ring }), around(px, py, side, side));
  }

  // Кольца Сатурна — отдельная структура: щёлкнуть по ним можно, а областью
  // самого Сатурна они не накрыты. Область берётся на внешнем крае кольца,
  // левее диска.
  const [sx, sy] = at(490, 356);
  p.put('saturn-ring', 'Кольца Сатурна', '', around(sx - 62, sy, 48, 44));

  // Пояс астероидов между Марсом и Юпитером.
  const rand = rng(777);
  const belt = [];
  for (let i = 0; i < 300; i += 1) {
    const a = rand() * Math.PI * 2;
    const rr = 344 + rand() * 46;
    belt.push(dot(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * SQ, 2.2, P.muted));
  }
  p.draw(belt.join('\n  '));
  const [bx, by] = at(366, 200);
  p.put('asteroid-belt', 'Пояс астероидов', '', around(bx, by, 120, 84));

  // Луна у Земли — с собственной орбитой, чтобы было видно, что она спутник.
  const [ex, ey] = at(258, 46);
  p.draw(
    `<ellipse cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" rx="96" ry="70" fill="none" stroke="${P.orbit}" stroke-width="1.4" stroke-dasharray="6 6"/>`
  );
  p.put('moon', 'Луна — спутник Земли', dot(ex + 96, ey, 10, P.moonLit), around(ex + 96, ey, 74, 74));

  // Орбита как таковая: область на пустом участке орбиты Нептуна.
  const [ox, oy] = at(586, 96);
  p.put('orbit', 'Орбита планеты', '', around(ox, oy, 96, 70));

  // Комета с хвостом, направленным ОТ Солнца, — так и бывает на самом деле.
  const kx = 430;
  const ky = 240;
  const tail = [];
  for (let i = 0; i < 26; i += 1) {
    const t = i / 26;
    tail.push(
      line(kx - t * 18, ky - t * 14, kx - t * 240, ky - t * 190, { color: '#9fd8e8', width: 3 }).replace(
        '/>',
        ` opacity="${(0.45 * (1 - t)).toFixed(2)}"/>`
      )
    );
  }
  p.put(
    'comet',
    'Комета',
    `${tail.join('\n  ')}
  ${dot(kx, ky, 11, '#dff2f8')}`,
    around(kx, ky, 84, 84)
  );

  // Точки без привязки — далёкие звёзды фона за орбитой Нептуна.
  const bgRand = rng(31337);
  let placed = 0;
  let guard = 0;
  while (placed < 14 && guard < 4000) {
    guard += 1;
    const a = bgRand() * Math.PI * 2;
    const rr = 650 + bgRand() * 240;
    const px = cx + Math.cos(a) * rr;
    const py = cy + Math.sin(a) * rr * SQ;
    if (px < 90 || px > W - 90 || py < 90 || py > H - 90) continue;
    const box = around(px, py, 54, 54);
    if (!p.fits(box)) continue;
    p.decoy(starGlyph(px, py, 2.4), box);
    placed += 1;
  }

  return p.build('Солнечная система');
}

// ─── Уровень 2. Звёздное небо ──────────────────────────────────────────────

function level2() {
  const p = plate('#080d13');

  // Млечный Путь — светлая полоса поперёк неба.
  p.draw(
    `<path d="M 0 1060 Q 620 660 1080 420 Q 1440 232 1800 130 L 1800 250 Q 1460 350 1130 528 Q 700 760 60 1140 Z" fill="#17233a" opacity="0.5"/>`
  );

  // Фоновые звёзды поля — они же обманки (см. шапку файла).
  const rand = rng(8191);
  const bg = [];
  for (let i = 0; i < 420; i += 1) {
    bg.push(dot(80 + rand() * (W - 160), 80 + rand() * 900, 1 + rand() * 1.8, P.star));
  }
  p.draw(bg.join('\n  '));

  // Горизонт с холмами: без него карта не привязана к земле.
  p.put(
    'horizon',
    'Горизонт',
    `<path d="M 0 1200 L 0 1064 Q 340 1010 700 1052 Q 1100 1100 1420 1026 Q 1630 978 1800 1020 L 1800 1200 Z" fill="${P.ground}" stroke="${P.bodyEdge}" stroke-width="2.4"/>`,
    { x: 300, y: 1090, width: 240, height: 78 }
  );
  p.put(
    'zenith',
    'Зенит',
    `<circle cx="900" cy="150" r="26" fill="none" stroke="${P.ray}" stroke-width="2.4" stroke-dasharray="6 6"/>
  ${dot(900, 150, 5, P.ray)}`,
    around(900, 150, 96, 96)
  );

  // Большой Ковш и Полярная: указатель Мерак → Дубхе сохранён и здесь.
  const uma = {
    dubhe: [520, 420],
    merak: [466, 474],
    fekda: [402, 440],
    megrez: [456, 392],
    alioth: [396, 358],
    mizar: [336, 334],
    benetnash: [278, 300],
  };
  p.draw(
    Object.entries({
      a: ['dubhe', 'merak'],
      b: ['merak', 'fekda'],
      c: ['fekda', 'megrez'],
      d: ['megrez', 'dubhe'],
      e: ['megrez', 'alioth'],
      f: ['alioth', 'mizar'],
      g: ['mizar', 'benetnash'],
    })
      .map(([, [x, y]]) => line(uma[x][0], uma[x][1], uma[y][0], uma[y][1], { color: P.constLine, width: 2 }))
      .join('\n  '),
    Object.values(uma)
      .map((pt) => starGlyph(pt[0], pt[1], 2.0))
      .join('\n  ')
  );
  p.put('ursa-major', 'Большая Медведица (Большой Ковш)', '', { x: 380, y: 372, width: 150, height: 120 });

  const umi = {
    pol: [790, 262],
    d: [846, 314],
    e: [888, 378],
    z: [856, 438],
    b: [908, 508],
    g: [962, 464],
    h: [910, 402],
  };
  p.draw(
    [
      ['pol', 'd'],
      ['d', 'e'],
      ['e', 'z'],
      ['z', 'b'],
      ['b', 'g'],
      ['g', 'h'],
      ['h', 'z'],
    ]
      .map(([x, y]) => line(umi[x][0], umi[x][1], umi[y][0], umi[y][1], { color: P.constLine, width: 2 }))
      .join('\n  '),
    Object.entries(umi)
      .filter(([k]) => k !== 'pol')
      .map(([, pt]) => starGlyph(pt[0], pt[1], 3.6))
      .join('\n  '),
    line(466, 474, 790, 262, { color: P.ray, width: 1.8, dash: '10 8' })
  );
  p.put('polaris', 'Полярная звезда', starGlyph(790, 262, 1.4), around(790, 262, 92, 92));
  p.put('ursa-minor', 'Малая Медведица', '', { x: 862, y: 412, width: 130, height: 120 });

  // Кассиопея.
  const cas = [
    [1150, 244],
    [1206, 296],
    [1256, 240],
    [1310, 288],
    [1360, 232],
  ];
  p.draw(
    cas
      .slice(0, -1)
      .map((pt, i) => line(pt[0], pt[1], cas[i + 1][0], cas[i + 1][1], { color: P.constLine, width: 2 }))
      .join('\n  '),
    cas.map((pt) => starGlyph(pt[0], pt[1], 2.4)).join('\n  ')
  );
  p.put('cassiopeia', 'Кассиопея', '', { x: 1180, y: 190, width: 200, height: 84 });

  // Орион: пояс, Бетельгейзе и Ригель — три отдельные структуры.
  const ori = {
    bet: [1020, 640],
    bel: [1190, 620],
    min: [1178, 758],
    aln: [1128, 774],
    ank: [1078, 790],
    sai: [1020, 926],
    rig: [1200, 946],
  };
  p.draw(
    [
      ['bet', 'bel'],
      ['bet', 'ank'],
      ['bel', 'min'],
      ['min', 'aln'],
      ['aln', 'ank'],
      ['ank', 'sai'],
      ['min', 'rig'],
      ['sai', 'rig'],
    ]
      .map(([x, y]) => line(ori[x][0], ori[x][1], ori[y][0], ori[y][1], { color: P.constLine, width: 2 }))
      .join('\n  '),
    starGlyph(...ori.bel, 1.6),
    starGlyph(...ori.sai, 2.1)
  );
  p.put('betelgeuse', 'Бетельгейзе', starGlyph(...ori.bet, 0.5, { color: P.starWarm }), around(1020, 640, 92, 92));
  p.put('rigel', 'Ригель', starGlyph(...ori.rig, 0.1, { color: P.starBlue }), around(1200, 946, 92, 92));
  p.put(
    'orion-belt',
    'Пояс Ориона',
    `${starGlyph(...ori.min, 2.2)}
  ${starGlyph(...ori.aln, 1.7)}
  ${starGlyph(...ori.ank, 1.7)}`,
    { x: 1052, y: 736, width: 156, height: 84 }
  );

  // Сириус — ярчайшая звезда неба.
  p.put('sirius', 'Сириус', starGlyph(1420, 880, -1.5, { color: P.starBlue }), around(1420, 880, 106, 106));

  // Телец: Альдебаран и Плеяды.
  const hy = [
    [700, 660],
    [742, 610],
    [784, 560],
    [658, 604],
    [620, 552],
  ];
  p.draw(
    line(700, 660, 784, 560, { color: P.constLine, width: 2 }),
    line(700, 660, 620, 552, { color: P.constLine, width: 2 }),
    hy
      .slice(2)
      .map((pt) => starGlyph(pt[0], pt[1], 3.6))
      .join('\n  '),
    starGlyph(700, 660, 3.4)
  );
  p.put('aldebaran', 'Альдебаран', starGlyph(742, 610, 0.9, { color: P.starWarm }), around(742, 610, 92, 92));
  const pl = [
    [530, 700],
    [552, 686],
    [512, 682],
    [540, 722],
    [566, 712],
    [520, 726],
  ];
  p.put(
    'pleiades',
    'Плеяды',
    `${pl.map((pt) => starGlyph(pt[0], pt[1], 4.0, { color: P.starBlue })).join('\n  ')}
  <circle cx="539" cy="704" r="46" fill="none" stroke="${P.constLine}" stroke-width="1.6" stroke-dasharray="5 6"/>`,
    around(539, 704, 108, 108)
  );

  p.put('milky-way', 'Млечный Путь', '', { x: 270, y: 860, width: 170, height: 80 });

  // Луна на небе — растущая, в первой четверти.
  p.put(
    'moon-in-sky',
    'Луна',
    `<circle cx="1580" cy="540" r="44" fill="${P.moonDark}" stroke="${P.muted}" stroke-width="1.6"/>
  <path d="M 1580 496 A 44 44 0 0 1 1580 584 A 0.1 44 0 0 0 1580 496 Z" fill="${P.moonLit}"/>`,
    around(1580, 540, 116, 116)
  );

  // Точки без привязки — безымянные звёзды поля, нарисованные ярче фоновых.
  const spots = [
    [180, 240], [300, 640], [214, 860], [640, 240], [860, 700], [960, 240],
    [1120, 520], [1340, 660], [1500, 300], [1660, 460], [1660, 760], [1300, 424],
    [420, 900], [880, 900],
  ];
  for (const [sx, sy] of spots) {
    const box = around(sx, sy, 56, 56);
    if (p.fits(box)) p.decoy(starGlyph(sx, sy, 2.2), box);
  }

  return p.build('Звёздное небо');
}

// ─── Уровень 3. Земля, Луна и затмения ─────────────────────────────────────

function level3() {
  const p = plate(P.bg);
  const ex = 820;
  const ey = 600;
  const er = 92;

  // Солнце слева и его параллельный пучок.
  p.put('sun', 'Солнце', sunDisc(190, ey, 78), around(190, ey, 200, 200));
  p.put(
    'sun-rays',
    'Солнечные лучи',
    [380, 470, 560, 650, 740]
      .map((y) => line(300, y, 700, y, { color: P.sunEdge, width: 3 }))
      .join('\n  '),
    { x: 430, y: 330, width: 150, height: 80 }
  );

  // Земля: освещённая половина слева, ось наклонена.
  const tilt = (23.5 * Math.PI) / 180;
  const axx = Math.sin(tilt);
  const axy = -Math.cos(tilt);
  p.draw(
    `<circle cx="${ex}" cy="${ey}" r="${er}" fill="#16222e" stroke="${P.bodyEdge}" stroke-width="2"/>
  <path d="M ${ex} ${ey - er} A ${er} ${er} 0 0 0 ${ex} ${ey + er} A 0.1 ${er} 0 0 1 ${ex} ${ey - er} Z" fill="#4f7fb5"/>`,
    line(ex - axx * 168, ey - axy * 168, ex + axx * 168, ey + axy * 168, { color: P.ink, width: 3, dash: '9 7' })
  );
  p.put('earth', 'Земля', '', { x: 716, y: 566, width: 80, height: 80 });
  p.put('earth-axis', 'Земная ось', '', around(ex + axx * 150, ey + axy * 150, 84, 84));
  p.put('terminator', 'Терминатор — граница дня и ночи', '', { x: 802, y: 612, width: 46, height: 76 });

  // Конус тени и полутени за Землёй.
  p.draw(
    `<polygon points="${ex},${ey - er} ${ex},${ey + er} 1560,${ey + 16} 1560,${ey - 16}" fill="#05080c" stroke="#2a3a4c" stroke-width="1.6"/>
  <polygon points="${ex},${ey - er} 1620,${ey - 210} 1620,${ey - 150} ${ex},${ey - er}" fill="#141d27" opacity="0.7"/>
  <polygon points="${ex},${ey + er} 1620,${ey + 210} 1620,${ey + 150} ${ex},${ey + er}" fill="#141d27" opacity="0.7"/>`
  );
  p.put('umbra', 'Конус земной тени', '', { x: 1244, y: 566, width: 150, height: 74 });
  p.put('penumbra', 'Полутень', '', { x: 1420, y: 400, width: 140, height: 62 });

  // Орбита Луны и три её положения.
  p.draw(
    `<ellipse cx="${ex}" cy="${ey}" rx="330" ry="250" fill="none" stroke="${P.orbit}" stroke-width="2" stroke-dasharray="9 8"/>`
  );
  p.put('moon-orbit', 'Орбита Луны', '', around(ex, ey + 250, 120, 66));
  p.put(
    'solar-eclipse',
    'Луна при солнечном затмении',
    `<circle cx="${ex - 330}" cy="${ey}" r="30" fill="${P.moonDark}" stroke="${P.muted}" stroke-width="2"/>`,
    around(ex - 330, ey, 92, 92)
  );
  p.put(
    'lunar-eclipse',
    'Луна при лунном затмении',
    `<circle cx="${ex + 330}" cy="${ey}" r="30" fill="${P.moonDark}" stroke="${P.muted}" stroke-width="2"/>`,
    around(ex + 330, ey, 92, 92)
  );
  p.put(
    'quarter-moon',
    'Луна в первой четверти',
    `<circle cx="${ex}" cy="${ey - 250}" r="30" fill="${P.moonDark}" stroke="${P.muted}" stroke-width="2"/>
  <path d="M ${ex} ${ey - 280} A 30 30 0 0 0 ${ex} ${ey - 220} A 0.1 30 0 0 1 ${ex} ${ey - 280} Z" fill="${P.moonLit}"/>`,
    around(ex, ey - 250, 84, 84)
  );

  // Увеличенный диск Луны в правом нижнем углу: море, материк, кратер.
  const mx = 1480;
  const my = 940;
  const mr = 190;
  p.draw(`<circle cx="${mx}" cy="${my}" r="${mr}" fill="${P.moonLit}" stroke="${P.craterEdge}" stroke-width="2"/>`);
  p.put(
    'mare',
    'Лунное море',
    `<ellipse cx="${mx - 62}" cy="${my - 66}" rx="86" ry="62" fill="${P.mare}"/>`,
    around(mx - 62, my - 66, 120, 92)
  );
  p.put('highland', 'Материк — светлая область Луны', '', around(mx + 96, my - 74, 96, 84));
  p.put('crater', 'Кратер', craterMark(mx - 20, my + 92, 46), around(mx - 20, my + 92, 108, 108));
  const craterRand = rng(4096);
  const extra = [];
  for (let i = 0; i < 26; i += 1) {
    const a = craterRand() * Math.PI * 2;
    const rr = Math.sqrt(craterRand()) * (mr - 30);
    const px = mx + Math.cos(a) * rr;
    const py = my + Math.sin(a) * rr;
    if (Math.hypot(px - (mx - 62), (py - (my - 66)) * 1.4) < 96) continue;
    if (Math.hypot(px - (mx - 20), py - (my + 92)) < 76) continue;
    extra.push(craterMark(px, py, 5 + craterRand() * 12));
  }
  p.draw(extra.join('\n  '));

  // Точки без привязки — звёзды фона вне системы Земля—Луна.
  const spots = [
    [120, 170], [420, 160], [760, 150], [1100, 150], [1440, 150], [1700, 220],
    [120, 900], [300, 1080], [640, 1080], [960, 1080], [140, 420], [1720, 600],
  ];
  for (const [sx, sy] of spots) {
    const box = around(sx, sy, 56, 56);
    if (p.fits(box)) p.decoy(starGlyph(sx, sy, 2.2), box);
  }

  return p.build('Земля, Луна и затмения');
}

export default {
  id: 'astro',
  prefix: 'astro',
  title: 'Астрономия',
  levels: { 1: level1, 2: level2, 3: level3 },
};
