// packages/player/tools/bioiq/render-thematic.cjs
//
// SVG → PNG тем же Chromium, который показывает картинку в приложении.
//
// ПОЧЕМУ ИМЕННО ИМ, А НЕ СТОРОННИМ КОНВЕРТЕРОМ. Урок Типа 4: пробник рисовал
// сцену через file://, а приложение — через свой протокол, и пробник
// подтверждал то, чего в приложении не было. Здесь тот же принцип: если
// Chromium плеера чего-то не нарисует (не найдёт шрифт, не поймёт путь), это
// должно быть видно на сборке картинки, а не на занятии.
//
// ПУСТОЙ РЕЗУЛЬТАТ — ОШИБКА, А НЕ ФАЙЛ. PNG размером в пару сотен байт — это
// пустой прямоугольник; в поставке он выглядел бы как готовая иллюстрация.
//
// Запуск:
//   electron.exe tools/bioiq/render-thematic.cjs <каталог svg> <каталог png>

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const SVG_DIR = args[args.length - 2];
const PNG_DIR = args[args.length - 1];

/** Меньше этого размера PNG со схемой не бывает — значит, вышла пустая картинка */
const MIN_PNG_BYTES = 12000;

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  if (!SVG_DIR || !fs.existsSync(SVG_DIR)) {
    console.error('нет каталога с SVG: ' + SVG_DIR);
    app.exit(1);
    return;
  }
  fs.mkdirSync(PNG_DIR, { recursive: true });

  const names = fs.readdirSync(SVG_DIR).filter((n) => n.endsWith('.svg')).sort();
  if (names.length === 0) {
    console.error('в каталоге нет ни одного SVG: ' + SVG_DIR);
    app.exit(1);
    return;
  }

  // ОДНО ОКНО НА ВЕСЬ ПРОГОН, размер подгоняется под каждую схему.
  //
  // Создавать и закрывать окно на каждую картинку нельзя: цикл «создал —
  // снял — destroy()» роняет процесс целиком после первого снимка
  // («crashpad: not connected»), и наружу это выходит как «вышла одна
  // картинка из шести». С offscreen:true — то же самое.
  const win = new BrowserWindow({ width: 800, height: 600, show: false, useContentSize: true });

  const failed = [];
  let made = 0;

  for (const name of names) {
    const svg = fs.readFileSync(path.join(SVG_DIR, name), 'utf-8');
    const m = svg.match(/width="(\d+)"\s+height="(\d+)"/);
    if (!m) {
      failed.push(`${name}: в SVG не указаны width/height`);
      continue;
    }
    const width = Number(m[1]);
    const height = Number(m[2]);
    win.setContentSize(width, height);

    // Страница-обёртка: SVG во весь холст, без полей и без полосы прокрутки —
    // иначе снимок получает рамку страницы и сдвиг на пару пикселей.
    //
    // Через ФАЙЛ, а не data:-URL: схема на полсотни примитивов даёт URL под
    // сотню килобайт, а такой Chromium не берёт.
    const html =
      '<!doctype html><meta charset="utf-8">' +
      '<style>html,body{margin:0;padding:0;overflow:hidden;background:#0d1620}svg{display:block}</style>' +
      svg;
    // Имя временного файла СВОЁ на каждую картинку. При одном общем имени
    // вторая загрузка того же пути возвращает ERR_FAILED (-2): содержимое
    // сменилось, а URL остался прежним.
    const htmlPath = path.join(PNG_DIR, '.render-' + name.replace(/\.svg$/, '') + '.html');
    fs.writeFileSync(htmlPath, html, 'utf-8');
    try {
      await win.loadFile(htmlPath);
    } catch (err) {
      failed.push(`${name}: страница не загрузилась — ${err && err.message}`);
      continue;
    }
    // Шрифты подставляются не мгновенно; без паузы подписи попадают на снимок
    // запасной гарнитурой и разъезжаются по ширине.
    await new Promise((r) => setTimeout(r, 400));

    const png = (await win.webContents.capturePage()).toPNG();
    const outPath = path.join(PNG_DIR, name.replace(/\.svg$/, '.png'));

    if (png.length < MIN_PNG_BYTES) {
      failed.push(`${name}: результат ${png.length} байт — картинка пустая`);
      continue;
    }
    fs.writeFileSync(outPath, png);
    made += 1;
    console.log(`${name} → ${path.basename(outPath)} (${width}×${height}, ${Math.round(png.length / 1024)} КБ)`);
  }

  win.destroy();
  for (const n of fs.readdirSync(PNG_DIR)) {
    if (n.startsWith('.render-') && n.endsWith('.html')) fs.unlinkSync(path.join(PNG_DIR, n));
  }

  console.log(`\nPNG: сделано ${made}, не вышло ${failed.length}`);
  for (const f of failed) console.log('  ' + f);
  app.exit(failed.length > 0 ? 1 : 0);
});
