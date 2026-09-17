// packages/player/tools/physastroiq/draw-levels.mjs
//
// Рисует игровые карты уровней и отдаёт КООРДИНАТЫ СТРУКТУР в
// structures-<предмет>.json. Сами карты описаны в levels-physics.mjs и
// levels-astro.mjs, общий каркас и проверки — в level-plate.mjs.
//
// ПОЧЕМУ ДВА НАБОРА КАРТ, А НЕ ОДИН. У Типа 11 предмет два (FR-004, строка
// 325: «Предмет — физика, астрономия»), и у каждого своя готовая викторина
// (FR-021, строка 342). Общая карта на два предмета означала бы, что вопрос
// по астрономии показывает электрическую цепь.
//
// Запуск:
//   node tools/physastroiq/draw-levels.mjs physics [каталог вывода]
//   node tools/physastroiq/draw-levels.mjs astro   [каталог вывода]
//   node tools/physastroiq/draw-levels.mjs all     [каталог вывода]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPlacement } from './level-plate.mjs';
import physics from './levels-physics.mjs';
import astro from './levels-astro.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SUBJECTS = { physics, astro };

const which = process.argv[2] || 'all';
const OUT = process.argv[3] || path.join(HERE, 'levelsvg');

const chosen = which === 'all' ? Object.values(SUBJECTS) : [SUBJECTS[which]];
if (chosen.some((s) => !s)) {
  console.error(`неизвестный предмет: ${which}. Ожидается physics, astro или all`);
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });
let ok = true;

for (const subject of chosen) {
  console.log(`\n${subject.title} (${subject.id})`);
  const meta = {};
  for (const [id, make] of Object.entries(subject.levels)) {
    const { svg, meta: m } = make();
    if (!checkPlacement(id, m)) ok = false;
    // Имя SVG совпадает с именем будущего PNG: render-thematic.cjs просто
    // меняет расширение, и разойтись им негде.
    const fileName = `${subject.prefix}_level${id}_map`;
    fs.writeFileSync(path.join(OUT, `${fileName}.svg`), svg, 'utf-8');
    meta[id] = { ...m, fileName: `${fileName}.png` };
    console.log(
      `  уровень ${id} «${m.title}»: структур ${m.structures.length}, точек без привязки ${m.decoys.length}`
    );
  }
  const metaPath = path.join(HERE, `structures-${subject.id}.json`);
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
  console.log(`  координаты: ${path.basename(metaPath)}`);
}

if (!ok) process.exit(1);
