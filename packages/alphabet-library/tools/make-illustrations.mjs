// packages/alphabet-library/tools/make-illustrations.mjs
// Превращает сгенерированные JPG в файлы пакета контента.
//
// ПОЧЕМУ РАСТР ВНУТРИ SVG. Раскладка пакета жёстко задаёт расширение .svg
// (wordImagePath в resources.ts), на него опираются проверка комплектности и
// контракт с будущей Android-реализацией. Менять расширение ради замены
// заглушек несоразмерно: пришлось бы править контракт для обеих платформ.
//
// Поэтому картинка кладётся ВНУТРЬ svg-обёртки как data-URI. Контракт цел,
// проверка комплектности проходит, Chromium такой файл рисует как обычную
// картинку. Когда появится настоящая векторная графика, файлы заменяются один
// в один, и обёртка исчезнет. Для нативной Android-реализации это важно: её
// рендерер SVG должен уметь встроенный WebP.
//
// ФОН ВЫРЕЗАЕТСЯ ПО ПУРПУРНОМУ. Модель просят рисовать на #FF00FF — цвете,
// который в детской иллюстрации не встречается, — и здесь он становится
// прозрачностью.
//
// ПОРОГ 0.36, А НЕ 0.30, КАК В ТИП 2. При 0.30 по краю рисунка оставалась
// заметная пурпурная кайма от артефактов JPEG. Опасение «выше нельзя, съест
// тёмные контуры» проверено замером: на эталонной картинке непрозрачная
// площадь при 0.30 — 210 448 пикселей, при 0.36 — 210 105, то есть теряется
// 0,16 %, а кайма уходит целиком. При 0.42 потери уже 2,6 % — вот там контуры
// действительно начинают страдать.
//
// Запуск: node tools/make-illustrations.mjs <каталог с jpg> <корень пакета> [путь к ffmpeg]

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const srcDir = path.resolve(process.argv[2]);
const pkgRoot = path.resolve(process.argv[3]);
// ffmpeg параметром: своей сборки в репозитории нет
const FF = process.argv[4] || 'ffmpeg';
const TMP = path.join(srcDir, '.tmp');
fs.mkdirSync(TMP, { recursive: true });

const W = 1024;
const H = 1024;
const ALPHA_THRESHOLD = 24;
/** Итоговая сторона: карточка в игре не больше 300 px, берём с запасом под Retina */
const TARGET = 512;

/** Рамка непрозрачной области — чтобы предмет занимал карточку целиком */
function contentBox(pngPath) {
  const raw = execFileSync(
    FF,
    ['-hide_banner', '-loglevel', 'error', '-i', pngPath,
      '-vf', 'alphaextract', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'],
    { maxBuffer: 1 << 28 }
  );
  let x0 = W;
  let y0 = H;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (raw[y * W + x] > ALPHA_THRESHOLD) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 <= x0 || y1 <= y0) return null;
  return { x0, y0, x1, y1 };
}

// Имя не process: так называется глобальный объект Node, и локальная функция
// его затеняет — argv становится недоступен
function makeOne(srcJpg, outSvg) {
  const base = path.basename(srcJpg, '.jpg');
  const keyed = path.join(TMP, `${base}-keyed.png`);

  execFileSync(FF, ['-hide_banner', '-loglevel', 'error', '-y', '-i', srcJpg,
    '-filter_complex',
    'colorkey=0xFF00FF:0.36:0.05,format=rgba,split[m][a];[a]alphaextract,erosion[e];[m][e]alphamerge',
    '-frames:v', '1', keyed]);

  const box = contentBox(keyed);
  if (!box) throw new Error('после вырезания фона не осталось изображения');

  // Квадрат вокруг предмета: карточки в игре квадратные, и разные пропорции
  // смотрелись бы вразнобой
  const pad = 16;
  const cx = (box.x0 + box.x1) / 2;
  const cy = (box.y0 + box.y1) / 2;
  const side = Math.min(W, H, Math.max(box.x1 - box.x0, box.y1 - box.y0) + pad * 2);
  const left = Math.max(0, Math.min(W - side, Math.round(cx - side / 2)));
  const top = Math.max(0, Math.min(H - side, Math.round(cy - side / 2)));

  const webp = path.join(TMP, `${base}.webp`);
  execFileSync(FF, ['-hide_banner', '-loglevel', 'error', '-y', '-i', keyed,
    '-vf', `crop=${Math.round(side)}:${Math.round(side)}:${left}:${top},scale=${TARGET}:${TARGET}:flags=lanczos`,
    '-c:v', 'libwebp', '-quality', '90', '-compression_level', '6', '-frames:v', '1', webp]);

  const b64 = fs.readFileSync(webp).toString('base64');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TARGET} ${TARGET}" width="${TARGET}" height="${TARGET}">` +
    `<image href="data:image/webp;base64,${b64}" width="${TARGET}" height="${TARGET}"/>` +
    `</svg>\n`;
  fs.mkdirSync(path.dirname(outSvg), { recursive: true });
  fs.writeFileSync(outSvg, svg, 'utf8');
  return { bytes: svg.length, box: `${Math.round(side)}px` };
}

let done = 0;
let failed = 0;
let total = 0;
for (const file of fs.readdirSync(srcDir).filter((f) => f.endsWith('.jpg')).sort()) {
  const id = path.basename(file, '.jpg');
  const out = path.join(pkgRoot, 'assets', 'img', `${id}.svg`);
  try {
    const r = makeOne(path.join(srcDir, file), out);
    total += r.bytes;
    console.log(`${id} → ${(r.bytes / 1024).toFixed(1)} КБ, кроп ${r.box}`);
    done += 1;
  } catch (err) {
    console.log(`${id}: СБОЙ — ${err.message}`);
    failed += 1;
  }
}

fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\nГотово: ${done}, сбоев: ${failed}, суммарно ${(total / 1024 / 1024).toFixed(2)} МБ`);
