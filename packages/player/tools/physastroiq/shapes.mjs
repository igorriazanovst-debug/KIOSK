// packages/player/tools/physastroiq/shapes.mjs
//
// Примитивы для чертежей по физике и астрономии. Используются и
// draw-thematic.mjs (тематические изображения, FR-022…FR-024), и
// draw-levels.mjs (игровые карты уровней).
//
// ПОЧЕМУ ОТДЕЛЬНЫЙ МОДУЛЬ. Одна и та же катушка, один и тот же диск планеты
// нужны и на тематической картинке, и на игровой карте. Если рисовать их
// дважды, они разойдутся, и ученик, выучивший обозначение на пособии, не
// узнает его в игре.
//
// ВСЁ ДЕТЕРМИНИРОВАНО. Там, где нужен беспорядок (частицы газа, звёздный фон),
// берётся ГПСЧ с фиксированным зерном, а не Math.random: перерисовка должна
// давать тот же файл. Иначе каждая сборка меняет все PNG, и по diff'у
// невозможно понять, поменялось ли что-то по существу.

export const PALETTE = {
  bg: '#0d1620',
  ink: '#e8eef4',
  muted: '#9fb3c4',
  // Схемы и чертежи
  wire: '#c9d6e0',
  metal: '#9fb3c4',
  body: '#2b4256',
  bodyEdge: '#7fa3bd',
  ground: '#1d3a4d',
  // Векторы сил: разные силы — разные цвета, иначе на наклонной плоскости
  // четыре стрелки сливаются в клубок.
  force: '#e0724f',
  forceNormal: '#7fd4c1',
  forceFriction: '#d8b25e',
  forceResult: '#c48fe0',
  // Поля и лучи
  field: '#8fb8e8',
  ray: '#f0d264',
  lens: '#6fb8d8',
  lensFill: '#1b3d4e',
  // Тепловые явления
  hot: '#c9563c',
  cold: '#4f8fd6',
  particle: '#8fd0e8',
  // Атом
  protonC: '#c9563c',
  neutronC: '#8296a6',
  electronC: '#8fd0e8',
  shell: '#5f7d95',
  // Магнит
  poleN: '#c9563c',
  poleS: '#4f8fd6',
  // Жидкость
  liquid: '#2b5f7a',
  liquidEdge: '#8fd0e8',
  vessel: '#8fa8bd',
  // Астрономия
  sun: '#f2c14e',
  sunEdge: '#f7e09a',
  orbit: '#3c556b',
  star: '#eef4fa',
  starWarm: '#f2c98a',
  starBlue: '#a8c8f0',
  constLine: '#4a6c8c',
  moonLit: '#d9dee3',
  moonDark: '#1a242e',
  mare: '#4a5866',
  crater: '#b9c2cb',
  craterEdge: '#eef2f6',
};

export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * ГПСЧ с зерном (xorshift32). Нужен там, где картинка должна выглядеть
 * неупорядоченной, но файл обязан получаться одинаковым при каждой сборке.
 */
