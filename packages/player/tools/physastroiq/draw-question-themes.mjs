// packages/player/tools/physastroiq/draw-question-themes.mjs
//
// Иллюстрация к вопросу (FR-009, FR-016) — одна нейтральная картинка на ТЕМУ,
// то же решение, что у «ХимIQ» и «БиоIQ» (tools/bioiq/draw-question-themes.mjs).
//
// ЧЕГО ЗДЕСЬ НЕЛЬЗЯ РИСОВАТЬ. Ответ в «ФизАстроIQ» — найти объект на карте по
// его виду. Значок амперметра над вопросом показал бы, как выглядит амперметр,
// то есть подсказал бы ответ. Поэтому на эмблемах нет ни одного объекта из
// structures-physics.json и structures-astro.json: только ассоциации с темой —
// бытовой предмет, инструмент, явление (вилка с розеткой, камертон, стакан с
// соломинкой, ракета, компас, очки для затмения).
//
// Отсюда и несколько неочевидных отказов:
//   • весы для «Сил и равновесия» — это рычаг на опоре, а оба они ответы;
//   • глобус для «Земли и Луны» — показывает наклон оси, а ось — ответ;
//   • «падающая звезда» для «Малых тел» неотличима от кометы;
//   • солнце в эмблемах не рисуется вовсе: оно ответ и на карте Солнечной
//     системы, и на схеме затмений;
//   • у метеорита грани, а не ямки: ямка читается как кратер.
//
// Запуск (из packages/player). Пути рендереру — АБСОЛЮТНЫЕ: относительные он
// отсчитывает от своего каталога, а не от каталога запуска.
//   node tools/physastroiq/draw-question-themes.mjs
//   env -u ELECTRON_RUN_AS_NODE node_modules/electron/dist/electron.exe //     tools/physastroiq/render-thematic.cjs "$(pwd -W)/tools/physastroiq/themesvg" "$(pwd -W)/public/physastroiq/questionThemes"

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PALETTE } from './shapes.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] || path.join(HERE, 'themesvg');
// Рисуем в координатах 880×640, а отдаём 440×320: на поле картинка занимает
// 132×96. Замер: в полном размере PNG весил около 380 КБ, в половинном — около
// 110 КБ; на 18 темах это 7 МБ против 2 МБ в установщике. Пропорции те же, что
// у места под картинку.
const W = 880;
const H = 640;
const OUT_W = W / 2;
const OUT_H = H / 2;

const INK = PALETTE.ink;
const METAL = PALETTE.metal;
const BODY = PALETTE.body;
const BG = PALETTE.bg;
const RED = '#e0524f';

const frame = (accent, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${OUT_W}" height="${OUT_H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="glow" cx="50%" cy="46%" r="60%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.36"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="dots" width="40" height="40" patternUnits="userSpaceOnUse">
      <circle cx="20" cy="20" r="2.5" fill="${accent}" fill-opacity="0.2"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" rx="48" fill="${BG}"/>
  <rect width="${W}" height="${H}" rx="48" fill="url(#dots)"/>
  <rect width="${W}" height="${H}" rx="48" fill="url(#glow)"/>
  <rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="40" fill="none" stroke="${accent}" stroke-opacity="0.55" stroke-width="6"/>
  ${body}
</svg>`;

const rays = (cx, cy, from, to, count, color, width) =>
  Array.from({ length: count }, (_, i) => {
    const a = (i * 2 * Math.PI) / count;
    return `<path d="M ${cx + Math.cos(a) * from} ${cy + Math.sin(a) * from} L ${cx + Math.cos(a) * to} ${cy + Math.sin(a) * to}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
  }).join('');

/** Четырёхлучевая искра: украшение фона, не звезда с карты (там звёзды — точки) */
const sparkle = (cx, cy, r, fill, opacity = 1) =>
  `<path d="M ${cx} ${cy - r} Q ${cx} ${cy} ${cx + r} ${cy} Q ${cx} ${cy} ${cx} ${cy + r} Q ${cx} ${cy} ${cx - r} ${cy} Q ${cx} ${cy} ${cx} ${cy - r} Z" fill="${fill}" fill-opacity="${opacity}"/>`;

const sparkles = (items, fill = '#ffffff', opacity = 0.8) => items.map(([x, y, r]) => sparkle(x, y, r, fill, opacity)).join('');

const sineWave = (x0, y, halfWave, amplitude, count) =>
  `M ${x0} ${y} q ${halfWave / 2} ${-amplitude * 2} ${halfWave} 0` + ` t ${halfWave} 0`.repeat(count - 1);

