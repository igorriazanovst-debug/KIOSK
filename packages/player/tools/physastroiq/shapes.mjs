// packages/player/tools/physastroiq/shapes.mjs
//
// Примитивы биологических схем, общие для карт уровней. Каждый примитив
// возвращает SVG и НЕ знает ничего про подписи: карта уровня — игровое поле,
// подписывать на нём структуры нельзя, иначе ответ написан прямо на картинке.

export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const PALETTE = {
  bg: '#0d1620',
  ink: '#e8eef4',
  muted: '#9fb3c4',
  membrane: '#7fd4c1',
  cytoplasm: '#1d3a4d',
  nucleus: '#3c4f86',
  nucleusEdge: '#9fb0e8',
  nucleolus: '#2a3566',
  mito: '#b5553f',
  mitoEdge: '#e08b6e',
  er: '#86b9d6',
  ribosome: '#d8e9f2',
  golgi: '#d8b25e',
  lysosome: '#8e6fb8',
  lysosomeEdge: '#c4a8e6',
  centriole: '#6fb8a2',
  centrioleEdge: '#b6e5d7',
  wall: '#c9a66b',
  vacuole: '#2b5f7a',
  vacuoleEdge: '#8fd0e8',
  chloroplast: '#3f8f4a',
  chloroplastEdge: '#8fe09a',
  grana: '#d3f2c4',
  plantCyto: '#25452f',
};

/** Митохондрия: овал с кристами. */
export function mitochondrion(x, y, rot = 0, rx = 70, ry = 33) {
  const c = [];
  const step = (rx * 2 - 40) / 3;
  for (let i = 0; i < 4; i += 1) {
    const dx = -rx + 24 + i * step;
    c.push(`M ${dx.toFixed(0)} ${-ry + 20} q 18 ${ry} 0 ${ry + 2}`);
  }
  return `<g transform="translate(${x} ${y}) rotate(${rot})">
    <ellipse rx="${rx}" ry="${ry}" fill="${PALETTE.mito}" stroke="${PALETTE.mitoEdge}" stroke-width="4"/>
    <path d="${c.join(' ')}" fill="none" stroke="#f0bda8" stroke-width="4"/>
  </g>`;
}

/** Шероховатая ЭПС: параллельные цистерны с рибосомами снаружи. */
export function roughER(x, y, width = 180, rows = 4, gap = 34) {
  const out = [];
  for (let i = 0; i < rows; i += 1) {
    const yy = y + i * gap;
    out.push(`<path d="M ${x} ${yy} q ${width / 2} -26 ${width} 0" fill="none" stroke="${PALETTE.er}" stroke-width="7" stroke-linecap="round"/>`);
    for (let k = 0; k <= 6; k += 1) {
      const t = k / 6;
      const px = x + t * width;
      const py = yy - 26 * 2 * t * (1 - t) - 8;
      out.push(`<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="5" fill="${PALETTE.ribosome}"/>`);
    }
  }
  return out.join('');
}

/** Гладкая ЭПС: те же цистерны БЕЗ рибосом — этим она от шероховатой и отличается. */
export function smoothER(x, y, width = 160, rows = 3, gap = 32) {
  const out = [];
  for (let i = 0; i < rows; i += 1) {
    const yy = y + i * gap;
    out.push(`<path d="M ${x} ${yy} q ${width * 0.3} -30 ${width * 0.55} -4 q ${width * 0.25} 26 ${width * 0.45} -6" fill="none" stroke="${PALETTE.er}" stroke-width="7" stroke-linecap="round"/>`);
  }
  return out.join('');
}

/** Аппарат Гольджи: стопка уплощённых цистерн и отшнуровавшиеся пузырьки. */
export function golgi(x, y, width = 140, layers = 5, gap = 21) {
  const out = [];
  for (let i = 0; i < layers; i += 1) {
    out.push(`<path d="M ${x} ${y + i * gap} q ${width / 2} -26 ${width} 0" fill="none" stroke="${PALETTE.golgi}" stroke-width="7" stroke-linecap="round"/>`);
  }
  out.push(`<circle cx="${x + width * 0.84}" cy="${y + layers * gap + 14}" r="11" fill="${PALETTE.golgi}"/>`);
  out.push(`<circle cx="${x + width * 0.62}" cy="${y + layers * gap + 36}" r="8" fill="${PALETTE.golgi}"/>`);
  return out.join('');
}

/** Клеточный центр: две центриоли под прямым углом, каждая из трёх трубочек. */
export function centriole(x, y) {
  const tubes = (tx, ty, vertical) =>
    [0, 1, 2]
      .map((i) =>
        vertical
          ? `<rect x="${tx - 4 + i * 9}" y="${ty - 30}" width="6" height="60" rx="3" fill="${PALETTE.centriole}" stroke="${PALETTE.centrioleEdge}" stroke-width="2"/>`
          : `<rect x="${tx - 30}" y="${ty - 4 + i * 9}" width="60" height="6" rx="3" fill="${PALETTE.centriole}" stroke="${PALETTE.centrioleEdge}" stroke-width="2"/>`
      )
      .join('');
  return tubes(x - 26, y, true) + tubes(x + 22, y + 26, false);
}

/** Хлоропласт: овал с гранами. */
export function chloroplast(x, y, rot = 0, rx = 58, ry = 30) {
  return `<g transform="translate(${x} ${y}) rotate(${rot})">
    <ellipse rx="${rx}" ry="${ry}" fill="${PALETTE.chloroplast}" stroke="${PALETTE.chloroplastEdge}" stroke-width="4"/>
    <ellipse cx="${-rx * 0.38}" cy="0" rx="11" ry="8" fill="${PALETTE.grana}"/>
    <ellipse cx="${rx * 0.03}" cy="-8" rx="11" ry="8" fill="${PALETTE.grana}"/>
    <ellipse cx="${rx * 0.41}" cy="5" rx="11" ry="8" fill="${PALETTE.grana}"/>
  </g>`;
}

export function nucleus(x, y, r, nucleolusDx = -30, nucleolusDy = -28, nucleolusR = 36) {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${PALETTE.nucleus}" stroke="${PALETTE.nucleusEdge}" stroke-width="5"/>
    <circle cx="${x + nucleolusDx}" cy="${y + nucleolusDy}" r="${nucleolusR}" fill="${PALETTE.nucleolus}" stroke="${PALETTE.nucleusEdge}" stroke-width="3"/>`;
}

export function lysosome(x, y, r = 27) {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${PALETTE.lysosome}" stroke="${PALETTE.lysosomeEdge}" stroke-width="4"/>`;
}

export function ribosomes(points, r = 8) {
  return points.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${PALETTE.ribosome}"/>`).join('');
}

/** Прямоугольник вокруг точки — так задаются кликабельные области структур. */
export function boxAround(x, y, w, h) {
  return { x: Math.round(x - w / 2), y: Math.round(y - h / 2), width: Math.round(w), height: Math.round(h) };
}
