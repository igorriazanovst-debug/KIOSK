// packages/player/tools/bioiq/draw-question-themes.mjs
//
// Иллюстрация к вопросу (FR-009, FR-016) — одна нейтральная картинка на ТЕМУ,
// то же решение, что у «ХимIQ» (chimiq/questionThemeImages.ts).
//
// ЧЕГО ЗДЕСЬ НЕЛЬЗЯ РИСОВАТЬ. Ответ в «БиоIQ» — найти структуру на схеме по
// её форме. Пиктограмма лёгких над вопросом показала бы, как выглядят лёгкие,
// то есть подсказала бы ответ. Поэтому на эмблемах нет ни одной структуры,
// которая бывает ответом: только ассоциации с темой — прибор, явление,
// предмет (микроскоп, солнце, пчела, пульс, яблоко, капля).
//
// Запуск:
//   node tools/bioiq/draw-question-themes.mjs
//   electron.exe tools/bioiq/render-thematic.cjs tools/bioiq/themesvg public/bioiq/questionThemes

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] || path.join(HERE, 'themesvg');
const W = 880;
const H = 640;

const frame = (accent, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="glow" cx="50%" cy="46%" r="60%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="dots" width="40" height="40" patternUnits="userSpaceOnUse">
      <circle cx="20" cy="20" r="2.5" fill="${accent}" fill-opacity="0.22"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" rx="48" fill="#0f1a2b"/>
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

const circles = (items, attrs) => items.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" ${attrs}/>`).join('');

const THEMES = {
  'cell-structure': ['#7cc4ff', `
    <g stroke-linecap="round" stroke-linejoin="round">
      <rect x="300" y="500" width="300" height="34" rx="17" fill="#7cc4ff"/>
      <path d="M 560 500 C 660 420 640 250 520 210" fill="none" stroke="#7cc4ff" stroke-width="30"/>
      <g transform="rotate(28 430 270)">
        <rect x="396" y="120" width="68" height="250" rx="16" fill="#e8f1ff"/>
        <rect x="406" y="84" width="48" height="50" rx="10" fill="#7cc4ff"/>
        <rect x="410" y="370" width="40" height="46" rx="8" fill="#7cc4ff"/>
      </g>
      <rect x="300" y="420" width="190" height="20" rx="10" fill="#e8f1ff"/>
      <circle cx="560" cy="500" r="26" fill="#e8f1ff"/>
    </g>`],

  organelles: ['#c9a0ff', `
    <circle cx="400" cy="290" r="170" fill="#1b2740" stroke="#e8f1ff" stroke-width="26"/>
    <path d="M 522 412 L 660 550" stroke="#c9a0ff" stroke-width="46" stroke-linecap="round"/>
    ${circles([[330, 240, 20], [470, 310, 24], [410, 280, 10]], 'fill="#c9a0ff" fill-opacity="0.9"')}
    ${circles([[440, 210, 14], [360, 350, 16]], 'fill="#7cc4ff" fill-opacity="0.9"')}
    ${circles([[300, 310, 12], [450, 380, 12]], 'fill="#ffd27c" fill-opacity="0.9"')}
    <path d="M 290 220 A 140 140 0 0 1 380 160" fill="none" stroke="#ffffff" stroke-opacity="0.6" stroke-width="12" stroke-linecap="round"/>`],

  'plant-vs-animal': ['#8fe0a0', `
    <g fill="#ffb27c">
      <ellipse cx="270" cy="370" rx="78" ry="66"/>
      <ellipse cx="170" cy="280" rx="34" ry="44"/><ellipse cx="240" cy="230" rx="34" ry="46"/>
      <ellipse cx="320" cy="232" rx="34" ry="46"/><ellipse cx="382" cy="288" rx="32" ry="42"/>
    </g>
    <path d="M 440 160 L 440 480" stroke="#e8f1ff" stroke-opacity="0.5" stroke-width="6" stroke-dasharray="14 16"/>
    <rect x="570" y="400" width="130" height="90" rx="12" fill="#c98b5a"/>
    <rect x="552" y="380" width="166" height="34" rx="10" fill="#e0a674"/>
    <path d="M 635 380 C 635 320 630 280 636 230" stroke="#8fe0a0" stroke-width="12" fill="none" stroke-linecap="round"/>
    <path d="M 636 300 C 560 300 540 250 548 214 C 600 214 640 250 636 300 Z" fill="#8fe0a0"/>
    <path d="M 636 260 C 712 258 736 208 726 172 C 674 174 634 210 636 260 Z" fill="#6fcf86"/>`],

  'plant-organs': ['#9be27a', `
    <circle cx="660" cy="190" r="70" fill="#ffd95c"/>
    ${rays(660, 190, 94, 130, 10, '#ffd95c', 12)}
    <g fill="#7cc4ff">
      <path d="M 200 330 L 420 330 L 400 500 L 220 500 Z"/>
      <path d="M 420 360 L 560 290 L 572 312 L 420 410 Z"/>
      <ellipse cx="572" cy="296" rx="26" ry="18" transform="rotate(-28 572 296)"/>
    </g>
    <path d="M 200 350 C 120 340 120 470 214 470" fill="none" stroke="#7cc4ff" stroke-width="22"/>
    ${[[600, 360], [624, 410], [590, 450], [640, 480]].map(([x, y]) => `<path d="M ${x} ${y} q 10 18 0 26 q -10 -8 0 -26 z" fill="#bfe4ff"/>`).join('')}
    <rect x="120" y="520" width="640" height="16" rx="8" fill="#9be27a" fill-opacity="0.7"/>`],

  leaf: ['#ffd95c', `
    <circle cx="250" cy="240" r="90" fill="#ffd95c"/>
    ${rays(250, 240, 116, 160, 12, '#ffd95c', 14)}
    <g fill="none" stroke-width="16" stroke-linecap="round">
      <path d="M 400 330 C 480 380 540 400 620 400" stroke="#ffe9a0"/>
      <path d="M 596 374 L 626 400 L 592 424" stroke="#ffe9a0"/>
      <path d="M 640 470 C 560 520 470 520 390 480" stroke="#8fe0a0"/>
      <path d="M 414 454 L 386 480 L 420 504" stroke="#8fe0a0"/>
    </g>
    <g font-family="system-ui, sans-serif" font-weight="700" font-size="54">
      <text x="660" y="500" fill="#e8f1ff">CO₂</text><text x="290" y="560" fill="#8fe0a0">O₂</text>
    </g>`],

  flower: ['#ffc94d', `
    <g transform="translate(440 320)">
      <ellipse cx="-60" cy="-96" rx="96" ry="54" fill="#dff1ff" fill-opacity="0.85" transform="rotate(-24 -60 -96)"/>
      <ellipse cx="70" cy="-104" rx="96" ry="54" fill="#dff1ff" fill-opacity="0.85" transform="rotate(20 70 -104)"/>
      <ellipse cx="0" cy="0" rx="170" ry="112" fill="#ffc94d"/>
      <path d="M -60 -104 C -40 -20 -40 20 -60 104 M 10 -112 C 30 -30 30 30 10 112 M 80 -98 C 96 -30 96 30 80 98" stroke="#2a2030" stroke-width="30" fill="none"/>
      <circle cx="-150" cy="-10" r="62" fill="#2a2030"/>
      <circle cx="-176" cy="-26" r="12" fill="#ffffff"/>
      <path d="M -190 -60 C -220 -110 -250 -110 -262 -96 M -158 -68 C -170 -120 -200 -132 -216 -122" stroke="#2a2030" stroke-width="10" fill="none" stroke-linecap="round"/>
      <path d="M 168 0 L 214 0" stroke="#2a2030" stroke-width="16" stroke-linecap="round"/>
    </g>
    ${circles([[170, 470, 9], [250, 520, 9], [690, 150, 9], [740, 220, 9]], 'fill="#ffc94d" fill-opacity="0.7"')}`],

  seed: ['#e0b070', `
    <g transform="rotate(-6 440 320)">
      <rect x="290" y="110" width="300" height="420" rx="22" fill="#f4e7c8"/>
      <rect x="290" y="400" width="300" height="130" fill="#c98b5a"/>
      <rect x="290" y="508" width="300" height="22" fill="#a86f42"/>
      <circle cx="440" cy="270" r="92" fill="#8fce7a"/>
      <g fill="#f4e7c8">${[[410, 240], [470, 252], [436, 290], [400, 302], [478, 308]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="15" ry="10" transform="rotate(30 ${x} ${y})"/>`).join('')}</g>
      <rect x="350" y="436" width="180" height="16" rx="8" fill="#f4e7c8"/>
      <rect x="380" y="468" width="120" height="12" rx="6" fill="#f4e7c8" fill-opacity="0.7"/>
    </g>`],

  respiratory: ['#9fd8ff', `
    <g fill="none" stroke="#e8f6ff" stroke-width="26" stroke-linecap="round">
      <path d="M 150 230 H 520 C 610 230 610 120 530 120 C 480 120 470 170 500 190"/>
      <path d="M 150 330 H 660 C 760 330 760 450 670 450 C 620 450 610 400 640 384"/>
      <path d="M 150 430 H 440 C 520 430 520 530 450 530 C 410 530 404 490 426 478"/>
    </g>
    ${circles([[690, 180, 18], [740, 240, 12], [600, 540, 14], [250, 530, 10]], 'fill="none" stroke="#9fd8ff" stroke-width="6"')}`],

  circulation: ['#ff7c7c', `
    <path d="M 90 340 H 280 L 330 240 L 400 470 L 470 150 L 540 420 L 580 340 H 790" fill="none" stroke="#ff7c7c" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M 660 90 C 700 150 724 180 724 216 A 64 64 0 0 1 596 216 C 596 180 620 150 660 90 Z" fill="#ff5a5a"/>
    <path d="M 628 216 A 34 34 0 0 0 650 250" fill="none" stroke="#ffd0d0" stroke-width="10" stroke-linecap="round"/>
    ${circles([[160, 470, 16], [250, 520, 16], [700, 480, 16]], 'fill="#ff7c7c" fill-opacity="0.55"')}`],

  digestive: ['#ffa05c', `
    <path d="M 330 250 C 250 250 210 320 230 410 C 250 500 330 540 380 500 C 430 540 510 500 530 410 C 550 320 510 250 430 250 C 400 250 392 262 380 270 C 368 262 360 250 330 250 Z" fill="#ff6b5c"/>
    <path d="M 380 270 C 376 220 392 180 430 160" fill="none" stroke="#7a4a2a" stroke-width="16" stroke-linecap="round"/>
    <path d="M 430 190 C 480 150 540 160 556 200 C 510 230 460 226 430 190 Z" fill="#8fe0a0"/>
    <path d="M 270 340 C 262 390 280 440 310 466" fill="none" stroke="#ffc2b8" stroke-width="14" stroke-linecap="round"/>
    <g stroke="#e8f1ff" stroke-width="18" stroke-linecap="round" fill="none">
      <path d="M 650 330 V 540"/><path d="M 614 140 V 250 C 614 300 686 300 686 250 V 140"/><path d="M 650 140 V 250"/>
    </g>`],

  excretory: ['#6cc8ff', `
    <path d="M 300 110 C 370 210 410 264 410 330 A 110 110 0 0 1 190 330 C 190 264 230 210 300 110 Z" fill="#4db4f5"/>
    <path d="M 240 330 A 60 60 0 0 0 286 388" fill="none" stroke="#d6efff" stroke-width="14" stroke-linecap="round"/>
    <path d="M 520 200 L 560 540 H 720 L 760 200 Z" fill="#1b2a44" stroke="#e8f1ff" stroke-width="12" stroke-linejoin="round"/>
    <path d="M 537 340 L 558 528 H 722 L 743 340 C 700 320 670 360 640 340 C 610 320 580 356 537 340 Z" fill="#4db4f5"/>
    ${circles([[610, 430, 10], [670, 470, 7], [650, 400, 6]], 'fill="#d6efff" fill-opacity="0.8"')}`],
};

fs.mkdirSync(OUT, { recursive: true });
for (const [name, [accent, body]] of Object.entries(THEMES)) {
  fs.writeFileSync(path.join(OUT, `${name}.svg`), frame(accent, body), 'utf-8');
}
console.log(`эмблем тем: ${Object.keys(THEMES).length} → ${OUT}`);