export function rng(seed) {
  let s = seed | 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

const FONT = "system-ui, 'Segoe UI', sans-serif";

export function label(x, y, s, opts = {}) {
  const size = opts.size || 20;
  const fill = opts.fill || PALETTE.ink;
  const anchor = opts.anchor || 'middle';
  const weight = opts.weight ? ` font-weight="${opts.weight}"` : '';
  const style = opts.italic ? ' font-style="italic"' : '';
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${fill}" font-size="${size}" font-family="${FONT}"${weight}${style}>${esc(s)}</text>`;
}

export function dot(cx, cy, r, fill, stroke) {
  const st = stroke ? ` stroke="${stroke}" stroke-width="1.6"` : '';
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${st}/>`;
}

export function line(x1, y1, x2, y2, opts = {}) {
  const color = opts.color || PALETTE.wire;
  const w = opts.width || 2;
  const dash = opts.dash ? ` stroke-dasharray="${opts.dash}"` : '';
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${w}"${dash} stroke-linecap="round"/>`;
}

/**
 * Вектор со стрелкой. Наконечник рисуется многоугольником, а не marker'ом:
 * marker живёт в <defs>, а картинки собираются склейкой строк без общего
 * <defs>, и один забытый marker обнулил бы все стрелки разом.
 */
export function vec(x1, y1, x2, y2, opts = {}) {
  const color = opts.color || PALETTE.force;
  const w = opts.width || 3.2;
  const head = opts.head || 16;
  const dash = opts.dash ? ` stroke-dasharray="${opts.dash}"` : '';
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const bx = x2 - head * Math.cos(ang);
  const by = y2 - head * Math.sin(ang);
  const px = -Math.sin(ang);
  const py = Math.cos(ang);
  const hw = head * 0.44;
  const a = `${(bx + px * hw).toFixed(1)},${(by + py * hw).toFixed(1)}`;
  const b = `${(bx - px * hw).toFixed(1)},${(by - py * hw).toFixed(1)}`;
  return `<line x1="${x1}" y1="${y1}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" stroke="${color}" stroke-width="${w}"${dash} stroke-linecap="round"/>
  <polygon points="${a} ${b} ${x2},${y2}" fill="${color}"/>`;
}

export function rectBody(x, y, w, h, opts = {}) {
  const fill = opts.fill || PALETTE.body;
  const stroke = opts.stroke || PALETTE.bodyEdge;
  const rx = opts.rx === undefined ? 6 : opts.rx;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
}

// ─── Элементы электрической цепи (условные обозначения) ────────────────────

/** Гальванический элемент: длинная тонкая черта — «+», короткая толстая — «−». */
export function batteryCell(cx, cy, opts = {}) {
  const s = opts.scale || 1;
  const long = 34 * s;
  const short = 18 * s;
  const gap = 8 * s;
  return `<line x1="${cx - gap}" y1="${cy - long / 2}" x2="${cx - gap}" y2="${cy + long / 2}" stroke="${PALETTE.wire}" stroke-width="${2.4 * s}"/>
  <line x1="${cx + gap}" y1="${cy - short / 2}" x2="${cx + gap}" y2="${cy + short / 2}" stroke="${PALETTE.wire}" stroke-width="${5.5 * s}"/>`;
}

/** Ключ: разрыв провода и откинутая черта. Рисуется РАЗОМКНУТЫМ — по нему видно, что это ключ, а не провод. */
export function switchSym(cx, cy, opts = {}) {
  const w = opts.width || 56;
  const lift = opts.lift || 26;
  return `${dot(cx - w / 2, cy, 4.5, PALETTE.wire)}
  ${dot(cx + w / 2, cy, 4.5, PALETTE.wire)}
  <line x1="${cx - w / 2}" y1="${cy}" x2="${cx + w / 2 - 6}" y2="${cy - lift}" stroke="${PALETTE.wire}" stroke-width="3" stroke-linecap="round"/>`;
}

/** Лампа накаливания: окружность с косым крестом. */
export function lampSym(cx, cy, r = 26) {
  const d = r * 0.7071;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${PALETTE.wire}" stroke-width="2.6"/>
  <line x1="${cx - d}" y1="${cy - d}" x2="${cx + d}" y2="${cy + d}" stroke="${PALETTE.wire}" stroke-width="2.4"/>
  <line x1="${cx - d}" y1="${cy + d}" x2="${cx + d}" y2="${cy - d}" stroke="${PALETTE.wire}" stroke-width="2.4"/>`;
}

/** Резистор: прямоугольник на проводе. */
export function resistorSym(cx, cy, w = 78, h = 32) {
  return `<rect x="${cx - w / 2}" y="${cy - h / 2}" width="${w}" height="${h}" fill="${PALETTE.bg}" stroke="${PALETTE.wire}" stroke-width="2.6"/>`;
}

/** Измерительный прибор: окружность с буквой (A — амперметр, V — вольтметр). */
export function meterSym(cx, cy, letter, r = 27) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${PALETTE.bg}" stroke="${PALETTE.wire}" stroke-width="2.6"/>
  ${label(cx, cy + 9, letter, { size: 26, weight: 700 })}`;
}

/** Катушка (соленоид): ряд полуокружностей. */
export function coilSym(x, y, turns = 6, step = 26) {
  const r = step / 2;
  const arcs = [];
  for (let i = 0; i < turns; i += 1) {
    const sx = x + i * step;
    arcs.push(`M ${sx} ${y} A ${r} ${r} 0 0 1 ${sx + step} ${y}`);
  }
  return `<path d="${arcs.join(' ')}" fill="none" stroke="${PALETTE.wire}" stroke-width="3"/>`;
}

// ─── Тепловые явления ──────────────────────────────────────────────────────

/**
 * Частицы вещества в сосуде.
 * mode: 'solid' — правильная решётка, 'liquid' — плотно, но без порядка,
 * 'gas' — редко и вразброс. Именно этим три состояния и различаются в курсе.
 */
export function particles(x, y, w, h, mode, seed) {
  const r = 8;
  const out = [];
  const rand = rng(seed);
  if (mode === 'solid') {
    const step = 34;
    for (let py = y + 24; py <= y + h - 18; py += step) {
      for (let px = x + 24; px <= x + w - 18; px += step) {
        out.push(dot(px, py, r, PALETTE.particle));
      }
    }
  } else if (mode === 'liquid') {
    const step = 34;
    let row = 0;
    for (let py = y + h * 0.40; py <= y + h - 18; py += step) {
      for (let px = x + 22 + (row % 2 ? 14 : 0); px <= x + w - 18; px += step) {
        const jx = (rand() - 0.5) * 12;
        const jy = (rand() - 0.5) * 12;
        out.push(dot(px + jx, py + jy, r, PALETTE.particle));
      }
      row += 1;
    }
  } else {
    for (let i = 0; i < 13; i += 1) {
      const px = x + 34 + rand() * (w - 68);
      const py = y + 34 + rand() * (h - 68);
      out.push(dot(px, py, r, PALETTE.particle));
      // Короткая стрелка — молекулы газа движутся свободно и во все стороны.
      const ang = rand() * Math.PI * 2;
      out.push(
        vec(px, py, px + 26 * Math.cos(ang), py + 26 * Math.sin(ang), {
          color: PALETTE.muted,
          width: 1.6,
          head: 8,
        })
      );
    }
  }
  return out.join('\n  ');
}

// ─── Магнит ────────────────────────────────────────────────────────────────

/** Полосовой магнит: половина N красная, половина S синяя. */
export function barMagnet(x, y, w, h) {
  return `<rect x="${x}" y="${y}" width="${w / 2}" height="${h}" fill="${PALETTE.poleN}" stroke="${PALETTE.ink}" stroke-width="2"/>
  <rect x="${x + w / 2}" y="${y}" width="${w / 2}" height="${h}" fill="${PALETTE.poleS}" stroke="${PALETTE.ink}" stroke-width="2"/>
  ${label(x + w * 0.25, y + h / 2 + 12, 'N', { size: 34, weight: 700 })}
  ${label(x + w * 0.75, y + h / 2 + 12, 'S', { size: 34, weight: 700 })}`;
}

/**
 * Силовая линия магнитного поля: дуга от одного полюса к другому.
 *
 * ПОЧЕМУ КУБИЧЕСКАЯ КРИВАЯ, А НЕ КВАДРАТИЧНАЯ. У квадратичной опорная точка
 * одна и лежит посередине, поэтому сразу после полюса линия идёт НАВСТРЕЧУ
 * второму полюсу — то есть сквозь сам магнит. На первой отрисовке все шесть
 * линий проходили прямо по нарисованному бруску, и картинка утверждала
 * неправду: вне магнита линии идут от N к S, но внутрь бруска они так не
 * входят. У кубической опорных точки две, и обе вынесены НАРУЖУ за полюса —
 * линия отходит от полюса вбок, обходит магнит и лишь потом поворачивает ко
 * второму полюсу.
 *
 * Стрелка посередине обязательна: линия без направления не показывает
 * главного свойства поля.
 */
function fieldCtrl(x1, y1, x2, y2, bulge) {
  // Чем дальше линия уходит от магнита, тем сильнее её надо отвести вбок:
  // иначе дальние линии всё равно срезают угол через брусок.
  const out = 100 + Math.abs(bulge) * 0.35;
  return [
    [x1 - out, y1 + bulge],
    [x2 + out, y2 + bulge],
  ];
}

export function fieldLine(x1, y1, x2, y2, bulge) {
  const [c1, c2] = fieldCtrl(x1, y1, x2, y2, bulge);
  const path = `<path d="M ${x1} ${y1} C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${x2} ${y2}" fill="none" stroke="${PALETTE.field}" stroke-width="2.2"/>`;
  const m = fieldPointAt(x1, y1, x2, y2, bulge, 0.5);
  const head = vec(
    m.x - Math.cos(m.ang) * 2,
    m.y - Math.sin(m.ang) * 2,
    m.x + Math.cos(m.ang) * 13,
    m.y + Math.sin(m.ang) * 13,
    { color: PALETTE.field, width: 2.2, head: 12 }
  );
  return `${path}
  ${head}`;
}

/**
 * Точка на силовой линии и направление касательной в ней.
 *
 * Нужна, чтобы магнитная стрелка стояла ИМЕННО вдоль линии. Стрелка,
 * поставленная «на глаз» рядом с линией, противоречит подписи под ней — а
 * подпись как раз и утверждает, что стрелка встаёт вдоль поля.
 */
export function fieldPointAt(x1, y1, x2, y2, bulge, t) {
  const [c1, c2] = fieldCtrl(x1, y1, x2, y2, bulge);
  const u = 1 - t;
  const bx = u * u * u * x1 + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * x2;
  const by = u * u * u * y1 + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * y2;
  const dx = 3 * u * u * (c1[0] - x1) + 6 * u * t * (c2[0] - c1[0]) + 3 * t * t * (x2 - c2[0]);
  const dy = 3 * u * u * (c1[1] - y1) + 6 * u * t * (c2[1] - c1[1]) + 3 * t * t * (y2 - c2[1]);
  return { x: bx, y: by, ang: Math.atan2(dy, dx) };
}

// ─── Астрономия ────────────────────────────────────────────────────────────

/** Диск планеты. Кольцо (Сатурн) рисуется эллипсом поверх. */
export function planetDisc(cx, cy, r, fill, opts = {}) {
  const out = [
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${opts.edge || PALETTE.ink}" stroke-width="1.4"/>`,
  ];
  if (opts.bands) {
    for (let i = -1; i <= 1; i += 1) {
      const yy = cy + (i * r) / 2.2;
      const half = Math.sqrt(Math.max(r * r - (yy - cy) * (yy - cy), 0));
      out.push(
        `<line x1="${cx - half * 0.9}" y1="${yy}" x2="${cx + half * 0.9}" y2="${yy}" stroke="${opts.bands}" stroke-width="${Math.max(r / 6, 2)}" opacity="0.5" stroke-linecap="round"/>`
      );
    }
  }
  if (opts.ring) {
    out.push(
      `<ellipse cx="${cx}" cy="${cy}" rx="${r * 2.05}" ry="${r * 0.5}" fill="none" stroke="${opts.ring}" stroke-width="${Math.max(r / 4, 3)}" opacity="0.85"/>`
    );
  }
  return out.join('\n  ');
}

/** Солнце: диск с короной из лучей. */
export function sunDisc(cx, cy, r) {
  const rays = [];
  for (let i = 0; i < 16; i += 1) {
    const a = (i / 16) * Math.PI * 2;
    rays.push(
      line(
        cx + Math.cos(a) * r * 1.12,
        cy + Math.sin(a) * r * 1.12,
        cx + Math.cos(a) * r * 1.34,
        cy + Math.sin(a) * r * 1.34,
        { color: PALETTE.sunEdge, width: 2.4 }
      )
    );
  }
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${PALETTE.sun}" stroke="${PALETTE.sunEdge}" stroke-width="2"/>
  ${rays.join('\n  ')}`;
}

/**
 * Звезда на карте неба. Размер задаётся видимой величиной: чем ярче звезда,
 * тем меньше её звёздная величина и тем крупнее кружок. Именно так устроены
 * настоящие карты, и на карте с одинаковыми точками рисунок созвездия не
 * читается.
 */
export function starGlyph(cx, cy, mag, opts = {}) {
  const r = Math.max(3.0, 8.6 - mag * 1.9);
  const fill = opts.color || PALETTE.star;
  const out = [`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`];
  if (mag < 1.2) {
    // Яркие звёзды получают крестообразный блик — так их видно сразу.
    const g = r * 2.6;
    out.push(line(cx - g, cy, cx + g, cy, { color: fill, width: 1.2 }));
    out.push(line(cx, cy - g, cx, cy + g, { color: fill, width: 1.2 }));
    out.push(`<circle cx="${cx}" cy="${cy}" r="${r * 2.2}" fill="${fill}" opacity="0.16"/>`);
  }
  return out.join('\n  ');
}

/** Соединительные линии созвездия по списку точек. */
export function constellation(points, pairs) {
  return pairs
    .map(([a, b]) =>
      line(points[a][0], points[a][1], points[b][0], points[b][1], {
        color: PALETTE.constLine,
        width: 1.8,
      })
    )
    .join('\n  ');
}

/** Кратер: чаша с валом. */
export function craterMark(cx, cy, r) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${PALETTE.mare}" opacity="0.45"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${PALETTE.craterEdge}" stroke-width="${Math.max(r / 7, 1.2)}" opacity="0.8"/>
  <circle cx="${cx - r * 0.18}" cy="${cy - r * 0.18}" r="${r * 0.55}" fill="${PALETTE.crater}" opacity="0.18"/>`;
}

/** Рамка вокруг области — для подписи группы объектов. */
export function boxAround(x, y, w, h, color = PALETTE.muted) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="none" stroke="${color}" stroke-width="1.6" stroke-dasharray="7 6" opacity="0.75"/>`;
}
