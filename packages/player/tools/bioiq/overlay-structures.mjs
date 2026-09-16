// packages/player/tools/bioiq/overlay-structures.mjs
//
// Отладочная версия карты уровня: поверх рисунка накладываются кликабельные
// области с именами. В поставку НЕ едет — только чтобы посмотреть глазами,
// лежит ли область на своём объекте.
//
// ЗАЧЕМ. Проверить это иначе нечем. Автоматическая проверка знает про
// наложение областей друг на друга (model/completeness.ts), но не знает, что
// нарисовано под областью: прямоугольник с именем «митохондрия», лежащий на
// пустой цитоплазме, для неё безупречен. Урок Типа 4 — два дефекта из двух
// нашлись просмотром картинок, а не прогоном.
//
// Запуск: node tools/bioiq/overlay-structures.mjs <каталог svg уровней> <каталог вывода>

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = process.argv[2] || path.join(HERE, 'levelsvg');
const OUT = process.argv[3] || path.join(HERE, 'overlay');

const meta = JSON.parse(fs.readFileSync(path.join(HERE, 'structures.json'), 'utf-8'));
fs.mkdirSync(OUT, { recursive: true });

for (const [id, level] of Object.entries(meta)) {
  const svgPath = path.join(SRC, `level${id}.svg`);
  if (!fs.existsSync(svgPath)) {
    console.error(`нет рисунка уровня ${id}: ${svgPath}`);
    process.exitCode = 1;
    continue;
  }
  const svg = fs.readFileSync(svgPath, 'utf-8');

  const marks = [];
  for (const s of level.structures) {
    marks.push(`<rect x="${s.x}" y="${s.y}" width="${s.width}" height="${s.height}" fill="rgba(120,220,180,0.16)" stroke="#7fd4c1" stroke-width="2"/>
    <text x="${s.x + 4}" y="${s.y + 16}" fill="#d9f6ee" font-size="13" font-family="system-ui, sans-serif">${s.label}</text>`);
  }
  for (const d of level.decoys) {
    marks.push(`<rect x="${d.x}" y="${d.y}" width="${d.width}" height="${d.height}" fill="rgba(230,150,120,0.16)" stroke="#e08b6e" stroke-width="2" stroke-dasharray="6 4"/>`);
  }

  const out = svg.replace('</svg>', marks.join('\n  ') + '\n</svg>');
  fs.writeFileSync(path.join(OUT, `level${id}.svg`), out, 'utf-8');
  console.log(`уровень ${id}: областей ${level.structures.length} + обманок ${level.decoys.length}`);
}
console.log(`\nотладочные рисунки: ${OUT}`);
