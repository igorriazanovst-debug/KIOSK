// packages/inophone-library/tools/make-illustrations.mjs
// Превращает сгенерированные JPG в файлы пакета контента.
//
// ПОЧЕМУ РАСТР ВНУТРИ SVG. Раскладка пакета жёстко задаёт расширение .svg
// (conceptImagePath в resources.ts), на неё опираются проверка комплектности и
// контракт с будущей Android-реализацией. Менять расширение — значит править
// контракт для обеих платформ. Поэтому картинка кладётся ВНУТРЬ svg-обёртки
// как data-URI: контракт цел, проверка проходит, Chromium рисует её как
// обычную картинку. Приём взят у Типа 2.
//
// ПРОЗРАЧНЫЙ ФОН ЗДЕСЬ ОБЯЗАТЕЛЕН, а не желателен. У Типа 2 картинка лежала на
// белой карточке, и остаток фона был бы незаметен. Здесь предмет ставится на
// подложку сцены: непрозрачный прямоугольник вокруг него превратил бы сцену в
// набор наклеек и выдал бы границы хотспота — ученик искал бы не предмет, а
// край плашки.
//
// `format=rgba` СТОИТ ПЕРЕД `scale`, И ЭТО НЕ ПЕРЕСТАНОВКА РАДИ ПОРЯДКА. В
// обратном порядке альфа теряется, и пурпурный фон возвращается — на Типе 3
// это стоило контрольного листа, который выглядел сплошь пурпурным.
//
// ЗАГЛУШКУ НЕ ТРОГАЕМ НАОБОРОТ: этот скрипт ЗАМЕЩАЕТ заглушки настоящими
// рисунками, поэтому пишет поверх без оглядки на содержимое. Обратную защиту
// (не затирать рисунок заглушкой) держит build.mjs.
//
// Запуск: node tools/make-illustrations.mjs <каталог с jpg> [путь к ffmpeg]

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ASSETS = path.join(ROOT, 'assets');

const srcDir = path.resolve(process.argv[2] ?? '');
const FF = process.argv[3] || 'ffmpeg';
if (!srcDir || !fs.existsSync(srcDir)) {
  console.error('Запуск: node tools/make-illustrations.mjs <каталог с jpg> [путь к ffmpeg]');
  process.exit(1);
}

const { inophone } = createRequire(import.meta.url)(path.resolve(ROOT, '../shared/dist/index.js'));

const TMP = path.join(srcDir, '.tmp');
fs.mkdirSync(TMP, { recursive: true });

const W = 1024;
const H = 1024;
const ALPHA_THRESHOLD = 24;
/** Итоговая сторона: на сцене предмет не крупнее 300 px, берём с запасом */
const TARGET = 512;

/** Рамка непрозрачной области — чтобы предмет занимал картинку целиком */
function contentBox(pngPath) {
  const raw = execFileSync(
    FF,
    ['-hide_banner', '-loglevel', 'error', '-i', pngPath,
     '-vf', 'alphaextract', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'],
    { maxBuffer: 1 << 28 }
  );
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
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

function makeOne(srcJpg, outSvg) {
  const base = path.basename(srcJpg, '.jpg');
  const keyed = path.join(TMP, `${base}-keyed.png`);

  // Порог 0.30 и эрозия — те же значения, что у Типов 2 и 3. Выше порог
  // поднимать нельзя: съедаются тёмные контуры рисунка
  execFileSync(FF, ['-hide_banner', '-loglevel', 'error', '-y', '-i', srcJpg,
    '-filter_complex',
    'colorkey=0xFF00FF:0.30:0.05,format=rgba,split[m][a];[a]alphaextract,erosion[e];[m][e]alphamerge',
    '-frames:v', '1', keyed]);

  const box = contentBox(keyed);
  if (!box) throw new Error('после вырезания фона не осталось изображения');

  // Квадрат вокруг предмета. На сцене предметы стоят в прямоугольных ячейках
  // разной формы, и картинка вписывается в них через preserveAspectRatio;
  // квадратный исходник ведёт себя предсказуемо в любой ячейке
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
  return { bytes: svg.length, side: Math.round(side) };
}

// Понятия берутся ИЗ ПАКЕТА: картинка, которой нет в index.json, в пакет не
// нужна, а её появление означает, что каталог и рисунки разъехались
const library = JSON.parse(fs.readFileSync(path.join(ROOT, 'index.json'), 'utf8'));
const known = new Set(library.concepts.map((c) => c.id));

let made = 0;
let failed = 0;
const strangers = [];

for (const file of fs.readdirSync(srcDir).filter((f) => f.endsWith('.jpg')).sort()) {
  const id = path.basename(file, '.jpg');
  if (!known.has(id)) {
    strangers.push(id);
    continue;
  }
  const out = path.join(ASSETS, inophone.conceptImagePath(id));
  try {
    const r = makeOne(path.join(srcDir, file), out);
    made += 1;
    if (made % 50 === 0) console.log(`  обработано ${made}`);
  } catch (err) {
    console.log(`${id}: СБОЙ — ${err.message}`);
    failed += 1;
  }
}

fs.rmSync(TMP, { recursive: true, force: true });
console.log(`картинок в пакет: ${made}, сбоев: ${failed}`);
if (strangers.length > 0) {
  console.log(`не из этого пакета (${strangers.length}): ${strangers.slice(0, 20).join(', ')}`);
}