const THEMES = {
  // ─── Физика ────────────────────────────────────────────────────────────

  'phys-circuit': ['#ffd95c', `
    <path d="M 170 470 C 110 470 110 560 70 560" stroke="${INK}" stroke-width="14" fill="none" stroke-linecap="round"/>
    <rect x="170" y="430" width="120" height="80" rx="18" fill="${INK}"/>
    <rect x="290" y="446" width="44" height="14" rx="7" fill="${METAL}"/>
    <rect x="290" y="480" width="44" height="14" rx="7" fill="${METAL}"/>
    <polygon points="470,90 330,350 430,350 380,550 560,270 450,270 520,90" fill="#ffd95c" stroke="${BG}" stroke-width="6" stroke-linejoin="round"/>
    <rect x="620" y="400" width="150" height="150" rx="28" fill="${BODY}" stroke="${INK}" stroke-width="8"/>
    <circle cx="695" cy="475" r="52" fill="${BG}"/>
    <circle cx="672" cy="475" r="9" fill="${INK}"/><circle cx="718" cy="475" r="9" fill="${INK}"/>`],

  'phys-current-effects': ['#ff8a5c', `
    <path d="M 300 210 V 360 A 140 140 0 0 0 580 360 V 210" fill="none" stroke="${RED}" stroke-width="80"/>
    <rect x="260" y="150" width="80" height="70" fill="${INK}"/>
    <rect x="540" y="150" width="80" height="70" fill="${INK}"/>
    <g fill="none" stroke="#ffd95c" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">
      <path d="M 446 50 l -24 48 h 30 l -22 48"/>
      <path d="M 170 120 l -18 36 h 24 l -16 36"/>
      <path d="M 720 120 l -18 36 h 24 l -16 36"/>
    </g>
    <g fill="none" stroke="${INK}" stroke-opacity="0.45" stroke-width="7" stroke-linecap="round">
      <path d="M 350 120 Q 440 60 530 120"/><path d="M 380 160 Q 440 124 500 160"/>
    </g>`],

  'phys-measuring': ['#7fd4c1', `
    <g transform="rotate(-20 300 330)">
      <rect x="120" y="290" width="420" height="84" rx="10" fill="#ffd95c"/>
      ${Array.from({ length: 13 }, (_, i) => `<path d="M ${150 + i * 30} 290 v ${i % 2 === 0 ? 40 : 24}" stroke="${BG}" stroke-width="5"/>`).join('')}
    </g>
    <rect x="606" y="330" width="148" height="186" fill="#7fd4c1" fill-opacity="0.7"/>
    <path d="M 600 170 V 500 a 20 20 0 0 0 20 20 H 740 a 20 20 0 0 0 20 -20 V 170" fill="none" stroke="${INK}" stroke-width="12" stroke-linejoin="round"/>
    <path d="M 582 170 H 612 M 748 170 H 778" stroke="${INK}" stroke-width="12" stroke-linecap="round"/>
    ${[220, 270, 320, 370, 420, 470].map((y, i) => `<path d="M ${i % 2 === 0 ? 700 : 720} ${y} H 748" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`).join('')}`],

  'phys-machines': ['#d8b25e', `
    <g transform="rotate(40 440 330)">
      <rect x="420" y="170" width="40" height="390" rx="14" fill="#c98b5a"/>
      <rect x="340" y="110" width="200" height="90" rx="14" fill="${METAL}"/>
    </g>
    <g transform="rotate(-40 440 330)">
      <rect x="418" y="200" width="44" height="320" rx="16" fill="${INK}"/>
      <path d="M 404 113 A 62 62 0 1 0 476 113" fill="none" stroke="${INK}" stroke-width="40"/>
      <circle cx="440" cy="540" r="36" fill="${INK}"/><circle cx="440" cy="540" r="14" fill="${BG}"/>
    </g>`],

  'phys-forces': ['#e0724f', `
    <path d="M 250 130 V 210 M 630 130 V 210 M 200 200 V 260 M 680 200 V 260" stroke="${INK}" stroke-opacity="0.45" stroke-width="8" stroke-linecap="round"/>
    <path d="M 440 190 C 380 140 280 180 290 290 C 296 390 370 440 440 410 C 510 440 584 390 590 290 C 600 180 500 140 440 190 Z" fill="${RED}"/>
    <path d="M 330 250 C 336 215 356 196 384 190" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="12" stroke-linecap="round"/>
    <path d="M 440 190 C 440 150 455 125 480 110" stroke="#8a5a3a" stroke-width="12" fill="none" stroke-linecap="round"/>
    <path d="M 470 140 C 510 100 560 110 580 130 C 550 165 500 170 470 140 Z" fill="#8fe0a0"/>
    <path d="M 440 440 V 540" stroke="#ffd95c" stroke-width="18" stroke-linecap="round"/>
    <polygon points="404,530 476,530 440,590" fill="#ffd95c"/>
    <text x="500" y="560" fill="${INK}" font-family="system-ui, sans-serif" font-weight="700" font-style="italic" font-size="84">F</text>`],

  'phys-oscillations': ['#c48fe0', `
    <g fill="none" stroke="${INK}" stroke-linecap="round">
      <path d="M 380 110 V 280 A 60 60 0 0 0 500 280 V 110" stroke-width="34"/>
      <path d="M 440 340 V 440" stroke-width="34"/>
    </g>
    <circle cx="440" cy="462" r="30" fill="${INK}"/>
    <g fill="none" stroke="#c48fe0" stroke-width="9" stroke-linecap="round">
      <path d="M 330 130 q -24 40 0 80"/><path d="M 290 110 q -36 60 0 120"/>
      <path d="M 550 130 q 24 40 0 80"/><path d="M 590 110 q 36 60 0 120"/>
    </g>
    <path d="${sineWave(100, 560, 85, 26, 8)}" fill="none" stroke="#c48fe0" stroke-width="12" stroke-linecap="round"/>`],

  'phys-lenses': ['#7cc4ff', `
    <rect x="330" y="160" width="180" height="70" rx="16" fill="${BODY}" stroke="${INK}" stroke-width="10"/>
    <rect x="230" y="178" width="70" height="40" rx="8" fill="${RED}"/>
    <rect x="190" y="210" width="500" height="300" rx="36" fill="${BODY}" stroke="${INK}" stroke-width="10"/>
    <circle cx="440" cy="365" r="110" fill="${BG}" stroke="${INK}" stroke-width="14"/>
    <circle cx="440" cy="365" r="70" fill="#7cc4ff" fill-opacity="0.55"/>
    <path d="M 392 340 A 56 56 0 0 1 430 312" fill="none" stroke="#ffffff" stroke-opacity="0.75" stroke-width="10" stroke-linecap="round"/>
    <rect x="590" y="240" width="64" height="40" rx="8" fill="#ffd95c"/>`],

  'phys-reflection': ['#7fd4c1', `
    <polygon points="160,330 330,130 450,260 540,170 720,330" fill="${PALETTE.bodyEdge}"/>
    <polygon points="300,165 330,130 362,168 330,184" fill="${INK}"/>
    <polygon points="515,198 540,170 568,200 540,214" fill="${INK}"/>
    <polygon points="160,330 330,530 450,400 540,490 720,330" fill="${PALETTE.bodyEdge}" fill-opacity="0.32"/>
    <path d="M 110 330 H 770" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
    <g stroke="#7fd4c1" stroke-opacity="0.7" stroke-width="7" stroke-linecap="round">
      <path d="M 200 380 H 420"/><path d="M 380 430 H 640"/><path d="M 260 480 H 480"/><path d="M 540 530 H 680"/>
    </g>`],

  'phys-refraction': ['#7cc4ff', `
    <path d="M 570 70 L 474 300" stroke="${RED}" stroke-width="22" stroke-linecap="round"/>
    <path d="M 440 300 L 384 516" stroke="${RED}" stroke-width="26" stroke-linecap="butt"/>
    <polygon points="318,300 562,300 539,534 341,534" fill="#7cc4ff" fill-opacity="0.42"/>
    <path d="M 318 300 H 562" stroke="#7cc4ff" stroke-width="6"/>
    <path d="M 300 140 L 340 540 H 540 L 580 140" fill="none" stroke="${INK}" stroke-width="12" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M 346 200 L 362 380" stroke="#ffffff" stroke-opacity="0.5" stroke-width="10" stroke-linecap="round"/>`],

  // ─── Астрономия ────────────────────────────────────────────────────────

  'astro-planets': ['#ffb27c', `
    ${sparkles([[160, 140, 22], [730, 120, 28], [700, 500, 20], [180, 520, 16]])}
    <g transform="rotate(-20 440 330)">
      <path d="M 380 380 H 210 M 500 380 H 700" stroke="${METAL}" stroke-width="10" stroke-linecap="round"/>
      <rect x="160" y="362" width="64" height="36" rx="8" fill="${METAL}"/>
      <rect x="690" y="355" width="50" height="50" rx="6" fill="#ffb27c"/>
      <path d="M 440 425 V 530" stroke="${METAL}" stroke-width="6" stroke-linecap="round"/>
      <path d="M 340 268 L 440 205 L 540 268" fill="none" stroke="${METAL}" stroke-width="6"/>
      <path d="M 440 330 V 205" stroke="${METAL}" stroke-width="10"/>
      <circle cx="440" cy="200" r="14" fill="#ffb27c"/>
      <path d="M 290 245 Q 440 430 590 245 Z" fill="${INK}"/>
      <rect x="380" y="335" width="120" height="90" rx="10" fill="${BODY}" stroke="${INK}" stroke-width="8"/>
    </g>`],

  'astro-solar-system': ['#ff8a5c', `
    ${sparkles([[150, 170, 24], [720, 460, 26], [690, 140, 16], [210, 500, 18]])}
    <g transform="rotate(32 440 330)">
      <path d="M 390 430 C 400 520 430 540 440 600 C 450 540 480 520 490 430 Z" fill="#ffd95c"/>
      <path d="M 412 430 C 418 490 434 505 440 545 C 446 505 462 490 468 430 Z" fill="#ff8a5c"/>
      <path d="M 365 350 L 290 470 L 368 440 Z" fill="${RED}"/>
      <path d="M 515 350 L 590 470 L 512 440 Z" fill="${RED}"/>
      <path d="M 440 80 C 520 160 540 300 520 430 H 360 C 340 300 360 160 440 80 Z" fill="${INK}"/>
      <path d="M 440 80 C 476 116 497 152 508 190 H 372 C 383 152 404 116 440 80 Z" fill="${RED}"/>
      <circle cx="440" cy="270" r="42" fill="#7cc4ff" stroke="${BODY}" stroke-width="10"/>
    </g>`],

  'astro-small-bodies': ['#d8b25e', `
    <rect x="200" y="512" width="400" height="30" rx="10" fill="${BODY}" stroke="${METAL}" stroke-width="4"/>
    <polygon points="250,420 290,300 400,250 520,280 580,370 540,470 400,512 300,492" fill="#7d6a58" stroke="#a38d78" stroke-width="8" stroke-linejoin="round"/>
    <path d="M 400 250 L 420 380 L 540 470 M 420 380 L 290 300 M 420 380 L 300 492" fill="none" stroke="#5e4f41" stroke-width="6" stroke-linejoin="round"/>
    <path d="M 640 330 L 752 442" stroke="#d8b25e" stroke-width="40" stroke-linecap="round"/>
    <circle cx="560" cy="250" r="110" fill="#7cc4ff" fill-opacity="0.18" stroke="${INK}" stroke-width="22"/>
    <path d="M 492 222 A 74 74 0 0 1 540 180" fill="none" stroke="#ffffff" stroke-opacity="0.7" stroke-width="10" stroke-linecap="round"/>`],

  'astro-constellations': ['#7cc4ff', `
    ${sparkles([[690, 110, 26], [760, 250, 16], [600, 70, 14]])}
    <path d="M 440 330 L 320 570 M 440 330 L 440 580 M 440 330 L 560 570" stroke="${METAL}" stroke-width="16" stroke-linecap="round"/>
    <g transform="rotate(-30 440 300)">
      <rect x="196" y="280" width="64" height="40" rx="8" fill="${METAL}"/>
      <rect x="250" y="260" width="370" height="80" rx="14" fill="${INK}"/>
      <rect x="596" y="245" width="54" height="110" rx="10" fill="#7cc4ff"/>
    </g>
    <circle cx="440" cy="330" r="26" fill="${BODY}" stroke="${INK}" stroke-width="6"/>`],

  'astro-bright-stars': ['#ffd95c', `
    <circle cx="440" cy="310" r="110" fill="#ffd95c" fill-opacity="0.28"/>
    ${sparkle(440, 310, 210, '#fff4c2')}
    ${sparkle(190, 180, 64, '#9fd0ff')}
    ${sparkle(690, 470, 74, '#ffb27c')}
    ${sparkles([[680, 150, 30], [220, 500, 34], [120, 340, 16], [770, 320, 16]])}`],

  'astro-orientation': ['#7fd4c1', `
    <circle cx="440" cy="320" r="210" fill="${BODY}" stroke="${INK}" stroke-width="16"/>
    ${rays(440, 320, 176, 194, 16, INK, 6)}
    <g fill="${INK}" font-family="system-ui, sans-serif" font-weight="700" font-size="46" text-anchor="middle">
      <text x="440" y="186" fill="#7fd4c1">С</text><text x="440" y="486">Ю</text>
      <text x="292" y="336">З</text><text x="588" y="336">В</text>
    </g>
    <g transform="rotate(35 440 320)">
      <polygon points="440,205 468,320 412,320" fill="${RED}"/>
      <polygon points="440,435 468,320 412,320" fill="${INK}"/>
    </g>
    <circle cx="440" cy="320" r="14" fill="${BG}"/>
    <rect x="416" y="62" width="48" height="44" rx="12" fill="${INK}"/>`],

  'astro-earth-moon': ['#9fd0ff', `
    ${sparkles([[130, 130, 20], [760, 170, 24], [730, 60, 12]])}
    <path d="M 220 640 C 230 540 300 510 440 510 C 580 510 650 540 660 640 Z" fill="${INK}"/>
    <rect x="300" y="468" width="280" height="56" rx="22" fill="${METAL}"/>
    <circle cx="440" cy="296" r="192" fill="${INK}"/>
    <circle cx="256" cy="320" r="28" fill="#9fd0ff"/><circle cx="624" cy="320" r="28" fill="#9fd0ff"/>
    <rect x="296" y="200" width="288" height="196" rx="94" fill="#1b2b45" stroke="${METAL}" stroke-width="10"/>
    <path d="M 336 276 Q 352 236 408 226" fill="none" stroke="#ffffff" stroke-opacity="0.7" stroke-width="12" stroke-linecap="round"/>`],

  'astro-phases-eclipses': ['#c48fe0', `
    <path d="M 152 300 L 92 256 M 728 300 L 788 256" stroke="${INK}" stroke-width="30" stroke-linecap="round"/>
    <path d="M 190 230 H 690 a 40 40 0 0 1 40 40 V 390 a 40 40 0 0 1 -40 40 H 500 L 440 372 L 380 430 H 190 a 40 40 0 0 1 -40 -40 V 270 a 40 40 0 0 1 40 -40 Z" fill="${INK}"/>
    <rect x="190" y="270" width="220" height="120" rx="24" fill="#15101f"/>
    <rect x="470" y="270" width="220" height="120" rx="24" fill="#15101f"/>
    <g stroke="#c48fe0" stroke-opacity="0.75" stroke-width="9" stroke-linecap="round">
      <path d="M 232 360 L 292 300"/><path d="M 272 366 L 310 328"/>
      <path d="M 512 360 L 572 300"/><path d="M 552 366 L 590 328"/>
    </g>
    ${sparkles([[440, 252, 14], [250, 250, 9], [630, 250, 9]], '#c48fe0', 1)}`],

  'astro-moon-surface': ['#ffd95c', `
    ${sparkles([[150, 120, 18], [740, 150, 22]])}
    <path d="M 110 526 H 770" stroke="${METAL}" stroke-width="8" stroke-linecap="round"/>
    <path d="M 120 560 H 170 M 200 560 H 250" stroke="${METAL}" stroke-opacity="0.6" stroke-width="8" stroke-linecap="round"/>
    <path d="M 300 330 L 232 186" stroke="${METAL}" stroke-width="8" stroke-linecap="round"/>
    <circle cx="228" cy="176" r="26" fill="none" stroke="#ffd95c" stroke-width="8"/>
    <path d="M 320 322 L 380 212 H 680 L 620 322 Z" fill="${BODY}" stroke="#ffd95c" stroke-width="6" stroke-linejoin="round"/>
    <path d="M 440 322 L 490 212 M 550 322 L 590 212 M 350 267 H 650" stroke="#ffd95c" stroke-opacity="0.6" stroke-width="4"/>
    <path d="M 260 330 H 640 L 600 424 H 300 Z" fill="${METAL}" stroke="${INK}" stroke-width="8" stroke-linejoin="round"/>
    <circle cx="592" cy="372" r="14" fill="${BG}"/><circle cx="548" cy="372" r="14" fill="${BG}"/>
    ${[300, 400, 500, 600].map((x) => `<circle cx="${x}" cy="478" r="42" fill="${BODY}" stroke="${INK}" stroke-width="10"/><circle cx="${x}" cy="478" r="12" fill="${INK}"/>`).join('')}`],
};

fs.mkdirSync(OUT, { recursive: true });
for (const stale of fs.readdirSync(OUT)) fs.unlinkSync(path.join(OUT, stale));
for (const [name, [accent, body]] of Object.entries(THEMES)) {
  fs.writeFileSync(path.join(OUT, `${name}.svg`), frame(accent, body), 'utf8');
}
console.log(`эмблем тем: ${Object.keys(THEMES).length} → ${OUT}`);
